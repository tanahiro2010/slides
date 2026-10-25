---
published: true
title: Cloudflare AgentsがPi 1.4の中断・復旧・永続化を検証する
---

# Cloudflare AgentsがPi 1.4に対応したので、Agentの中断・復旧・永続化を検証する

> 中断された Agent は、最後のチェックポイントから正しく再開しました。副作用が2回起きたのは、そのせいです。

## この記事の結論

Cloudflare Agents SDK が Pi 1.4 に対応したので、Durable Object 上の Agent を実際に停止させ、会話履歴・タスク・ツール実行がどこまで復旧するかを測りました。復旧機構は期待どおり動きましたが、**Agent が復旧することと、外部の副作用が重複しないことは別です。**

- Pi 1.4 で追加された Hibernation と Parked Tasks は、実際の Durable Object で確認できた
- `replay: "safe"` は冪等性を検査しない。非冪等なツールに付けると、同じ副作用が2回起きる
- Storage Error Recovery は進行中の呼び出しを救わず、次の操作から Pi を開き直す仕組みだった
- `agents@0.30.0` には、別タスクが動いているとリトライ待機中のタスクを起こせない既知の不具合がある。使うなら `0.30.1` 以降にする

| 観測したもの | 結果 |
| --- | ---: |
| 再起動後の会話履歴 | 読み戻せた |
| 完了済みタスク | 二重実行されなかった |
| `safe` な冪等ツール | 再実行されたが副作用は1回 |
| `safe` と宣言した非冪等ツール | 副作用が2回 |
| `unsafe` ツール | 自動再実行されず、完了もしない |
| Hibernation | 待機中に別インスタンスで再開 |

検証コードはこちらです: https://github.com/tanahiro2010/slides/tree/main/slides/slides/Cloudflare%20Agents%E3%81%8CPi%201.4%E3%81%AB%E5%AF%BE%E5%BF%9C%E3%81%97%E3%81%9F%E3%81%AE%E3%81%A7%E3%80%81Agent%E3%81%AE%E4%B8%AD%E6%96%AD%E3%83%BB%E5%BE%A9%E6%97%A7%E3%83%BB%E6%B0%B8%E7%B6%9A%E5%8C%96%E3%82%92%E6%A4%9C%E8%A8%BC%E3%81%99%E3%82%8B/sandbox

そして、この記事で一番伝えたいことを先に書いておきます。

**`replay: "safe"` は、ツールを安全にする機能ではありません。** Pi に対して「このツールは途中で止まったら再実行してよい」と宣言するだけです。副作用が本当に冪等か、同じリクエストを2回受けても外部 API が重複処理しないかは、ツールの実装側が保証しなければなりません。

> この記事は「Cloudflare AgentsがPi 1.4に対応したので、Agentの中断・復旧・永続化を検証する」の登壇内容に、発表で話しきれなかった検証手順・実測値・失敗した測定を足したものです。対象は Cloudflare Agents と Pi Durable を使って、外部 API やデータベースを操作する人です。

---

## 1. 「Pi 1.4 対応」の4項目を分解する

2026年10月22日、Cloudflare は Agents SDK の Pi 1.4 対応を発表しました。Changelog には次の4項目が並んでいます。

- Hibernation
- Parked Tasks
- Storage Error Recovery
- Model Stream Retry

最初は、4つとも Pi 1.4 の新機能だと思いました。しかし、配布物と変更履歴を追うと、出どころは2層に分かれていました。

| Changelog の項目 | 実際の変更元 |
| --- | --- |
| Hibernation | Pi 1.4 の `sleeping` タスクを Agents SDK が配線 |
| Parked Tasks | Pi 1.4 の機能を Agents SDK が公開 |
| Storage Error Recovery | Agents SDK 側の修正。Pi のバージョンとは別 |
| Model Stream Retry | Agents SDK 側の修正。Pi 1.3 でも成立 |

特に Model Stream Retry の PR には、Pi 1.3.0 と Pi main の両方で判定を確認したと書かれていました。つまり、Storage Error Recovery と Model Stream Retry を Pi 1.3 と 1.4 で比較するのは軸が違います。比較すべきなのは `agents@0.29.0` と `agents@0.30.x` です。

ベンダーの Changelog は、利用者にとって分かりやすい単位で変更をまとめています。一方、障害が起きたときに調べるには、どのパッケージのどの層が責任を持つかを分ける必要があります。

## 2. Pi、PiHarness、Lifecycleの役割

今回の構成には3つの層があります。

| 層 | 担当 |
| --- | --- |
| Pi Durable | Agent の実行ループ、タスク、チェックポイント、replay |
| PiHarness | Pi に Durable Object の SQLite と起動処理を接続 |
| Lifecycle | Durable Object 上で長時間の仕事を実行し、必要なときに起こす |

Pi Durable は Cloudflare のパッケージではありません。`@earendil-works/pi-durable` として提供され、Agents SDK 側の `PiHarness` が Durable Object に組み込みます。

ここで重要なのは、保存と再開が別の機能だということです。

- 会話履歴やタスクの保存先は、`pi_` で始まる SQLite テーブル
- 眠っているタスクを再開するのは、Lifecycle の Wake ジョブと Durable Object Alarm

保存できていても、起こす仕組みがなければ再開しません。逆に、再開できてもチェックポイントがなければ、どこから続けるか分かりません。今回の検証では、この2つを混ぜないようにしました。

Pi Durable の設計記事には、次のようにあります。

> every step of a run is a task that stores a checkpoint before it moves on.

このチェックポイントが、再起動後に「完了済みのタスクをもう一度実行しない」ための基礎になります。

## 3. まず、観測そのものを永続化する

障害復旧を測るとき、最初に作るべきなのは実験対象ではなく記録機構です。Durable Object の書き込みは、呼び出した瞬間にすべてがディスクへ確定するわけではありません。

検証用のレコーダは、イベントを SQLite に書いたあと、通常は `ctx.storage.sync()` を呼ぶようにしました。直後に `ctx.abort()` を呼び、再起動後にイベントが残っているかを比較します。

| 記録の仕方 | 再起動 | 再起動後に残った行数 |
| --- | --- | ---: |
| `sync()` あり | した | **1** |
| `sync()` なし | した | **0** |

どちらもコンストラクタで発行したインスタンス ID が変わっていました。本当に同じインスタンスが動き続けたのではなく、再生成後のインスタンスが SQLite を読んでいます。

`ctx.abort()` は通常の `throw` とは違います。アプリケーションコードでは catch できず、Durable Object を即座にリセットします。障害注入に通常の例外を使うと、Agent の復旧ではなく「同じインスタンスのエラー処理」を測ってしまいます。

この土台を確認してから、以降のイベントはすべて `sync()` ありで記録しました。ログに残らなかった観測を、復旧の証拠には使っていません。

## 4. 会話履歴とタスクは再起動を越えて残る

ツールを1回実行する Agent を動かし、処理が完了したあとに `ctx.abort()` で Durable Object を落としました。再起動後に transcript とイベントを読みます。

| 観測 | 再起動前 | 再起動後 |
| --- | ---: | ---: |
| インスタンス識別子 | — | **変化した** |
| transcript のエントリ数 | 5 | 5 |
| ツール実行開始 | 1 | 1 |
| 副作用 | 1 | 1 |

完了済みのタスクは二重実行されませんでした。同じ `operationId` を使った submit も、1回目は `accepted: true`、2回目は `accepted: false` になりました。異なる ID を使うと `accepted: true` になるため、submit 全体が壊れたわけではありません。

ここまでは、Pi Durable がチェックポイントと submit の識別子を使って、完了済みの仕事を保護している結果です。

## 5. クライアントが切れても、Agentは動き続ける

次に、モデルのリトライで処理時間を伸ばし、途中で WebSocket を切断しました。クライアントがいなくなったあとも実行が続くかを確認します。

結果は、最終的に `done` になりました。モデル呼び出しは「失敗2回、成功1回」の3回です。切断前後でインスタンス IDは変わっていません。

これは「落ちて復旧した」のではありません。**Agent の実行がクライアント接続に依存していなかった**ということです。

再接続後は snapshot から現在の状態を組み立て直せました。ただし、切断中に流れたイベントをカーソルで途中から再生できるわけではありません。イベントストリームは状態を追うためのものではありますが、履歴ストリームの代わりではありません。

## 6. Parked Tasksはクラッシュループを止める

同じ場所で何度も `ctx.abort()` を発生させ、`restartLimit` を2に下げて測りました。

| 落とし方 | 障害発火 | インスタンス生成 | `pending()` | 次の Alarm |
| --- | ---: | ---: | --- | --- |
| `ctx.abort()` | 2 | 2 | **`parked`** | **なし** |
| 通常の例外 | 1 | 0 | 空 | なし |

通常の例外は Durable Object をリセットしないため、再起動回数には入りません。Parked に到達するには、実際に再起動される障害が必要です。

Parked になったタスクは、放置しても Durable Object を起こし続けません。手動では2つの抜け方があります。

| 操作 | 戻り値 | `wait()` |
| --- | --- | --- |
| `session.retry()` | `true` | `done` |
| `session.abort()` | `ok` | `unanswered` / `aborted` |

`retry()` はやり直す操作、`abort()` は放棄する操作です。クラッシュループを止めるだけでなく、運用者が判断して再開か放棄かを選べる設計になっています。

なお、ツールが `api.output()` で進捗を8回出しても、再起動カウントは戻りませんでした。Pi が進捗として扱うのは、ツールの出力ではなく、タスクが次の状態をコミットしたことです。まだ完了していない1つのツールが出力を吐き続けても、クラッシュループの上限はリセットされません。

## 7. Storage Error Recoveryは「次の操作」から効く

Storage Error Recovery は、ストレージエラーが起きたあとに Pi を開き直せる機能です。ここでは Storage を Proxy で包み、次の2種類のエラーを注入しました。

- `commit()` などから任意のエラーを返す
- 読み取りから `StorageRequestError` を返す

どちらも、現在進行中の呼び出しはエラーになりました。しかし、次の `submit()` は成功し、最終的に `done` になりました。致命的な Storage エラーでは factory の実行回数が1から2に増えましたが、Durable Object 自体のインスタンス IDは変わっていません。

つまり、これは Durable Object のクラッシュ復旧ではありません。PiHarness が壊れた Pi をキャッシュから外し、次の操作または Wake ジョブの次のステップで Pi を開き直しています。

**進行中の呼び出しは救われません。** 仕様にも、すでに実行中の呼び出しは `SessionFailed` で失敗するとあります。factory は何度実行されても正しく初期化できるように書く必要があります。

## 8. `replay: "safe"` は副作用を守らない

ここが今回の中心です。4種類のツールを用意し、実行開始・副作用の確定・終了を別々に記録しました。副作用確定直後に Durable Object を落とし、再起動後の挙動を比較します。

| ツール | `replay` | 冪等性 | 実行開始 | 副作用 | 完了 |
| --- | --- | --- | ---: | ---: | ---: |
| `write_record` | `safe` | あり | 2 | 1 | 1 |
| `bump_unsafe` | 未指定 | なし | 1 | 1 | 0 |
| `bump_safe_unguarded` | `safe` | **なし** | 2 | **2** | 1 |
| `bump_safe_guarded` | `safe` | あり | 2 | **1** | 1 |

`write_record` は同じ値を書き込むので、2回実行されても結果は変わりません。`bump_safe_unguarded` はカウンターを1増やすだけで、実行されるたびに結果が変わります。このツールに `safe` を付けると、Pi は宣言を信じて再実行し、副作用が2回確定しました。

一方、`bump_unsafe` は自動再実行されません。副作用確定後に落としたケースでは、副作用は1回だけ残りましたが、ツールは完了していません。Agent は中断されたツール結果をモデルへ渡して run を決着させます。

中断されたツールの transcript は、専用のエントリになるわけではありません。通常と同じ `pi.tool-result` ですが、内容が次のように変わります。

```text
<harness>
[error] Tool bump_unsafe was interrupted and may have partially run
</harness>
```

このメッセージは、モデルに「部分的に実行されたかもしれない」と伝える平文です。その後にモデルが同じツールを呼び直すかどうかは、モデルの判断に委ねられます。今回の実モデルによる3試行では呼び直しませんでしたが、1モデル・1プロンプト・3試行だけなので一般化はしません。

`bump_safe_guarded` には冪等キーを入れました。再実行自体は起きていますが、2回目はキーを見て副作用をスキップし、確定回数は1回に収まりました。

ここから分かることは明確です。**`safe` の判断を間違えても Pi は警告しません。** 外部 API、決済、メール送信、データベース更新などをツールに持たせるなら、`safe` の設定とは別に冪等キーや重複排除を実装する必要があります。

## 9. Model Stream Retryはエラー文言で判定される

Model Stream Retry は、途切れたモデルストリームを一時的なエラーとして扱い、ターン全体を再試行します。配布物を読むと、判定はエラー本文の正規表現でした。

同じ回数だけ失敗させ、エラー文言だけを変えました。

| エラー文言 | 結果 | モデル呼び出し |
| --- | --- | ---: |
| `The stream ended before the model finished its answer.` | `unanswered` | 1 |
| `The stream ended without the model finishing its answer.` | **`done`** | **3** |
| `Model stream stalled: no data received for 60s.` | `unanswered` | 1 |
| `Model stream timed out: no data received for 60s.` | **`done`** | **3** |
| `insufficient_quota: the account has no remaining credit.` | `unanswered` | 1 |

再試行対象の文言では「失敗2回、成功1回」の3回になりました。つまり、再試行は部分的なストリームの続きではなく、モデルリクエスト全体の作り直しです。

`baseDelayMs` を100秒に設定しても、待機時間の上限は約60秒でした。既定の `maxAgentDelayMs` が60,000ミリ秒だからです。設定値を大きくしたからといって、無制限に待つわけではありません。

## 10. Hibernationは、待機中に別インスタンスで再開する

Hibernation の測定では、最初に alarm の時刻を比べました。しかし、ローカルの workerd では `onWake` の有無にかかわらず、alarm の秒数が一致しました。これは測定対象を間違えています。

Hibernation の本質は、alarm の時刻ではなく、**待機中に Durable Object がメモリから退避できるか**です。そこで実デプロイし、コンストラクタでインスタンス IDを記録して、リトライがどのインスタンスで走るかを見ました。

`onWake` を渡した場合は、次のようになりました。

```text
model_error@old-instance
→ instance_started@new-instance
→ model_request@new-instance
```

`onWake` を渡さない場合は、次のようになりました。

```text
model_error@same-instance
→ model_request@same-instance
```

| `onWake` | リトライを走らせたインスタンス |
| --- | --- |
| 渡す | **別インスタンス** |
| 渡さない | **同じインスタンス** |

リトライ待機中は、測定のために一度もリクエストを送りませんでした。途中で触るとオブジェクトが起きてしまい、退避を観測できないからです。

処理中の work と、リトライ待ちの sleep は別の状態です。work がある間は heartbeat Alarm が30秒ごとに再設定されます。一方、sleep 中は最初に起きるタスクの時刻が次の Alarm になります。この2つを混ぜると、Hibernation の測定結果を誤読します。

## 11. `agents@0.30.0` の不具合を再現する

公式が案内した `agents@0.30.0` で検証を始めようとしました。しかし、このバージョンには、別タスクが動いているとリトライ待機中のタスクが起きない既知の不具合があります。

1つの Harness で、次の2本を並行させました。

- セッションA: 60秒走るツールを実行する
- セッションB: 再試行対象のエラーを返し、12秒の backoff に入る

| | B単独 | 並行する work あり |
| --- | ---: | ---: |
| `agents@0.30.1` | 12秒 | **12秒** |
| `agents@0.30.0` | 12秒 | **57秒** |

0.30.0 では、B のリトライが A の完了まで止まっていました。0.30.1 では、A が動いていても B は予定どおり12秒後に再開します。

原因は配布物の差分からも確認できます。0.30.0 は Pi が active かどうかだけを見ていました。0.30.1 では、sleep の期限 `wake.at` を次の待機期限に使い、期限に達したら `pi.resume()` を呼びます。

これは煽るための話ではありません。PiHarness が Beta と案内されていることの、具体的な例です。Pi 1.4 の Hibernation を検証するなら、`agents@0.30.1` 以降を使う必要があります。

## 12. Pi 1.4に上げると、1.3には戻せない

Pi 1.4 は session storage の SQLite schema を更新するため、Pi 1.3 へロールバックできません。

実際に Pi 1.4 で1ターン実行したあとの schema version は `2` でした。配布物のマイグレーション定義を比べると、次の差があります。

| バージョン | マイグレーション |
| --- | --- |
| `pi-durable@1.3.0` | version 1 のみ |
| `pi-durable@1.4.0` | version 1 と **version 2 `sleepingStatus`** |

Pi 1.3 のマイグレーションランナーは、対応していない新しい schema version を見つけるとエラーにします。追加された `sleepingStatus` は、Pi 1.4 の Hibernation を支える `sleeping` タスク状態そのものです。

つまり、Durable Object を退避できるようになったことと、ロールバックできなくなったことは、別々の変更ではありません。同じ schema 変更の表と裏です。

Pi 1.4 と1.3を比較するときは、同じ Durable Object を使い回してはいけません。実験用の名前を分け、マイグレーションを一方向のものとして扱います。

## 13. 測定をやり直して分かったこと

この検証では、最初の測定結果をそのまま記事にしませんでした。対照を組み直した結果、3つの主張を修正または保留にしています。

### WebSocketのイベント取りこぼし

最初は、遅いイベントリスナーがイベントを取りこぼすように見えました。しかし、WebSocket を8秒で閉じていたことが原因でした。ドレイン時間を30秒に延ばすと、遅いリスナーでもイベント数は一致しました。

### 進捗の定義

自前カウンターの更新を Pi の進捗だと思い込んでいました。`api.output()` を8回呼ぶ対照に変えても、未完了のツールは Parked になりました。ツールの出力ではなく、タスクが状態をコミットしたかどうかが進捗です。

### 19分のモデルストリーム

Worker 内の faux Provider で約19.2分のストリームを流したところ、モデル呼び出し1回のまま完走しました。ただし、これは外部モデル API へのHTTP接続を19分維持した測定ではありません。公式の「15分を越えるリクエストは切断されることがある」という制約を否定する材料にはならないため、結論は保留にしました。

障害復旧の検証では、「結果が出た」だけでは不十分です。そもそも障害が起きていなかった、観測側が先に接続を閉じた、という可能性を対照で潰す必要があります。

## 14. まとめ

Cloudflare Agents と Pi 1.4 の復旧機構は、実際に動きました。会話履歴は再起動後に読み戻せ、完了済みタスクは二重実行されず、クラッシュループは Parked Tasks で止まり、リトライ待機中の Agent は Hibernation によって別インスタンスで再開できました。

しかし、Pi が守っているのは Agent の実行状態です。あなたの外部副作用まで自動的に exactly-once にしてくれるわけではありません。

実装時には、次の点を守る必要があります。

- 外部操作には冪等キーや重複排除を入れる
- `replay: "safe"` は、2回実行しても安全だと自分で証明できるツールだけに付ける
- `unsafe` にしても、確定済みの副作用が消えるわけではない
- factory は Storage Error Recovery で何度も呼ばれる前提で書く
- Hibernation を使うなら `agents@0.30.1` 以降を使う
- Pi 1.4 に上げた Durable Object は、Pi 1.3 に戻せない

最後に、検証から持ち帰る教訓を1つに絞るならこれです。

**「復旧した」と「重複せずに完了した」は、別の主張です。**

### 参考

- [Cloudflare Changelog — Agents SDK now supports the latest Pi 1.4 release](https://developers.cloudflare.com/changelog/post/2026-10-22-pi-harness-pi-1-4/) — Pi 1.4 対応として発表された4項目
- [Cloudflare Docs — Pi](https://developers.cloudflare.com/agents/harnesses/pi/) — PiHarness、Recovery、Hibernation の公式ドキュメント
- [Cloudflare Docs — Pi Extensions](https://developers.cloudflare.com/agents/harnesses/pi/extensions/) — ツールの `replay` 設定と復旧時の扱い
- [`agents` CHANGELOG](https://github.com/cloudflare/agents/blob/main/packages/agents/CHANGELOG.md#0300) — `0.30.0` / `0.30.1` の変更
- [cloudflare/agents#2683](https://github.com/cloudflare/agents/issues/2683) — `onWake` と並行タスクに関する既知の不具合
- [`pi-durable` CHANGELOG 1.4.0](https://github.com/earendil-works/pi/blob/v1.4.0/packages/durable/CHANGELOG.md#140---2026-10-21) — Pi 1.4 の `sleeping` タスクと schema migration
- [Pi Durable の設計記事](https://earendil.com/posts/pi-durable/) — チェックポイントとタスク実行の設計
