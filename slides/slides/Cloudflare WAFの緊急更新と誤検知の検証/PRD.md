# PRD：Cloudflare WAFの緊急更新と誤検知の検証

## 1. プロジェクト概要

### 記事タイトル

**Cloudflare WAFの緊急更新が公開されたので、ルール適用と正常なリクエストの誤検知を検証する**

### 背景

Cloudflare WAFでは、脆弱性の公開や新しい攻撃手法への対応として、Managed Rulesetの緊急更新が実施される。

通常、新規ルールや変更されたルールにはLogモードによる評価期間が設けられるが、緊急リリースでは通常の更新サイクルを経ずに新しいルールが配信される場合がある。

2026年10月21日には異常なリクエストパターンを検知する7ルールがBlockモードで追加された。

続く10月25日にはCVE-2026-111497に関連する以下の2ルールが追加された。

- Brotli - Request Content-Encoding
- Next.js - Image Optimizer Path

後者の2ルールはデフォルトでLogモードとなっているが、正常なアプリケーション通信にも一致する可能性がある。

さらに、既存のRuleset-level overrideが新規ルールにも適用されるため、運用設定次第では緊急更新直後に正常なリクエストがブロックされる可能性がある。

本検証では、こうした更新の影響を実際のCloudflare環境で観測する。

---

## 2. 目的

Cloudflare WAFの緊急更新が既存のアプリケーションに与える影響を明らかにする。

特に次の5点を検証する。

1. 緊急追加されたManaged Rulesがどのように適用されるか
2. 正常なHTTPリクエストが新規ルールに一致するか
3. Log、Block、Defaultの設定によって動作が変化するか
4. Ruleset-level overrideが新規ルールにも適用されるか
5. 誤検知を回避しつつ、必要なWAF保護を維持できるか

### 検証対象外

- 実際の脆弱性を悪用する攻撃コードの作成
- WAF検知の回避手法の探索
- Cloudflareの内部検知ロジックの完全な解明
- 本番環境を対象とした負荷試験
- 過去のルールバージョンを再現できない状態での更新前後比較

---

## 3. 検証環境

### 使用技術

| 項目 | 使用技術 |
|---|---|
| アプリケーション | Hono |
| 実行環境 | Cloudflare Workers |
| WAF | Cloudflare Managed Ruleset |
| デプロイ | Wrangler |
| リクエスト送信 | curl / Node.js |
| 記録 | JSON / CSV |
| ログ分析 | Cloudflare Security Events |
| 必要に応じて | Cloudflare GraphQL Analytics API |

### インフラ構成

```text
Test Client
    |
    | HTTPS Request
    v
Cloudflare Edge
    |
    +-- WAF Managed Rules
    |       |
    |       +-- Default
    |       +-- Log override
    |       +-- Block override
    |
    +-- Security Events
    |
    v
Cloudflare Workers
    |
    v
Hono Application
    |
    +-- GET  /health
    +-- POST /echo
    +-- POST /compressed
    +-- GET  /_next/image
    |
    v
JSON Response
```

**注意：** `/_next/image` は、検証用の単純なスタブに加えて、必要ならローカルで管理するNext.js検証環境でも確認する。HonoのスタブだけではNext.jsの画像最適化機能そのものは検証できない。

### 検証環境の条件

- 自分が管理するテスト用ドメインを使用する
- 本番トラフィックが流れる環境とは分離する
- WAF Managed Rulesetが利用可能なプランを使用する
- ルール設定・適用時刻・プランを記録する
- 他のCustom RulesやBot対策などの干渉を可能な限り除外する
- 検証用エンドポイントでのみ設定変更を行う

---

## 4. 検証仮説

### H1：正常な通信でも新規ルールに一致する

Brotli圧縮された正常なPOSTリクエストや、Next.jsの画像最適化エンドポイントへのアクセスは、悪意のある通信ではなくても新規ルールに一致すると予想する。

### H2：Logモードでは通信が遮断されない

対象ルールがLogモードの場合、ルールに一致しても、そのルール自体はリクエストを遮断しないと予想する。

ただし別のルールによる遮断はあり得る。

### H3：Block overrideで正常な通信が遮断される

新規ルールにBlockを適用した場合、正常な通信も遮断される可能性がある。

### H4：Ruleset-level overrideは新規ルールにも引き継がれる

Managed Ruleset全体に設定したBlock overrideは、後から追加された新規ルールにも適用されると予想する。

### H5：ルール単位の例外設定で誤検知の影響を局所化できる

特定のルールや検証用パスに限定した設定を利用することで、Managed Ruleset全体を無効化せずに正常通信への影響を抑制できると予想する。

---

## 5. 検証内容

### TEST-01：緊急更新の適用状況

**目的**

緊急リリースで追加されたルールが、実際の検証環境で利用できるかを確認する。

**手順**

1. Cloudflare WAF Changelogから対象ルールの情報を取得する
2. ダッシュボードでManaged Rulesetを確認する
3. 対象ルールの存在を確認する
4. Rule ID、Action、Enabled状態を記録する
5. 公式Changelogの記載と比較する

**記録項目**

- Release Date
- Rule ID
- Rule Description
- Default Action
- Effective Action
- Enabled Status
- 観測日時
- 適用されていたoverride

**期待結果**

新規ルールと設定状態を確認できる。

配信開始時刻については、Cloudflare内部の正確な反映時刻ではなく、自分の環境で確認した時刻として扱う。

### TEST-02：Brotliリクエストの検知

**目的**

正常なBrotli圧縮リクエストがWAFルールに一致するかを検証する。

**テストケース**

| ケース | リクエスト | 期待する観測 |
|---|---|---|
| B01 | 通常のJSON POST | 対照群 |
| B02 | Brotli圧縮JSON POST | 対象ルールへの一致 |
| B03 | `Accept-Encoding: br` を設定したGET | Brotliリクエストボディ規則には原則一致しない |
| B04 | `Content-Encoding: gzip` のPOST | Brotli規則との比較 |

**測定内容**

- HTTPステータス
- WAF Action
- Rule ID
- Worker到達有無
- レスポンス内容
- WAFイベントへの記録有無

**判定**

正当なBrotliリクエストが対象ルールに一致した場合、正常通信への検知影響が存在すると判断する。

Blockモードで正常通信が遮断された場合は、誤検知による実害が発生したと判定する。

### TEST-03：Next.js画像最適化エンドポイント

**目的**

`/_next/image` にアクセスする正常な画像リクエストが検知されるかを確認する。

**テストケース**

| ケース | リクエスト | 検証内容 |
|---|---|---|
| N01 | `/health` | 通常パス |
| N02 | `/images/sample.png` | 通常の画像パス |
| N03 | `/_next/image` | 対象パスへの一致 |
| N04 | 正常な画像最適化リクエスト | 実際のNext.js通信 |
| N05 | Block設定下での正常な画像取得 | 画像配信への影響 |

**測定内容**

- ルール一致有無
- レスポンスステータス
- 画像取得成功率
- WorkerまたはNext.jsアプリケーションへの到達
- WAFログの記録

**期待結果**

正常なNext.js画像最適化リクエストが対象ルールに一致するか、Block設定によって画像配信に影響が出るかを確認できる。

### TEST-04：Action変更による挙動差

**目的**

同一の正常なリクエストに対して、WAFのAction設定による結果の違いを確認する。

**比較設定**

| 設定 | 想定される動作 |
|---|---|
| Default（10/25の対象ルール） | Log |
| Rule-level Log override | Log |
| Rule-level Block override | Block |
| Ruleset-level Block override | Blockの影響が生じ得る |

**手順**

1. 対象ルールをDefaultに設定する
2. 正常なリクエストを送信する
3. WAFイベントとレスポンスを確認する
4. 対象ルールにLog overrideを設定して再試験する
5. 対象ルールにBlock overrideを設定して再試験する
6. Ruleset-level overrideも別条件として試験する
7. 設定を元に戻す

各設定間では反映確認を行い、前の条件の設定が残っていないことを確認する。

**期待結果**

同じ正常なリクエストでも、WAF設定により記録だけで済む場合と遮断される場合があることを確認できる。

### TEST-05：Ruleset-level overrideの影響

**目的**

緊急更新で追加された新規ルールに、既存のRuleset-level overrideが適用されることを確認する。

**検証方法**

現在配信済みのルールを使い、以下の構成を比較する。

- 環境A：Ruleset action = Default
- 環境B：Ruleset action = Block
- 環境C：Ruleset action = Block、対象ルールのみLog

それぞれに同一の正常なリクエストを送信する。

**注意点**

すでに配信済みのルールを用いるため、将来のルール配信時の挙動を完全に再現するものではない。

既存ルールに対するoverrideの適用結果と、公式仕様を組み合わせて考察する。

**期待結果**

Ruleset全体へのAction指定が、新規ルールのデフォルト設定より強い影響を持つ場合があることを確認できる。

### TEST-06：誤検知への対応

**目的**

誤検知が確認された場合に、WAF全体を停止せず対処できるかを検証する。

**比較する対応**

1. 対象ルールのみLogに変更する
2. 対象ルールのみ無効化する
3. 検証用の特定パスに限定したExceptionを作成する
4. 設定を元に戻す

**評価項目**

- 正常通信が回復するか
- 他のWAFルールの設定が維持されるか
- 設定変更の影響範囲
- 運用上の復旧手順の明確さ

**期待結果**

ルール単位または限定的なExceptionを用いた対応の有効性と制約を整理できる。

---

## 6. 検証データの収集

各リクエストについて以下の形式で記録する。

```json
{
  "testId": "B02",
  "timestamp": "ISO-8601",
  "method": "POST",
  "path": "/compressed",
  "contentEncoding": "br",
  "configuredAction": "default",
  "wafAction": null,
  "matchedRuleId": null,
  "httpStatus": 200,
  "workerReached": true,
  "eventObserved": false,
  "requestId": "example-id"
}
```

`null` は未観測または取得不可を表し、未検知と同一視しない。

### 分析指標

**1. 正常リクエストのルール一致率**

`対象ルールに一致した正常リクエスト数 / 送信した正常リクエスト総数`

**2. 正常リクエストの遮断率**

`対象ルールによって遮断された正常リクエスト数 / 送信した正常リクエスト総数`

**3. 正常リクエストの成功率**

`期待した応答が返ったリクエスト数 / 送信したリクエスト総数`

**4. Rule Overrideによる影響差**

Default、Log、Blockそれぞれの検知率・遮断率・成功率を比較する。

**測定上の注意**

Security Eventsにはサンプリングがあるため、ログに表示されなかったことだけを理由に未検知とは判断しない。

送信側の記録、Worker側の到達ログ、WAFイベントを突き合わせる。

また、検知率と遮断率は別の指標として扱い、Logによる一致をそのまま実害のある誤検知と断定しない。

---

## 7. 実装要件

### Honoアプリケーション

- GET `/health`：疎通確認用
- POST `/echo`：通常のJSONリクエスト確認
- POST `/compressed`：圧縮リクエストの受信確認
- GET `/_next/image`：パス一致確認用スタブ
- 各リクエストに検証IDを付与
- Workerへの到達をログとして記録
- 受信した安全な検証用データに対する応答を返す

### テストクライアント

- 各テストケースを個別実行可能
- Content-Encodingを変更可能
- HTTPレスポンスを記録
- 実行日時・リクエストIDを記録
- 同じケースを複数回実行可能
- 実行結果をJSONまたはCSVで出力

### ログ収集

- Security Eventsを使って対象ルールへの一致を確認する
- 利用可能であればGraphQL Analytics APIで補完する
- Worker側の到達ログと照合する
- APIやダッシュボードのプラン制限を明示する

---

## 8. 成果物

```text
cloudflare-waf-emergency-test/
├── README.md
├── package.json
├── wrangler.jsonc
├── src/
│   └── index.ts
├── tests/
│   ├── baseline.ts
│   ├── brotli.ts
│   ├── next-image.ts
│   └── runner.ts
├── scripts/
│   └── summarize.ts
├── results/
│   ├── requests.json
│   ├── waf-events.json
│   └── summary.csv
└── docs/
    ├── methodology.md
    └── findings.md
```

### 最終記事構成

1. はじめに
2. Cloudflare WAFの緊急更新とは
3. 2026年10月の緊急更新内容
4. 検証環境の構築
5. 正常なBrotli通信を送ってみる
6. Next.jsの画像最適化リクエストを送ってみる
7. WAFのActionを変更して比較する
8. Ruleset-level overrideの影響を確認する
9. 誤検知への対応を検証する
10. 結果・考察
11. まとめ

---

## 9. 完了条件

以下を満たした場合に検証完了とする。

- 緊急更新で追加された対象ルールを特定できている
- 対象ルールのDefault Actionを確認できている
- 正常なBrotliリクエストの結果を記録できている
- Next.js画像最適化パスの検知結果を確認できている
- Default / Log / Blockを比較できている
- Ruleset-level overrideの影響を評価できている
- 誤検知発生時の限定的な対応方法を確認できている
- 結果が期待と異なる場合も、その差異と制約を記録できている

対象ルールやログ機能を利用できない場合は、検証不能の理由を記録する。推測で結果を補完しない。

---

## 10. 記事で最終的に答えたい問い

**「Cloudflare WAFの緊急更新は、既存アプリケーションの設定を変更していなくても正常な通信に影響を与える可能性があるのか？」**

この問いについて、公式仕様だけでなく、実際のHTTPリクエストとWAFログの比較から検証する。

想定される結論は、緊急更新の危険性そのものではなく、Managed Rulesetの更新と既存override設定の組み合わせが、意図しない通信遮断につながり得るという運用上の注意点である。

ただし、最終的な結論は観測結果によって決定する。
