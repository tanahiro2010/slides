---
title: Cloudflare AgentsがPi 1.4に対応したので、Agentの中断・復旧・永続化を検証する
description: 〜 復旧は成功しました。副作用が2回起きただけです 〜
author: 田中博悠 / tanahiro2010
date: 2026-10-25
slug: support-agents-pi-1.4
published: false
---

::title::

# Cloudflare AgentsがPi 1.4に対応したので、Agentの中断・復旧・永続化を検証する

〜 復旧は成功しました。副作用が2回起きただけです 〜

田中博悠 / tanahiro2010

::note::

「Cloudflare AgentsがPi 1.4に対応したので、Agentの中断・復旧・永続化を検証する」、田中博悠です。よろしくお願いします。

全 114 枚・想定 15〜20 分。**LT 枠（5分）なら「章3 土台」「章8 戻せない理由」「章9 測り直した3件」を落とす** → 約 70 枚。

---

## 田中博悠 / tanahiro2010

- 三田学園高等学校 1年
- GDG Greater Kwansai
- Cloudflare Workers と Durable Objects で個人開発

# Agent に外部APIを叩かせてます

::note::

高校1年です。Workers と Durable Objects で個人開発をしていて、Agent にツールを持たせて外部 API を叩かせている側の人間です。

だから今日の話は他人事じゃない、という立場で聞いてください。

**15 秒で切る。**

---

::center::

2026年10月22日

---

::center::

Cloudflare が「Pi 1.4 に対応した」と発表

-# Agents SDK v0.30.0

---

## Changelog に 4 点

- Hibernation
- Parked Tasks
- Storage Error Recovery
- Model Stream Retry

::note::

Durable Object の上で動く Agent が、落ちても復旧できるようになる。

4 つ並んでいました。

---

::center size=2::

**落ちても復旧できる**

---

::center::

面白そう、測ってみるか

---

::center size=1.5 bg=#b91c1c::

前提が3つ崩れた

---

## 崩れた前提

- 4点のうち**2点は Pi 1.4 の機能じゃなかった**
- 検証に使う予定だった **0.30.0 にバグ**があった
- Storage Error Recovery は**進行中の呼び出しを救わない**

::note::

測る前に、です。

ドキュメントを読んで、配布物を読んだだけで、ここまで出てきました。

---

::center::

そして実際に測ったら

---

::center size=2::

**`replay: "safe"` と書いたツールが**

**副作用を2回起こした**

---

::center::

Pi から見れば、復旧は成功しています

-# run は `done`、エラー報告も無し

---

::center size=1.5::

あなたの Agent のツール

`replay` に何を書きましたか？

::note::

ここ、問いかけて少し待つ。

書いていない人がほとんどのはずです。そして**書かなければ `unsafe`** です。

これが今日の話の入口になります。

---

::center size=1.5 bg=white::

章1

Pi と PiHarness

---

## 登場人物は3層

| | 誰のもの | 何を持つ |
|---|---|---|
| **Pi Durable** | earendil-works | Agent の実行ループ |
| **PiHarness** | Cloudflare | SQLite と起こす仕組み |
| **Lifecycle** | Cloudflare | 長時間の仕事を回す土台 |

::note::

ここを混ぜると、以降の話が全部おかしくなります。

Pi は Cloudflare のものじゃない。別会社のパッケージです。

---

::center::

Pi は別会社のパッケージ

-# `@earendil-works/pi-durable`

---

::center size=2::

**`agents` 1 リリース = Pi 1 マイナー**

-# peer dependency は `~1.4.0` — チルダ指定

::note::

Pi 1.5 が出ても、agents 0.30.x は受け付けません。

実験的なパッケージなので、こう縛っていると公式が明記しています。

---

## 保存と再開は別の機能

- 保存は `pi_` 接頭辞の SQLite テーブル
- 再開は Lifecycle の Wake ジョブ（Alarm で起こす）

# 保存できていても、起こされなければ再開しません

---

::center::

設計記事より

> every step of a run is a task
> that stores a checkpoint before it moves on

-# earendil.com、2026年10月1日

---

::center size=1.5 bg=white::

章2

Changelog の4点を割る

---

::center::

4点を、出どころでたどりました

---

## 層が2つに割れた

| 項目 | どこの変更か |
|---|---|
| Hibernation | **Pi 1.4** |
| Parked Tasks | **Pi 1.4** |
| Storage Error Recovery | **Agents SDK のみ** |
| Model Stream Retry | **Agents SDK のみ** |

---

::center::

PR #2643 の本文

> Each string checked against the classifier
> in **installed Pi 1.3.0** and Pi main

---

::center size=2::

**Pi 1.3 でも成立する**

-# 2点は Pi のバージョンと関係ない

::note::

つまり「Pi 1.3 と 1.4 を比べる」という検証計画は、この2点については軸が間違っていました。

正しい軸は agents の 0.29.0 と 0.30.x です。

ベンダーの Changelog は、機能の出どころを語ってくれません。

---

::center size=1.5 bg=#ca8a04::

もうひとつ

---

::center::

公式が案内する 0.30.0 で組もうとしました

---

::center::

目玉の Hibernation が効かないバグがありました

-# cloudflare/agents#2683

---

::center::

> PiHarness onWake can leave due sleeps
> unresumed while another task is active

---

::center size=2::

**発表から28時間でパッチ**

-# 0.30.0 → 0.30.1

::note::

煽る話ではありません。Cloudflare 自身が報告して、自分で直しています。

PiHarness が Beta である、という自己申告の具体例として扱います。

ただ、**0.30.0 で測ると「Pi 1.4 の Hibernation が動かない」という誤った結論になります**。

---

::center size=1.5 bg=white::

章3

まず土台を測る

---

::center::

ここを飛ばすと、以降の観測が全部疑わしくなります

---

## Durable Object の書き込み

- メモリ上のバッファに入る
- 非同期でディスクに落ちる

# `ctx.abort()` の直前に書いても、消えます

---

## 同じ記録を、`sync()` の有無だけ変えた

| 記録の仕方 | 跨いで残った行 |
|---|---:|
| `ctx.storage.sync()` あり | **1** |
| `sync()` なし | **0** |

-# どちらも instanceId が変わっている（本当にリセットされた）

::note::

対照があるので、「記録が失敗した」ではなく「ディスクに落ちる前にプロセスが消えた」と言えます。

レコーダが信用できることを先に示してから、本題に入ります。

---

::center::

障害注入は `ctx.abort()` を使います

---

::center::

> Calling `abort` immediately resets a Durable Object.
> **Application code cannot catch this error.**

---

::center size=2::

**例外送出とは別物**

-# この違いが章4で効きます

---

::center size=1.5 bg=white::

章4

復旧は、本当に動く

---

::center::

ツールを1回使う run を完了させてから、落としました

---

## 再起動を跨いで

| | 前 | 後 |
|---|---:|---:|
| インスタンス識別子 | — | **変化** |
| transcript のエントリ | 5 | 5 |
| ツール実行 | 1 | 1 |
| 副作用 | 1 | 1 |

-# 完了済みのタスクは再実行されません

---

::center::

クライアントを切っても、実行は続きます

---

## WebSocket を実行中に切断

- 結果は `done`
- モデル呼び出しは 3 回（失敗2 + 成功1）
- **インスタンス識別子は切断の前後で同一**

::note::

対照が効いています。

インスタンスが変わっていないので、これは「落ちて復旧した」のではなく、**実行がクライアント接続に依存していない**という観測です。

この対照が無いと、両者を区別できません。

---

::center size=1.5 bg=#16a34a::

Parked Tasks

---

::center::

クラッシュし続けるタスクを止める仕組みです

---

## 同じ場所で落とし続けた

| 落とし方 | 再起動 | `pending()` |
|---|---:|---|
| `ctx.abort()` | 2 | **`parked`** |
| 例外送出 | **0** | 空（決着） |

-# `restartLimit` は 2 に下げています

::note::

例外は Durable Object をリセットしないので、インスタンス生成が0回。

再起動カウントは1度も増えません。README の「a close is not counted」の、実際の意味です。

さっきの `ctx.abort()` の話が、ここで効きます。

---

::center size=2::

**parked 後、alarm は null**

-# 起こし続けません

---

## 抜け方は2通り

| | `retry()` | `abort()` |
|---|---|---|
| `wait()` | **`done`** | **`unanswered`** |

-# 何も parked していなければ `retry()` は `false`

::note::

「片付いた」のか「やり遂げた」のかが区別できます。

対照も取ってあります。何も parked していない状態で retry を呼ぶと false が返る。だから「再開した」と「そもそも何も止まっていなかった」が別物だと言えます。

---

::center::

ここまでは全部ドキュメント通りです

---

::center size=1.5 bg=#ca8a04::

ここからが本題

---

::center size=1.5 bg=white::

章5

`replay: "safe"`

---

::center::

公式ドキュメントの Recovery 表

---

## 中断されたとき

| | Pi の扱い |
|---|---|
| `replay: "safe"` | 再実行する |
| それ以外 | 再実行しない |

---

::center size=2::

**`unsafe` が既定値**

-# 何も書かなければ全ツールが unsafe

::note::

型定義にも「Default unsafe」と書いてあります。

ここ、意外と知られていないはずです。

---

::center::

4本のツールを、同じ条件で中断させました

---

## 実行回数と副作用回数を、別々に数える

- `write_record` — safe・冪等
- `bump_unsafe` — 未指定・**非冪等**
- `bump_safe_unguarded` — **safe・非冪等**
- `bump_safe_guarded` — safe・冪等キーあり

::note::

3番目が本命です。

`safe` と宣言しているのに冪等ではない。公式が言う「running it twice is harmless」を破っているツールです。

実際のコードでは、やりがちだと思います。

---

::center::

中断する位置も2つ

-# 副作用の確定前 / 確定直後

---

## 結果

| ツール | 中断位置 | 実行 | **副作用** |
|---|---|---:|---:|
| `bump_unsafe` | 確定前 | **1** | 0 |
| `bump_unsafe` | 確定直後 | **1** | 1 |
| `bump_safe_unguarded` | 確定前 | 2 | 1 |
| `bump_safe_unguarded` | 確定直後 | 2 | **2** |

---

::center size=2::

**副作用が2回**

---

## イベント列

```console
 6 tool_committed   {value: 1}
 7 fault_injected   {mode: abort}
 8 instance_started {factoryRuns: 0}
!!11 tool_committed   {value: 2}
```

-# 8 で別インスタンスになっている

---

::center::

対照が2つ効いています

---

## 対照

- `bump_unsafe` が1回で止まる
  → **再実行が本当に起きている証明**
- 冪等キーありが1回に収まる
  → **Pi の復旧が壊れているのではない証明**

::note::

この2つが無いと、「2回になった」という数字だけでは何も言えません。

再実行されていないのかもしれないし、Pi が壊れているのかもしれない。対照で潰してあります。

---

::center size=2::

**Pi から見れば、正常に復旧している**

-# run は `done`、警告も出ません

---

::center::

ローカルと実デプロイで、8ケースすべて一致しました

---

::center size=1.5::

`safe` は冪等性の**宣言**であって

**検査**ではありません

::note::

ここが今日の一番の話です。

宣言を間違えても、Pi は何も言いません。復旧は成功し、run は done で終わり、副作用だけが2回起きます。

---

::center size=1.5 bg=white::

章6

では unsafe なら安全か

---

::center::

`unsafe` のツールは再実行されません

---

::center::

でも、確定した副作用は残ります

---

## 中断あり3回、実モデルで

| | 実行 | 副作用 | **完了** |
|---|---:|---:|---:|
| 中断なし（対照） | 1 | 1 | 1 |
| 確定直後に中断 | 1 | 1 | **0** |

-# Workers AI `@cf/zai-org/glm-4.7-flash`

---

::center size=2::

**完了が 0**

-# 副作用は確定したのに

::note::

ビジネス処理は実行済みなのに、Agent はそれを「終わった」と記録していません。

それでも run は決着します。

**実行されたのに、実行されたと分からない状態が残る。**

冪等キーが要る本当の理由は、再実行されるからだけじゃありません。

---

::center::

ではモデルには何が渡るのか

---

## 中断された tool-result

```json
{
  "toolName": "bump_unsafe",
!!  "isError": true,
  "content": [{ "type": "text", "text":
!!    "<harness>[error] Tool bump_unsafe was
!!     interrupted and may have partially run</harness>" }]
}
```

---

::center size=2::

**英文1行**

-# 構造化フラグではありません

::note::

専用のエントリ種別ではなく、同じ `pi.tool-result` に入ります。

モデルは「部分的に実行されたかもしれない」という自然文をそのまま読む。

だから、そのあとどう振る舞うかはモデル依存になります。仕様が決めているのは「自動では再実行しない」ことと「この文を渡す」ことまでです。

---

::center size=1.5 bg=white::

章7

Hibernation

---

::center::

ここで1回、測り方を間違えました

---

::center::

alarm の時刻を測ったんです

---

## ローカルで測った結果

| `onWake` | 配線 | alarm までの秒数 |
|---|---|---|
| 渡す | `true` | 17 15 12 10 7 5 |
| 渡さない | `false` | 17 15 12 10 7 5 |

-# 6サンプルすべて一致

::note::

設定は届いていました。onWakeWired が false になっている。

それでも差が出ない。

ここで「Hibernation は効いていない」と書きかけました。

---

::center size=2::

**alarm は代理指標じゃなかった**

---

::center::

PR #2619 の表が比べているのは

---

::center size=1.5::

**オブジェクトがメモリに留まる時間**

::note::

onWake を渡さないと、Pi がインメモリタイマーを張る。それがオブジェクトを掴みます。

workerd のローカル実行では本番と同じ退避が起きないので、ローカルでは観測できません。

---

::center::

観測するものを変えました

---

::center size=1.5::

リトライは

**どのインスタンスで走るか**

---

## `onWake` を渡した場合

```console
model_error@b42b1d7d
!!instance_started@2bc10139
model_request@2bc10139
```

-# 失敗したのと別のインスタンスで再開

---

## 渡さなかった場合

```console
model_error@67b53297
model_request@67b53297
```

-# 同じインスタンスのまま

---

::center size=2::

**退避されていた**

-# 90秒の待機中、メモリから落ちていました

::note::

待機中は一切リクエストしていません。

1回でも触ると、オブジェクトが起きて、測りたい現象が消えます。

backoff 90秒と60秒で、別の Durable Object で2回、独立に再現しました。

---

::center::

issue #2683 の報告者も、ここで止まっていました

> not yet on a deployed
> Cloudflare Durable Object

---

::center size=1.5 bg=#ca8a04::

ついでに

---

::center::

0.30.0 のバグも再現しました

---

## 条件を2セッションで作る

- セッション A は 60 秒走るツール（work）
- セッション B は 12 秒の backoff（sleep）
- A を先に走らせてから B を投げる

---

## B が再開するまで

| | B 単独 | 並行 work あり |
|---|---:|---:|
| `agents@0.30.1` | 12s | **12s** |
| `agents@0.30.0` | 12s | **57s** |

-# 57秒は A の残り時間とほぼ一致

::note::

B の再試行が、A が終わるまで止まっていました。

対照が2方向に効いています。B単独が両版とも12秒なので、差はバージョンそのものではなく並行実行の有無で出ている。0.30.1 の並行ありも12秒なので、並行実行そのものが遅いわけでもない。

---

::center size=2::

**`agents` は 0.30.1 以降**

---

::center size=1.5 bg=white::

章8

戻せない理由

---

::center::

Changelog の警告

> a deployment cannot roll back
> past this upgrade

---

## マイグレーション定義の差

| | 定義 |
|---|---|
| `pi-durable@1.3.0` | `version: 1` のみ |
| `pi-durable@1.4.0` | `version: 1` と **`version: 2`** |

-# 実測したスキーマ版は `2`

---

## 1.3 のランナー

```js
if (row.version > currentVersion) {
!!  throw new Error(`schema version ${row.version} is newer
!!    than supported version ${currentVersion}`);
}
```

---

::center::

追加されたマイグレーションの名前が

---

::center size=2::

**`sleepingStatus`**

::note::

Pi 1.4 の Breaking Changes にある「Tasks have a sleeping status」がこれです。

そして sleeping 状態は、耐久スリープ、つまり**さっきの Hibernation を成り立たせている仕組みそのもの**。

---

::center size=1.5::

退避できるようになった代償が

スキーマの非互換でした

-# 警告と目玉は、同じ変更の表と裏

---

::center size=1.5 bg=white::

章9

測り直した3件

---

::center::

この章を落とすと、章5の数字も信用されません

---

::center::

1件目、イベントの取りこぼし

---

## 遅いリスナーを張った

| ドレイン | 遅延 0ms | 遅延 1500ms |
|---|---:|---:|
| 8 秒 | 22 | **14** |
| 30 秒 | 22 | **22** |

-# 差は、自分が WebSocket を早く閉じた副作用でした

::note::

最初は「遅いリスナーはイベントを取りこぼす」と出ました。

ドレインを延ばしたら同数になった。

8秒のまま書いていたら、誤った主張を載せていました。

---

::center::

2件目、「進捗」の定義

---

::center::

自前カウンタの更新を進捗と呼んでいました

-# Pi から見れば、それは進捗じゃない

---

::center::

3件目、heartbeat

---

## work と sleep は別の状態

| 状態 | alarm |
|---|---|
| work がある | 30 秒のノコギリ波 |
| task が sleep | wake 時刻まで単調に減る |

-# sleep を測って「30秒にならない」と書きかけました

---

::center size=2::

**3件とも、対照を組み直して気づいた**

---

::center size=1.5 bg=white::

まとめ

---

::center::

入れていいと思います

---

## 復旧機構はドキュメント通りに動きます

- 会話履歴は別インスタンスから読み戻せます
- クラッシュループは止まり、手動で再開できます
- 待機中は Durable Object が退避できます

---

::center size=1.5::

ただし Pi が守っているのは

**Agent の実行**であって

**あなたの副作用**ではありません

---

## 開発者が持ち続けるもの

- 外部操作には**冪等キー**（`safe` を付けるかとは別）
- factory は**何度でも走ってよい**実装に
- `createRegistry()` は**クラスフィールド**に

::note::

最後のやつ、モジュールスコープに置くと退避ごとにハーネスがメモリに残ります。

公式の Upgrading 手順にも書いてあります。

---

## バージョン

- `agents` は **0.30.1 以降**
- Pi 1.4 に上げたら**戻せません**

-# 1.3 との比較には別の Durable Object を使ってください

---

::center size=1.5::

測り方を1つだけ持ち帰るなら

---

::center size=2::

**対照を置く**

-# 「できた」と「壊れていなかった」は対照が無いと区別できません

::note::

今日、3件判定が覆りました。全部、対照を組み直して気づいたものです。

数字だけ並べても、それが何を示しているかは決まりません。

---

::center size=1.5 bg=#4285F4::

Thank you!

-# 田中博悠 / tanahiro2010
