---
title: Agents SDKについて
description: Workers Tech Talks in Kyoto #2
author: Yusuke Wada / yusukebe
date: 2026-07-08
slug: agents-sdk
source: https://slides.yusu.ke/agents-sdk
---

# CloudflareでAIエージェントを作るのに便利なやつ

Yusuke Wada

Workers Tech Talks in Kyoto #2

---

## Yusuke Wada

- Cloudflare Developer Advocate
- Creator of Hono

::right::

![me](https://ss.yusukebe.com/d0630d477f3a3a3eb97f2711dcac50cef18715c73da36879f8da6bb904578ed8.png)

---

## アジェンダ

- AIエージェントについて
- AIエージェントを作るの便利なCloudflareの機能をデモと共に紹介

---

## AIエージェントとは？

> AIエージェントは、AIを活用したコンピュータプログラムで、明示的な指示がなくても自律的にタスクを実行して人間のユーザーを支援することができます。
>
> https://www.cloudflare.com/ja-jp/learning/ai/what-is-agentic-ai/

---

## AIの変遷

![AIの変遷](https://ss.yusukebe.com/ab5e53a8d9ef72edb2b738acd231f4183583b38ee465018b334f9f8bf8b30a11.png)

---

## AIエージェントの例

- コーディングエージェント
- 旅行のプラン作ってチケットとか取ってくれるやつ
- ビジネス業務で競合のリサーチとか、データ分析とかして資料作ってくれるやつ

---

## CloudflareはAIエージェント構築に向いている

- V8 Isolateで動くWorkersがAIエージェントのアーキテクチャに合ってる
- AIエージェント向けの機能が揃っている
- 参考文献 => [AIエージェントはCloudflareに賭けろ](https://zenn.dev/yusukebe/articles/ccb1f953e48ee1)

---

## "Cloudflare Agents"は既存の機能の合わせ技

- https://developers.cloudflare.com/agents/

![Cloudflare Agents](https://ss.yusukebe.com/cf6507d55de52586e9629a68fbd2b21a77f7d6c294f3fc6eef2265f502c390c2.png)

---

- Workers
- Durable Objects
- Workers AI
- AI Search
- Vectorize
- Sandboxes
- Dynamic Workers
- Browser Run
- ...

---

## 中でも最近使って便利なやつ

- どんな機能なのか？
- デモと共に紹介します

---

## 1. Agents SDK

- エージェント構築のためのSDK
  - Schdule tasks, Queue tasks, Email Routing...
- サーバーサイドのステート管理ができる

---

## サーバーサイドでステート管理をしたい

- LLM呼び出しは時間がかかる
  - 会話履歴、タスクの進行状態を保持したい
  - 進捗をリアルタイムに確認したい
- クライアントを閉じても動き続けてほしい
- 複数のクライアントから同じエージェントを見たい

---

## Agents SDKでできること

- 状態の保持 - エージェントはコンテキストとメモリをそれぞれのDurable Objects内のSQLiteに持つ
- リアルタイムで同期 - 状態が変更されると自動的にWebSocketで接続したクライアントにブロードキャストされる
- 休止と再開 - エージェントがアイドルすると休止し、オンデマンドに立ち上がる。使った時にだけ課金が走る

---

## コード例: Agentsクラス

```ts
import { Agent, callable } from 'agents'

export class CounterAgent extends Agent {
  initialState = { count: 0 }

  @callable()
  increment() {
    this.setState({ count: this.state.count + 1 })
    return this.state.count
  }
}
```

---

## コード例: useAgent

```tsx
import { useState } from 'react'
import { useAgent } from 'agents/react'

export function CounterWidget() {
  const [count, setCount] = useState(0)

  const agent = useAgent({
    agent: 'CounterAgent',
    onStateUpdate: (state) => setCount(state.count)
  })

  return (
    <>
      {count}
      <button onClick={() => agent.stub.increment()}>+</button>
    </>
  )
}
```

---

## デモ: カウンター

- https://github.com/yusukebe/agent-examples
- https://my-counter.yusukebe.workers.dev/

---

![counter](https://ss.yusukebe.com/agent-counter.gif)

---

## 2. Workers AI

- 推論モデルがCloudflare上で動く
- 80のオープンモデル
- 外部プロバイダも合わせると199モデル

::right::

![ss](https://ss.yusukebe.com/c8812485cc5dcff9a353a26db9bd46a015e5a38dadea2c51e658dc515e279407.png)

---

## コード例

```ts
app.get('/', async (c) => {
  const prompt = c.req.query('q') ?? 'Explain Cloudflare Workers in one sentence.'

  const result = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct-fast', {
    messages: [{ role: 'user', content: prompt }]
  })

  return c.json(result)
})
```

---

## 3. Schedule tasks

- 将来のタスクをスケジュールする
- 今からx秒後、明日の8時、定期的に実行
- 「あとでメールを送信」「毎朝ニュースをまとめる」

---

## コード例

```ts
import { Agent } from 'agents'

export class Reminder extends Agent<Env, { message?: string }> {
  async remind(seconds: number, text: string) {
    await this.schedule(seconds, 'notify', { text })
  }

  // 時間が来たら呼ばれる
  async notify({ text }: { text: string }) {
    this.setState({ message: text }) // クライアントに自動同期
  }
}
```

---

## タイミングの指定方法

```ts
await this.schedule(60, 'notify', { text }) // 60秒後
await this.schedule('0 9 * * *', 'notify', { text }) // 毎朝9時（cron）
await this.schedule(new Date('2026-07-08 19:00'), 'notify', { text }) // 特定日時
```

---

## デモ: memo2task

- https://github.com/yusukebe/memo2task
  - 雑なメモをAIがタスクにしてくれる
    - タスクのタイトル
    - 期限
- ブラウザ通知

---

![memo2task](https://ss.yusukebe.com/memo2task.gif)

---

## 4. Workflows

- Cloudflare Workflowsを呼び出す
- マルチステップなバックグラウンド処理をすることができる
- 自動リトライ、リカバリ、外部処理を待つ

---

## コード例 (Cloudflare Workflows)

---

## 5. Browser Run

- 旧Browser Rendering、AIエージェント向けに進化
  - Cloudflare上でヘッドレスブラウザが動く
  - スクリーンショット、PDFの生成、自動化したブラウザタスク
- 2つの方法
  - Browser Sessions
  - Quick Actions

---

## Quick Actions

- ステートレスなブラウザタスクを実行する
  - スクリーンショット、PDF生成、スクレイピング

---

## コード例

```ts
app.get('/', (c) => {
  const url = c.req.query('url') ?? 'https://example.com'
  return c.env.BROWSER.quickAction('screenshot', { url })
})
```

---

- `/content` - Fetch HTML
- `/screenshot` - Capture screenshot
- `/pdf` - Render PDF
- `/markdown` - Extract Markdown from a webpage
- `/snapshot` - Capture multiple page formats
- `/scrape` - Scrape HTML elements
- `/json` - Capture structured data using AI
- `/links` - Retrieve links from a webpage
- `/crawl` - Crawl web content

---

## デモ: screenshot-workflow

![screenshot-workflow](https://ss.yusukebe.com/screenshot-workflow.gif)

---

## より実践的なデモ: Meshi Agent

- チャットしてごはん屋さんを探してくれる
- カード表示
- Googleの情報
- 食べログのリンク付き

---

## 使った技術

- Workers - 実行環境
- Agents SDK - 会話エージェント
  - Durable Objects - 会話の永続化、クライアントの同期
  - ステートのブロードキャスト
- Workers AI / OpenAI API - 推論モデル
- Browser Run - 食べログのURLを取得
- Workflows - 検索バッチのステップ管理
Google Place API => AIが店を選ぶ => 食べログのURLを取得 => カード表示

---

## まとめ

- AIエージェントについて
- AIエージェントを作るの便利なCloudflareの機能をデモと共に紹介
  1. Agents SDK
  2. Workers AI
  3. Schedule tasks
  4. Workflows
  5. Browser Run
