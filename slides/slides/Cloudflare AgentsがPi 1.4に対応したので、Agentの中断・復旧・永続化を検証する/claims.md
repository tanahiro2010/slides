# claims — Cloudflare Agents × Pi 1.4 の中断・復旧・永続化

| | |
| --- | --- |
| フェーズ | **5（実機で測る）完了。未検証ゼロ。** 44 本中 39 本確定・1 本否定・4 本保留。結果は `results.md` |
| 次 | **6. 判定**（`verify-judge`）→ 8. 執筆。全 44 本に判定が付いた |
| 人間待ち | なし。**Worker `pi14-recovery-sandbox` が公開状態のまま**（不要なら削除してよい） |
| 開示 | 方針のみ決定。新しい不具合が出たら内容を見せて相談してから報告する |
| 作成日 | 2026-10-25 |
| 対象 | Agents SDK 0.29.0 / 0.30.0 / 0.30.1、`@earendil-works/pi-durable` 1.3.0 / 1.4.0 |
| 実機 | **一部のみ要**（下記「実機が要るもの／要らないもの」で分離済み） |

## 決定事項（Phase 0）

| | |
| --- | --- |
| スコープ | **EXP-01〜07 の 7 本すべて** |
| 実機 | **ローカル（workerd / vitest-pool-workers）+ 実デプロイ**。EXP-07 の C38〜C40 だけデプロイ必須 |
| 上流報告 | **出たら相談してから報告**。証跡を報告可能な形で残す前提でサンドボックスを設計する |
| シークレット | `.gitignore` 済み（`**/sandbox/.env`、`**/.dev.vars`、`**/sandbox/data/`、`**/*.raw.jsonl`） |
| モデル | **偽 Provider を既定にする。** Workers AI は C05 と C40 の実デプロイ確認でだけ使う |

偽 Provider を既定にする理由を書いておきます。
EXP-03 はストリームを狙った位置で切ります。
EXP-04 と EXP-05 は同じ応答を何度も再現します。
Workers AI では、どちらも制御できません。
`models.setProvider()` が公開されているので、差し替えは公式の経路に乗ります。

---

## 一次資料

**更新日を必ず書く。** どちらを先に疑うかの材料になる。

| 資料 | 種別 | 最終更新 |
| --- | --- | --- |
| [Changelog — Agents SDK now supports the latest Pi 1.4 release](https://developers.cloudflare.com/changelog/post/2026-10-22-pi-harness-pi-1-4/) | ベンダー changelog | **2026-10-22** |
| [Cloudflare Docs — Pi](https://developers.cloudflare.com/agents/harnesses/pi/) | ベンダー doc | **2026-10-22** |
| [Cloudflare Docs — Pi / Extensions](https://developers.cloudflare.com/agents/harnesses/pi/extensions/) | ベンダー doc | 2026-10-22 |
| [`agents` CHANGELOG 0.30.0 / 0.30.1](https://github.com/cloudflare/agents/blob/main/packages/agents/CHANGELOG.md#0300) | ベンダー changelog | 2026-10-23 |
| [`pi-durable` CHANGELOG 1.4.0](https://github.com/earendil-works/pi/blob/v1.4.0/packages/durable/CHANGELOG.md#140---2026-10-21) | 上流 changelog | 2026-10-21 |
| `@earendil-works/pi-durable@1.4.0` の `README.md` | 上流 doc | 2026-10-21 |
| [cloudflare/agents#2683](https://github.com/cloudflare/agents/issues/2683) | 一次（不具合の自己申告） | 2026-10-23 |
| [PR #2619](https://github.com/cloudflare/agents/pull/2619) / [#2624](https://github.com/cloudflare/agents/pull/2624) / [#2643](https://github.com/cloudflare/agents/pull/2643) / [#2648](https://github.com/cloudflare/agents/pull/2648) / [#2649](https://github.com/cloudflare/agents/pull/2649) | 一次（設計意図） | 2026-10-21〜22 |
| [Durable Objects — `state`](https://developers.cloudflare.com/durable-objects/api/state/) | ベンダー doc | 2026-10-21 |
| [Durable Objects — Storage API](https://developers.cloudflare.com/durable-objects/api/storage-api/) | ベンダー doc | 2026-10-21 |
| [Pi Durable（earendil.com）](https://earendil.com/posts/pi-durable/) | 上流の設計記事 | 2026-10-01 |
| `agents@0.29.0` / `0.30.0` / `0.30.1` の `dist/` | **一次・最強** | 2026-10-20〜23 |
| `@earendil-works/pi-durable@1.4.0` / `pi-ai@1.4.0` の `dist/` | 一次 | 2026-10-21 |

> ベンダー doc と上流 changelog は層が違う。
> Cloudflare の Changelog は 4 項目を「Pi 1.4 対応」としてまとめているが、
> うち 2 項目は Agents SDK 側の修正で、Pi は関与していない（C33・C11 の由来を参照）。
> **どちらの層の話かを毎回確かめる。**

---

## 矛盾と沈黙（読むだけで出たもの）

### 矛盾 1: 「Pi 1.4 の新機能」の 4 点は、2 つの層が混ざっている

| | 言っていること |
| --- | --- |
| Cloudflare Changelog（10-22） | 4 点をまとめて「Pi 1.4 対応リリースの内容」として並べる |
| PR #2643 本文（10-21） | 「Each string checked against the classifier in **installed Pi 1.3.0** and Pi main」 |

Model Stream Retry は Pi 1.3 でも成立します。
Storage Error Recovery も、Pi 側の挙動は 1.2 から変わっていません。
**PRD §7 の「Pi 1.3 vs Pi 1.4」比較表は、この 2 行について軸が間違っています。**
正しい軸は Agents SDK 0.29.0 と 0.30.1 です（C11・C33）。

### 矛盾 2: 公式ドキュメントが推す構成に、既知の不具合が残っている

| | 言っていること |
| --- | --- |
| Pi doc / Changelog（10-22） | `onWake` を factory から渡せ。渡さないと警告が出る |
| issue #2683（10-23） | その `onWake` を渡すと、他タスク実行中にスリープが再開しない |

0.30.1 で修正されました。
**0.30.0 で測ると、Pi 1.4 の Hibernation が動かないという誤った結論になります**（C38）。

### 沈黙（書かれていないので実測するしかない）

| 書かれていないこと | 対応する主張 |
| --- | --- |
| クラッシュ直前の記録を残す方法 | C01（`sync()` が要るのか） |
| Parked に到達するまでの実時間 | C25 |
| 副作用確定「直後」に中断した safe ツールの副作用回数 | C19 |
| 中断された unsafe ツールを、モデルが呼び直すか | C20 |
| factory の `storage` をラップして差し替えられるか | C30 |
| リトライ待機中に alarm がいつに設定されるか | C39 |
| 退避したオブジェクトのコンストラクタが再実行されるか | C40 |

---

## 主張一覧

PRD の EXP-01〜07 を、真偽判定できる単位に割り直しました。
**元の EXP 番号は「由来」列に残しています。**

| # | 主張 | 出典 | 確かめ方 | 対照 | 実機 | 判定 | 由来 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **C01** | 記録イベントは `ctx.storage.sync()` を挟めば `ctx.abort()` を跨いで残る | Storage API doc「resolves once all previous writes have successfully been persisted to disk」 | 書く → `sync()` → `abort()` → 再起動後に読む | **`sync()` 無しで同じことをすると残らないこと。これが無いとレコーダ自体が信用できない** | ローカル可 | ✅ **実測**（対照あり） | 📭 基盤 |
| **C02** | `ctx.abort()` はアプリコードから catch できない | `state` doc「Application code cannot catch this error」 | ツール内で `try { ctx.abort() } catch {}` | **通常の `throw` は catch できること** | ローカル可 | ✅ **実測** | 📭 基盤 |
| **C03** | インスタンス識別子はコンストラクタ実行ごとに変わる | 自明だが土台 | コンストラクタで UUID を採番して記録 | **同一インスタンスへの連続リクエストでは変わらないこと** | ローカル可 | ✅ **実測** | 📭 基盤 |
| **C04** | Pi の状態は `pi_` 接頭辞の SQLite テーブルに入る | Pi doc「The table names start with `pi_`」 | `sqlite_master` を列挙 | **自前テーブルが同居しても壊れないこと** | ローカル可 | ✅ **実測**（9 表） | EXP-01 |
| **C05** | DO が再生成されても `messages()` が読み戻せる | Pi doc / 設計記事 | abort → 再リクエスト → `messages()` | **インスタンス識別子が変わっていること。これが無いと「そもそも死んでいない」と区別できない** | ローカル可 | ✅ **実測**（対照あり） | **EXP-01** |
| **C06** | 完了済みタスクは再起動後に二重実行されない | 設計記事「continues from its last checkpoint」 | ツール実行回数カウンタ | **同じ構成で未完了タスクは再実行されること** | ローカル可 | ✅ **実測** | EXP-01 |
| **C07** | 同じ `operationId` の再 submit は `accepted: false` を返す | Pi doc「Submitting the same id again returns the same operation」 | 同一 id で 2 回 submit | **違う id なら `accepted: true` になること** | ローカル可 | ✅ **実測**（対照あり） | EXP-01 |
| **C08** | WebSocket を切っても Agent の実行は継続する | PRD の仮説 | 実行中に切断 → 別経路で `wait()` | **インスタンス識別子が変わっていないこと（切断と再起動の区別）** | ローカル可 | ✅ **実測**（対照あり） | **EXP-02** |
| **C09** | イベントストリームにカーソル再生は無い | Pi doc「There is no cursor to resume a stream from」 | 型定義を読む | — | **不要** | ✅ **型定義** | EXP-02 |
| **C10** | 再接続時は snapshot から現在状態を再構築できる | Pi doc「A client that connects mid-run gets a snapshot that includes the partial answer」 | 切断中に進んだ分が snapshot に入っているか | **切断中に流れたイベントは個別には取れないこと** | ローカル可 | ✅ **実測** | EXP-02 |
| **C11** | 途切れたモデルストリームが一時的エラーとして再試行される | Changelog | 偽 Provider でストリームを途中切断 | **`agents@0.29.0` では再試行されないこと（バージョン対照）** | ローカル可 | ✅ **静的 + 実測** | **EXP-03** |
| **C12** | 再試行はモデルリクエスト全体の再実行である | Pi doc「Pi keeps the partial answer it stored and makes the model call again」 | Provider への到達回数を数える | **部分出力が履歴に残っていること** | ローカル可 | ✅ **実測**（3 回） | EXP-03 |
| **C13** | モデルリトライの既定は 3 回・初回 2 秒・倍々・上限 60 秒 | `DEFAULT_RETRY_POLICY` | 失敗を連続させて間隔を測る | **`settings.retry` を変えると追従すること** | ローカル可 | ✅ **静的 + 実測**（60 秒の天井） | EXP-03 |
| **C14** | 再試行の前に、途中まで流れたツール呼び出しは実行されない | PR #2643「a cut-off message has `stopReason: "error"`, so no streamed tool call runs before the retry」 | ツール呼び出しを含む応答を途中で切る | **正常完了時は同じツールが走ること** | ローカル可 | ✅ **実測**（対照あり） | 📭 EXP-03 |
| **C15** | 15 分を超えるモデルストリームは切られうる | Pi doc Limitations | `tokensPerSecond: 1` で 19 分のストリームを作る | **400 文字（約 100 秒）が完走すること**（遅延が効いている証明） | **要デプロイ**・長時間 | ⚠️ **切られず**（19.2 分で完走） | EXP-03 |
| **C16** | `replay` 未指定のツールは unsafe 扱いになる | Extensions doc「`replay: "unsafe"`, the default」 | 型定義と既定値を読む | — | **不要** | ✅ **型定義 + 実測** | **EXP-04** |
| **C17** | `replay: "safe"` のツールは中断後に再実行される | Pi doc Recovery 表 | 実行中に `ctx.abort()` → 実行回数 | **同一 run 内の unsafe ツールが再実行されないこと** | ローカル可 | ✅ **実測** | **EXP-04** |
| **C18** | unsafe なツールは再実行されず、モデルに中断結果が渡る | 同上 | 同上 + transcript を読む | **上と対。同じスクリプトで両方を測る** | ローカル可 | ✅ **実測** | **EXP-04** |
| **C19** | 副作用が確定した**直後**に中断した safe ツールは、副作用を 2 回起こす | **記載なし** | 副作用を書いた直後に `ctx.abort()` | **冪等キーを付けた版では 1 回に収まること** | ローカル可 | ✅ **実測・中核** | **📭 EXP-04 中核** |
| **C20** | 中断された unsafe ツールを、モデルが呼び直すことがある | **記載なし**（PRD の仮説） | 実モデルで同条件を繰り返す | **中断しない同じプロンプト**（3/3 で実行 1 回） | **要 Workers AI** | ⚠️ **呼び直さなかった**（n=3・1 モデル） | **📭 EXP-04 中核** |
| **C21** | 中断は transcript に専用のエントリとして残る | Pi doc「The model gets an interrupted result」 | `messages()` のエントリ種別 | **正常終了時のエントリと違うこと** | ローカル可 | ❌ **同じ `pi.tool-result`**。`isError` と平文で区別 | EXP-04 |
| **C22** | `restartLimit` の既定値は 5 | `DEFAULT_RESTART_LIMIT = 5` | 配布物を読む | **1 未満や非数値は既定に落ちること** | **不要** | ✅ **静的に確認済み** | EXP-05 |
| **C23** | 正常な `close()` は再起動カウントに入らない | pi-durable README「a close is not counted」 | 正常終了を 6 回繰り返す | **`ctx.abort()` 6 回では parked になること。これが一番効く対照** | ローカル可 | ✅ **実測**（対照あり） | **EXP-05** |
| **C24** | タスクが新しい状態をコミットするとカウントが 0 に戻る | 同 README「a new state the task commits」 | `api.output()` を刻んでから落とす | **進捗なしと同条件で比べる**（どちらも 2 回で parked） | ローカル可 | ⚠️ **出力は進捗に数えられない** | EXP-05 |
| **C25** | 上限到達でタスクが parked になり `pending()` に出る | Pi doc / PR #2624 | `restartLimit: 2` にして 2 回クラッシュ | **1 回では `running` のままであること** | ローカル可 | ✅ **実測** | **EXP-05** |
| **C26** | parked されたタスクは DO を起こし続けない | Changelog「a task stopped by Pi's restart limit no longer keeps the object awake」 | `ctx.storage.getAlarm()` を見る | **parked 前は 30 秒後に alarm があること** | ローカル可 | ✅ **実測**（alarm なし） | EXP-05 |
| **C27** | `session.retry()` で parked タスクが再開し、最終的に完了する | Pi doc | 障害条件を解除して `retry()` | **何も parked されていなければ `false` を返すこと** | ローカル可 | ✅ **実測**（対照あり） | **EXP-05** |
| **C28** | `session.abort()` で parked タスクを放棄できる | Pi doc | `abort()` 後に `pending()` | **`retry()` した場合は完了すること** | ローカル可 | ✅ **実測**（`retry()` と対） | EXP-05 |
| **C29** | parked の間も `wait()` は待ち続ける | Pi doc「`wait()` keeps waiting」 | parked 状態で `wait()` を張る | **`retry()` 後に解決すること** | ローカル可 | ✅ **実測**（対照あり） | EXP-05 |
| **C30** | factory が受け取る `storage` をラップして差し替えられる | **記載なし**（EXP-06 の前提） | Proxy で包んで `Harness.open()` に渡す | **包まない場合と同じ結果になること** | ローカル可 | ✅ **型定義** | **📭 EXP-06 前提** |
| **C31** | ストレージエラーは Session を殺し、進行中の呼び出しは `SessionFailed` で reject する | **`Storage` インターフェースの契約**（下記） | 書き込みで投げさせる | **正常時は同じ呼び出しが成功すること** | ローカル可 | ✅ **実測**（対照あり） | EXP-06 |
| **C32** | 次の呼び出しで factory が再実行され、Pi が開き直る | PR #2648 | エラー後に `submit()` → factory 実行回数 | **`agents@0.29.0` では開き直らないこと（バージョン対照）** | ローカル可 | ✅ **実測** | **EXP-06** |
| **C33** | 復旧は Pi の機能ではなく、PiHarness がキャッシュを捨てる動作である | PR #2648「PiHarness kept the dead pi cached」 | C32 の factory 実行回数で示す | **Pi 単体（`agents` を介さない）では開き直らないこと** | ローカル可 | ✅ **実測**（DO 再起動なし） | **📭 EXP-06** |
| **C34** | 読み取りで投げた `StorageRequestError` は Session を殺さない | **`Storage` インターフェースの契約**（下記） | 読み取りだけで投げさせる | **`commit()` で投げると殺すこと** | ローカル可 | ✅ **実測**（対照あり） | **EXP-06** |
| **C35** | `onWake` を渡さないと警告ログが出る | PR #2619「the harness logs one warning when it opens pi」 | factory から外して起動 | **渡すと出ないこと** | ローカル可 | ✅ **実装** | EXP-07 |
| **C36** | `onWake` を渡すと Pi はスリープ用のタイマーを持たない | **`HarnessOptions.onWake` の契約**（下記） | タイマー数を観測 | **渡さない場合はタイマーが残ること** | ローカル可 | ✅ **間接**（退避の有無から） | EXP-07 |
| **C37** | リトライ待機中の alarm は、30 秒の heartbeat ではなく wake 時刻に設定される | Pi doc「the job is due when the first one wakes」 | 待機中に `ctx.storage.getAlarm()` | **`onWake` 無しでは 30 秒後になること（PR #2619 の表の再現）** | **要デプロイ** | ✅ **実デプロイで確認** | **EXP-07 中核** |
| **C38** | 他タスクの実行中でも、期限の来たスリープが再開される | 0.30.1 の修正 | 2 セッションで work と sleep を並行させる | **B 単独が両版とも 12 秒**（差は並行の有無で出る） | ローカル可 | ✅ **実測**（0.30.0 で 57 秒に伸びる） | **📭 EXP-07** |
| **C39** | 処理中の alarm は 30 秒ごとに発火する | `HEARTBEAT_MS = 3e4` | 発火時刻を記録 | **スリープ中は 30 秒では発火しないこと** | **要デプロイ** | ✅ **実測**（ノコギリ波） | EXP-07 |
| **C40** | 待機明けにコンストラクタが再実行される（= メモリから落ちていた） | Changelog「the Durable Object can hibernate」 | 長い待機の前後でインスタンス識別子を比較 | **短い待機では変わらないこと** | **要デプロイ** | ✅ **実デプロイ・中核** | **📭 EXP-07 中核** |
| **C41** | Pi 1.4 で開いた SQLite は Pi 1.3 で開けない | Changelog「a deployment cannot roll back past this upgrade」 | スキーマ版の実測 + 両版の定義 + 1.3 の拒否コード | **1.3 の上限が 1 であること**（1.4 は 2 を書く） | ローカル可 | ✅ **実測 + 実装**（1.3 の実行は未実施） | EXP-07 / §7 |
| **C42** | レジストリをモジュールスコープに置くと、退避ごとにハーネスがメモリに残る | 0.30.0 CHANGELOG の Upgrading 手順 4 | 退避を繰り返してメモリを見る | **クラスフィールドに置いた版では増えないこと** | ローカル可 | ✅ **実装**（機構を特定） | 📭 実装注意 |
| **C43** | イベントが溢れると、未配信バッチが 1 つの snapshot に置き換わる | **記載なし**（`watchEvents` の実装コメント） | 遅いリスナーを張って大量にコミットする | **速いリスナーとイベント数を比べる**（22 対 22 で同数） | ローカル可 | ⚠️ **この規模では再現せず** | **📭 EXP-02 で発見** |
| **C44** | unsafe なツールは crash-loop を作れない（再実行されないため parked に到達しない） | **記載なし**（EXP-05 の過程で判明） | unsafe なツールで同じ中断を繰り返す | **safe なツールでは parked に到達すること** | ローカル可 | ✅ **実測** | **📭 EXP-05 で発見** |

---

## 1 文を割った箇所

### Cloudflare Changelog のこの 1 文は、4 つの主張です

> Agents SDK v0.30.0 runs `PiHarness` on Pi 1.4, and makes it recover more reliably from evictions, crashes, and storage errors.

| 割った主張 | どこの層か | 対応 |
| --- | --- | --- |
| Pi 1.4 の上で動く | Pi | C41 |
| eviction からの復旧が改善した | Pi（crash-loop guard） | C23〜C27 |
| crash からの復旧が改善した | Pi（同上） | C24・C25 |
| storage error からの復旧が改善した | **Agents SDK のみ** | C32・C33 |

### Pi doc の Recovery 表のこの 1 行は、2 つの主張です

> A tool with `replay: "safe"` was running → Pi runs the tool again.

| 割った主張 | 対応 |
| --- | --- |
| 中断された safe ツールは再実行される | C17 |
| 再実行されても結果は変わらない（= 冪等である） | **C19。ここが崩れる可能性がある** |

公式は「running it twice is harmless」なツールに safe を付けろと書いています。
**ツールが冪等であることは開発者の責任で、Pi は検査しません。**
C19 は「safe を付けたが実は冪等でなかった」場合に何が起きるかを測る主張です。
これが記事の中核になります。

---

## 実機が要るもの／要らないもの

| 区分 | 主張 | 本数 |
| --- | --- | ---: |
| **フェーズ 3 で確定した**（配布物を読むだけ） | C09・C11・C13・C16・C22・C30・C35・C42 | 8 |
| **ローカルで足りる** | C01〜C08・C10・C12・C14・C17〜C21・C23〜C29・C31〜C34・C36〜C38・C41・C43 | 32 |
| **実デプロイ必須** | C15・C39・C40 | 3 |

全 43 本のうち 8 本が、認証情報もブラウザも使わずに落ちました。
実デプロイが要るのは 3 本だけです。
うち C15 は長時間測定なので、フェーズ 5 の最後に回します。

### やり直しできない検証

**C41 は一方向です。**
Pi 1.4 で一度開いた Durable Object の SQLite は、1.3 では二度と開けません。

対策を 2 つ入れます。

- **DO 名を分ける。** 1.3 用と 1.4 用で別の名前を使い、同じ DO を跨がせません
- **1.3 側の観測を先に取る。** バージョン対照を持つ C11・C32・C38 も、先に 0.29.0 / 0.30.0 側を測ってから 0.30.1 に上げます

認可のやり直しが要る検証はありません。
`wrangler login` の資格情報は使い回せるので、フェーズ 5 は何度でも回せます。

---

## 測る指標

PRD §6 の `RecoveryEvent` をそのまま使います。
ただし `instanceId` の扱いだけ補強します。

| 項目 | PRD の定義 | 補強 |
| --- | --- | --- |
| `instanceId` | インスタンス生成時に付与する観測用識別子 | **コンストラクタで採番する。** C03・C05・C08・C40 の対照がこれに乗る |
| `operationId` | 再試行しても変わらない値 | そのまま |
| 書き込み先 | 独立した検証用ストレージ | **DO 自身の SQLite に書き、`sync()` で確定させる**（C01 で検証する） |

PRD は「障害を受ける DO のローカルログだけに依存しない」と書いています。
その意図は正しいのですが、独立したストレージへの RPC は、死にかけの DO から届く保証がありません。
DO 自身の SQLite は**ディスク**なので、`sync()` さえ挟めばクラッシュを跨ぎます。
**その前提が本当かを C01 で先に確かめます。**
C01 が ❌ なら、レコーダの設計からやり直します。

---

## フェーズ 3 の結果（実機なしで潰したもの）

認証情報もブラウザも使わず、配布物の型定義と実装を読むだけで 6 本が確定しました。

### C16 — `replay` の既定値は `unsafe`

`@earendil-works/pi-durable@1.4.0` の `dist/harness/types.d.ts:243` より。

```ts
/** Whether an interrupted execution may rerun on recovery. Default `unsafe`. */
readonly replay?: "safe" | "unsafe";
```

省略可能な型で、既定が `unsafe` だと型定義自身が宣言しています。
**何も書かなければ全ツールが unsafe になります。**

### C30 — `Storage` は構造的インターフェースなので Proxy で包める

`dist/types.d.ts:982` の `export interface Storage` は、`commit()`・`mintId()`・各種 `scan*()`・`close()` など 17 メソッドを持つ素のインターフェースです。
クラスでも抽象クラスでもないので、同じ形のオブジェクトを渡せば通ります。
**EXP-06 の前提が成立しました。**

### C31 / C34 — エラーの扱いは doc より `Storage` の契約の方が厳密

同じ型定義に付いたコメントが、README より踏み込んだ契約を書いています。

> An error a method throws is final: it fails the Session, which nothing retries, so retry transient failures inside the method.
> Two errors of a read fail only that read: a `StorageRequestError` for an invalid request ..., **which must have no durable effect**, and a rejection because its caller's context was aborted.
> **Any error from `commit()` or `mintId()` is fatal.**

読み取りの例外が許されるのは 2 種類だけで、しかも永続的な副作用を持ってはいけません。
`commit()` と `mintId()` は例外なく致命的です。
EXP-06 の障害注入は、この 3 つの境界を撃ち分ける設計にします。

### C35 — 警告は実装に埋まっている

`agents@0.30.1` の `dist/harness/pi/index.js:441` より。

```js
if (!onWakeWired) console.warn("PiHarness: the harness factory did not pass onWake to Harness.open, so pi's timers keep this Durable Object in memory while a task sleeps. ...");
```

文面そのものが「渡さないとオブジェクトがメモリに残る」と言っています。

### C36 — `onWake` を渡すとタイマーを張らない

`dist/harness/types.d.ts:587` の `onWake` のコメントより。

> Without it, while scheduling runs, a timer that keeps the process alive resumes sleeping tasks when they are due.
> **With it, the Harness arms no timer for them**: it calls `onWake` after open and whenever `Harness.wake()` changes, and the host arms its own wakeup, such as a Durable Object alarm, and calls `resume()` when it fires.

隣の `setTimer` のコメントには、Pi 1.4 の Fixed に対応する記述もありました。

> Default `setTimeout`, with background timers unreferenced, or **declined in Cloudflare Workers** and where they cannot be unreferenced.
> ... a host can keep timers off a process that should hibernate.

Workers ではタイマーを張ること自体を拒否する、という実装方針です。

### C42 — レジストリの購読が解除されない機構を特定した

`dist/harness/registry.js` の購読は素の `Set` で、解除関数を返すだけです。

```js
subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
}
```

呼び出し側は `dist/harness/scheduler.js:177` の 1 箇所だけで、解除はクローズ時にしか走りません。
退避したオブジェクトはクローズしないので、モジュールスコープのレジストリはスケジューラのクロージャを掴んだままになります。
**つまりハーネス全体が解放されません。**

### 新しく出た主張（C43）

`dist/harness/events.d.ts:181` の `watchEvents` のコメントに、ドキュメントに無い挙動がありました。

> The snapshot and the registration for later commits are captured atomically on the Session line; **overflow replaces undelivered batches with one snapshot.**

公式ドキュメントは「カーソルが無いので再接続時は snapshot から」としか書いていません。
実際には**接続したままでも**、リスナーが追いつかなければ個別イベントが 1 つの snapshot に畳まれます。
EXP-02 の「切断中のイベントは受け取れない」は、切断に限らない話でした。

### まだ ⬜ のまま残した理由

C02 は `state` doc が「Application code cannot catch this error」と明記していますが、
**ランタイムの挙動なので配布物からは確かめられません。**
ローカル実行で対照つきで確かめます。

---

## 次の 1 手

フェーズ 4 に入り、`verify-harness` で `sandbox/` を作ります。

作る順番を決めておきます。

1. **レコーダと C01 を最初に作る。** `sync()` の有無で対照を取り、記録が信用できることを先に示す
2. **C03（インスタンス識別子）を乗せる。** C05・C08・C40 の対照がこれに依存する
3. **EXP-04（C17〜C21）を作る。** 記事の中核なので、ここに時間を使う
4. **EXP-05（C23〜C29）を作る。** `restartLimit: 2` にして待ち時間を縮める
5. EXP-06・EXP-07 はバージョン対照を持つので、0.29.0 / 0.30.0 側を先に測る

人間待ちは `wrangler login` だけで、1〜5 はすべてローカルで進みます。
