---
title: Hono in this era
description: Hono Conference 2026
author: Yusuke Wada / yusukebe
date: 2026-10-11
slug: honoconf-2026
source: https://slides.yusu.ke/honoconf-2026
---

::title::

# Hono in this era

Yusuke Wada

Hono Conference 2026 ・ October 11, 2026

---

::center size=1.5 bg=white::

時代

---

::center::

Hono Conference 2025

2025/10/18

---

## npmダウンロード数

- 2025年10月 → **1,110万** / 月
- 2026年9月 → **2.67億** / 月

-# api.npmjs.org

::right::

![npm downloads](https://ss.yusukebe.com/5459227703ec8fcbcbb4ffb68e349df6a5abf95ae323569e650783abcc358278.png)

---

- `express` → 2.7倍
- `react` → 3.8倍
- `next` → 4.1倍
- `zod` → 6.3倍
- **`hono` → 30.8倍**

-# 2025年9月 → 2026年9月の月間ダウンロード

---

## ちなみに⋯MCP SDK

- `@modelcontextprotocol/sdk`(v1) → `@hono/node-server` / `hono`
- `@modelcontextprotocol/node`(v2) → `@hono/node-server`
- `@modelcontextprotocol/hono`(v2) → Hono用ミドルウェア

-# 直近1ヶ月 → v1 **2.58億**、v2 `server` 3,130万

---

## PR数

- 2025年7〜9月 → **82**
- 2026年7〜9月 → **345**

-# honojs/hono

---

::center::

明らかに新しい時代

---

::center::

何が変わった？？

---

::center size=1.5 bg=white::

開発

---

::center::

10月5日

honojs/hono → PRを閉じる

---

::center::

![x.com/yusukebe/status/2107027870019445007](https://ss.yusukebe.com/d8f8a2be1d6f7a37d89515e2d06e837ca405aa2e01ef721d735f481c68f6d55f.png "https://x.com/yusukebe/status/2107027870019445007")

---

## 何をしたか

- 外部コントリビューターからのPRを受け付けなくした
- PRを作れるのはコラボレーターだけ

---

## 背景

- PRが増えた
- GitHubのinboxを見るのが追いつかない

---

## Slop？？

- 品質は悪くない → 問題は姿勢

---

## 「貢献」のための貢献

- 細かい指摘、ただのリファクタ
- コミットに入るのが嫌
- AIで加速

---

::center::

![x.com/yusukebe/status/2106657806732677205](https://ss.yusukebe.com/82bff37182c78f2c0544ce23d675a0518e5ea33bf58a284f47d65b46b6911c88.png "https://x.com/yusukebe/status/2106657806732677205")

---

## Hono-kun

- AIボットでtriage、close、PR立てる
- https://github.com/honojs/hono-kun

---

## 閉じる

- ある朝突然
- だいぶ楽！
- とはいえPRがHonoを支えてきた

---

::center::

OSSは死んだ？

---

::center::

![x.com/yusukebe/status/2108057552223359003](https://ss.yusukebe.com/db3d706124b8d1680898ee401db047052ba3b5d9032e944bbf40e18c3635d29a.png "https://x.com/yusukebe/status/2108057552223359003")

---

## 貢献の仕方

- PRをレビューしてもらう
- 実際に困ったバグをissueにする
- 欲しいものを提案する

---

::center::

開発が変わった

---

::center size=1.5 bg=white::

ユーザー

---

::center::

人間がコードを書かなくなった

→ AIがコードを書く

---

::center::

「`package.json`の中を見なくなる」

---

::center::

「Honoのことを人間は忘れてしまう」

---

## エージェントがHonoを使う

- ユーザーをエージェントとして考える
- もっとエージェントのことを知らないといけない

---

## フロントエンドカンファレンス福岡 2026

- 2026年9月12日
- 「AI時代のWebフレームワークはどこへ行く？」
- [slides.yusu.ke/web-frameworks-in-the-ai-era](https://slides.yusu.ke/web-frameworks-in-the-ai-era)

---

## Agent DX

- AIがHonoを使うDXを測る
- Evals
- [agent-dx.hono.dev](https://agent-dx.hono.dev)

::right::

![agent-dx.hono.dev](/images/fec2026/agent-dx-dashboard.png)

---

::center::

![x.com/yusukebe/status/2108928295127691453](https://ss.yusukebe.com/b37fc886a8ded5bcba39bcc2c895a86fc721344b1d474054f9f485a2a6ad2a92.png "https://x.com/yusukebe/status/2108928295127691453")

---

## Evals

- エージェントにタスクを解かせて、採点する
- 条件 → fixture × ランタイム × モデル
- 採点は普通のテストと型チェック → LLMには判定させない
- 成功率・トークン・時間を比較

::right::

![Evalsの流れ](/images/fec2026/evals-flow.svg)

---

## Claudeからも測れる

```sh
claude -p "TODOアプリをつくって。追加、編集、削除ができるように" \
  --model opus --output-format stream-json
```

- Claudeからヘッドレスで別のClaudeを動かす
- 採点はスクリプトと別のClaude → 自己申告は信じない

---

::center size=1.5::

Adoption

---

::center::

AIはHonoを使うのか？？

---

::wide::

## Adoptionのやり方

![Adoptionの流れ](/images/fec2026/adoption-flow.svg)

---

::wide::

## Adoption - claude-haiku-4-5

![Adoption claude-haiku-4-5](/images/fec2026/adoption-haiku.png "https://agent-dx.hono.dev")

---

::wide::

## Adoption - claude-opus-5

![Adoption claude-opus-5](/images/fec2026/adoption-opus.png "https://agent-dx.hono.dev")

---

## Adoption

- 案外使わない → 素で書く
- 賢いモデルほど使う
- `package.json`に`hono`があると使う

---

## `package.json`に`hono`

- Cloudflare Workers → **5/5** Hono
- Node.js → **5/5** Hono
- `hono`なし → 素のハンドラ、itty-router、Express

-# claude-haiku-4-5・n=5・福岡のあとに追加で計測

---

::center size=1.5::

Value

---

::center::

Honoを使うことはAIにとって効果的か？？

---

::wide::

## Valueのやり方

![Valueの流れ](/images/fec2026/value-flow.svg)

---

::wide::

## Value

![Value results](/images/fec2026/value-results.png "https://agent-dx.hono.dev")

---

## Value

- 成功率が上がる（2/10 → 4/10）
- コードが**30〜40%**減る
- トークンが**15〜30%**減る

---

## ユーザーがAIになった

- AIがコードを書く、AIが技術選定をする
- Agent DX
  - 案外Honoを使わない時がある
  - `hono`があればAIはHonoを使う
  - Honoを使うとAIは効率よく書ける

---

::center size=1.5 bg=white::

DX

---

::center::

ユーザーが変わるなら、DXも変わる

---

## Hono RPC

```ts
const app = new Hono().get('/posts/:id', (c) => {
  return c.json({ id: c.req.param('id') })
})

export type AppType = typeof app
```

```ts
const client = hc<AppType>('/')
const res = await client.posts[':id'].$get({ param: { id: '123' } })
```

---

::center::

型を頑張る、RPC → エディタの型補完 → 人間向けのDX

---

## RPC関係のIssue

- 2024〜2025年 → 全体の**8〜12%**
- 2026年4月〜 → 全体の**2〜3%**

-# honojs/hono・タイトルに RPC / hc / hono/client を含むissue

---

## AIにとっての型

- 型チェックはあった方がいい！
- → `tsc`で確かめることができる
- → 結局、型は必要
- とはいえ、補完のために頑張りすぎなくていい

---

## 他に人間のためのDX

- 評判 → 「Honoっていいらしい」
- 気持ちよさ → 書いてて気持ちいい「フィーリング」
- → AIは知らない

---

## 開発サーバー

- 人間はローカルに開発サーバーを立ち上げてブラウザで確認する
- AIにとって必要か？？
  - リクエストを投げて、レスポンスを確かめられればいい

---

::center size=1.5::

Practical

---

## Practicalのひとつ

- `create-hono`で作ったCloudflare Workersのテンプレをそのまま使う
- そこにエンドポイントを作らせる

---

## 開発サーバーを立ち上げる

- `package.json`に`"dev": "wrangler dev"`
- **15/15**が`wrangler dev`を起動
- 立ち上げること自体は悪くない
- 問題は⋯
  - 起動したままハングして失敗する
  - 他で立ち上げてるサーバーまでkillしてしまう

---

## AI向けのDXを考えなくてはいけない

- 補完 → 人間のため、型チェック → AIのため
- 評判・気持ちよさ → AIには届かない
- 開発サーバー → ハングする・他のサーバーを止める

---

::center size=1.5 bg=white::

設計

---

::center::

フレームワークのAPI設計はどうすればいいか？

---

::center::

![x.com/yusukebe/status/2106722774089974199](https://ss.yusukebe.com/a180d9935b405eb41e14ebad0dc8ba3165e01c41e18e3a5e3f61c753b0222bbc.png "https://x.com/yusukebe/status/2106722774089974199")

---

## ✗ 万能なAPI

- 抽象化はされているが選択肢が多い
- → AIが迷う

---

## ✗ 低レベルなAPI

- 選択肢は少ないが細かく書く必要がある
- → トークンをたくさん使う

---

## ○ 良いAI向けAPI

- 抽象化されていて選択肢が少ない
- → 少ないトークンで迷わず書ける

---

::center::

![x.com/yusukebe/status/2106788928896614752](https://ss.yusukebe.com/f149282c8d31fda25e95e3d2af68c1c6541a1a1ed7376c7729cca8b54fe072bb.png "https://x.com/yusukebe/status/2106788928896614752")

---

## 悪いコードではない

- 人間でも書いてしまいそうなコード
- ただ、バリデーションはしてほしい
- → バリデーションを迷わず書けるAPIがいい

---

## AI向けに設計をする

- AI向けのAPI → 抽象化されていて、選択肢が少ない

---

::center::

Hono

---

::center size=4 bg=white::

v5

---

## v5 RC

- `hono` → **5.0.0-rc.1**
- Hono CLI → **1.0 RC**
- `create-hono` → **0.20.0-rc.1**
- Hono Skills

-# `npm i hono@next` etc.

---

## パッケージサイズ

- ESM only
- アダプタを分離 → `@hono/*`

::right::

- **1.29 MB → 0.70 MB**（-46%）
- ファイル数 **574 → 310**

-# hono 4.13.13 vs 5.0.0-rc.1（npm）

---

## アダプタを分離

```ts
// v4
import { serveStatic } from 'hono/bun'

// v5
import { serveStatic } from '@hono/bun'
```

- `@hono/bun` / `@hono/deno` / `@hono/aws-lambda` / `@hono/vercel` ...
- `hono/cloudflare-pages` → 廃止、Workersを使う

---

## `onError()` / `notFound()` → ミドルウェアに

```ts
// v4
app.onError((err, c) => c.text('Error', 500))

// v5
app.onError((c) => c.text('Error', 500)) // c.error
```

- `(c, next)` → 普通のミドルウェアと同じ形
- `notFound()`も同じ仕組みに

---

## パスで絞れる・重ねられる

```ts
app.onError('/items/*', (c) => c.text('Items Error', 500))

app.onError(async (c, next) => {
  console.error(c.error)
  await next()
})
app.onError((c) => c.text('Error', 500))
```

- v4 → パスは取れない、後から登録したもので上書き
- v5 → パスで絞れる、順番に重なる

---

## サブアプリの`notFound()`が効く

```ts
const api = new Hono()
api.notFound((c) => c.json({ error: 'Not Found' }, 404))

app.route('/api', api)
app.notFound((c) => c.text('Page not found', 404))
```

- `/api/nope` → v4: `Page not found` / v5: `{"error":"Not Found"}`
- v4 → 親の`notFound`しか使われない

---

## その他の変更

- Error以外の`throw` → `onError`
- `c.req.query()` → `undefined`も含む
- `c.req.json()` → `unknown`を返す
- `c.json()` → JSONにできない値は`throw`
- 非推奨のものを削除 → `app.mount()` / `app.fire()` etc.

---

## `defineHandler()`

バリデーションを迷わず書ける

```ts
import { defineHandler } from 'hono/factory'

app.post(
  '/users/:id',
  defineHandler({
    param: ParamSchema,
    json: BodySchema,
    response: UserSchema
  })(async (c, { param, json }) => {
    c.status(201)
    return { id: param.id, ...json }
  })
)
```

---

## `defineHandler()`

- リクエストとレスポンスを1か所で検証
- Standard Schema → Zod / Valibot / ArkType ...
- 書き方が1つ → AIが迷わない
- experimental

---

## Hono CLI 1.0 RC

- サーバーを立てずにアプリを確かめる
- `app.request()`で直接リクエスト
- 出力は全部JSON → AIが読める
- `hono --help` → AI向けの説明から始まる

---

## `hono request`

```sh
hono request /posts/1
```

```json
{
  "ok": true,
  "data": {
    "status": 200,
    "headers": { "content-type": "application/json" },
    "body": { "id": "1", "title": "Hello" }
  }
}
```

---

## `hono batch`

```sh
hono batch - <<'EOF'
{"method":"POST","path":"/posts","body":{"title":"Hono"},"expect":{"status":201}}
{"path":"/posts/1","expect":{"status":200,"body":{"id":"1"}}}
EOF
```

- 複数のリクエストを1回で送れる
- `expect` → 期待するレスポンスを書く
- `"failed": 0` になるまで直す

---

## 他のコマンド

- `hono routes` → ソースを読まずにルート一覧
- `hono snapshot` → 今の挙動を`batch`の形で出す → リファクタの前に
- `--runtime workerd` → 本物のバインディング（KV、D1、AI）で動かす
- `--runtime vite` → Viteプラグインで組むアプリも（`request` / `batch`）

---

## Hono CLIを使うと⋯

- 開発サーバーを立ち上げない（**0/15**）
- `hono snapshot` / `hono batch`で確かめる
- 全モデルで成功率**100%**、約**30秒**

-# Agent DX・build-endpoints-workers・CLI + Skills

---

::wide::

## Sonnet 5

![build-endpoints-workers / Sonnet 5](/images/honoconf-2026/last-sonnet.svg)

---

## 賢いモデルは開発サーバーを使いこなす

```sh
(npx cf dev --port 8799 &) ; ./check.sh ; pkill -f "cf dev --port 8799"
```

- Opusは1コマンドで「起動 → 確認 → 停止」
- CLIなしでも壊さない
- ただし44回中24回 → `pkill -f vite`で他のサーバーまで止める

---

## 「カウンターをつくって」→「パスワードつけて」

- CLIなし → **13ターン・70秒**
  - `cf dev`を起動 → curl → `pkill -f vite`を2回
- CLIあり → **8ターン・39秒**
  - `hono batch`を1回ずつ → サーバーなし
- どちらも正しく動く

-# Opus・1回ずつ

---

## CLIを使う理由

- 開発サーバーで詰まらない → 起動したままハングして失敗しない
- サーバーを立てない → 他のプロセスを止めない
- 検証の道具は毎回作らず、Honoが用意する
- モデルが変われば答えも変わる → Agent DXで測り続ける

---

## Starter

- `create-hono`のテンプレに`AGENTS.md` + Hono CLI
- 「`npm run dev`は人間のため」

```md
## Hono CLI

Run `npx hono --help` first, and use the CLI instead of a dev server.
```

---

## Hono Skills

- `hono` → APIリファレンス + Hono CLIの使い方
- `hono-jsx` → `hono/jsx`でUI

```sh
npx skills add honojs/skills
```

---

## hono.dev/docs/agents

- 「Hono for Coding Agents」
- 全ページMarkdownで取れる → `Accept: text/markdown`
- `/llms.txt` / `/llms-full.txt`

---

::center size=1.5::

Demo

---

## まとめ

- 時代 → 明らかに新しい時代になった
- 開発 → PRを閉じた、でも貢献の仕方は他にもある
- ユーザー → ユーザーがAIになった
- DX → AI向けのDXを考える
- 設計 → 抽象化されていて、選択肢が少ないAPI
- v5 → AIのためのHono

---

::center size=1.5::

ありがとうございました

---

::center bg=white::

One more thing

---

::center::

Honoをopinionatedなフルスタックにする

---

```ts
// Hono v5
import { defineHandler } from 'hono/factory'

app.post(
  '/posts',
  defineHandler({ json: PostSchema })(async (c, { json }) => {
    return { received: true }
  })
)
```

::right::

```ts
// Void
import { defineHandler } from 'void'

export const POST = defineHandler(async (c) => {
  return { received: true }
})
```

---

::center::

？？？

---

::center::

![Void](https://ss.yusukebe.com/6f2e473739d234944a692a18b98f9788bc41654b20efe5b06776c00dd542701e.png)

---

::center::

Void by VoidZero

-# [void.cloud](https://void.cloud)

---

::center size=2 bg=white::

Hono v5

---

::center size=1.5::

```sh
npm create hono@next
```

-# [hono.dev/docs/guides/migrating-to-v5](https://hono.dev/docs/guides/migrating-to-v5)
