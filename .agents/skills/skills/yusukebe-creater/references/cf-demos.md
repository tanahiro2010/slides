---
title: 動くデモサイトを作る
description: Workers Tech Talks in Osaka #3
author: Yusuke Wada / yusukebe
date: 2026-08-07
slug: cf-demos
source: https://slides.yusu.ke/cf-demos
---

# 動くデモサイトを作る

Yusuke Wada

Workers Tech Talks in Osaka #3

---

## Yusuke Wada

- Cloudflare Senior Developer Advocate
- Creator of Hono

::right::

![me](https://ss.yusukebe.com/d0630d477f3a3a3eb97f2711dcac50cef18715c73da36879f8da6bb904578ed8.png)

---

## 今日話すこと

- Cloudflareの製品を紹介するためのデモサイトを作った
- => 仕組みが面白いので紹介

---

## そもそも何か？

---

## プロダクトを紹介したい！

- たくさんあるCloudflareプロダクトを紹介したい
- 最低限のコードを見せたかった
  - 例: ワークショップ、ハッカソンで紹介

::right::

![dos](https://ss.yusukebe.com/8e5df9a9a3ff67e062d62de8dadafec4e3bced14e58a7093f18e22eae1add98e.png)

---

## 最低限のコード例

```ts
import { Hono } from 'hono'

const app = new Hono<{ Bindings: Env }>()

app.get('/markdown', (c) => {
  const url = c.req.query('url') ?? 'https://example.com'
  return c.env.BROWSER.quickAction('markdown', { url })
})

export default app
```

---

## どうするか？

- GitHubのレポを作った
- `demos`
  - `browser-run`
  - `cron`
  - `d1`
  - `durable-objects`
  - ...

::right::

![github](https://ss.yusukebe.com/007c2e08233a5ce9ad7acb84291349d8ee0bc7ae9c409df8c5c7fec4a0687200.png)

---

## どうせなら...

- どうせならWebページを作りたい！
  - `https://cf-demos.yusuke.run/`
- どうせならWebページ上で動かしたい！
  - => **動くデモサイト**

---

## 動かす？

---

## WebページはWorkersで動いている

- https://cf-demos.yusuke.run/

::right::

![web](https://ss.yusukebe.com/826d0b5aedac54e5261bb2b49be56821ddcca0cd5ada17e84a4e321bbd1464e1.png)

---

## 各デモは独立したWorkersプログラムになっている

```ts
// cloudflare-demos/demos/browser-run/src/index.ts
import { Hono } from 'hono'

const app = new Hono<{ Bindings: Env }>()

app.get('/markdown', (c) => {
  const url = c.req.query('url') ?? 'https://example.com'
  return c.env.BROWSER.quickAction('markdown', { url })
})

export default app
```

::right::

![github](https://ss.yusukebe.com/632e7fe762111ebfba6a4a4496206ddf378526e41c4e581a5eab6fedc3440d2c.png)

---

## WorkersからWorkersを立ち上げらればいい！

---

## Dynamic Workers

- Workersを独立した環境で動的に立ち上げることができる

---

## コードの中にコードを書ける

```ts
// src/index.ts
export default {
  async fetch(request, env): {
    const worker = env.LOADER.load({
      compatibilityDate: '2026-06-01',
      mainModule: 'src/index.js',
      modules: {
        'src/index.js': `
          export default {
            fetch(request) {
              return new Response("Hello from a dynamic Worker");
            },
          };
        `
      }
    })
    const entrypoint = worker.getEntrypoint()
    return entrypoint.fetch(request)
  }
}
```

---

詳しくは2026年6月3日「Workers Tech Talks in Hokkaido #2」でやった[「Dynamic Workersについて」](https://speakerdeck.com/yusukebe/dynamic-workersnituite)を参考に

---

## 基本的な仕組み

1. 親Workerがデモ用のコードを持っている
2. リクエストが来たら、対象のデモのコードをDynamic Workersで実行
3. デモWorkerにリクエストを渡す
4. レスポンスをそのまま返却

---

## もう少し詳しく

---

## 例: KVのデモコード

```ts
// demos/kv/src/index.ts
import { Hono } from 'hono'

const app = new Hono<{ Bindings: Env }>()

app.get('/keys/:key', async (c) => {
  const value = await c.env.KV.get(c.req.param('key'))
  return c.text(value)
})

export default app
```

---

## 1. ブラウザからリクエスト

WebのUI

![browser](https://ss.yusukebe.com/3749e62d32c467a2380bdc0e7039b21c3d0e97c0b3d1d38bca308688c8f18923.png)

::right::

親Workerへのリクエスト

```js
// GET /run/kv/keys/greeting
fetch('/run/kv/keys/greeting')
```

---

## 2. 親WorkerがデモWorkerを立ち上げる

- 親Worker`app.all('/run/:name/*', ...)`が実行される
- パス`/run/kv/keys/greeting` => 「`kv`」のデモコードを取得
- デモコードをDynamic Workersで立ち上げる
- パスを`/keys/greeting`に書き換えて、デモWorkerにリクエストを送る
- デモの`app.get('/keys/:key', ...)`が動く

---

![image](https://ss.yusukebe.com/5496433ac357fbf8d8e0cc083db2e46236c6a4cf0c7dc7ee2cda78cd4da75881.png)

---

## Bindingsをどう実現しているか？

---

## 問題

1. 親WorkerのBindings `env.KV` はそのまま渡せない
2. デモごとにネームスペース、データベースを分けたい
3. デモWorkerは外部へのアクセスを制限したい（`globalOutbound: null`等）

---

## やりたいこと

デモのコードは本物のWorkerと同じまま、実行環境だけ多人数共有のサンドボックスにする

---

## どうやってるか

---

## カスタムBindingsを作る

- KVのAPIを模したカスタムBindingsを作成
- `WorkerEntrypoint`で定義
- セッションごとにネームスペースを作る

```ts
import { WorkerEntrypoint } from 'cloudflare:workers'

export class KVFacade extends WorkerEntrypoint<Env, Props> {
  #key(key: string) {
    // prefix => `sessions:${sid}:kv`
    return `${this.ctx.props.prefix}:${key}`
  }
  get(key: string) {
    return this.env.SITE_KV.get(this.#key(key))
  }
}
```

---

## デモWorkerに渡す

- Execution Contextの`exports`からカスタムBindingsを取得
- `KV`の名前で参照可能に
- デモWorkerもセッションごとに立ち上げる

```ts
const worker = c.env.LOADER.get(`kv@${sid}`, async () => ({
  mainModule: 'index.js',
  modules: { 'index.js': bundle },
  env: {
    KV: c.executionCtx.exports.KVFacade({ props: { prefix: `sessions:${sid}:kv` } }) }
  },
  globalOutbound: null
}))
```

---

## 対応プロダクト

![cf-demo](https://ss.yusukebe.com/b98b8ef5b8b23a6a77874b366274b39c46834515fb36f6a5ed4d3c7c1d2c95d7.png)

---

## その他工夫した点

---

## 3つのRate Limiting

- `RUN_LIMITER`（30回/分・IPごと）- 通常デモ
- `AI_LIMITER`（5回/分・IPごと）— Workers AI / Browser Runなど高いサービス
- `DEMO_LIMITER`（5回/分）— Rate Limitingのデモ用

---

## デモ

---

## まとめ

- Cloudflareの製品を紹介するデモサイトを作った
- 動かすのにDynamic Workersを使った
- 仕組み
- 工夫した点
