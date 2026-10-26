---
title: JevRouterについて
description: Cloudflare Workers実践LT 〜移行から運用、コストの話まで〜
author: Yusuke Wada / yusukebe
date: 2026-09-24
slug: jev-router
source: https://slides.yusu.ke/jev-router
---

::title::

# JevRouterについて

Yusuke Wada

Cloudflare Workers実践LT 〜移行から運用、コストの話まで〜 ・ September 24, 2026

---

## Yusuke Wada

- Cloudflare Senior Developer Advocate
- Creator of Hono

::right::

![me](https://ss.yusukebe.com/d0630d477f3a3a3eb97f2711dcac50cef18715c73da36879f8da6bb904578ed8.png)

---

::center::

Jev!!

---

::center::

JevRouterを作った話

---

## JevRouter

- Honoのルーターの一つ
- 本当にルーターのスペックを満たしている
- 意味（自然言語）によってルーティングを指定できる
- npm package: `hono-jev-router`
- GitHub: https://github.com/yusukebe/hono-jev-router

---

## Honoでルーターを変更する方法

```ts
import { PatternRouter } from 'hono/router/pattern-router'

const app = new Hono({
  router: new PatternRouter()
})
```

---

## JevRouterを使う

```ts
import { Hono } from 'hono'
import { JevRouter } from 'hono-jev-router'

const app = new Hono({
  router: new JevRouter()
})
```

---

## ユースケース例

- 「AIエージェントからのリクエストだよ」=> Markdownを見せる
- 「人間からのリクエストだよ」=> HTMLページを見せる
- 「自動化されたアクセスだよ」 => ブロックする

---

## コード

```ts
app.on('jev', 'AIエージェントからのリクエストだよ', (c) => {
  return c.text('# Documentation', 200, { 'Content-Type': 'text/markdown' })
})

app.on('jev', '人間からのリクエストだよ', (c) => {
  return c.html('<h1>Documentation</h1>')
})

app.on('jev', '自動化されたアクセスだよ', (c) => {
  return c.text('Forbidden', 403)
})
```

---

## 仕組み

![リクエスト => Jev => ルートを選ぶ](/images/jev-router/flow.svg)

---

## Jevに渡すもの

```json
{
  "state": {
    "method": "GET",
    "url": "https://example.com/docs",
    "headers": {
      "user-agent": "claude-code/2.0",
      "accept": "text/markdown",
      "cookie": "[redacted]"
    }
  },
  "questions": {
    "route_1": {
      "type": "noul",
      "instructions": "A router has a handler for requests described as \"AIエージェントからのリクエストだよ\". Is this HTTP request one that the handler should receive?"
    }
  }
}
```

---

## Jevから返るもの

```json
{
  "answers": {
    "route_1": { "noul": 0.94 },
    "route_2": { "noul": 0.2 },
    "route_3": { "noul": 0.05 }
  }
}
```

---

::center::

デモ

-# https://hono-jev-router.yusuke.run

---

```bash
npx hono request /docs -H 'user-agent: claude-code/2.0' -H 'accept: text/markdown'

npx hono request /docs -H 'user-agent: Mozilla/5.0 (Macintosh) Safari/605.1' -H 'accept: text/html'

npx hono request /docs -H 'user-agent: python-requests/2.31' -H 'accept: */*'
```

---

```bash
npx hono request /support -X POST \
  -d '先月の請求額が2回引き落とされてるみたいなんですが、確認できますか？'

npx hono request /support -X POST \
  -d 'もう使わないので解約したいです。手続きを教えてください。'

npx hono request /support -X POST \
  -d '3回問い合わせてるのに返事がない。いい加減にしてください。今すぐ対応して。'

npx hono request /support -X POST \
  -d 'ダークモードって対応予定ありますか？'
```

---

## ミドルウェアというアプローチ

```ts
import { createMiddleware } from 'hono/factory'

export const jevMiddleware = (question: string, threshold = 0.8) =>
  createMiddleware(async (c, next) => {
    const state = await c.req.text()
    const res = await c.env.AI.run('typesafe/jev', {
      state,
      questions: { flag: { type: 'noul', instructions: question } }
    })
    const p = (res.result ?? res).answers.flag.noul
    if (p > threshold) {
      return c.json({ blocked: true, probability: p }, 400)
    }
    await next()
  })
```

---

## 使い方

```ts
import { Hono } from 'hono'
import { jevMiddleware } from './middleware'

const app = new Hono()

app.post('/comments', jevMiddleware('これはスパムですか？'), (c) => {
  return c.json({ posted: true })
})

export default app
```

---

## スパム判定されるリクエスト

```bash
npx hono request -X POST -d "副業で月収100万円！スマホだけで誰でも簡単！今すぐLINE登録" /comments ./src/using-middleware.ts
```

---

## まとめ

- JevRouter => 意味でルーティングするHonoのルーター
- リクエスト => Jev => ルートを選ぶ
- ミドルウェアにするとわりと実用的
- アクセス量（料金）、速度が許容できれば使えるかも

---

- GitHub: https://github.com/yusukebe/hono-jev-router
- Playground: https://hono-jev-router.yusuke.run
