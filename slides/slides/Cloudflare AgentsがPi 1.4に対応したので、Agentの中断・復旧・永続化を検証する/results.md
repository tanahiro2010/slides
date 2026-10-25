# results — 実測結果

| | |
| --- | --- |
| 測定日 | 2026-10-25 |
| 環境 | macOS Darwin 25.5.0 / Node.js v24.22.1 / bun 1.4.3 |
| ランタイム | `wrangler dev --local`（workerd）と **実デプロイの Cloudflare Durable Object** |
| デプロイ先 | Worker `pi14-recovery-sandbox`。アカウントは個人（**Account ID はコミットしない**） |
| プラン | **Workers Free**。`@cf/zai-org/glm-5.3-flash` は有料で使えず、`glm-4.7-flash` を使用 |
| バージョン | `agents@0.30.1` / `@earendil-works/pi-durable@1.4.0` / `pi-ai@1.4.0` / `chord@1.4.0` |
| モデル | pi-ai 同梱の `fauxProvider`。Workers AI は使っていない |
| ハーネス | `sandbox/`。ドライバは `sandbox/drive/exp04.mjs` |

C40 / C37 / C20 と、EXP-04 の再現は実デプロイで測っています。
それ以外は workerd 上の結果です。

最後に障害なしの正常系を実デプロイで通し直して、対象が生きていることを確認しました。

---

## 土台

### C01 — 記録は `sync()` を挟まないとクラッシュで消える

同じ記録を、`ctx.storage.sync()` の有無だけ変えて書き、直後に `ctx.abort()` を撃ちました。

| 記録の仕方 | 再起動 | 跨いで残った行数 |
| --- | --- | ---: |
| `sync()` あり | した | **1** |
| `sync()` なし | した | **0** |

どちらも instanceId が変わっているので、本当にリセットされています。
対照が効いているので、「残らなかった」のは記録が失敗したからではなく、
ディスクに落ちる前にプロセスが消えたからだと言えます。

**判定: ✅ 確認。** 以降のすべての観測は `sync()` ありで取っています。

### C02 — `ctx.abort()` は catch できない

`try { ctx.abort() } catch {}` を書いても catch 節に入りません。
記録も残らず、エラーは RPC 境界を越えて呼び出し側に出ます。

```
{ "threw": true, "name": "Error", "message": "c02-probe" }
```

**判定: ✅ 確認。** 例外送出とは別物なので、障害注入にはこれを使います。

### C03 — インスタンス識別子

同一インスタンスへの連続リクエストでは変わらず、`abort()` のあとは変わります。
C05・C08・C40 の対照はこれに乗ります。

**判定: ✅ 確認。**

### C04 — Pi のテーブルは `pi_` 接頭辞

1 ターン流したあとの `sqlite_master` です。

| | テーブル |
| --- | --- |
| Pi | `pi_conversations` `pi_document_revisions` `pi_documents` `pi_durable_metadata` `pi_durable_schema` `pi_entries` `pi_record_ids` `pi_submissions` `pi_tasks` |
| 自前 | `exp_counters` `exp_events` `exp_faults` `exp_kv` |

9 表すべてが `pi_` で始まり、自前の 4 表と衝突していません。

**判定: ✅ 確認。**

---

## EXP-04 — ツール実行中の中断と Replay

記事の中核です。
4 本のツールを同じ条件で中断させ、実行回数と副作用回数を別々に数えました。
対照は同じスクリプトの中に並べています。

中断は `ctx.abort()` を 1 回だけ撃ち、再起動後は素通りさせています。

| ツール | `replay` | 冪等 | 中断位置 | 再起動 | 実行開始 | **副作用** | 完了 |
| --- | --- | --- | --- | --- | ---: | ---: | ---: |
| `write_record` | `safe` | はい | 確定前 | した | 2 | 1 | 1 |
| `write_record` | `safe` | はい | 確定直後 | した | 2 | 2 | 1 |
| `bump_unsafe` | 未指定 | いいえ | 確定前 | した | **1** | 0 | 0 |
| `bump_unsafe` | 未指定 | いいえ | 確定直後 | した | **1** | 1 | 0 |
| `bump_safe_unguarded` | `safe` | **いいえ** | 確定前 | した | 2 | 1 | 1 |
| `bump_safe_unguarded` | `safe` | **いいえ** | 確定直後 | した | 2 | **2** | 1 |
| `bump_safe_guarded` | `safe` | はい | 確定前 | した | 2 | 1 | 1 |
| `bump_safe_guarded` | `safe` | はい | 確定直後 | した | 2 | **1** | 1 |

生データは `sandbox/data/exp04-*.json` にあります。

### C17 — safe なツールは再実行される

`safe` を付けた 3 本はすべて実行開始が 2 回です。

**判定: ✅ 確認。**

### C18 / C16 — unsafe なツールは再実行されない

`bump_unsafe` だけ実行開始が 1 回で止まっています。
このツールは `replay` を書いていないので、**既定が unsafe であることが実行時にも確認できました。**

確定直後に中断したケースでは、副作用が 1 回残り、ツールは完了しないまま run が決着しています。
「再実行されない」ことと「副作用が無かったことになる」ことは別だと、数字で示せます。

**判定: C18 ✅ / C16 ✅（型定義に続いて実行時も確認）。**

### C19 — safe を付けた非冪等ツールは、副作用を 2 回起こす

**この検証の中心です。**

`bump_safe_unguarded` は `replay: "safe"` を宣言していますが冪等ではありません。
副作用が確定した直後に中断すると、**副作用が 2 回確定します。**

イベント列がそのまま証拠になります。

```
 5 tool_started     {tool: bump_safe_unguarded, key: k1}
 6 tool_committed   {tool: bump_safe_unguarded, key: k1, value: 1}
 7 fault_injected   {at: bump_safe_unguarded:after_commit, mode: abort}
 8 instance_started {factoryRuns: 0}          ← 別インスタンス
 9 harness_opened   {factoryRuns: 1}
10 tool_started     {tool: bump_safe_unguarded, key: k1}
11 tool_committed   {tool: bump_safe_unguarded, key: k1, value: 2}
12 tool_finished    {tool: bump_safe_unguarded, key: k1, value: 2}
```

対照が 2 つ効いています。

- `bump_unsafe` が 1 回で止まる → **再実行が本当に起きていることの証明**
- `bump_safe_guarded`（冪等キーあり）が 1 回に収まる → **2 回になるのは冪等性の問題であって、Pi の復旧が壊れているのではないことの証明**

Pi 側から見れば、どのケースも正常に復旧しています。
run は `done` で決着し、エラーも報告されていません。

**判定: ✅ 確認。**

### 実デプロイで独立に再現しました

同じ 8 ケースを、**本物の Cloudflare Durable Object 上で**測り直しました。
ローカル（workerd）の結果と 8 ケースすべて一致しています。

| ツール | 中断位置 | ローカルの副作用 | 実デプロイの副作用 |
| --- | --- | ---: | ---: |
| `write_record` | 確定前 / 確定直後 | 1 / 2 | 1 / 2 |
| `bump_unsafe` | 確定前 / 確定直後 | 0 / 1 | 0 / 1 |
| `bump_safe_unguarded` | 確定前 / 確定直後 | 1 / **2** | 1 / **2** |
| `bump_safe_guarded` | 確定前 / 確定直後 | 1 / 1 | 1 / 1 |

実行開始回数も、`safe` の 3 本が 2 回・`bump_unsafe` が 1 回で一致しました。
環境を変えても同じなので、workerd の実装差ではありません。

### ここから言えること

公式ドキュメントは `replay: "safe"` を「running it twice is harmless」なツールに付けろと書いています。
**Pi はその冪等性を検査しません。**
宣言が間違っていても警告は出ず、復旧は成功し、副作用だけが 2 回起きます。

「Agent が復旧できること」と「処理が重複せず完了すること」は別だ、という PRD の論点が、
`side_effect` が 1 か 2 かという 1 つの数字に落ちました。

---

## C20 — 中断された unsafe ツールを、モデルは呼び直すか

**偽モデルでは測れない 1 本です。** 応答を自分で書く以上、モデルの判断は観測できません。
ここだけ Workers AI の実モデルを使いました。

| 条件 | 試行 | ツール実行 | **副作用** | ツール完了 | 再起動 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 中断なし（対照） | 3 | 各 1 | 各 1 | 各 1 | 0 |
| 副作用確定直後に中断 | 3 | 各 1 | **各 1** | **各 0** | 各 1 |

対照が無いと「中断されたから呼び直さなかった」と
「このモデルはもともと 1 回しか呼ばない」が区別できません。
対照 3 本がすべて実行 1 回なので、ベースラインは揃っています。

### 言えること

この条件では、モデルは中断されたツールを呼び直しませんでした。
副作用は 1 回で止まっています。

**ただし主張はここまでです。**

- 試行は 3 回だけで、統計的な分布とは呼べません
- モデルは `@cf/zai-org/glm-4.7-flash` の 1 種類だけです
- プロンプトも 1 種類で、「exactly once」と明示しています
- 温度や応答の揺れを統制していません

**「Pi は unsafe なツールを自動再実行しない」は仕様として確定していますが（C18）、
「だから副作用は 1 回で済む」はモデル依存の観測であって、仕様の保証ではありません。**

### むしろ重要なのは、完了が 0 だったこと

中断した 3 本すべてで、**副作用は確定したのにツールは完了していません。**

ビジネス処理は実行済みなのに、Agent はそれを「終わった」と記録していません。
それでも run は決着します。

外部操作に冪等キーや重複防止機構が要るのは、再実行されるからだけではありません。
**実行されたのに実行されたと分からない状態が残るから**です。

**判定: ⚠️ 条件付きで観測。** 一般化はしません。

---

## EXP-05 — Parked Tasks と手動復旧

`restartLimit` を 2 に下げ、進捗を出さないまま同じ場所で落とし続けました。
対照は「何が再起動として数えられるか」です。

| シナリオ | 落とし方 | 障害発火 | インスタンス生成 | 実行開始 | `pending()` | `onReport` | 次の alarm |
| --- | --- | ---: | ---: | ---: | --- | --- | --- |
| abort-loop | `ctx.abort()` | 2 | 2 | 2 | **`parked`** | **`task_parked`** | **なし** |
| throw-loop | 例外送出 | 1 | **0** | 1 | 空（決着） | なし | なし |

### C23 — 例外送出では parked にならない

対照が決定的でした。
例外は Durable Object をリセットしないので、インスタンス生成が 0 回です。
ツールはエラー結果としてモデルに渡り、run はそのまま決着します。
再起動カウントは 1 度も増えません。

pi-durable の README が書いている「a close is not counted」の実際の意味が、
この 2 行の差に出ています。

**判定: ✅ 確認。** 障害注入に `ctx.abort()` が要る理由がここにあります。

### C25 — 上限ちょうどで parked になる

`restartLimit: 2` に対して、障害発火 2 回・インスタンス生成 2 回で parked に移りました。
`pending()` の status が `parked` になり、`onReport` に `task_parked` が 1 度だけ届いています。

**判定: ✅ 確認。**

### C26 — parked されたタスクは Durable Object を起こし続けない

parked のあと、`ctx.storage.getAlarm()` は null です。
30 秒ごとの heartbeat も止まっています。

Changelog の「a task stopped by Pi's restart limit no longer keeps the object awake」が、
alarm の有無という観測可能な形で確認できました。

**判定: ✅ 確認。**

### C27 — `session.retry()` で再開し、完了する

障害条件を解除してから `retry()` を呼ぶと `true` が返り、`pending()` が空になりました。
副作用カウンタは 1 です。
2 回の中断はどちらも副作用確定前だったので、実際に効いた実行は再開後の 1 回だけでした。

対照も取れています。
何も parked されていない状態で `retry()` を呼ぶと `false` が返ります。
**「再開した」と「そもそも何も止まっていなかった」が区別できます。**

**判定: ✅ 確認。**

### ついでに分かったこと

**unsafe なツールは、そもそもクラッシュループを作れません。**

最初 `bump_unsafe` で組んだところ、中断は 1 回起きたものの再実行されず、
run がそのまま決着して parked に到達しませんでした。

Parked Tasks が守るのは「再実行される work」だけです。
`replay: "safe"` なツールや、Pi が再開する種類のタスクでなければ、
crash-loop guard の出番はありません。

---

## EXP-06 — Storage Error Recovery

`Storage` を Proxy で包み、3 つの境界を撃ち分けました。
どちらのケースも、まず障害なしで 1 往復通してから障害を仕込んでいます。
土台が動くことを先に示さないと、何が壊れたのか切り分けられません。

| 観測 | `mintId()` から任意のエラー | 読み取りから `StorageRequestError` |
| --- | --- | --- |
| 呼び出し側 | `Error` が出る | `StorageRequestError` が出る |
| `onReport` | **`session_failed`** | **なし** |
| factory 実行回数 | 1 → **2** | 1 → **1** |
| `harness_opened` | **2** | **1** |
| `instance_started` | **0** | **0** |
| 次の `submit()` | 成功し `done` | 成功し `done` |

### C31 / C34 — 致命的なのは書き込み側だけ

対照が決定的でした。
**どちらも呼び出し側には例外が出て、どちらも次の操作は成功します。**
見た目だけでは区別がつきません。

違いは `onReport` と factory の実行回数に出ます。
`mintId()` のエラーは Session を殺し（`session_failed`）、Pi が開き直されています。
読み取りの `StorageRequestError` は、その読みだけを失敗させ、Session は生きたままです。

この対照が無いと、「PiHarness がストレージエラーから復旧した」と
「そもそも何も壊れていなかった」が区別できません。

`Storage` インターフェースの契約どおりでした。

> Any error from `commit()` or `mintId()` is fatal.

**判定: C31 ✅ / C34 ✅ 確認。**

### C32 / C33 — 復旧は Pi ではなく PiHarness の動作

factory 実行回数が 1 から 2 に増えています。
Pi が自分で立ち直ったのではなく、**PiHarness が死んだ Pi を捨てて開き直しています。**

さらに `instance_started` が 0 のままです。
**Durable Object は再起動していません。**

PR #2648 がこう書いているとおりです。

> PiHarness kept the dead pi cached, so every later call failed until the isolate restarted

修正前は isolate の再起動を待つしかなかったものが、
次の呼び出しで回復するようになっています。

factory が何度も走る前提になったのは、この変更が理由です。
公式ドキュメントの「Keep it safe to run more than once」は、ここに効いています。

**判定: C32 ✅ / C33 ✅ 確認。**

---

## EXP-03 — モデルストリーム断の再試行

`agents` のバージョンを入れ替えず、**投げる文言だけ**を変えて撃ち分けました。
pi-ai の再試行判定がエラー本文に対する正規表現なので、これで十分です。

どのケースも条件は同じです。
2 回失敗してから成功する偽モデルに対し、リトライ既定（3 回）のまま流しています。

| 投げた文言 | 由来 | 結果 | 理由 | モデル呼び出し回数 |
| --- | --- | --- | --- | ---: |
| `The stream ended before the model finished its answer.` | `agents@0.29.0` | `unanswered` | `model_error` | **1** |
| `The stream ended without the model finishing its answer.` | `agents@0.30.x` | **`done`** | — | **3** |
| `Model stream stalled: no data received for 60s.` | `agents@0.29.0` | `unanswered` | `model_error` | **1** |
| `Model stream timed out: no data received for 60s.` | `agents@0.30.x` | **`done`** | — | **3** |
| `insufficient_quota: the account has no remaining credit.` | 対照 | `unanswered` | `model_error` | **1** |

### C11 / C12 — 文言だけで結果が割れる

**同じ失敗を同じ回数起こしているのに、文言を変えるだけで結果が変わります。**
0.29.0 の文言は 1 回目で run が死に、0.30.x の文言は 3 回呼ばれて成功します。

モデル呼び出しが 3 回（失敗 2 + 成功 1）なので、
再試行がモデルリクエスト全体の作り直しであることも同時に確認できました。

対照の `insufficient_quota` が 0.29.0 側と同じ挙動になっているのが重要です。
**判定器が実際に働いていて、何でも再試行しているわけではない**と示せます。

`references.md` に書いた静的な発見（`before` を `without` に書き換えただけ）が、
実行時の挙動としても再現しました。

**判定: C11 ✅ / C12 ✅ 確認。**

### C13 — backoff には 60 秒の天井がある

別の測定で `baseDelayMs` を 100 秒に設定したところ、
実際の待機は約 60 秒でした。

`DEFAULT_RETRY_POLICY` の `maxAgentDelayMs`（既定 60000）が効いています。

```js
export function retryDelayMs(policy, attempt) {
    const delay = policy.baseDelayMs * 2 ** Math.max(0, attempt - 1);
    const safeDelay = Number.isSafeInteger(delay) ? delay : Number.MAX_SAFE_INTEGER;
    return Math.min(safeDelay, policy.maxAgentDelayMs ?? DEFAULT_MAX_AGENT_RETRY_DELAY_MS);
}
```

`baseDelayMs` をいくら大きくしても、1 回の待機は 60 秒を超えません。
**倍々に増えるのも 60 秒まで**です。

**判定: ✅ 確認。** 既定値は配布物の定数と実測の両方で一致しました。

---

## EXP-02 — クライアント切断と再接続

リトライ backoff で run を 18 秒ほどに伸ばし、実行の途中で WebSocket を切りました。

### C08 — 切断しても実行は続く

| 観測 | 値 |
| --- | --- |
| 切断までに受け取ったメッセージ | 12 件 |
| 最終結果 | `done` / `"survived the disconnect"` |
| モデル呼び出し回数 | 3（失敗 2 + 成功 1） |
| **インスタンス識別子** | **切断の前後で同一** |

対照が効いています。
インスタンスが変わっていないので、これは「落ちて復旧した」のではなく、
**実行がクライアント接続に依存していない**という観測です。
この対照が無いと、両者を区別できません。

**判定: ✅ 確認。**

### C10 — 再接続は snapshot から組み直せる

切断後に新しい WebSocket を開くと、snapshot にエントリが 5 件入っていました。
切断中に進んだ分も含めて、現在状態をそこから再構築できます。

**判定: ✅ 確認。**

### C43 — 再現しませんでした（最初の測定は私の誤りでした）

`watchEvents` の実装コメントには、ドキュメントに無い挙動が書かれています。

> overflow replaces undelivered batches with one snapshot.

遅いリスナーを張って、イベントが 1 つの snapshot に畳まれるかを測りました。

| リスナー遅延 | ドレイン 8 秒 | ドレイン 30 秒 |
| --- | --- | --- |
| 0 ms | バッチ 7 / イベント 22 | バッチ 7 / イベント 22 |
| 1500 ms | バッチ 5 / **イベント 14** | バッチ 7 / **イベント 22** |

**最初の測定で出た差は、私が WebSocket を早く閉じたせいでした。**
ドレインを 30 秒に延ばすと、遅いリスナーも高速側と同じ 22 イベントを受け取ります。
届くのが遅いだけで、取りこぼしていません。

この規模とこの遅延では overflow に届かなかった、というだけです。
実装コメントの記述を否定するものではありません。
確かめるには、イベント数を桁違いに増やすか、リスナーをもっと遅くします。

**判定: ⚠️ 再現せず。** この条件では畳まれませんでした。

> 8 秒のドレインのまま書いていたら、「遅いリスナーはイベントを取りこぼす」という
> 誤った主張を載せるところでした。対照の条件を揃え直して気づいた分です。

---

---

## C14 / C21 — 中断の表現

### C14 — 切れたストリームに積まれたツール呼び出しは実行されない

ツール呼び出しブロックを積んだまま `stopReason: "error"` で終わる応答を返しました。
対照は、同じ中身を `stopReason: "toolUse"` で正常に返した場合です。

| 条件 | 結果 | モデル呼び出し | ツール実行 | 副作用 |
| --- | --- | ---: | ---: | ---: |
| 対照（切れない） | `done` | 2 | 1 | 1 |
| 本番（切れる） | `done` | **3** | **1** | **1** |

切れた側はモデル呼び出しが 3 回（失敗 1 + ツール 1 + 締め 1）に増えています。
再試行は起きたのに、ツールの実行回数は 1 回のままでした。

PR #2643 が「a cut-off message has `stopReason: "error"`, so no streamed tool call runs before the retry」
と書いているとおりです。

**判定: ✅ 確認。**

### C21 — 専用のエントリではありませんでした

**主張が外れました。**

中断されたツール呼び出しは、専用のエントリ種別にはなりません。
正常終了と**同じ `pi.tool-result`** に入り、中身で区別されます。

transcript のエントリ列は、中断の有無にかかわらず同じです。

```
pi.user → pi.system → pi.assistant → pi.tool-result → pi.assistant
```

違うのは `pi.tool-result` の中身だけでした。

| | `isError` | モデルが読む本文 |
| --- | --- | --- |
| 中断なし | `false` | `counter=1` |
| 中断あり | **`true`** | `<harness>\n[error] Tool bump_unsafe was interrupted and may have partially run\n</harness>` |

**モデルは「部分的に実行されたかもしれない」という英文をそのまま読みます。**
構造化されたフラグではなく、プロンプトに混ぜた自然文です。

ここが C20 につながります。
そのあとどう振る舞うかは、この 1 文をモデルがどう解釈するか次第です。
仕様が決めているのは「自動では再実行しない」ことと「この文を渡す」ことまでです。

**判定: ❌ 専用エントリではない。** ただし中断の伝達そのものは確認できました。

---

## EXP-07 — Hibernation（実デプロイで決着）

実デプロイの Durable Object で測り直しました。
観測するのは alarm の時刻ではなく、**リトライがどのインスタンスで走るか**です。

90 秒の backoff を仕込んで submit し、**待機中は 1 回もリクエストしません。**
1 度でも触るとオブジェクトが起きて、測りたい現象が消えます。

### C40 — リトライは別インスタンスで走る

`onWake` を渡した場合。

```
harness_opened@b42b1d7d → submitted@b42b1d7d → model_request@b42b1d7d → model_error@b42b1d7d
→ instance_started@2bc10139 → harness_opened@2bc10139 → model_request@2bc10139
```

失敗したのが `b42b1d7d`、90 秒後にリトライを走らせたのが `2bc10139` です。
**待機中にオブジェクトがメモリから落ち、alarm で別インスタンスとして起こされています。**

`onWake` を渡さなかった場合。

```
harness_opened@67b53297 → submitted@67b53297 → model_request@67b53297 → model_error@67b53297
→ model_request@67b53297
```

リトライが**同じインスタンス**で走っています。
`instance_started` が間に挟まりません。
Pi のインメモリタイマーが 90 秒間オブジェクトを掴んでいたということです。

submit 直後の alarm にも差が出ました。

| `onWake` | submit 直後の alarm | リトライを走らせたインスタンス | 結果 |
| --- | --- | --- | --- |
| 渡す | 0 秒（即時） | **別インスタンス** | `done` |
| 渡さない | 30 秒（heartbeat） | **同一インスタンス** | `done` |

PR #2619 の表（4 分の backoff で「約 4 分」対「数秒」）が、
インスタンスの同一性という形で再現しました。

### 独立に再現しました

backoff を 60 秒に変え、新しい Durable Object で測り直しました。
インスタンス識別子はすべて別ですが、構造は同じです。

| `onWake` | 失敗したインスタンス | リトライしたインスタンス |
| --- | --- | --- |
| 渡す | `bd698ef7` | **`dc5b3f32`**（別） |
| 渡さない | `312f32e6` | **`312f32e6`**（同一） |

**判定: C40 ✅ / C37 ✅ 確認。** 2 回の独立した測定で一致しました。

### ローカルでは測れませんでした

同じ検証を `wrangler dev --local` で先に試したときは、対照が判別しませんでした。

| `onWake` | 実際の配線 | alarm までの秒数 |
| --- | --- | --- |
| 渡す | `true` | 17s 15s 12s 10s 7s 5s |
| 渡さない | `false` | 17s 15s 12s 10s 7s 5s |

設定は届いていた（`onWakeWired` が `false`）のに、alarm の挙動は 6 回のサンプルすべてで一致しました。
**alarm の時刻は Hibernation の代理指標になりません。**

0.30.1 の待機ループで `wake.at` を使う行が `onWake` の有無で分岐していないからです。

```js
let sleep = onWakeWired ? left : Math.min(left, pollMs);
if (wake.at !== void 0) sleep = Math.min(sleep, wake.at - now);  // ← 分岐の外
```

そもそも workerd のローカル実行では本番と同じ退避が起きません。
issue #2683 の報告者が
「not yet on a deployed Cloudflare Durable Object」と断っていたのは、この壁です。

**測るべきは alarm ではなく、インスタンスの同一性でした。**

---

## C39 / C36 — heartbeat とタイマー

公式ドキュメントの Recovery にある 2 文を、それぞれ別の条件で測りました。

> While Pi has work, the job's heartbeat alarm fires every 30 seconds.
> While Pi's tasks sleep, such as during a retry backoff, the job is due when the first one wakes.

**「work がある」と「task が sleep している」は別の状態です。**
最初はここを取り違えて、リトライ backoff（= sleep）を測って「30 秒にならない」と書きかけました。

### C39 — 処理中は 30 秒ごとに再設定される

90 秒かかるツールを走らせ、5 秒ごとに `ctx.storage.getAlarm()` を見ました。

| `onWake` | alarm までの秒数 | 最大 |
| --- | --- | ---: |
| 渡す | 25 20 15 10 5 **30** 25 20 15 10 5 **30** 25 20 15 10 5 | 30 |
| 渡さない | 25 20 15 10 5 **30** 25 20 15 10 5 **30** 25 20 15 10 5 | 30 |

0 に達するたびに 30 に戻る、きれいなノコギリ波です。
配布物の `HEARTBEAT_MS = 3e4` と一致しました。

`onWake` の有無で差が出ないのが正しい挙動です。
`onWake` が効くのは sleep のときだけで、work の heartbeat には関係しません。

**判定: ✅ 確認。**

### 対になる観測: スリープ中は wake 時刻 1 本

同じ測定をリトライ backoff（= sleep）で行うと、ノコギリ波になりません。

| `onWake` | alarm までの秒数 |
| --- | --- |
| 渡す | 55 50 45 40 35 30 25 20 15 10 5 なし… |
| 渡さない | 55 50 45 40 35 30 25 20 15 10 5 なし… |

30 を超えて単調に減り、wake 時刻で消えます。
heartbeat は挟まりません。

**2 つの測定を合わせて、公式ドキュメントの 2 文が両方とも確認できました。**

### C36 — タイマーは間接的に確認しました

「`onWake` を渡すと Pi はスリープ用のタイマーを持たない」は、
タイマー数を直接数える手段が workerd にないので、直接は測れません。

ただし C40 の実デプロイ結果が証拠になります。

| `onWake` | スリープ中にオブジェクトが退避されたか |
| --- | --- |
| 渡す | **された**（別インスタンスでリトライ） |
| 渡さない | **されなかった**（同一インスタンスでリトライ） |

Workers では保留中のタイマーがオブジェクトを掴みます。
退避できたということは、掴むものが無かったということです。

型定義の契約とも一致します。

> With it, the Harness arms no timer for them

**判定: ✅ 確認（間接）。** タイマーそのものは観測していません。

---

## C41 — ロールバックできない理由は Hibernation の実装だった

Cloudflare の Changelog は、このアップグレードを戻せないと明記しています。

> Pi 1.4 migrates the session storage in the object's SQLite database to a schema that Pi 1.3 cannot open,
> so a deployment cannot roll back past this upgrade.

証拠が 3 つ揃いました。

**1. Pi 1.4 が書いたスキーマ版を実測しました。**

1 ターン流したあとの `pi_durable_schema` です。

```json
[{ "singleton": 1, "version": 2 }]
```

**2. 1.3.0 と 1.4.0 のマイグレーション定義を比べました。**

| | 定義されているマイグレーション |
| --- | --- |
| `@earendil-works/pi-durable@1.3.0` | `{ version: 1, statements: initialSchema }` のみ |
| `@earendil-works/pi-durable@1.4.0` | `{ version: 1, ... }` と **`{ version: 2, statements: sleepingStatus }`** |

`CURRENT_SQLITE_SCHEMA_VERSION` は配列の末尾から取るので、1.3 では 1、1.4 では 2 です。

**3. 1.3.0 のマイグレーションランナーが、新しいスキーマを拒否します。**

`dist/storage/sqlite/migrations.js` より。

```js
if (row.version > currentVersion) {
    throw new Error(`Durable SQLite schema version ${row.version} is newer than supported version ${currentVersion}`);
}
```

1.4 が書いた `version: 2` を 1.3（`currentVersion` が 1）が開くと、ここで投げます。

### 面白いのは、追加されたマイグレーションの名前です

`version: 2` の中身は `sleepingStatus` でした。

Pi 1.4 の Breaking Changes にある「Tasks have a `sleeping` status」がこれです。
そして `sleeping` 状態は、`sleepUntil()` による耐久スリープ、つまり
**Hibernation を成り立たせている仕組みそのもの**です。

Durable Object が退避できるようになった代償が、スキーマの非互換でした。
「戻せない」という警告と、この記事の目玉である Hibernation は、同じ変更の表と裏です。

**判定: ✅ 確認。** ただし 1.3 を実際に動かして開かせるところまでは行っていません。
実測したスキーマ版・両版の定義・拒否するコードの 3 点で確定としています。

---

## EXP-01 の残りと、EXP-05 の積み残し

### C05 / C06 — 再起動を跨いだ永続化と、二重実行されないこと

ツールを 1 回使う run を完了させたあと、`ctx.abort()` を撃ちました。

| 観測 | 再起動前 | 再起動後 |
| --- | ---: | ---: |
| インスタンス識別子 | — | **変化した** |
| transcript のエントリ数 | 5 | 5 |
| ツール実行開始 | 1 | 1 |
| 副作用 | 1 | 1 |

インスタンス識別子が変わっているので、本当に別プロセスから読めています。
完了済みのタスクは再実行されていません。

**判定: C05 ✅ / C06 ✅ 確認。**

### C07 — `operationId` の冪等性

| 送った id | `accepted` |
| --- | --- |
| `same`（1 回目） | `true` |
| `same`（2 回目） | **`false`** |
| `different`（対照） | `true` |

対照があるので、「2 回目が弾かれた」のであって「submit 自体が壊れた」のではないと言えます。

**判定: ✅ 確認。**

### C29 — parked の間も `wait()` は待ち続ける

parked 状態で `wait()` を張ると、15 秒待っても返りません。
障害条件を解除して `retry()` を呼ぶと、同じ `wait()` が `done` で解決しました。

**判定: ✅ 確認。**

### C28 — `abort()` で放棄できる

parked になったタスクに `session.abort()` を撃ちました。

| | `retry()`（C27） | `abort()`（C28） |
| --- | --- | --- |
| 戻り値 | `true` | `ok` |
| `pending()` | 空になる | 空になる |
| `wait()` | `done` | **`unanswered` / `aborted`** |

同じ parked 状態から、2 通りの抜け方があります。
対になっているので、「片付いた」のか「やり遂げた」のかが区別できます。

**判定: ✅ 確認。**

### C24 — 進捗の定義が思っていたものと違いました

前回は自前カウンタの更新を「進捗」と呼んでしまい、対照になっていませんでした。
今回は `api.output()` を刻んで、ツール自身に進捗を出させました。

| 条件 | `api.output()` の回数 | parked | 障害発火 | 再起動 |
| --- | ---: | --- | ---: | ---: |
| 進捗なし | 0 | した | 2 | 2 |
| 進捗あり | **8** | **した** | 2 | 2 |

**ツールの進捗出力では、再起動カウントは戻りませんでした。**

README の言う「a new state the task commits」は、
ツールが吐く出力のことではありません。
タスクが局面を越えて状態をコミットすること、つまり**フェーズの境界**を指しています。
ツールが 1 回も完了していない以上、どれだけ出力を刻んでも進捗ゼロのままです。

これは Parked Tasks の設計として筋が通っています。
出力を出しながらクラッシュし続けるタスクを「進捗あり」と数えたら、
crash-loop guard が働かなくなります。

**判定: ⚠️ 元の主張は未確認のまま。** ただし「出力は進捗に数えられない」は確認できました。
フェーズを越えるケースを作るには、ツールを完走させてから次の局面で落とす設計が要ります。

### C21 — 結論を出しません

**C21。** 観測した transcript は
`pi.user` `pi.system` `pi.assistant` `pi.tool-result` `pi.assistant` でした。
ただしこの run は正常終了してから落としたので、
**中断されたツール呼び出しの transcript を見ていません。**
中断専用のエントリがあるかどうかは、これでは答えられません。

**判定: C21 ⚠️ 測り直します。**

---

## 残り

| 主張 | なぜ残っているか |
| --- | --- |
| **C15** | 15 分を超えるストリーム。faux Provider は応答を即返すので、長時間ストリームを作る仕組みが無い。測るなら 15 分以上の測定になる |
| **C38** | `agents@0.30.0` を入れた対照が要る。issue #2683 の条件は「実行中の別タスクの横で眠っているタスク」なので、同時実行を作る改修も要る |
| C20 | 実モデルで 3 試行のみ。モデルも 1 種類。分布と呼べる量ではない |
| C24 | 出力が進捗に数えられないことは確認。フェーズを越える設計での測り直しが残る |
| C43 | この規模では overflow に届かなかった。イベント数を桁違いに増やす必要がある |

## 測定の再現手順

```sh
cd sandbox
bun install
bunx wrangler types

# ローカル
bunx wrangler dev --port 8799 --local
node drive/exp04.mjs http://127.0.0.1:8799
node drive/exp05.mjs http://127.0.0.1:8799
node drive/exp06.mjs http://127.0.0.1:8799
node drive/exp03_07.mjs http://127.0.0.1:8799
node drive/exp01.mjs http://127.0.0.1:8799

# 実デプロイ
bunx wrangler deploy
node drive/deploy-hibernation.mjs <url> 90000
node drive/exp04-c20.mjs <url> 3
```

生データは `sandbox/data/` に残しています（gitignore 済み）。
