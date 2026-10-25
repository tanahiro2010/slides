# Cloudflare AgentsがPi 1.4に対応したので、Agentの中断・復旧・永続化を検証する

**このドラフトは検証がすべて完了した後の確定版です。** `claims.md` の 44 本すべてに判定が付いている（確定 39 / 否定 1 / 保留 4 / 未検証 0）。
数値はすべて `results.md` からの実測。推測は入れていない。
slide.md と article.md はこれから。順番は slide → article。

**経緯メモ:** 上流に報告すべき新規の発見は出ていない。
`agents@0.30.0` の `onWake` バグは Cloudflare 自身が報告済み（[#2683](https://github.com/cloudflare/agents/issues/2683)）で 0.30.1 で修正済み。
こちらは独立再現をしただけなので、開示待ちは無い。**全知見を公開してよい。**

**検証に使った Worker は削除すること。** `pi14-recovery-sandbox` が公開状態で残っている。

## 一次ソース

更新日を必ず書く。どちらを先に疑うかの材料になる。

- Cloudflare Changelog「Agents SDK now supports the latest Pi 1.4 release」（2026-10-22）: https://developers.cloudflare.com/changelog/post/2026-10-22-pi-harness-pi-1-4/
- Cloudflare Docs「Pi」（更新 2026-10-22）: https://developers.cloudflare.com/agents/harnesses/pi/
- Cloudflare Docs「Pi / Extensions」（更新 2026-10-22）: https://developers.cloudflare.com/agents/harnesses/pi/extensions/
- Cloudflare Docs「Durable Objects — state」（更新 2026-10-21）: https://developers.cloudflare.com/durable-objects/api/state/
- `agents` CHANGELOG 0.30.0 / 0.30.1（2026-10-23）: https://github.com/cloudflare/agents/blob/main/packages/agents/CHANGELOG.md#0300
- `@earendil-works/pi-durable` CHANGELOG 1.4.0（2026-10-21）: https://github.com/earendil-works/pi/blob/v1.4.0/packages/durable/CHANGELOG.md#140---2026-10-21
- `@earendil-works/pi-durable@1.4.0` の `README.md`（2026-10-21）: npm の配布物
- Pi Durable 設計記事（earendil.com、2026-10-01）: https://earendil.com/posts/pi-durable/
- cloudflare/agents#2683（2026-10-23）: https://github.com/cloudflare/agents/issues/2683
- PR [#2619](https://github.com/cloudflare/agents/pull/2619) / [#2624](https://github.com/cloudflare/agents/pull/2624) / [#2643](https://github.com/cloudflare/agents/pull/2643) / [#2648](https://github.com/cloudflare/agents/pull/2648) / [#2649](https://github.com/cloudflare/agents/pull/2649)（2026-10-21〜22）
- 📌 **一番強いのは npm の配布物**。`agents@0.29.0` / `0.30.0` / `0.30.1`、`pi-durable@1.3.0` / `1.4.0`、`pi-ai@1.4.0` の `dist/` を直接読んだ

### 公開日の対応

| パッケージ | 版 | 公開（UTC） |
| --- | --- | ---: |
| `@earendil-works/pi-durable` | 1.3.0 | 2026-10-15 19:13 |
| `@earendil-works/pi-durable` | 1.4.0 | 2026-10-21 22:44 |
| `agents` | 0.29.0 | 2026-10-20 15:25 |
| `agents` | 0.30.0 | 2026-10-22 11:31 |
| `agents` | 0.30.1 | 2026-10-23 15:40 |

- Pi 1.4 の公開から Cloudflare の対応まで約 13 時間
- 📌 **0.30.0 から 0.30.1 まで 28 時間**。ここに §3 の話がある

## 表現のルール（slide でも守る）

- ❌「Pi 1.4 で復旧できるようになった」→ ⭕「Pi 1.3 でも復旧はしていた。1.4 で Hibernation と Parked Tasks が増えた」
- ❌「Changelog の 4 点は Pi 1.4 の新機能」→ ⭕「2 点は Agents SDK 側の修正で、Pi 1.3 でも成立する」
- ❌「`replay: "safe"` を付ければ安全」→ ⭕「`safe` は再実行してよいという宣言であって、Pi は冪等性を検査しない」
- ❌「Exactly-once で実行される」→ ⭕「自動再実行はされない。副作用が 1 回で済むかは別の話」
- 「Agent が復旧する」と「処理が重複せず完了する」を書き分ける
- 「ドキュメントに書いていない」と「事実として無い」を書き分ける
- Cloudflare（`agents`）の層と earendil-works（Pi）の層を毎回区別する
- 0.30.0 のバグは**煽らない**。既報告・修正済み。「Beta であることの具体例」として扱う
- 自分の測定ミス（§16）を隠さない。隠すと §9 の数字も信用されない
- Account ID・生ログ・`wrangler` の資格情報は記事にもリポジトリにも出さない

## タイトルまわり

- 題名：Cloudflare AgentsがPi 1.4に対応したので、Agentの中断・復旧・永続化を検証する
- 副題：44 個の主張に分けて、全部に判定を付けた
- 一言（記事冒頭のエピグラフ）

  > 中断された Agent は、最後のチェックポイントから正しく再開しました。
  > 副作用が 2 回起きたのは、そのせいです。

  - 候補②：「ツールは再実行されませんでした」。副作用の方は、1 回確定したまま残っていました。
  - 📌 §9 を指している。軸（復旧は Agent を守るが、副作用は守らない）と一致している
- 発表者：田中博悠 / Hirohisa Tanaka / tanahiro2010
- 自己紹介：三田学園高等学校 / GDG Greater Kwansai
  - Cloudflare Workers と Durable Objects で個人開発をしている
  - Agents SDK は以前の Workspace 移行でも触っている（前回は「移行は成功したように見える」話だった）

## つかみ

- 2026/10/22、Cloudflare が「Agents SDK v0.30.0 が Pi 1.4 に対応した」と発表
- Changelog に 4 点が並んでいた
  - Hibernation、Parked Tasks、Storage Error Recovery、Model Stream Retry
  - 「Durable Object 上の Agent が落ちても復旧できる」── 面白そう、測ってみよう
- ……と調べ始めたら、前提が 3 つ崩れた
  - 4 点のうち **2 点は Pi 1.4 の機能ではなかった**（Agents SDK 側の修正。Pi 1.3 でも成立する）
  - 検証に使おうとした **0.30.0 に、目玉の Hibernation が効かない既知バグ**があった
  - Storage Error Recovery は、**進行中の呼び出しを 1 つも救わない**
- そして実際に測ったら、一番効いたのはここだった
  - `replay: "safe"` と宣言したツールが、副作用を 2 回起こした
  - Pi から見れば**復旧は成功していた**。run は `done` で終わり、エラーも出ていない
- 問いかけ：「あなたの Agent のツール、`replay` に何を書きましたか？ 書いていないなら、それは `unsafe` です」

## この発表のスタンス

- 公式ドキュメントの翻訳記事にはしない
- Changelog の 1 行ずつを**検証可能な主張に割ってから**測る（44 本に割った）
- 「ドキュメントにこう書いてある」ではなく「**実際にこうなった**」を出す
- **対照の無い観測から結論を書かない。** 対照が判別しなかったものは「判別しなかった」と書く
- 測り直して判定が覆ったものは、覆った経緯ごと出す（§16）
- 検証できなかったものは「できなかった」と書く
- 📌 このスタンスは §16 で正当化される。3 件覆っている

---

## 1. Pi と PiHarness ―― 誰がどこまで持っているか

- 登場人物が 3 層ある。**混ぜると以降が全部おかしくなる**
  - **Pi Durable**（earendil-works）: Agent の実行ループ本体。タスク、チェックポイント、replay、inbox
  - **PiHarness**（Cloudflare `agents`）: Pi に Durable Object の SQLite を渡し、必要なときに起こす
  - **Lifecycle**（Cloudflare `agents`）: Durable Object 上で長時間の仕事を回す土台
- Pi Durable の設計記事（2026-10-01）より、一次

  > every step of a run is a task that stores a checkpoint before it moves on.

- 保存と再開は別の機能
  - 保存は `pi_` 接頭辞の SQLite テーブル（✅ 実測で 9 表、§4）
  - 再開は Lifecycle の Wake ジョブ。Durable Object の Alarm で起こす
  - 📌 保存できていても、起こされなければ再開しない
- Pi のパッケージは 3 つとも optional peer dependency で `~1.4.0`
  - `@earendil-works/pi-durable` / `pi-ai` / `chord`
  - チルダなので **Pi 1.5 が出ても `agents` 0.30.x は受け付けない**
  - `agents` 1 リリースが Pi 1 マイナーに対応する、と公式ドキュメントが明記している
- `PiHarness` は Beta、Pi Durable は実験的パッケージと公式が自己申告している

## 2. 「Pi 1.4 の新機能 4 点」は層が違う（❌ 前提が崩れた）

- Changelog は 4 点をまとめて「Agents SDK v0.30.0 のリリース内容」として並べている
- 出どころをたどると、層が 2 つに割れる

  | Changelog の項目 | 実際はどこの変更か | 根拠 |
  | --- | --- | --- |
  | Hibernation（`onWake`） | **Pi 1.4** の新 API を SDK が配線した | Pi CHANGELOG / PR #2619 |
  | Parked Tasks | **Pi 1.4** の新機能を SDK が露出させた | Pi CHANGELOG / PR #2624 |
  | Storage Error Recovery | **Agents SDK のみ**。Pi の挙動は 1.2 から不変 | PR #2648 |
  | Model Stream Retry | **Agents SDK のみ**。Pi 1.3 でも成立する | PR #2643 |

- PR #2643 の本文に、はっきり書いてある

  > Each string checked against the classifier in **installed Pi 1.3.0** and Pi main.

- 着地：「Pi 1.3 と Pi 1.4 を比べる」は、この 2 点については軸が間違っている
  - 正しい軸は **`agents` 0.29.0 と 0.30.x**
- 📌 ベンダーの Changelog は、機能の出どころを語らない。**層を自分で分ける**

## 3. 検証環境のバージョンを間違えかけた（0.30.0 の罠）

- 最初は公式が案内する `agents@0.30.0` で組もうとした
- ところが 0.30.0 には、**目玉の Hibernation が効かない既知バグ**がある（[#2683](https://github.com/cloudflare/agents/issues/2683)）

  > Wiring the documented onWake callback can stall a native compaction retry sleep while another Pi task remains active.

- 配布物を diff すると、何が足りなかったのか分かる（📋 メモ①）
  - 0.30.0 の待機ループは `pi.wake().active` だけを見ていた
  - `wake.at`（次にスリープが明ける時刻）を締切に使わず、`pi.resume()` も呼ばない
- 0.30.1 で 2 行入って直った
- ✅ 自分でも再現した（§13）
- 着地：**0.30.0 で測ると「Pi 1.4 の Hibernation が動かない」という誤った結論になる**
  - 発表から 28 時間でパッチが出ている。Beta であることの具体例として扱う

## 4. まず土台を測る ―― 記録が信用できるか

- 📌 ここを飛ばすと、以降の観測が全部疑わしくなる
- Durable Object の書き込みはメモリ上のバッファに入り、非同期でディスクに落ちる
  - `ctx.abort()` の直前に書いただけでは、**記録ごと消える**
- ✅ 実測（workerd、📋 メモ②）

  | 記録の仕方 | 再起動したか | クラッシュを跨いで残った行数 |
  | --- | --- | ---: |
  | `ctx.storage.sync()` あり | した | **1** |
  | `sync()` なし | した | **0** |

  - どちらも instanceId が変わっている。**本当にリセットされている**
  - 対照があるので「記録が失敗した」ではなく「ディスクに落ちる前に消えた」と言える
- 障害注入は `ctx.abort()` を使う。公式 API より、一次

  > Calling `abort` immediately resets a Durable Object.
  > Application code cannot catch this error.

  - ✅ 実測: `try { ctx.abort() } catch {}` は catch 節に入らない
  - **例外送出とは別物**。これは §7 の対照で効く
- ✅ Pi のテーブルは `pi_` 接頭辞で 9 表。自前の `exp_` 4 表と衝突しない

## 5. 永続化は本当に効いている

- ツールを 1 回使う run を完了させてから `ctx.abort()` を撃った
- ✅ 実測

  | 観測 | 再起動前 | 再起動後 |
  | --- | ---: | ---: |
  | インスタンス識別子 | — | **変化した** |
  | transcript のエントリ数 | 5 | 5 |
  | ツール実行開始 | 1 | 1 |
  | 副作用 | 1 | 1 |

  - インスタンスが変わっているので、**別プロセスから読めている**
  - 完了済みタスクは再実行されていない
- ✅ `operationId` で submit が冪等になる

  | 送った id | `accepted` |
  | --- | --- |
  | `same`（1 回目） | `true` |
  | `same`（2 回目） | **`false`** |
  | `different`（対照） | `true` |

  - 対照があるので「2 回目が弾かれた」であって「submit が壊れた」ではないと言える
- 📌 ここまでは全部ドキュメント通り。**面白くなるのは §9 から**

## 6. クライアントを切っても実行は続く

- リトライ backoff で run を 18 秒ほどに伸ばし、途中で WebSocket を切った
- ✅ 実測

  | 観測 | 値 |
  | --- | --- |
  | 切断までに受信 | 12 件 |
  | 最終結果 | `done` / `"survived the disconnect"` |
  | モデル呼び出し | 3（失敗 2 + 成功 1） |
  | **インスタンス識別子** | **切断の前後で同一** |

  - 対照が効いている。インスタンスが変わっていないので、
    これは「落ちて復旧した」のではなく「**実行がクライアント接続に依存していない**」
- ✅ 再接続すると snapshot にエントリが 5 件入っている。そこから現在状態を組み直せる
- 📌 イベントストリームに**カーソル再生は無い**（型定義で確認）
  - `AgentEventStream` は `snapshot` / `start` / `stop` / `closed` のみ
  - 一方 `entries()` には cursor がある。**状態は追えるがイベントは追えない**

## 7. Parked Tasks ―― クラッシュループを止める

- `restartLimit` を 2 に下げ、進捗を出さないまま同じ場所で落とし続けた
- ✅ 実測。対照は「何が再起動として数えられるか」

  | 落とし方 | 障害発火 | インスタンス生成 | `pending()` | `onReport` | 次の alarm |
  | --- | ---: | ---: | --- | --- | --- |
  | `ctx.abort()` | 2 | 2 | **`parked`** | **`task_parked`** | **なし** |
  | 例外送出 | 1 | **0** | 空（決着） | なし | なし |

  - 例外は Durable Object をリセットしないので、インスタンス生成が 0
  - 再起動カウントは 1 度も増えない。README の「a close is not counted」の実際の意味
- ✅ parked のあと `getAlarm()` は null。**parked タスクは Durable Object を起こし続けない**
- ✅ 抜け方が 2 通りある

  | | `retry()` | `abort()` |
  | --- | --- | --- |
  | 戻り値 | `true` | `ok` |
  | `pending()` | 空になる | 空になる |
  | `wait()` | **`done`** | **`unanswered` / `aborted`** |

  - 対照: 何も parked されていない状態で `retry()` を呼ぶと `false`
  - 「片付いた」のか「やり遂げた」のかが区別できる
- 📌 **unsafe なツールは、そもそもクラッシュループを作れない**
  - 最初 `bump_unsafe` で組んだら、中断は 1 回起きたが再実行されず run が決着した
  - crash-loop guard が守るのは「再実行される work」だけ

## 8. Storage Error Recovery の守備範囲

- `Storage` は 17 メソッドの構造的インターフェース。**Proxy で包める**（型定義で確認）
- 型定義のコメントが、README より踏み込んだ契約を書いている

  > Two errors of a read fail only that read: a `StorageRequestError` for an invalid request ...
  > **Any error from `commit()` or `mintId()` is fatal.**

- ✅ 実測。3 つの境界を撃ち分けた

  | 観測 | `mintId()` から任意のエラー | 読み取りから `StorageRequestError` |
  | --- | --- | --- |
  | 呼び出し側 | `Error` が出る | `StorageRequestError` が出る |
  | `onReport` | **`session_failed`** | **なし** |
  | factory 実行回数 | 1 → **2** | 1 → **1** |
  | `instance_started` | **0** | **0** |
  | 次の `submit()` | 成功し `done` | 成功し `done` |

  - 📌 **どちらも例外が出て、どちらも次の操作は成功する。** 見た目では区別がつかない
  - 対照が無いと「復旧した」と「そもそも壊れていなかった」が区別できない
- 復旧の正体は PR #2648 が書いている通り

  > PiHarness kept the dead pi cached, so every later call failed until the isolate restarted
  > Reopens on the next call or the wake job's next step. **Calls already in flight still reject with `SessionFailed`.**

- 着地：**進行中の呼び出しは 1 つも救われない**。`instance_started` が 0 なので、
  Durable Object を再起動せずに Pi だけ開き直している
  - だから factory は「何度でも走ってよい」実装にする必要がある

## 9. `replay: "safe"` は冪等性を検査しない（🔥 山場その1）

- 公式ドキュメントの Recovery 表は、こう書いている

  | 起きたこと | Pi の扱い |
  | --- | --- |
  | `replay: "safe"` のツールが実行中だった | ツールを再実行する |
  | それ以外のツールが実行中だった | 再実行しない。モデルに中断結果を渡す |

- 📌 Extensions ドキュメントと型定義の両方で、**`unsafe` が既定値**
  - **何も書かなければ全ツールが unsafe になる**
- 4 本のツールを同じ条件で中断させて、実行回数と副作用回数を**別々に数えた**（📋 メモ③）
- ✅ 実測（workerd と実デプロイで 8 ケースすべて一致）

  | ツール | `replay` | 冪等 | 中断位置 | 実行開始 | **副作用** | 完了 |
  | --- | --- | --- | --- | ---: | ---: | ---: |
  | `write_record` | `safe` | はい | 確定前 | 2 | 1 | 1 |
  | `write_record` | `safe` | はい | 確定直後 | 2 | 2 | 1 |
  | `bump_unsafe` | 未指定 | いいえ | 確定前 | **1** | 0 | 0 |
  | `bump_unsafe` | 未指定 | いいえ | 確定直後 | **1** | 1 | 0 |
  | `bump_safe_unguarded` | `safe` | **いいえ** | 確定前 | 2 | 1 | 1 |
  | `bump_safe_unguarded` | `safe` | **いいえ** | 確定直後 | 2 | **2** | 1 |
  | `bump_safe_guarded` | `safe` | はい | 確定前 | 2 | 1 | 1 |
  | `bump_safe_guarded` | `safe` | はい | 確定直後 | 2 | **1** | 1 |

- 🔥 **`safe` を宣言した非冪等なツールは、副作用を 2 回確定させる**
- イベント列がそのまま証拠になる

  ```
   6 tool_committed   {tool: bump_safe_unguarded, value: 1}
   7 fault_injected   {at: bump_safe_unguarded:after_commit, mode: abort}
   8 instance_started {factoryRuns: 0}          ← 別インスタンス
  11 tool_committed   {tool: bump_safe_unguarded, value: 2}
  ```

- 対照が 2 つ効いている
  - `bump_unsafe` が 1 回で止まる → **再実行が本当に起きている証明**
  - `bump_safe_guarded`（冪等キーあり）が 1 回に収まる → **2 回になるのは冪等性の問題であって、Pi の復旧が壊れているのではない証明**
- 📌 **Pi から見れば、どのケースも正常に復旧している。** run は `done`、エラー報告も無い
- 着地：公式は「running it twice is harmless」なツールに `safe` を付けろと書いている。
  **その判断を間違えても、Pi は何も言わない**

## 10. 中断はモデルに平文で渡る（❌ 主張が外れた）

- 当初の主張：「中断は transcript に専用のエントリとして残る」
- ✅ 実測したら、**エントリ種別は同じだった**

  ```
  中断なし: pi.user → pi.system → pi.assistant → pi.tool-result → pi.assistant
  中断あり: pi.user → pi.system → pi.assistant → pi.tool-result → pi.assistant
  ```

- 違うのは `pi.tool-result` の中身だけ

  | | `isError` | モデルが読む本文 |
  | --- | --- | --- |
  | 中断なし | `false` | `counter=1` |
  | 中断あり | **`true`** | `<harness>\n[error] Tool bump_unsafe was interrupted and may have partially run\n</harness>` |

- 📌 **モデルは「部分的に実行されたかもしれない」という英文をそのまま読む**
  - 構造化されたフラグではない。プロンプトに混ぜた自然文
- では、そのあとモデルは呼び直すのか
  - 偽モデルでは測れない。**応答を自分で書く以上、モデルの判断は観測できない**
  - Workers AI の実モデル（`@cf/zai-org/glm-4.7-flash`）で測った

  | 条件 | 試行 | ツール実行 | 副作用 | **ツール完了** |
  | --- | ---: | ---: | ---: | ---: |
  | 中断なし（対照） | 3 | 各 1 | 各 1 | 各 1 |
  | 確定直後に中断 | 3 | 各 1 | 各 1 | **各 0** |

  - この条件では呼び直さなかった。**ただし n=3・1 モデル・1 プロンプト**。一般化しない
- 📌 むしろ効くのは**完了が 0 だったこと**
  - 副作用は確定したのに、Agent は「終わった」と記録していない
  - それでも run は決着する
  - **実行されたのに、実行されたと分からない状態が残る**
- ✅ 切れたストリームに積まれたツール呼び出しは、再試行の前に実行されない

  | 条件 | 結果 | モデル呼び出し | ツール実行 |
  | --- | --- | ---: | ---: |
  | 対照（切れない） | `done` | 2 | 1 |
  | 本番（切れる） | `done` | **3** | **1** |

  - PR #2643 の「a cut-off message has `stopReason: "error"`, so no streamed tool call runs before the retry」の通り

## 11. ストリーム断の再試行は、文言で決まる

- Changelog の 1 行はこう

  > `agents/models/pi-ai` reports a cut-off or idle model stream as a transient error, so Pi retries the turn instead of failing it.

- 配布物を読むと、判定は**エラー本文に対する正規表現**だった（📋 メモ④）

  ```js
  export function isRetryableAssistantError(message) {
      if (message.stopReason !== "error" || !message.errorMessage) return false;
      const errorMessage = message.errorMessage;
      if (NON_RETRYABLE_PROVIDER_LIMIT_ERROR_PATTERN.test(errorMessage)) return false;
      return RETRYABLE_PROVIDER_ERROR_PATTERN.test(errorMessage);
  }
  ```

  - 再試行対象のパターンに `"ended without"` と `"timed? out"` が入っている
- PR #2643 がやったのは、**文言の書き換えだけ**だった
- ✅ 実測。バージョンを入れ替えず、投げる文言だけを変えた（失敗回数も条件も同じ）

  | 投げた文言 | 由来 | 結果 | モデル呼び出し |
  | --- | --- | --- | ---: |
  | `The stream ended before the model finished its answer.` | 0.29.0 | `unanswered` | **1** |
  | `The stream ended without the model finishing its answer.` | 0.30.x | **`done`** | **3** |
  | `Model stream stalled: no data received for 60s.` | 0.29.0 | `unanswered` | **1** |
  | `Model stream timed out: no data received for 60s.` | 0.30.x | **`done`** | **3** |
  | `insufficient_quota: the account has no remaining credit.` | 対照 | `unanswered` | **1** |

  - 📌 **同じ失敗を同じ回数起こしているのに、文言だけで結果が割れる**
  - 対照の `insufficient_quota` が 0.29.0 側と同じ → **判定器は実際に働いている**
  - モデル呼び出し 3 回（失敗 2 + 成功 1）なので、再試行は**リクエスト全体の作り直し**
- ✅ backoff には天井がある
  - `baseDelayMs` を 100 秒に設定しても、実際の待機は約 60 秒
  - `DEFAULT_RETRY_POLICY.maxAgentDelayMs`（既定 60000）が効いている
  - **倍々に増えるのも 60 秒まで**

## 12. Hibernation は alarm では測れない（🔥 山場その2）

- ここで 1 回失敗している。**最初は alarm の時刻を測って、対照が判別しなかった**
- ❌ ローカル（workerd）の測定

  | `onWake` | 実際の配線 | alarm までの秒数 |
  | --- | --- | --- |
  | 渡す | `true` | 17s 15s 12s 10s 7s 5s |
  | 渡さない | `false` | 17s 15s 12s 10s 7s 5s |

  - 設定は届いていた（`onWakeWired` が `false`）のに、6 サンプルすべて一致
  - 0.30.1 の待機ループで `wake.at` を使う行は、`onWake` の有無で分岐していない
- 🔥 **PR #2619 の表が比べているのは alarm の時刻ではなく、オブジェクトがメモリに留まる時間だった**
  - `onWake` を渡さないと Pi がインメモリタイマーを張り、それがオブジェクトを固定する
  - workerd では本番と同じ退避が起きないので、ローカルでは観測できない
- ✅ 観測対象を変えて、実デプロイで測り直した。**リトライがどのインスタンスで走るか**

  `onWake` を渡した場合。

  ```
  harness_opened@b42b1d7d → submitted@b42b1d7d → model_request@b42b1d7d → model_error@b42b1d7d
  → instance_started@2bc10139 → harness_opened@2bc10139 → model_request@2bc10139
  ```

  `onWake` を渡さなかった場合。

  ```
  harness_opened@67b53297 → submitted@67b53297 → model_request@67b53297 → model_error@67b53297
  → model_request@67b53297
  ```

  | `onWake` | submit 直後の alarm | リトライを走らせたインスタンス |
  | --- | --- | --- |
  | 渡す | 0 秒（即時） | **別インスタンス**（退避された） |
  | 渡さない | 30 秒（heartbeat） | **同一インスタンス**（タイマーが掴んでいた） |

  - backoff 90 秒と 60 秒で 2 回、別の Durable Object で独立に再現した
- 📌 待機中は**一切リクエストしない**。1 回でも触るとオブジェクトが起きて、測りたい現象が消える
- 📌 issue #2683 の報告者が「not yet on a deployed Cloudflare Durable Object」と断っていたのは、この壁
## 13. 0.30.0 のバグを自分で再現する

- §3 で見つけた既知バグ（[#2683](https://github.com/cloudflare/agents/issues/2683)）を、こちらで作り直した
- 条件は「実行中の別タスクの横で眠っているタスク」。1 つのハーネスで 2 本を並行させる
  - セッション A は 60 秒走るツールを呼ぶ（= Pi に work がある状態）
  - セッション B は再試行対象のエラーを返し、12 秒の backoff に入る（= sleeping なタスク）
  - A を 3 秒先に走らせてから B を投げ、B が再開するまでを測る
- ✅ 実測

  | | B 単独（対照） | 並行する work あり |
  | --- | ---: | ---: |
  | `agents@0.30.1` | 12s | **12s** |
  | `agents@0.30.0` | 12s | **57s** |

  - 📌 **57 秒は A の残り時間とほぼ一致する。** B の再試行が A の完了まで止まっていた
- 対照が 2 方向に効いている
  - B 単独が両版とも 12 秒 → 差はバージョンそのものではなく、並行実行の有無で出ている
  - 0.30.1 の並行ありも 12 秒 → 並行実行そのものが遅いわけではない
- 📋 メモ① の差分とも一致する。A が走っている間、待機ループは `active` のまま回り続け、
  B のスリープが期限を迎えても誰も `resume()` を呼ばなかった
- 着地：**`agents` は 0.30.1 以降を使う**。煽る話ではなく、Beta の成熟度の具体例

## 14. heartbeat は「work」と「sleep」で別物

- 公式ドキュメントの Recovery に 2 文ある

  > While Pi has work, the job's heartbeat alarm fires every 30 seconds.
  > While Pi's tasks sleep, such as during a retry backoff, the job is due when the first one wakes.

- 📌 **最初はここを取り違えて、リトライ backoff（= sleep）を測って「30 秒にならない」と書きかけた**
- ✅ 90 秒かかるツールを走らせた場合（= work がある）

  | `onWake` | alarm までの秒数 | 最大 |
  | --- | --- | ---: |
  | 渡す | 25 20 15 10 5 **30** 25 20 15 10 5 **30** 25 20 15 10 5 | 30 |
  | 渡さない | 25 20 15 10 5 **30** 25 20 15 10 5 **30** 25 20 15 10 5 | 30 |

  - 0 に達するたびに 30 に戻る、きれいなノコギリ波
  - 配布物の `HEARTBEAT_MS = 3e4` と一致
  - `onWake` で差が出ないのが正しい。`onWake` が効くのは sleep のときだけ
- ✅ リトライ backoff（= sleep）の場合

  | `onWake` | alarm までの秒数 |
  | --- | --- |
  | 渡す | 55 50 45 40 35 30 25 20 15 10 5 なし… |
  | 渡さない | 55 50 45 40 35 30 25 20 15 10 5 なし… |

  - 30 を超えて単調に減り、wake 時刻で消える。heartbeat は挟まらない
- 着地：**2 つの測定を合わせて、公式ドキュメントの 2 文が両方とも確認できた**

## 15. ロールバックできない理由は、Hibernation の実装だった

- Changelog の警告

  > Pi 1.4 migrates the session storage in the object's SQLite database to a schema that Pi 1.3 cannot open,
  > so a deployment cannot roll back past this upgrade.

- ✅ 証拠が 3 つ揃った
  - Pi 1.4 が書いたスキーマ版を実測: `[{ "singleton": 1, "version": 2 }]`
  - マイグレーション定義の差

    | | 定義されているマイグレーション |
    | --- | --- |
    | `pi-durable@1.3.0` | `{ version: 1, statements: initialSchema }` のみ |
    | `pi-durable@1.4.0` | `{ version: 1, ... }` と **`{ version: 2, statements: sleepingStatus }`** |

  - 1.3.0 のマイグレーションランナーが拒否する

    ```js
    if (row.version > currentVersion) {
        throw new Error(`Durable SQLite schema version ${row.version} is newer than supported version ${currentVersion}`);
    }
    ```

- 📌 **追加されたマイグレーションの名前が `sleepingStatus`**
  - Pi 1.4 の Breaking Changes にある「Tasks have a `sleeping` status」がこれ
  - `sleeping` 状態は `sleepUntil()` による耐久スリープ、つまり **§12 の Hibernation を成り立たせている仕組みそのもの**
- 着地：**Durable Object が退避できるようになった代償が、スキーマの非互換だった**
  - 「戻せない」という警告と、この記事の目玉は、同じ変更の表と裏

## 16. 測り直して判定が覆った 3 件

- 📌 **この節を落とすと、§9 の数字も信用されない**
- **C43（イベントの取りこぼし）** ―― 最初の測定が一番危なかった

  | リスナー遅延 | ドレイン 8 秒 | ドレイン 30 秒 |
  | --- | --- | --- |
  | 0 ms | バッチ 7 / イベント 22 | バッチ 7 / イベント 22 |
  | 1500 ms | バッチ 5 / **イベント 14** | バッチ 7 / **イベント 22** |

  - 最初は「遅いリスナーはイベントを取りこぼす」と出た
  - ドレインを延ばしたら同数になった。**差は自分が WebSocket を早く閉じた副作用だった**
  - 8 秒のまま書いていたら、誤った主張を載せていた
- **C24（進捗でカウントが戻る）** ―― 「進捗」の定義を取り違えていた
  - 最初は自前カウンタの更新を「進捗」と呼んでいた。Pi から見ればそれは進捗ではない
  - `api.output()` を 8 回刻んで測り直しても、**やはり parked になった**
  - 分かったのは「ツールの出力は進捗に数えられない」まで。元の主張は未確認
- C39（heartbeat）は sleep と work を取り違えていた（§14）
- 📌 3 件とも、**対照を組み直して気づいた**。対照が無ければ気づけない
- C15（15 分超のストリーム）も保留にした
  - 19.2 分のストリームは切られなかった。モデル呼び出しは最後まで 1 回
  - ただし偽 Provider のストリームは Worker 内で閉じている。外部 API への長時間接続とは別物
  - 公式も「can be cut off」と条件付き。**仕様を否定するものではない**

## 17. まとめ ―― 入れるべきか

- 入れてよい。**復旧機構はドキュメント通りに動く**
  - 会話履歴は別インスタンスから読み戻せる（§5）
  - クラッシュループは `restartLimit` で止まり、手動で再開・放棄できる（§7）
  - リトライ待機中は Durable Object が退避できる（§12）
- ただし **Pi が守っているのは「Agent の実行」であって「あなたの副作用」ではない**
  - `replay: "safe"` は冪等性の宣言であって、検査ではない（§9）
  - `unsafe` にしても、確定した副作用は残る。ツールは完了しないまま run が決着する（§10）
  - モデルに渡るのは `<harness>` タグ付きの英文 1 行。そのあとの挙動はモデル依存（§10）
- 開発者が引き続き持つべきもの
  - 外部操作には**冪等キー**。`safe` を付けるかどうかとは別の話
  - factory は**何度でも走ってよい**実装にする（§8）
  - `createRegistry()` は**クラスフィールドに置く**。モジュールスコープだと退避ごとにハーネスがメモリに残る
- バージョンの選び方
  - `agents` は **0.30.1 以降**。0.30.0 には §3 のバグがある
  - Pi 1.4 に上げたら**戻せない**（§15）。1.3 との比較には別の Durable Object を使う
- 📌 測り方の教訓を 1 つだけ持ち帰るなら
  - **対照を置く。** 「できた」と「そもそも壊れていなかった」は、対照が無いと区別できない（§8 / §16）

## 検証前チェックリスト

- [ ] `.gitignore` を `.env` より先に書く（`data/`・生ログ・`.dev.vars` も）
- [ ] レコーダを 1 行目から仕込む。`ctx.storage.sync()` を挟む（§4）
- [ ] インスタンス識別子をコンストラクタで採番する。対照の土台になる
- [ ] Durable Object の名前を実行ごとに変える。使い回すと前回の失敗した run が先に走る
- [ ] `createRegistry()` をクラスフィールドに置く
- [ ] `agents` は 0.30.1 以降
- [ ] Workers AI を使うなら**プランを確認する**。Free では `@cf/zai-org/glm-5.3-flash` が使えない
- [ ] 実デプロイで測る項目を先に分ける（Hibernation はローカルでは測れない）

## メモ（サンプルコード・資料）

### メモ① `agents` 0.30.0 → 0.30.1 の差分

```sh
diff -u agents-0.30.0/package/dist/harness/pi/index.js \
        agents-0.30.1/package/dist/harness/pi/index.js
```

```js
// 0.30.1 で追加された部分（#waitWhileActive の中）
let sleep = onWakeWired ? left : Math.min(left, pollMs);
if (wake.at !== void 0) sleep = Math.min(sleep, wake.at - now);
// ...
if (wake.at !== void 0 && Date.now() >= wake.at) pi.resume();
wake = pi.wake();
```

### メモ② 記録が消えるかを測る（C01）

```ts
async probeC01(durable: boolean): Promise<never> {
  await this.evidence.record("observed", { probe: "c01", durable }, { durable });
  this.ctx.abort(`c01-probe:sync=${durable}`);
  throw new Error("unreachable");
}
```

`durable: true` のとき `record()` の最後で `await ctx.storage.sync()` を呼ぶ。
`false` は **C01 の対照専用**で、他では使わない。

### メモ③ 検証用ツールの 4 本（C16〜C19）

| ツール | `replay` | 冪等 | 何を見るため |
| --- | --- | --- | --- |
| `write_record` | `safe` | はい | safe は再実行される |
| `bump_unsafe` | 未指定 | いいえ | 既定は unsafe、再実行されない |
| `bump_safe_unguarded` | `safe` | **いいえ** | **safe を付けたが冪等でないツール** |
| `bump_safe_guarded` | `safe` | はい | 冪等キーがあれば 1 回に収まる |

どのツールも「実行開始」「副作用の確定」「終了」を**別々に数える**。
実行回数と副作用回数が食い違う瞬間が、この検証の中心にある。

発火点は 2 つ。`before_commit`（副作用確定前）と `after_commit`（確定直後）。

### メモ④ 再試行の判定を手元で確かめる（C11）

```sh
# 両バージョンの配布物から実際の文言を取り出す
grep -n "Model stream\|The stream ended" agents-0.29.0/package/dist/models/pi-ai/index.js
grep -n "Model stream\|The stream ended" agents-0.30.1/package/dist/models/pi-ai/index.js

# pi-ai 1.4.0 の判定関数にそのまま通す
node check-retry.mjs ./pi-ai/package/dist/utils/retry.js
```

```js
const { isRetryableAssistantError } = await import(process.argv[2]);
const r = isRetryableAssistantError({ stopReason: "error", errorMessage: text });
```

### メモ⑤ 既定値（配布物より）

```js
// @earendil-works/pi-durable@1.4.0 dist/harness/agent.js
export const DEFAULT_RETRY_POLICY = {
    enabled: true, maxRetries: 3, baseDelayMs: 2000, maxAgentDelayMs: 60000,
};
export const DEFAULT_RESTART_LIMIT = 5;

// agents@0.30.1 dist/harness/pi/index.js
const WAIT_BUDGET_MS = 10 * 6e4;      // 10 分
const HEARTBEAT_MS = 3e4;             // 30 秒
const MAX_WAKE_BACKOFF_MS = 10 * 6e4; // 10 分
```

| 設定 | 既定値 | 影響する節 |
| --- | ---: | --- |
| モデルリトライ | 有効、3 回、初回 2 秒から倍々、上限 60 秒 | §11 |
| `restartLimit` | 5 回 | §7 |
| Wake ジョブの heartbeat | 30 秒 | §14 |
| 1 回の Alarm 内で待つ上限 | 10 分 | §16（C15） |

- クラッシュから再起動まで最大 30 秒なので、既定の `restartLimit` で parked に到達させるには最大 2 分半かかる
- `settings.restartLimit` は 1 以上の整数を受け付けるので、検証では 2 まで下げた

### メモ⑥ ハーネス実装でハマったところ

記事には書かない。**スライドの「おまけ」には使えるかもしれない。**

- `fauxAssistantMessage` の既定は `stopReason: "stop"`
  - ツール呼び出しブロックを積んでも `"toolUse"` にしないと Pi は実行せずにターンを終える
  - エラーにならないので、カウンタを見るまで気づけない
- `setResponses` はキューなので 1 回で尽きる
  - ツール呼び出し → 結果 → 締め、のように 1 ターンで終わらないシナリオでは 2 回目で `model_error`
  - 応答関数が毎回自分を積み直す形にした
- Durable Object の RPC はネストしたプロパティを通さない
  - `lab.harness.submit()` は型が通っても実行時に落ちる
  - `WebSocket` も RPC の戻り値にできない（`DataCloneError`）。DO 自身の `fetch()` で受ける
- `defaults` はクラスフィールドなので構築時に 1 度しか評価されない
  - あとからモデルを変えるには `session().setModel()`
- Workers Free プランでは `@cf/zai-org/glm-5.3-flash`（公式サンプルのモデル）が使えない
  - `createAI` のカタログも限定的で `@cf/meta/llama-*` は `no_model`
  - 動いたのは `@cf/zai-org/glm-4.7-flash`

### メモ⑦ サンドボックスの構成

```
sandbox/
├── src/evidence.ts   証跡レコーダ。全観測がここを通る
├── src/state.ts      障害注入の計画とカウンタ。Pi の replay の外側
├── src/tools.ts      検証用ツール 4 本
├── src/script.ts     偽モデル（pi-ai 同梱の fauxProvider）
├── src/storage.ts    Storage の Proxy ラッパ
├── src/agent.ts      検証対象の Durable Object
└── drive/*.mjs       シナリオドライバ。対照を 1 本のスクリプトに並べる
```

実行手順と生データは `results.md` の「測定の再現手順」にある。
