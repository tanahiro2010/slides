# references — SQLiteのJOIN順序を変えたら、処理が173秒から1秒になった話

| | |
| --- | --- |
| 調査日 | 2026-11-22 |
| 対象 | ghusage v0.1.1 / v0.1.2（修正コミット `4ff1ddf`） |
| 用途 | slide.md / article.md |

draft.md の共通ドラフト欄は空だったので、主張は PRD.md の Executive Summary と 2.3、7 章から抜き出しました。

## 確認した主張

| # | 主張 | 判定 | 根拠 |
| --- | --- | --- | --- |
| 1 | SQLite が `account_events` 側から JOIN を駆動し、PR ごとにアカウントの全イベントを走査していた | ✅ 確認 | コミット `4ff1ddf` / 自分の実測 |
| 2 | `CROSS JOIN` で JOIN 順序を固定すると `parent_pr_id` のインデックスが使われる | ✅ 確認 | SQLite 公式 / テストコード / 実測 |
| 3 | 原因はテーブル統計が無いこと | ✅ 確認 | コミット本文 / 実測（`ANALYZE` だけで直る） |
| 4 | 10 万イベントのデバッグビルドで 173 秒から 1 秒 | ✅ 173 秒は確認 / ⚠️ 「1 秒」は丸めが甘い | CI ログのタイムスタンプ。修正後は 1.67〜2.05 秒 |
| 4b | この修正で CI 全体も速くなった | ✅ 確認 | CI のステップ時間。macOS の `cargo test` が 509 秒から 78 秒 |
| 5 | 遅いクエリは昔からあった | ❌ 前提が違う | 前日のコミット `0e04820` で入り、v0.1.1 に含まれて出荷された |
| 6 | 修正で元の速さに戻った | ❌ 戻っていない | CI のベンチで 101 ms から 831 ms。目標 500 ms も未達のまま |
| 7 | `CROSS JOIN` は SQLite 公式が勧める手段である | ❌ 逆 | 公式は 2024 年の追記で「もう使うべきではない」と書いている |
| 8 | 同梱の SQLite 3.54.1 でも同じ実行計画になる | ⬜ 未確認 | 手元の実測は 3.51.0 でした |

---

## 1. 走査の向きが逆だった

**判定: 確認。**

- [コミット 4ff1ddf](https://github.com/tanahiro2010/ghusage/commit/4ff1ddf07b06fdaeb6826e533252e929c329fa59) は一次ソースです。本文はこうなっています。
  > Without table statistics SQLite drove that per-PR query from account_events and scanned all of the account's events once per pull request, so large caches loaded slowly. Force the join order so the parent_pr_id index is used, and check the query plan in a test.
- 修正前のクエリは次のとおりです（`crates/ghusage-storage/src/lib.rs`）。
  ```sql
  SELECT {EVENT_COLS} FROM activity_events e
  JOIN account_events ae ON ae.event_id = e.event_id
  WHERE ae.account_id = ?1 AND e.parent_pr_id = ?2
  ```
- このクエリは、期間内に動きのあった PR の数だけループの中で呼ばれます。ベンチのデータは 2,000 PR なので、30 日の期間でもほぼ全 PR が対象になります。
- スキーマ（`schema.rs`）では `account_events` の主キーが `(account_id, event_id)` です。利用者が 1 人なら `account_id` は全行で同じ値になります。そのため `account_id = ?` での SEARCH は、実質的に全件走査と変わりません。

### 記事に使える切り口

- `EXPLAIN QUERY PLAN` では `SEARCH` と表示されるので、全件走査に見えません。`SCAN` が出ないから安心とは言えないことを示せます。

---

## 2. `CROSS JOIN` で順序を固定する

**判定: 確認。**

- [The SQLite Query Optimizer Overview](https://www.sqlite.org/optoverview.html) の 7 章は一次ソースです。
  > The CROSS JOIN operator is commutative, in theory. However, SQLite chooses to never reorder tables in a CROSS JOIN. This provides a mechanism by which the programmer can force SQLite to choose a particular loop nesting order.
- 同じ 7 章で、通常の INNER JOIN は自由に並べ替えられると書かれています。
  > Inner joins can be freely reordered.
- 修正後は `pr_events_sql()` という関数に切り出され、`EXPLAIN QUERY PLAN` の 1 行目に `activity_events_parent_pr` が出ることをテストで確かめています（`pull_request_events_are_found_through_the_parent_index`）。実行計画を回帰テストにしている点は記事で紹介できます。

---

## 3. 原因は統計の不在だった

**判定: 確認。自分の実測で、`ANALYZE` を一度流すだけで旧クエリも正しい計画になりました。**

- [The Next-Generation Query Planner](https://www.sqlite.org/queryplanner-ng.html) の「Checklist For Avoiding Or Fixing Query Planner Problems」は一次ソースです。
  > A low-quality index (for the purpose of this checklist) is one where there are more than 10 or 20 rows in the table that have the same value for the left-most column of the index.
  > If you must use a low-quality index, be sure to run ANALYZE.
- `account_events` の主キーは、左端の列 `account_id` が全行同じ値です。公式の定義する low-quality index にそのまま当てはまります。
- [optoverview](https://www.sqlite.org/optoverview.html) には、統計が無いときの推定値も書かれています。
  > the default guess is that there are an average of 10 duplicates for every value in the left-most column of the index.
  - 統計が無いと、`account_id = ?` も `parent_pr_id = ?` も「10 行くらい」と推定されます。どちらから回しても同じに見えるので、SQLite は悪い方を選べてしまいます。
- `ANALYZE` 後の `sqlite_stat1` は次のとおりでした。
  ```
  account_events|account_events|100000 100000 1
  activity_events|activity_events_parent_pr|80000 50
  ```
  `account_id` 1 値あたり 100,000 行、`parent_pr_id` 1 値あたり 50 行と分かれば、SQLite は自分で正しい順序を選びます。
- ghusage のコードには `ANALYZE` も `PRAGMA optimize` もありません（`grep -rni "analyze\|pragma optimize\|sqlite_stat" crates benches` で該当なし）。
- [PRAGMA optimize](https://www.sqlite.org/pragma.html#pragma_optimize) の公式の推奨は次のとおりです。
  > Applications with short-lived database connections should run "PRAGMA optimize;" once, just prior to closing each database connection.

### 記事に使える切り口

- JOIN の順序を固定するのは対症療法で、根本は統計にあります。PRD の PERF-021 が「`PRAGMA optimize` との比較」を課題にしているのはこのためです。

---

## 4. 173 秒から 1 秒という数字

**判定: 173 秒は CI のログで確認できました。「1 秒」はログでは 1.67〜2.05 秒なので、タイトルの数字としては少し甘い丸め方です。**

### 出どころ

本人が ChatGPT に送った表の画像（`~/Downloads/ChatGPT 画像 2026年11月22日 15_21_44.png`）が元の数字です。

| OS | 7 日分（前 → 後） | 30 日分（前 → 後） |
| --- | --- | --- |
| ubuntu-latest | 131 秒 → 2 秒 | 169 秒 → 3 秒 |
| macos-15 | 173 秒 → 1 秒 | 240 秒 → 3 秒 |
| windows-latest | 133 秒 → 2 秒 | 172 秒 → 3 秒 |

PRD.md で「1 秒」と「3 秒」が食い違って見えたのは、1 秒が 7 日分、3 秒が 30 日分の数字だったからです。食い違いではありませんでした。

### 何を測った数字か

- CI の `cargo test --workspace --all-targets` は `benches/aggregation.rs` もデバッグビルドで実行します。Criterion はテストモードでは各ベンチを 1 回だけ流し、`Testing ...` と `Success` を出力します。
- この 2 行のタイムスタンプの差が、ベンチ 1 回分の所要時間になります。「10 万イベント、デバッグビルド、1 回だけの実行」という条件の数字です。

### CI ログから取り直した値

```sh
gh run view <run-id> -R tanahiro2010/ghusage --log \
  | grep -A1 -E "Testing cached" \
  | grep -E "\((macos-15|ubuntu-latest|windows-latest)\)"
```

| OS | 区間 | 修正前 [run 44979438123](https://github.com/tanahiro2010/ghusage/actions/runs/44979438123)（`fecbf20`, push） | 修正後 [run 44982784864](https://github.com/tanahiro2010/ghusage/actions/runs/44982784864)（`4ff1ddf`, push） | 修正後 [run 44982787718](https://github.com/tanahiro2010/ghusage/actions/runs/44982787718)（`4ff1ddf`, PR） |
| --- | --- | ---: | ---: | ---: |
| macos-15 | 7 日 | 173.16 s | 1.67 s | 2.05 s |
| macos-15 | 30 日 | 239.82 s | 2.29 s | 2.66 s |
| ubuntu-latest | 7 日 | 131.24 s | 1.97 s | 1.34 s |
| ubuntu-latest | 30 日 | 168.91 s | 2.55 s | 1.71 s |
| windows-latest | 7 日 | 133.08 s | 2.23 s | 1.75 s |
| windows-latest | 30 日 | 172.47 s | 2.92 s | 2.30 s |

- 修正前の値は画像と 1 秒単位で一致します。
- 修正後の macOS 7 日分は 1.67 秒と 2.05 秒で、四捨五入すると 2 秒です。画像の「1 秒」は切り捨てで出した値と考えられます。
- 記事やスライドでは「173 秒 → 約 2 秒（約 100 倍）」と書くのが安全です。タイトルを「1 秒」のままにするなら、本文で「1.7 秒」と実測値を出しておけば突っ込まれずに済みます。
- 1 回だけの実行なので、ばらつきは大きいです（同じコミットで 1.34 秒と 1.97 秒）。

### その他

- [v0.1.2 のリリースノート（PR #4）](https://github.com/tanahiro2010/ghusage/pull/4) の記述とも矛盾しません。
  > In the debug benchmark, cached 7- and 30-day loads went from over two minutes to seconds.
- 自分の再現（下の「計測」）では、Python 経由で 260.8 秒から 0.79 秒でした。桁は一致します。

---

## 4b. CI 全体も速くなった

**判定: 確認。ベンチ 2 本の待ち時間が `cargo test` の大半を占めていました。**

本人の画像（`15_21_55.png` と `15_22_04.png`）の数字を、上と同じ 2 つの push run のステップ時間で確かめました。この 2 つの run の間にあるのは修正コミット `4ff1ddf` だけです。

```sh
gh run view <run-id> -R tanahiro2010/ghusage --json jobs --jq '...'  # steps[].startedAt / completedAt の差
```

| OS | `cargo test`（前 → 後） | ジョブ全体（前 → 後） |
| --- | --- | --- |
| ubuntu-latest | 364 s → 92 s | 7.8 分 → 3.2 分 |
| ubuntu-24.04-arm | 588 s → 115 s | 11.3 分 → 3.3 分 |
| macos-15 | 509 s → 78 s | 10.7 分 → 3.0 分 |
| macos-15-intel | 553 s → 204 s | 13.3 分 → 8.2 分 |
| windows-latest | 467 s → 175 s | 11.2 分 → 6.4 分 |

- `cargo test` の秒数は画像と完全に一致します。ジョブ全体の分は windows と intel で 0.1 分ずれますが、秒の丸め方の違いです。
- macOS の修正前 509 秒のうち、ベンチ 2 本（173 + 240 = 413 秒）が約 8 割でした。
- CI 全体の待ち時間は、いちばん遅いジョブで決まるので約 13 分から約 8 分になりました（画像 `15_22_04.png`）。修正後は macos-15-intel の 8.2 分がボトルネックで、PRD の PERF-030 の対象です。

### 記事に使える切り口

- 「ユーザーの手元が 100 倍速くなった」だけでなく、「CI の待ち時間も 13 分から 8 分になった」と書けます。遅いクエリが開発のループまで遅くしていた、という話にできます。

---

## 参考: 同期時間の画像（このデッキの主題からは外れる）

`15_22_09.png` は初回同期の数字です（295 秒 → 124 秒、API リクエスト 2,015 → 952）。PRD.md の「v0.1.2 までの改善」と同じ値で、v0.1.1 の同期の並列化の成果です。JOIN の修正とは関係ないので、このデッキでは使いません。公開ログでの裏取りもしていません。

---

## 5. 遅いクエリは 1 日だけ前に入った

**判定: 前提が違いました。これは記事の山場にできます。**

- 遅いクエリを入れたのは [コミット 0e04820](https://github.com/tanahiro2010/ghusage/commit/0e048202bb50dcfb095966a4d441b76c6a53cf6e)（2026-11-22 01:58 JST）で、題は `fix(storage): load every event of pull requests active in a period for lifetime timings` です。
  - PR の生涯の指標を正しく出すため、期間外のイベントも読み込むようにした修正でした。正確さのための変更が性能の退行を生んだ、という流れになります。
- `git tag --contains 0e04820` の結果は `v0.1.1` と `v0.1.2` でした。つまり v0.1.1 は遅いクエリを含んだまま出荷されています。
- 修正の `4ff1ddf` は 2026-11-22 12:55 JST なので、混入から約 11 時間後です。

---

## 6. 修正後も、元の速さには戻っていない

**判定: 戻っていません。**

CI のベンチ（release ビルド、Linux x64、AMD EPYC 7763、4 論理 CPU）は、release 向け PR に bot がコメントしています。

| 時点 | cached 30-day | cached 7-day | 出典 |
| --- | ---: | ---: | --- |
| 混入前（PR #1 の Base, `9b71a80`） | 101.92 ms | 63.26 ms | [PR #1 コメント](https://github.com/tanahiro2010/ghusage/pull/1) |
| 修正後（PR #5 の Base, `770195e` = v0.1.2） | 831.01 ms | 644.58 ms | [PR #5 コメント](https://github.com/tanahiro2010/ghusage/pull/5) |

- 約 8 倍遅いままで、latency の目標（7 日 200 ms、30 日 500 ms）は FAIL です。
- 読み込むイベントが増えたこと自体のコストなのか、まだ別の非効率があるのかは切り分けていません。PRD の PERF-020 / PERF-022 の対象になります。
- 修正前の bench ワークフローは 1 時間で何度も cancelled になっていました（例: run 44982787676、03:56 から 04:56）。修正後の run 44988674319 は 12 分 54 秒で success でした。CI が 1 時間で打ち切られていたことは、遅さを示す傍証として使えます。

### 記事に使える切り口

- 「173 秒から 1 秒」だけを見せると、完全に直ったように読めます。混入前は 0.1 秒だったことも書く方が誠実で、話としても締まります。

---

## 7. 公式は `CROSS JOIN` の利用を勧めていない

**判定: 逆でした。**

- [queryplanner-ng](https://www.sqlite.org/queryplanner-ng.html) のチェックリストに、2024 年の追記があります。
  > Update 2024: The query planner has been improved so much over the years that you should never need to use any of the hacks described below. [...] If you do find a case where you are getting a suboptimal query plan, please report it to the SQLite developers on the SQLite Forum
- この「hacks」に `unlikely()` と「Use the CROSS JOIN syntax to enforce a particular loop nesting order」が含まれます。
- ただし、公式が先に挙げているのは「low-quality index を使うなら ANALYZE しろ」です。今回はそれをしていなかったので、フォーラムに報告すべきプランナの不具合ではありません。
- 記事では「CROSS JOIN で直した」で終わらせず、「公式は統計を取ることを勧めている。CROSS JOIN は互換のために残っている手段だ」と書くのが正確です。PRD の PERF-021 は「CROSS JOIN の削除を前提にしない」としているので、そこと矛盾しない書き方にします。

---

## 計測（自分で取った一次ソース）

ghusage のスキーマから、関係する列とインデックスだけを抜いて再現しました。データの形はベンチ（`benches/common/mod.rs`）に合わせています。10 万イベント、2,000 PR、5 件に 1 件は PR に属さないイベント、アカウントは 1 つです。

スクリプトは `sandbox/join-order/` に置きました。

```sh
cd sandbox/join-order
sqlite3 t.db < make.sql
python3 -I run.py t.db            # 統計なし
cp t.db t2.db && python3 -I run.py t2.db analyze   # ANALYZE あり
```

`run.py` は 2,000 PR 分のクエリを 2 周流し、2 周目の時間を記録します。

| 条件 | クエリ | 2,000 回の合計 | 1 段目の実行計画 |
| --- | --- | ---: | --- |
| 統計なし | 旧 `JOIN` | 260.82 s | `SEARCH ae USING PRIMARY KEY (account_id=?)` |
| 統計なし | 新 `CROSS JOIN` | 0.79 s | `SEARCH e USING INDEX activity_events_parent_pr` |
| `ANALYZE` あり | 旧 `JOIN` | 0.33 s | `SEARCH e USING INDEX activity_events_parent_pr` |
| `ANALYZE` あり | 新 `CROSS JOIN` | 0.43 s | `SEARCH e USING INDEX activity_events_parent_pr` |

- どの条件でも返る行数は 80,000 行で、結果は変わりません。
- 統計なしでは約 330 倍の差でした。
- `ANALYZE` を流すと、旧クエリのままで新クエリと同じ計画になります。JOIN 順序の固定が無くても直ることを確認できました。
- `ANALYZE` ありの 0.33 s と 0.43 s の差は 1 回の計測なので、誤差の範囲かもしれません。

### 環境

- macOS 26.5 / Apple M4
- Python 3.10.4 の `sqlite3` モジュール（SQLite 3.51.0）
- 計測日 2026-11-22

---

## 未確認・積み残し

- [ ] ghusage が同梱する SQLite 3.54.1（`libsqlite3-sys 0.40.0`）で、旧クエリが同じ悪い計画になるか
- [x] 173 秒と 1 秒（または 3 秒）の計測条件 → CI の `cargo test` でデバッグビルドのベンチを 1 回実行した時間でした（4 章）
- [ ] `ANALYZE` ではなく `PRAGMA optimize` を接続のクローズ時に流した場合の効果（ghusage の接続は短命か長命か）
- [ ] 修正後に残っている 101 ms から 831 ms への退行の内訳
  - 手がかり: 期間で絞る最初のクエリ（`JOIN account_events ... WHERE ae.account_id = ?1 AND (occurred_at BETWEEN ... OR author_date BETWEEN ...)`）も、簡略化スキーマ・統計なしでは外側が `account_events` の主キーになりました（`occurred_at` 側だけで確認）。ループの外なので 10 万行を 1 回読むだけです。本物のスキーマ（`author_date` の部分インデックスと `OR` あり）では未確認です
- 読み取り専用の接続（`Store::open_read_only`）は、キャッシュに書き込み権限がないときのフォールバックとして使われます（`crates/ghusage-app/src/session.rs`）。この接続では `ANALYZE` を実行できないので、統計に頼る直し方だとこの経路は統計なしで動きます
- [ ] アカウントが複数ある場合に、統計なしの計画が変わるか

## 探したが取れなかったもの

- 173 秒という数字は、リリースノートにも PR コメントにもドキュメントにも書かれていません。CI のログのタイムスタンプから計算して初めて出てくる数字です。最初の調査ではここに気づかず、本人の画像で場所が分かりました。
- 修正前の release ビルドでのベンチ結果。bench ワークフローの修正前の run は 1 時間で cancelled になっていて、数字が残っていません。
