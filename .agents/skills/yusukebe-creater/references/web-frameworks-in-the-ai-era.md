---
title: AI時代のWebフレームワークはどこへ行く？
description: フロントエンドカンファレンス福岡 2026
author: Yusuke Wada / yusukebe
date: 2026-09-12
slug: web-frameworks-in-the-ai-era
source: https://slides.yusu.ke/web-frameworks-in-the-ai-era
---

::title::

# AI時代のWebフレームワークはどこへ行く？

Yusuke Wada

フロントエンドカンファレンス福岡 2026 ・ September 12, 2026

---

::center bg=blue::

マジで

---

::center bg=blue::

喉（声帯）がやられて

---

::center bg=blue::

声がでない

---

::center bg=blue size=2::

😱

---

::center bg=blue::

お聞き苦しいところありますがご了承ください

---

::center bg=blue size=2::

🙇

---

::center bg=blue::

ぶっつけ本番なので、尺が合うかわかりません！

-# （たぶん早く終わると思います）

---

::center bg=blue::

あ、あとAIに助けてもらいます！

---

::center bg=blue size=2::

ではいきます！

---

::title::

# AI時代のWebフレームワークはどこへ行く？

Yusuke Wada

フロントエンドカンファレンス福岡 2026 ・ September 12, 2026

---

## Yusuke Wada

- Senior Developer Advocate at Cloudflare
- Creator of Hono

::right::

![me](https://ss.yusukebe.com/d0630d477f3a3a3eb97f2711dcac50cef18715c73da36879f8da6bb904578ed8.png)

---

::center size=1.5 bg=white::

問い

---

::center::

「AIがどんなライブラリ使ってるか知っているか！？」

---

::center::

AIがコードを書くようになって

---

::center::

ライブラリもAIが選定

---

::center::

人間はライブラリを気にしなくなった

---

::center::

`package.json`の`dependencies`にこだわっていた僕らは⋯

---

::center::

AIのみがライブラリのことを知り

---

::center::

人間はライブラリのことを忘れてしまうかもしれない

---

::center::

Honoのことを人間が忘れてしまうかもしれない⋯

---

::center::

((((;ﾟДﾟ))))ｶﾞｸｶﾞｸﾌﾞﾙﾌﾞﾙ

---

::center::

結構マジな話だと思う！

---

::center::

ならば

---

::center::

AIにちゃんと向き合って「**Webフレームワークはどこへ行く？**」かを考えてみよう！

---

::center size=1.5 bg=white::

アジェンダ

---

::center::

AI時代のWebフレームワークについて考える

---

::center::

HonoをAIにとって使いやすいフレームワークにしていく！

---

## アジェンダ

- 前提 — HonoのAI向けプロジェクト
- Agent DX — AIのためのDXを測る試み
- 実験 — AIがHonoを使うことを評価する
- 改善 — 実験結果をフィードバックする

---

::center bg=blue::

水を飲む

---

::center size=1.5 bg=white::

前提

---

::center::

実はHonoには

もうAI向けのプロジェクトがある

---

## Skills

- エージェント向けの公式スキル集
- 個人プロジェクトをオフィシャルに持ってきた
  - `yusukebe/hono-skill` → `honojs/skills`

::right::

![honojs/skills](/images/fec2026/skills-repo.png "https://github.com/honojs/skills")

---

## Hono CLI

- Hono Conference 2025（2025.10.18）のクロージングで発表
- 「CLI for Humans and AI」

::right::

![Hono Conference 2025 Findyレポート](/images/fec2026/findy-hono-cli.png "https://findy-code.io/media/articles/hono-conf-2025")

---

## 5つのコマンド

- `hono docs` — ドキュメントをMarkdownでターミナルに表示
- `hono search` — ドキュメントを検索
- `hono request` — 開発サーバー無しでアプリにリクエスト
- `hono serve` — 便利なサーバー起動
- `hono optimize` — 最適化したHonoを出力

---

## AI向けのコマンド

- **`hono docs` — ドキュメントをMarkdownでターミナルに表示**
- **`hono search` — ドキュメントを検索**
- **`hono request` — 開発サーバー無しでアプリにリクエスト**
- `hono serve` — 便利なサーバー起動
- `hono optimize` — 最適化したHonoを出力

---

::center::

好きなコマンド

`hono request`

---

::center::

AIによくある問題

---

::center::

「開発サーバー立ち上げまくってポート衝突・乱立する」

---

## `hono request` が解決

- エージェント向けのコマンド
- CLIからアプリに直接リクエストを送れる
- 開発サーバーを立てなくていい
- エージェントによくある「ポート乱立」（8787, 8788, 8789⋯）が起きない

```sh
$ hono request -P /users/123
{"id":"123","name":"Alice"}

$ hono request -P /api/users -X POST -d '{"name":"Alice"}'
{"ok":true,"id":"124"}
```

---

## これを実現しているのが `app.request()`

- Hono組み込みのメソッド
- サーバーを立てずに Request → Response が返る
- `honojs/hono`のテストもほとんどこれを使ってる（実サーバーは立ててない）

```ts
const res = await app.request('/users/123')
res.status // 200
```

---

::wide::

![Request → Hono app → Response](/images/fec2026/app-request-flow.svg)

---

::center bg=orange::

デモ

---

::center::

`hono request`便利！

---

::center::

「Hono CLIよさそう」

---

::center::

あれから半年以上⋯

Hono CLIはわりと放置してた⋯

---

::center::

2026年6月27日にIssue #77を立てる

---

::wide::

## New concept（honojs/cli#77）

![New concept issue](/images/fec2026/issue-77.png "https://github.com/honojs/cli/issues/77")

---

::center::

AIに振り切る

---

::center::

ただし

---

::center::

本当にAIに効果があるかは分からなかった

---

::center size=1.5 bg=white::

Agent DX

---

::center::

「ちゃんと」効果を測ろう！

---

::center::

そして、改善していこう！

---

::center size=2::

Agent DX

---

## Agent DX

- AIがHonoを使うDXを測って、改善するプロジェクト
- AIもコードを書くなら、それはDXと言える
- リポジトリ → [honojs/agent-dx](https://github.com/honojs/agent-dx)
- 結果は公開してる → [agent-dx.hono.dev](https://agent-dx.hono.dev)

::right::

![agent-dx.hono.dev](/images/fec2026/agent-dx-dashboard.png "https://agent-dx.hono.dev")

---

::center::

AI Evalsを使う

---

## AI Evalsとは⋯

> AI Evals（評価）とは、確率的に動作する生成AIや大規模言語モデル（LLM）の出力品質を、定義された基準・データ・採点ロジックに基づいて再現可能な形で測定し、継続的に改善する仕組みです。
>
> Google「ai evalsの検索結果」より

---

## Evalsをフレームワークに取り入れた例

- Next.js → [Next.js Agent Evals](https://nextjs.org/evals)
  - 実際のNext.jsタスクをエージェントに解かせて採点。AGENTS.mdの効果も公開
- Angular → [web-codegen-scorer](https://github.com/angular/web-codegen-scorer)
  - 生成コードのビルド成功・実行時エラー・アクセシビリティなどを評価
- Vercel → [@vercel/agent-eval](https://github.com/vercel-labs/agent-eval)
  - 評価基盤。ドキュメントやMCPの有無、モデルの違いを比較できる

---

## FlueでEvalsを実装

- Astroチームが作ってるAIエージェント向けフレームワーク
- 実行基盤としてpiを採用
- TypeScriptでAIエージェントを書ける
- 複数モデル対応、サンドボックス、スキルの読み込み
- Evalsの実装もできる

::right::

![Flue](/images/fec2026/flue.png "https://flueframework.com")

---

## Evalsの実装

- プロンプトと条件を与える
  - 条件 → fixture × ランタイム × モデル
- エージェントがコードを書く
- 結果を採点する → LLMには判定させない
  - 中身は普通のテストと型チェック
- 成功率・トークン・時間を記録して比較

::right::

![Evalsの流れ](/images/fec2026/evals-flow.svg)

---

::center bg=blue::

水を飲む

---

::center size=1.5 bg=white::

3つの実験

---

## 3つの実験

- **Adoption** → そもそもAIはHonoを使うのか？
- **Value** → そもそもHonoは必要なのか？
- **Practical** → 何を足せばAIはうまくやれるのか？

---

::center::

1つずつみていこう

---

::center size=1.5::

1. Adoption

---

::center::

そもそもAIはHonoを使うのか？

---

::wide::

## Adoptionのやり方

![Adoptionの流れ](/images/fec2026/adoption-flow.svg)

---

## シナリオとランタイム

- シナリオ4種
  - `minimal` → `GET /health` だけの一番小さいアプリ
  - `routes` → パスパラメータ入りの複数エンドポイント
  - `api` → バリデーション付きのTODO JSON API
  - `framework` → 同じ`api`を「フレームワークを使え」と明示
- ランタイム4種 → Cloudflare Workers / Bun / Node.js / Deno

---

## プロンプトの例

```
Create a Cloudflare Workers application in TypeScript.
It should respond to GET /health with the JSON {"ok":true}.
```

- Cloudflare Workers × minimal シナリオ
- まっさらのディレクトリでこのプロンプトを与える

---

## 使ったモデル

- `claude-haiku-4-5` → 安い・速い、回数を回す
  - 素だと失敗もするので、工夫の効果が**差として出やすい**
- `claude-opus-5` → 実際のエージェントがよく使う
  - 素でも成功しがちなので、**差が出にくい**

---

::wide::

## Adoptionの結果（claude-haiku-4-5）

![Adoptionの結果 claude-haiku-4-5](/images/fec2026/adoption-haiku.png "https://agent-dx.hono.dev")

---

::wide::

## Adoptionの結果（claude-opus-5）

![Adoptionの結果 claude-opus-5](/images/fec2026/adoption-opus.png "https://agent-dx.hono.dev")

---

## Adoptionでわかったこと

- 何も言わないと素で書く
  - 知識が古い → `wrangler.toml`を書きがち
- 「フレームワーク使え」と言うと、ランタイムごとの定番に流れる
  - Cloudflare → Hono、Node.js → Express、Bun → Elysia、Deno → Oak
- 賢いモデルはHonoを使いがち

---

::center::

さらに分かったのは⋯

---

::center::

`package.json`を追加して`dependencies`に`hono`を入れると**100%** Honoを使う

---

::center bg=#ca8a04::

面白い

---

::center size=1.5::

2. Value

---

::center::

そもそもHonoは必要なのか？

---

::center::

「AIが全部手で書くなら、ライブラリ要らなくない？」論争

---

::wide::

## Valueのやり方

![Valueの流れ](/images/fec2026/value-flow.svg)

---

## 2つのタスク

- `shop API` → 商品・カート・チェックアウト / 状態を持つ複雑なAPI
- `notes API` → ログイン・Bearer認証・CORS・JSONエラー / 認証まわり

---

::wide::

## Valueの結果

![Valueの結果](/images/fec2026/value-results.png "https://agent-dx.hono.dev")

---

## Valueの結果

- 成功率は**上がる**（2/10 → 4/10）
- コードは**30〜40%** 減る
- トークンは**15〜30%** 減る

---

## Valueでわかったこと

- AIが書いても、フレームワークの恩恵はある
- 正確になる、書く量が減る、早く書ける
- 「AIにもライブラリは要る」

---

::center bg=#ca8a04::

面白い

---

::center bg=blue::

水を飲む

---

::center size=1.5::

3. Practical

---

## ここまででわかったこと

- きっかけがあればHonoを使う
- Honoを使う効果もある

---

::center::

何を足せばAIはうまくやれるのか？

---

::wide::

## Practicalのやり方

![Practicalの流れ](/images/fec2026/practical-flow.svg)

---

## 2つのタスクで見てみる

- `build-endpoints` → `/users`CRUDをゼロから作る、「ちゃんと動くか」確認してもらう
- `fix-404` → サブアプリのマウントミスで起きた404を直す
  - `/api/todos`を期待してるが`/api/api/todos`になってしまう

---

::wide::

## Practicalの結果

![Practicalの結果（改善前）](/images/fec2026/practical-before.svg)

---

::center::

差が出ない⋯

---

::center::

どころか悪化してる

---

::center::

なぜ？

---

## 敗因1 - AIが書き捨てスクリプトを書く

```ts
// verify.mjs
import app from './src/index.ts'

let res = await app.request('/users')
console.log(res.status, await res.json())

res = await app.request('/users', { method: 'POST', ... })
console.log(res.status, await res.json())
```

- `app.request()` を呼ぶ**書き捨てスクリプト**を書いて実行

---

## 書き捨てスクリプトでも

- 1回のツールコールで全エンドポイントを確認できる → CLIを使ってくれない
- `hono request` がやってるのは結局 `app.request()` で、書き捨てスクリプトと同じ → CLIを使っても効果がない

---

## 敗因2 - AIがコマンドを間違える

```bash
# 正しいコマンド
$ hono request -P /api/orders src/index.ts
```

```bash
# 間違ったコマンド（curl風構文）
$ hono request GET /api/orders    → エラー
$ hono request "/api/orders"      → エラー
$ hono request --app src/index.ts → エラー

（諦めて書き捨てスクリプトを書き始める）
```

---

::center size=1.5::

CLI不要説！？

---

::center bg=blue::

水を飲む

---

::center size=1.5 bg=white::

改善

---

## 改善のループを回そう

- 測って終わりにしない
- 結果を CLI / Skills に反映して、また測る

::right::

![改善のループ](/images/fec2026/improve-loop.svg)

---

::center::

敗因1 - 「AIが書き捨てスクリプトを書く」に対抗する

---

## 書き捨てスクリプトがつらい時

- 確認項目が何十項目もある構築タスク
- リファクタで全ルートの回帰確認
- → より現時的なケースでトークンをたくさん消費したり、間違える

::right::

![書き捨てスクリプトの悪循環](/images/fec2026/throwaway-loop.svg)

---

## 2つのコマンドを追加

- `hono batch` → 複数リクエストをまとめて実行、判定まで
- `hono snapshot` → 今のアプリの挙動をJSONLで書き出す

---

## `hono batch`

- JSONLで書いたリクエスト列を順に実行
- `expect` を書いておけば判定までやる → 目視ゼロ

```sh
hono batch - <<'EOF'
{"path":"/users","expect":{"status":200}}
{"method":"POST","path":"/users","body":{"name":"Momo"},"expect":{"status":201}}
EOF

{"path":"/users","status":200,"pass":true}
{"path":"/users","status":201,"pass":true}
{"summary":{"total":2,"passed":2,"failed":0}}
```

---

## `hono snapshot`

- 今のアプリの挙動を、batch用のJSONLとして出力
- リファクタ前に撮っておいて、あとで `hono batch` に流す
- `hono batch` の `failed` が0なら壊してない

```sh
$ hono snapshot
{"path":"/health","expect":{"status":200,"body":{"ok":true}}}
{"path":"/users","expect":{"status":200,"body":[{"id":"1"}]}}
{"path":"/users/:id"}
```

---

::center::

敗因2 - 「AIがコマンドを間違える」に対抗する

---

## 構文を修正

- リクエストパスを第一引数に → `hono request /api/orders`
  - curl風のコマンド
- 間違えたら、エラーが正しいコマンドを返す

```sh
$ hono request GET /api/orders
{
  "ok": false,
  "error": {
    "code": "INVALID_ARGUMENTS",
    "message": "The method goes in -X, like curl",
    "suggestions": ["hono request /api/orders -X GET"]
  }
}
```

---

::center::

効果は？

---

::wide::

## 改善後の結果（同じ2タスク）

![改善後の結果（同じ2タスク）](/images/fec2026/practical-after.svg)

---

## 追加タスク

- より現実的なユースケースで計測
- `build-shop` → 確認項目が多いショップAPIをゼロから作る
- `session-users` → 同じセッションで変更依頼を4回続ける
  - 現実のAIコーディングに近い

---

::wide::

## 改善後の結果（追加2タスク）

![差が出た2タスクの結果](/images/fec2026/practical-wins.svg)

---

::center size=1.5::

いい感じ 😊

---

## 改善でわかったこと

- CLIが効くのは「量」と「継続」のタスク
  - 量 - エンドポイントが多い
  - 継続 - やり取りが多い
- 簡単なタスクは、今も書き捨てで十分
- `hono batch` が効く、それを活かす `hono snapshot` も便利

---

::center bg=#ca8a04::

面白い

---

::center bg=blue::

水を飲む

---

::center size=1.5 bg=white::

最後の実験

---

::center::

そもそも、なぜ `hono request` を作ったか？

---

::center size=0.8::

AIが「開発サーバー立ち上げまくってポート衝突・乱立する」問題に対処したい

---

::center::

実はその検証ができてなかった！

---

::center::

baselineでも開発サーバーを立ててなかった

---

## これまでの実験

- まっさらなディレクトリから作り始めた
  - fixtureには何もない
- `package.json`すらない
- → 約100run、開発サーバー起動0回

---

## 開発サーバーを立ち上げるようにした

- → fixtureを変える
- create-hono のCloudflare Workersテンプレをそのまま使う
- `npm run dev` で `wrangler dev` が立つ
  - 実ユーザーの初回と同じ
- AGENTS.mdなし

---

::center::

結果

---

## 開発サーバーを立ち上げた！

- baselineで**15/15全部**が `wrangler dev` を起動
- サーバーを立ち上げたままでbashツールごとハングするケースも
- 例 - Sonnet 5は成功**20%**、5本中4本が**600秒ハング**
- → 「ポート衝突・乱立」が再現した

---

::center::

一方

---

## CLI + Skills

- fixtureにCLI + Skillsを入れる（AGENTS.mdは入れてない）
- 15/15、誰も開発サーバーを立てない
- 初手で `hono batch`
- 全モデル**100%**・約**30秒**

---

::center::

モデルごとの結果のグラフ

---

::wide::

## Haiku 4.5

![build-endpoints-workers / Haiku 4.5](/images/fec2026/last-haiku.svg)

---

::wide::

## Sonnet 5

![build-endpoints-workers / Sonnet 5](/images/fec2026/last-sonnet.svg)

---

::wide::

## Opus 5

![build-endpoints-workers / Opus 5](/images/fec2026/last-opus.svg)

---

::center size=1.5::

いい感じ 😊

---

::center::

なぜ開発サーバーを立てたり、立てなかったりするのか？

---

## 開発サーバーを立てるきっかけがある

- create-honoで作ったfixtureには開発サーバー向けのコマンドとファイルがある
- `package.json` の `scripts` に `dev`
- `wrangler.jsonc`

---

::center::

で、よく考えると

---

## `dev`コマンドは人間にとってのDX

```bash
# コマンドへのショートカット、打ちやすい・みんなが知ってる
# → 人間にとってのDX
pnpm dev
```

---

::center::

さらに⋯

---

::center::

人間は開発サーバーで結果を確認する

AIは開発サーバーなしでも確認できる

---

::center::

**開発サーバーは人間のためのDX**

---

::center::

最後の実験では

人間にとってのDXを向上させるもの → AIにとっては裏目に出た

---

::center::

だからこそ、CLI + Skills、AGENTS.mdは大事

---

::center::

**人間向けのDX**と**AI向けのDX**がある

---

::center bg=#ca8a04::

面白い

---

::center size=1.5 bg=white::

実験まとめ

---

## 実験まとめ

- Adoption → きっかけがあればHonoを使う、`package.json`にあれば100%
- Value → AIが書いても、Honoの恩恵はある
- Practical → CLI / Skills は「量」と「継続」のタスクで効く
- 最後の実験 → 開発サーバーは人間向けのDX、AI向けのDXを用意するの大事

---

::center size=1.5 bg=white::

おまけ

---

## おまけ

- 継続計測中 → [agent-dx.hono.dev](https://agent-dx.hono.dev) で公開中！
- お金かかった → 約700run・約$200・CLIリリース7回
- 今後の課題
  - create-honoテンプレにAGENTS.mdの1行 + Skill を入れる
  - Cloudflare Bindings対応の `request` / `batch`

---

::center size=1.5 bg=white::

まとめ

---

## まとめ

- HonoのAIにとってのDXを測って改善
  - どれほどHonoを採用するか
  - Honoは効果的か
  - 何を追加するとよくなるか？
- AI Evalsを使うと「ちゃんと」測れる

---

::center::

AI時代でもWebフレームワークはあった方がいいし、

---

::center::

AI向けのDXを改善できる！

---

::center size=1.5::

AI時代のWebフレームワークはどこへ行く？

---

::center::

おわり
