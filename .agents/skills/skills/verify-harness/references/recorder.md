---
name: recorder
description: The evidence recorder pattern — a no-op-by-default hook in the transport layer, JSONL output with fingerprinted secrets, and a resumable long-measurement loop. Copy these shapes when building a sandbox harness.
---

# 証跡レコーダの型

**最初から仕込む。** あとから足すと、一番欲しかった最初の run が記録なしで終わる。

## 1. 通信層にフックを置く

既定では何もしない。記録したいときだけ差し込む。
**通常動作を変えないので、本番相当のコードにそのまま入れられる。**

```ts
// client.ts
export type Exchange = {
  timestamp: string
  request: { method: string; url: string; headers: Record<string, string>; form: Record<string, string> }
  response: { status: number; statusText: string; headers: Record<string, string>; body: unknown }
  durationMs: number
}

let recorder: ((e: Exchange) => void) | null = null
export function setRecorder(fn: ((e: Exchange) => void) | null) { recorder = fn }

async function post(url: string, form: Record<string, string>, headers: Record<string, string>) {
  const startedAt = Date.now()
  const res = await fetch(url, { method: 'POST', headers, body: new URLSearchParams(form).toString() })
  const durationMs = Date.now() - startedAt

  const text = await res.text()
  let body: unknown
  try { body = JSON.parse(text) } catch { body = { _raw: text } }

  recorder?.({
    timestamp: new Date(startedAt).toISOString(),
    request: { method: 'POST', url, headers, form },
    response: {
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries()),  // ← 全部残す
      body,
    },
    durationMs,
  })

  // 例外を投げない。400 も観測結果
  return { status: res.status, headers: res.headers, body }
}
```

**`recorder?.()` を通らない送信を作らない。** 直で `fetch` を書いた瞬間に穴が空く。

## 2. 秘密は指紋に置き換える

消すのではなく、**不可逆なハッシュ**にする。同一性と差異が証明できる形で残す。

```ts
import { appendFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'

const SECRETS = ['client_secret', 'refresh_token', 'access_token', 'id_token']

const fingerprint = (v: string) => ({
  _redacted_len: v.length,
  _sha256_16: createHash('sha256').update(v).digest('hex').slice(0, 16),
})

function scrub(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(scrub)
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) =>
        [k, SECRETS.includes(k) && typeof v === 'string' ? fingerprint(v) : scrub(v)],
      ),
    )
  }
  return obj
}

export function startRecording(name: string) {
  mkdirSync('data', { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const safe = `data/evidence-${name}-${stamp}.jsonl`       // 共有してよい
  const raw  = `data/evidence-${name}-${stamp}.raw.jsonl`   // 手元限定
  let seq = 0

  setRecorder((e) => {
    seq += 1
    appendFileSync(raw,  JSON.stringify({ seq, ...e }) + '\n')
    appendFileSync(safe, JSON.stringify({ seq, ...(scrub(e) as object) }) + '\n')
  })

  return () => { setRecorder(null); return { safe, raw, seq } }
}
```

### 指紋にすると何が言えるか

| 観測 | 言えること |
| --- | --- |
| `refresh_token` の指紋が全記録で同一 | **同じトークンに対する再送**だと証明できる |
| `access_token` の指紋が毎回違う | キャッシュや no-op ではなく**本当に再発行**されている |
| 送信ボディのハッシュが一致 | **同一バイト列を送った**証拠 |

`<redacted>` で潰すと、この 3 つが全部言えなくなる。

### 伏せないもの

報告を受けた相手が**検証できなくなる**ので、これらは残す。

- 署名付きトークンの本文（公開鍵と署名しか入っていない場合）
- サーバーが発行した使い捨て値（nonce, challenge）
- クライアント識別子（相手が調査に使う）

> ⚠️ 「伏せ字あり」＝「公開してよい」ではない。クライアント識別子が平文なら、
> それは**報告先にだけ渡すもの**。記事やリポジトリには載せない。

## 3. 中断・再開できる長時間測定

```ts
type Run = {
  subject: string          // 測定対象（proof, token など）を丸ごと保存
  createdAt: number
  probes: { minutes: number; elapsedSeconds: number; status: number; error: string }[]
}

const PROBE_MINUTES = [0, 1, 2, 5, 10, 20, 30, 45, 55, 59, 61]
const STATE = 'data/lifetime-state.json'

// 再開: 保存済みなら読む。古すぎるなら作り直す
let run: Run = load(STATE) ?? await startNewRun()
const done = new Set(run.probes.map((p) => p.minutes))

for (const minutes of PROBE_MINUTES) {
  if (done.has(minutes)) continue

  // 止めている間に過ぎていたら待たずにすぐ投げる
  const waitMs = run.createdAt + minutes * 60_000 - Date.now()
  if (waitMs > 0) await sleep(waitMs)

  const r = await send(run.subject)
  run.probes.push({
    minutes,
    elapsedSeconds: Math.round((Date.now() - run.createdAt) / 1000), // ← 実測を残す
    status: r.status,
    error: String(r.body?.error ?? '-'),
  })
  save(STATE, run)   // 1 回ごとに保存

  if (r.status !== 200) break
}
```

要点:

- **測定対象そのものを状態ファイルに保存する**（再開時に同じものを投げるため）
- **1 プローブごとに保存**。落ちてもそこまで残る
- **予定の分数と実測の経過秒を別々に持つ**。スリープや再開でずれる
- やり直し用に `--new` のようなフラグを付ける

## 4. 境界の二分探索

```ts
/** ok は必ず通る値、ng は必ず弾かれる値。1 秒まで詰める */
async function bisect(ok: number, ng: number) {
  while (Math.abs(ng - ok) > 1) {
    const mid = Math.round((ok + ng) / 2)
    if (mid === ok || mid === ng) break
    const accepted = await probe(mid)
    console.log(`${mid} → ${accepted ? '通った' : '弾かれた'}`)
    if (accepted) ok = mid
    else ng = mid
  }
  return { ok, ng }
}
```

- **前回の答えを知らない範囲から始める**と、独立した再現になる
- 他の要因（nonce 切れなど）で落ちたときは、**測り直してから判定する**
- 丸い数字（3600, 10, 60）が出たら実装定数。そこで止めてよい

## 5. 出力の型

画面と `data/` の両方に出す。**画面に出したものが、そのままファイルにも残る**ようにする。

```ts
const transcript: string[] = []
const log = (line = '') => { console.log(line); transcript.push(line) }

function save() {
  if (!transcript.length) return
  mkdirSync('data', { recursive: true })
  writeFileSync(`data/run-${stamp}.md`, '```\n' + transcript.join('\n') + '\n```\n')
}

main().catch((e) => { console.error(e?.message ?? e); save(); process.exit(1) })
//                                                    ^^^^ 落ちても残す
```

1 行 1 往復で、**送った値・送信ハッシュ・ステータス・error・返った値**を並べる。

```text
 # 内容                    送nonce  proof   HTTP  error              返nonce
 1 正しい nonce             AHeS8l6K 0e76e856 200   -                  AHeS8l6J
 2 でたらめな nonce          XWZ7kQml 20a74e1b 400   use_dpop_nonce     AHeS8l5Z
 3 1 文字変えた nonce        AHeS8l6K f25528e9 400   use_dpop_nonce     AHeS8l7N
```

**この表がそのまま記事と報告書に載る。** 読んだ人が同じ結論に辿り着ける形にする。
