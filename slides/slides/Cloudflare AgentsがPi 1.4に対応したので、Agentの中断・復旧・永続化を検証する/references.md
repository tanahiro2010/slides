# references — Cloudflare Agents × Pi 1.4 の中断・復旧・永続化

| | |
| --- | --- |
| 調査日 | 2026-10-25 |
| 対象 | Agents SDK 0.30.0 / 0.30.1、`@earendil-works/pi-durable` 1.4.0 |
| 用途 | slide.md / article.md（PRD.md の裏取り） |
| 立てた問い | PRD が「Pi 1.4 の新機能」として挙げた 4 点は、本当に Pi 1.4 のものか。検証環境の指定は妥当か。 |

このファイルは公開しません。
読めなかったこと、調べたら前提が違ったことも、そのまま残しています。

## 確認した主張

| # | 主張（出どころは PRD.md） | 判定 | 根拠 |
| --- | --- | --- | --- |
| 1 | 2026-10-22 に Agents SDK v0.30.0 の Pi 1.4 対応が発表された | ✅ 確認 | 公式 Changelog / npm |
| 2 | 新機能は Hibernation / Parked Tasks / Storage Error Recovery / Model Stream Retry の 4 点 | ⚠️ **半分は Pi 1.4 ではない** | PR #2643・#2648 は Agents SDK 側の修正 |
| 3 | 検証環境の Agents SDK は `0.30.0` | ❌ **前提が崩れる** | 0.30.0 には onWake の既知バグ（#2683）。0.30.1 で修正 |
| 4 | Pi は `pi_` で始まる SQLite テーブルに状態を保存する | ✅ 確認 | 公式ドキュメント |
| 5 | 「状態を保存できる」と「処理を再開できる」は別の機能である | ✅ 確認 | Pi Durable 設計記事 / 公式ドキュメント |
| 6 | イベントストリームにカーソル再生はない | ✅ 確認 | 公式ドキュメント Limitations |
| 7 | `replay: "safe"` は再実行、それ以外は再実行しない | ✅ 確認 | Extensions ドキュメント。**unsafe が既定値** |
| 8 | `restartLimit` の既定値は 5 回 | ✅ 自分で確認 | 配布物に `DEFAULT_RESTART_LIMIT = 5` |
| 9 | Parked になったタスクは `session.retry()` で再開できる | ✅ 確認 | 公式ドキュメント / PR #2624 |
| 10 | ストレージエラーのあと Pi を再オープンして復旧できる | ⚠️ **範囲が狭い** | 実行中の呼び出しは救われない（PR #2648） |
| 11 | 待機中は `onWake` 経由でスケジュールし、処理中は 30 秒ごとに Heartbeat を打つ | ✅ 自分で確認 | 配布物に `HEARTBEAT_MS = 3e4` ほか |
| 12 | Pi 1.4 は SQLite のスキーマを移行し、1.3 には戻せない | ✅ 確認 | Pi Durable CHANGELOG |
| 13 | Pi 1.3 との比較には別の Durable Object と DB を使う | ✅ 確認 | 同上（ロールバック不可のため） |
| 14 | `@earendil-works/chord` も必要 | ✅ 自分で確認 | npm の peerDependencies |
| 15 | `PiHarness` は Beta、Pi Durable は実験的 | ✅ 確認 | 公式ドキュメント |
| 16 | 障害注入の手段（PRD に具体策の記載なし） | ✅ 見つけた | `ctx.abort()` が公式 API にある |
| 17 | モデルリトライの既定値 | ✅ 自分で確認 | `DEFAULT_RETRY_POLICY` |
| 18 | 実デプロイでの Hibernation の実証 | ⬜ 未確認 | 報告者本人も workerd/Miniflare 止まり |

---

## 1. 発表日とバージョンの対応

**判定: 確認しました。**

- [Agents SDK now supports the latest Pi 1.4 release](https://developers.cloudflare.com/changelog/post/2026-10-22-pi-harness-pi-1-4/) — 一次。2026-10-22 付
- [Pi Durable 1.4.0 CHANGELOG](https://github.com/earendil-works/pi/blob/v1.4.0/packages/durable/CHANGELOG.md#140---2026-10-21) — 一次。Pi 側は 2026-10-21 付

npm の公開時刻を引くと、Pi が先に出て Cloudflare が翌日追随した順番がはっきりします。

```sh
curl -s https://registry.npmjs.org/@earendil-works%2Fpi-durable | python3 -c "
import json,sys; d=json.load(sys.stdin); t=d['time']
for v in sorted(d['versions'], key=lambda v: t[v])[-4:]: print(t[v][:19], v)"
```

| パッケージ | バージョン | 公開（UTC） |
| --- | --- | ---: |
| `@earendil-works/pi-durable` | 1.3.0 | 2026-10-15 19:13 |
| `@earendil-works/pi-durable` | 1.4.0 | 2026-10-21 22:44 |
| `agents` | 0.29.0 | 2026-10-20 15:25 |
| `agents` | 0.30.0 | 2026-10-22 11:31 |
| `agents` | 0.30.1 | 2026-10-23 15:40 |

Pi 1.4 が公開されてから Cloudflare の対応リリースまでは 13 時間ほどでした。

### 記事に使える切り口

Pi は別会社（earendil-works）のパッケージで、Agents SDK はその特定マイナーだけを受け入れます。
`agents` 1 リリースが Pi 1 マイナーに対応する、という紐付けが公式ドキュメントに明記されています。

---

## 2. 「Pi 1.4 の新機能 4 点」の内訳

**判定: 2 点は Pi 1.4 の機能ですが、残り 2 点は Agents SDK 側の修正です。**

Cloudflare の Changelog は 4 点をまとめて「Agents SDK v0.30.0 のリリース内容」として並べています。
PRD.md はこれを「Pi 1.4 対応によって追加された復旧機構」と書いていますが、出どころをたどると層が違います。

| Changelog の項目 | 実際にどこの変更か | 根拠 |
| --- | --- | --- |
| Hibernation（`onWake`） | Pi 1.4 の新 API を Agents SDK が配線した | Pi CHANGELOG「Added: `Harness.wake()` and `HarnessOptions.onWake`」/ [PR #2619](https://github.com/cloudflare/agents/pull/2619) |
| Parked Tasks | Pi 1.4 の新機能を Agents SDK が露出させた | Pi CHANGELOG「Crash-loop guard」/ [PR #2624](https://github.com/cloudflare/agents/pull/2624) |
| Storage Error Recovery | **Agents SDK 側だけの修正**。Pi の挙動は 1.2 から変わっていない | [PR #2648](https://github.com/cloudflare/agents/pull/2648) |
| Model Stream Retry | **Agents SDK 側だけの修正**。Pi 1.3 でも同じ効果が出る | [PR #2643](https://github.com/cloudflare/agents/pull/2643) |

PR #2643 の本文には、こう書かれています。

> Each string checked against the classifier in installed Pi 1.3.0 and Pi main.

つまり Model Stream Retry は Pi 1.4 を待たなくても成立する修正です。
PRD の §7「Pi 1.3 と Pi 1.4 の比較」の表は、この 2 行を Pi のバージョン差として扱うと誤った比較になります。
比較すべき軸は Pi のバージョンではなく、Agents SDK 0.29.0 と 0.30.x です。

### 記事に使える切り口

「Pi 1.4 対応リリース」の中身を層ごとに分けると、Pi が増やした能力と、Cloudflare が塞いだ穴が混ざっています。
ベンダーの Changelog が機能の出どころを語らない、という具体例として使えます。

---

## 3. 検証環境のバージョン指定

**判定: PRD の `0.30.0` 指定は変更が必要です。**

0.30.0 には、この記事の中心であるはずの Hibernation がうまく動かない既知バグがあります。

- [cloudflare/agents#2683](https://github.com/cloudflare/agents/issues/2683) — 一次。報告本文より

  > Wiring the documented onWake callback can stall a native compaction retry sleep while another Pi task remains active.
  > With onWake wired, two concurrent-compaction cases time out at 60 seconds. With it omitted, the corresponding cases complete in approximately 14.6 and 2.6 seconds.

- 0.30.1 の Patch Changes に修正が入りました（[PR #2684](https://github.com/cloudflare/agents/pull/2684)）

配布物を差分で見ると、何が足りなかったのかがはっきりします。

```sh
diff -u agents-0.30.0/package/dist/harness/pi/index.js \
        agents-0.30.1/package/dist/harness/pi/index.js
```

0.30.0 の待機ループは `pi.wake().active` だけを見ていて、`wake.at`（次にスリープが明ける時刻）を締切に使わず、`pi.resume()` も呼びませんでした。
0.30.1 で `wake.at` を待機時間の上限に加え、期限が来たら `pi.resume()` を呼ぶようになっています。

```js
// 0.30.1 で追加された部分
if (wake.at !== void 0) sleep = Math.min(sleep, wake.at - now);
// ...
if (wake.at !== void 0 && Date.now() >= wake.at) pi.resume();
wake = pi.wake();
```

**EXP-07 と EXP-03 は 0.30.1 以降で実施してください。**
0.30.0 で測ると、Pi 1.4 の Hibernation が動かないという結論になりますが、それは SDK 側のバグを測っているだけです。

### 記事に使える切り口

発表から 1 日後にパッチが出ている事実は、`PiHarness` が Beta であることの具体的な裏付けになります。
PRD の非目標にある「未検証の脆弱性を主張しない」を守りつつ、成熟度の話として書けます。

---

## 4. 永続化と復旧は別物である

**判定: 確認しました。一次ソースが 2 本あります。**

- [Pi Durable（earendil.com、2026-10-01）](https://earendil.com/posts/pi-durable/) — 一次。設計記事

  > every step of a run is a task that stores a checkpoint before it moves on.

  モデルへのリクエストは再送され、途中まで届いていた応答は「中断済み」として履歴に残ります。
  ツール呼び出しは、安全に再実行できると宣言されたものだけが再実行されます。

- [Cloudflare Docs — Pi](https://developers.cloudflare.com/agents/harnesses/pi/) — 一次

  Storage（`pi_` 接頭辞の SQLite テーブル）と Wake-up（Lifecycle ジョブ）を、別々の役割として説明しています。

Durable Object の中では、保存先が SQLite で、再開の引き金が Alarm です。
両者は独立していて、保存できていても起こされなければ再開しません。

---

## 5. ツールの Replay 設定

**判定: 確認しました。ただし PRD の表に 1 行足りません。**

- [Extensions](https://developers.cloudflare.com/agents/harnesses/pi/extensions/) — 一次

  > - `replay: "safe"`: Pi runs the tool again after the object restarts.
  > - `replay: "unsafe"`, the default: Pi does not run it again. The model gets an interrupted result and decides what to do next.

**`unsafe` が既定値です。**
PRD の表は「Unsafe なツール」と書いていますが、何も指定しなければ全部 unsafe になる点が抜けています。
EXP-04 で Tool B を作るときは、`replay` を書かないことが unsafe の指定そのものになります。

公式ドキュメントの Recovery 表も合わせて読むと、復旧の分岐は次の 5 通りです。

| 起きたこと | Pi の扱い |
| --- | --- |
| Object の退避・クラッシュ・メモリ超過 | 次の Alarm で再起動し、最後のチェックポイントから続行する |
| 実行中のデプロイ | クラッシュと同じ。ランタイムが 30 秒の猶予を与えてから Alarm が再起動する |
| モデルがストリーム中だった | 途中まで保存した応答を残し、モデル呼び出しをやり直す |
| `replay: "safe"` のツールが実行中だった | ツールを再実行する |
| それ以外のツールが実行中だった | 再実行しない。モデルに中断結果を渡す |

### 記事に使える切り口

PRD §5 の「Unsafe が自動再実行されないことと、Exactly-once は同義ではない」という論点は、この表だけでは証明も反証もできません。
モデルが中断結果を見て同じツールをもう一度呼ぶかどうかは、モデル依存の挙動です。
記事では「仕様が保証するのは自動再実行をしないことだけで、再呼び出しはモデルの判断」と書き分ける必要があります。

---

## 6. Storage Error Recovery の範囲

**判定: 公式の説明より狭い範囲でしか救われません。**

Pi 側の仕様は 1.2 から変わっていません。
Pi Durable 1.2.0 CHANGELOG の Breaking Changes より、一次。

> Any error a `Storage` method throws, a read included, now fails the Session, which closes itself: every later call and every pending wait rejects with `SessionFailed`

1.4.0 の Fixed で例外の範囲が狭まりました。

> The README's Errors section now limits the `StorageRequestError` exemption to reads: a `StorageRequestError` thrown by `commit()` or `mintId()` fails the Harness like any other storage error

その上で、[PR #2648](https://github.com/cloudflare/agents/pull/2648) が Agents SDK 側に再オープンを足しました。
PR 本文より、一次。

> PiHarness kept the dead pi cached, so every later call failed until the isolate restarted
> Reopens on the next call or the wake job's next step. **Calls already in flight still reject with `SessionFailed`.**

つまり EXP-06 の期待結果は、次のように分けて書くべきです。

- ストレージエラーが起きた時点で進行中だった呼び出しは、`SessionFailed` で失敗します。救われません。
- その次の呼び出し、または Wake ジョブの次のステップで、ファクトリが再実行されて Pi が開き直ります。
- 復旧は Pi の機能ではなく、`PiHarness` がキャッシュを捨てて開き直す動作です。

ファクトリが何度も走る前提になったのはこの変更が理由です。
公式ドキュメントも「Keep it safe to run more than once」と明記しています。

---

## 7. Parked Tasks の条件

**判定: 確認しました。条件が思ったより限定的です。**

`@earendil-works/pi-durable` 1.4.0 の README より、一次。

> Open counts each task a crash, eviction, or reset cut off; **a close is not counted**, and a new state the task commits starts the count over. Once the count reaches `settings.restartLimit` (default 5; `Infinity` never parks), the task is parked

ここが EXP-05 の設計に効きます。

- 正常な `close()` ではカウントが増えません。例外を投げるだけ、HTTP を切るだけでは Parked に届きません。
- タスクが新しい状態をコミットすると、カウントが 0 に戻ります。進捗のない失敗を連続させる必要があります。
- 実際に必要なのはクラッシュ・退避・リセットです。`ctx.abort()` がこの条件を満たします。

[PR #2624](https://github.com/cloudflare/agents/pull/2624) の本文に、修正前の状態が書かれています。

> the operation showed as `running` forever, `wait()` never resolved, and the only way out was `harness.pi().inspect()` to find the task id, then `pi.retryTask(id)`

0.30.0 より前は、Parked されたタスクをユーザー側から観測する手段がありませんでした。
`pending()` に `parked` が出るようになったことが、EXP-05 を成立させています。

---

## 8. 障害をどう注入するか

**判定: PRD に書かれていなかった手段が公式 API にありました。**

- [Durable Objects — `state.abort()`](https://developers.cloudflare.com/durable-objects/api/state/) — 一次

  > Calling `abort` immediately resets a Durable Object. The runtime logs a JavaScript `Error` with the message passed to `abort`. Application code cannot catch this error.
  > By default, an alarm interrupted by `abort` retries after the Durable Object resets.

`this.ctx.abort("exp-04 inject")` が、例外送出では作れない本物のリセットを作ります。
アプリケーションコードから catch できないので、ツールの `try/catch` をすり抜ける点も検証向きです。

PRD §5 の EXP-04 にある「例外送出や HTTP リクエスト中断だけでは実際のクラッシュとは異なる」という注意書きは、この API を使えば解消できます。

### 記事に使える切り口

副作用が確定した直後に中断するケースは、ツール内で副作用を書いた直後に `ctx.abort()` を呼ぶだけで再現できます。
タイミングを引数で選べるようにしておけば、PRD の「副作用確定前 / 確定直後 / ツール完了後」の 3 点がそのまま 1 つのツールで測れます。

---

## 計測（自分で取った一次ソース）

### Model Stream Retry の正体は、エラー文字列の書き換えである

[PR #2643](https://github.com/cloudflare/agents/pull/2643) は、ストリーム断の扱いを変えるために、エラーメッセージの文言だけを変えています。
pi-ai の再試行判定が、メッセージ本文に対する正規表現だからです。

`@earendil-works/pi-ai` 1.4.0 の `dist/utils/retry.js` より、一次。

```js
export function isRetryableAssistantError(message) {
    if (message.stopReason !== "error" || !message.errorMessage) return false;
    const errorMessage = message.errorMessage;
    if (NON_RETRYABLE_PROVIDER_LIMIT_ERROR_PATTERN.test(errorMessage)) return false;
    return RETRYABLE_PROVIDER_ERROR_PATTERN.test(errorMessage);
}
```

再試行対象のパターンに `"ended without"` と `"timed? out"` が入っています。
`agents` 0.29.0 と 0.30.x が実際に投げる文字列を取り出して、この判定にかけました。

```sh
# 両バージョンの配布物から実際の文言を取り出す
grep -n "Model stream\|The stream ended" agents-0.29.0/package/dist/models/pi-ai/index.js
grep -n "Model stream\|The stream ended" agents-0.30.1/package/dist/models/pi-ai/index.js

# pi-ai 1.4.0 の判定関数にそのまま通す
node check-retry.mjs ./pi-ai/package/dist/utils/retry.js
```

結果です。

| 版 | エラーメッセージ | 再試行されるか |
| --- | --- | --- |
| 0.29.0 | `Model stream stalled: no data received for 60s.` | ❌ されない |
| 0.30.x | `Model stream timed out: no data received for 60s.` | ✅ される |
| 0.29.0 | `The stream ended before the model finished its answer.` | ❌ されない |
| 0.30.x | `The stream ended without the model finishing its answer.` | ✅ される |
| 0.29.0 | `The stream ended before the model produced any output.` | ❌ されない |
| 0.30.x | `The stream ended without any output from the model.` | ✅ される |
| 両方 | `The stream ended without a terminal response event.` | ✅ される |

4 ケース中 3 ケースが、文言の差だけで判定を跨いでいます。
PR 本文の「3 of 4 new cases fail」という記述と一致しました。

**この 1 つが記事で一番強い材料になります。**
「ストリーム断を一時的なエラーとして扱えるようになった」という Changelog の 1 行が、実装では `before` を `without` に書き換えた差分だった、という話です。
再試行の判定が型でもエラーコードでもなく、人間向けの文面に対する正規表現である点も、そのまま書けます。

### 既定値

`@earendil-works/pi-durable` 1.4.0 の `dist/harness/agent.js` より、一次。

```js
export const DEFAULT_RETRY_POLICY = {
    enabled: true, maxRetries: 3, baseDelayMs: 2000, maxAgentDelayMs: 60000,
};
export const DEFAULT_RESTART_LIMIT = 5;
```

`agents` 0.30.1 の `dist/harness/pi/index.js` より、一次。

```js
const WAIT_BUDGET_MS = 10 * 6e4;      // 600000 ms = 10 分
const HEARTBEAT_MS = 3e4;             // 30000 ms = 30 秒
const MAX_WAKE_BACKOFF_MS = 10 * 6e4; // 600000 ms = 10 分
```

| 設定 | 既定値 | 影響する実験 |
| --- | ---: | --- |
| モデルリトライ | 有効、3 回、初回 2 秒から倍々、上限 60 秒 | EXP-03 / EXP-07 |
| `restartLimit` | 5 回 | EXP-05 |
| Wake ジョブの Heartbeat | 30 秒 | EXP-01 / EXP-05 |
| 1 回の Alarm 内で待つ上限 | 10 分 | EXP-03 |
| Wake ジョブ失敗時のバックオフ上限 | 10 分 | EXP-06 |

ここから、実験にかかる時間が見積もれます。
クラッシュから再起動までが最大 30 秒なので、既定の `restartLimit` で Parked に到達させるには最大 2 分半かかります。
`settings.restartLimit` は 1 以上の整数を受け付けるので、EXP-05 では 2 まで下げて待ち時間を縮められます。

```js
// 配布物より。1 未満や非数値は既定値に落ちる
function restartLimit(limit) {
    return typeof limit === "number" && limit >= 1 ? Math.floor(limit) : DEFAULT_RESTART_LIMIT;
}
```

### 依存関係

```sh
curl -s https://registry.npmjs.org/agents/0.30.0 | python3 -c "
import json,sys; d=json.load(sys.stdin)
print({k:v for k,v in d['peerDependencies'].items() if 'earendil' in k})"
```

```
{'@earendil-works/chord': '~1.4.0',
 '@earendil-works/pi-ai': '~1.4.0',
 '@earendil-works/pi-durable': '~1.4.0'}
```

3 つとも optional peer dependency です。
チルダ指定なので、Pi 1.5 が出ても `agents` 0.30.x は受け付けません。
PRD §4 の「`@earendil-works/chord` も必要」は、この指定で裏が取れました。

### 環境

- macOS Darwin 25.5.0、Apple Silicon
- Node.js v24.22.1
- 配布物は npm registry の tarball を展開したもの。ソースは読んでいません
- 計測日 2026-10-25

---

## 実装に入る前の申し送り

公式の Upgrading 手順に、検証コードを書くときに踏みやすい落とし穴が書かれています。
[Agents SDK 0.30.0 CHANGELOG](https://github.com/cloudflare/agents/blob/main/packages/agents/CHANGELOG.md#0300) より、一次。

> **If you create Pi's registry at module scope, move it into your class.**
> Pi keeps every `Harness` subscribed to its registry until it closes, and an evicted object never closes it, so a module-level registry keeps every evicted object's harness in memory.

退避した Object は `close()` しません。
モジュールスコープにレジストリを置くと、退避のたびにハーネスがメモリに残ります。
退避を何度も起こす EXP-04 と EXP-05 では、この書き方のままだと測りたい現象の手前でメモリ上限に当たる可能性があります。

`createRegistry()` はクラスのフィールドに置いてください。

実装の出発点としては、公式のサンプルアプリが使えます。

- [examples/next/harnesses/pi](https://github.com/cloudflare/agents/tree/main/examples/next/harnesses/pi) — WebSocket セッション、永続ファイルシステム、コード実行まで入った完成形
- 同ディレクトリの `NOTES.md` — 設計の経緯が書かれた作業メモ。Lifecycle ジョブを 1 本にした理由が読めます

---

## 未確認・積み残し

- [ ] 実デプロイの Durable Object で Hibernation が起きていることの実証。issue #2683 の報告者も workerd と Miniflare までで、「not yet on a deployed Cloudflare Durable Object」と明記しています
- [ ] ストレージエラーの注入方法。ファクトリが受け取る `storage` をラップして渡せば届くはずですが、実際に `Harness.open()` が受け付けるか未検証です（EXP-06 の前提）
- [ ] Pi 1.3 側の実測。PRD §7 の比較表は、Pi 1.3 と 1.4 ではなく Agents SDK 0.29.0 と 0.30.1 の比較に組み替える必要があります
- [ ] 副作用確定直後に `ctx.abort()` した場合に、モデルが同じツールを呼び直すかどうか。仕様では決まらず、モデル依存です
- [ ] Hibernation 中の課金・メモリ使用量。「待機中の CPU 使用量が低い」ことは Hibernation の証明になりません（PRD §5 の注意書きのとおり）

## 探したが取れなかったもの

- Pi 本体（earendil-works/pi）のソースは読んでいません。星 11 万超の公開リポジトリなので読めますが、今回は npm の配布物で足りました。`#waitWhileActive` のような Agents SDK 側の実装は配布物から読めています
- Pi Durable の設計記事（earendil.com）は HTML を要約で読んだだけで、原文の全文は取っていません。引用した 1 文のみ原文で確認しました
- 日本語の解説記事・参加レポートは、発表から 3 日しか経っていないため見つかっていません。二次ソースに頼らずに済んだので、追加で探していません

## 冒頭の問いへの答え

PRD が「Pi 1.4 の新機能」とした 4 点のうち、Pi 1.4 のものは Hibernation と Parked Tasks の 2 点でした。
Storage Error Recovery と Model Stream Retry は Agents SDK 側の修正で、Pi 1.3 でも成立します。

検証環境の指定は変更が必要です。
`agents` は 0.30.1 以降を使ってください。
0.30.0 では Hibernation が別タスクの実行中に働かない既知バグが残っています。
