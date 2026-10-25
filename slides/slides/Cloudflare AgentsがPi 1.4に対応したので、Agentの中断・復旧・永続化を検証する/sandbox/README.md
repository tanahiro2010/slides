# sandbox — Pi 1.4 の中断・復旧・永続化

`claims.md` の主張を実際に叩いて確かめるハーネスです。
エンドポイントは C 番号に対応しています。

## 動かす

```sh
bun install
bunx wrangler types
bunx wrangler dev --port 8799 --local
```

別の端末から。

```sh
node drive/exp04.mjs http://127.0.0.1:8799
```

## 構成

| ファイル | 役割 |
| --- | --- |
| `src/evidence.ts` | 証跡レコーダ。**全観測がここを通る** |
| `src/state.ts` | 障害注入の計画とカウンタ。Pi の replay の外側に置く |
| `src/tools.ts` | 検証用ツール 4 本。実行回数と副作用回数を別々に数える |
| `src/script.ts` | 偽モデル。pi-ai 同梱の `fauxProvider` を使う |
| `src/storage.ts` | `Storage` の Proxy ラッパ。EXP-06 用 |
| `src/agent.ts` | 検証対象の Durable Object |
| `src/index.ts` | シナリオの入口 |
| `drive/*.mjs` | シナリオドライバ。対照を 1 本のスクリプトに並べる |

## 設計上の決め事

### 記録は `ctx.storage.sync()` を挟む

Durable Object の書き込みはメモリ上のバッファに入り、非同期でディスクに落ちます。
`ctx.abort()` の直前に書いただけでは、その記録ごと消えます。

これは実測で確かめました（C01）。

| 記録の仕方 | クラッシュを跨いで残った行数 |
| --- | ---: |
| `sync()` あり | 1 |
| `sync()` なし | 0 |

どちらも本当にリセットされています（instanceId が変化）。
**`durable: false` は C01 の対照専用で、他では使いません。**

### 障害注入は `ctx.abort()` を使う

例外送出では本物のクラッシュになりません。
`ctx.abort()` はアプリコードから catch できず、Durable Object を即座にリセットします（C02）。

発火回数は撃つ**前**に確定させます。
`ctx.abort()` のあとに走るコードは存在しないので、順番を逆にすると回数が残りません。

### Durable Object の名前は実行ごとに変える

名前を使い回すと、前回の失敗した run に積まれた submission が先に走ります
（`settings.afterFailedRun` の既定が `keep` のため）。
測りたい条件が揃わなくなります。

C41（Pi 1.4 のマイグレーションは一方向）の観点でも、使い回しは避けます。

### レジストリはクラスフィールドに置く

モジュールスコープに置くと、退避したオブジェクトのハーネスがメモリに残ります。
退避を繰り返す EXP-04 と EXP-05 では、測りたい現象の手前でメモリ上限に当たります。

## ハマったところ

あとから来る人のために残します。

### `fauxAssistantMessage` の既定は `stopReason: "stop"`

ツール呼び出しブロックを積んでも、`stopReason` を `"toolUse"` にしないと
Pi はツールを実行せずにターンを終えます。
エラーにならないので、カウンタを見るまで気づけません。

### `setResponses` はキューなので 1 回で尽きる

ツール呼び出し → 結果 → 締め、のように 1 ターンで終わらないシナリオでは、
2 回目のモデル呼び出しで `model_error` になります。
応答関数が毎回自分を積み直す形にしています。

### Durable Object の RPC はネストしたプロパティを通さない

`lab.harness.submit()` は型が通っても実行時に落ちます。
外から触る操作は、すべて `RecoveryLab` に明示的なメソッドとして生やしています。

## 秘密情報

`.env` は作る前に `.gitignore` を書いてあります。
`data/` 以下の生ログと測定データも除外済みです。
ローカル検証では認証情報を使いません。
