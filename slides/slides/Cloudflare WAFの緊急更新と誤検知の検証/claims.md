# claims — Cloudflare WAFの緊急更新と誤検知の検証

| | |
| --- | --- |
| 作成日 | 2026-10-26 |
| 対象 | Cloudflare WAF Managed Rulesetの緊急更新、CVE-2026-111497関連ルール、正常通信への影響 |
| フェーズ | 2（主張を割る）完了。実機測定前 |
| 次 | 3. 実機不要で潰す → 4. 検証ハーネス → 5. 実機測定 |
| 人間待ち | テスト用Cloudflareゾーン、APIトークン、検証用ドメインの用意 |
| 開示 | 現時点で新規の脆弱性発見なし。誤検知の実測結果が出た場合は判定後に要相談 |

## 一次資料

| 資料 | 種別 | 最終更新 / 公開日 |
| --- | --- | --- |
| [WAF Release - 2026-10-21 - Emergency - Cloudflare Managed Ruleset](https://developers.cloudflare.com/changelog/post/2026-10-21-emergency-waf-release-cfmr/) | Cloudflare公式Changelog | 2026-10-21 |
| [WAF Release - 2026-10-21 - Emergency - Cloudflare Free Ruleset](https://developers.cloudflare.com/changelog/post/2026-10-21-emergency-waf-release-free/) | Cloudflare公式Changelog | 2026-10-21 |
| [WAF Release - 2026-10-25 - Emergency - Cloudflare Managed Ruleset](https://developers.cloudflare.com/changelog/post/2026-10-25-emergency-waf-release/) | Cloudflare公式Changelog | 2026-10-25 |
| [WAF Changelog](https://developers.cloudflare.com/waf/change-log/changelog/) | Cloudflare公式ドキュメント | 2026-10-26確認 |
| [Node.js Wednesday, October 21, 2026 Security Releases](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases) | Node.js公式セキュリティリリース | 2026-10-21 |
| [Managed rulesets](https://developers.cloudflare.com/waf/account/managed-rulesets/) | Cloudflare WAF docs | 2026-10-26確認 |
| [Override a managed ruleset](https://developers.cloudflare.com/ruleset-engine/managed-rulesets/override-managed-ruleset/) | Cloudflare Ruleset Engine docs | 2026-04-16 |
| [Cloudflare Managed Ruleset](https://developers.cloudflare.com/waf/managed-rules/reference/cloudflare-managed-ruleset/) | Cloudflare WAF reference | 2026-08頃（ページ表示） |
| [Security Events](https://developers.cloudflare.com/waf/analytics/security-events/) | Cloudflare WAF docs | 2026-10-02 |
| [Security Analytics](https://developers.cloudflare.com/waf/analytics/security-analytics/) | Cloudflare WAF docs | 2026-10-15 |

## 主張一覧

| # | 主張 | 出典 | 確かめ方 | 対照 | 実機 | 判定 |
| --- | --- | --- | --- | --- | --- | --- |
| C01 | 10/21にManaged Rulesetへ7つの異常リクエスト検知ルールが追加された | Cloudflare Changelog | Changelog表を数える | Free Rulesetの7ルールと混同しない | 不要 | ✅ 確認 |
| C02 | Managed Ruleset側7ルールの初期ActionはBlock | Cloudflare Changelog | 7行のNew Actionを確認 | 同日のFree Ruleset側もBlockだがRule IDが異なる | 不要 | ✅ 確認 |
| C03 | Free Rulesetにも別Rule IDの7ルールが追加された | Cloudflare Changelog | 2ページのRule ID末尾を比較 | Managed Ruleset側のRule ID | 不要 | ✅ 確認 |
| C04 | 10/25にCVE-2026-111497関連の2ルールが追加された | Cloudflare Changelog | ルール名・CVE欄を確認 | 10/21の7ルール | 不要 | ✅ 確認 |
| C05 | Brotliルールの初期ActionはLog | Cloudflare Changelog | New Actionを確認 | Block overrideを設定した場合 | 不要 | ✅ 確認 |
| C06 | Brotliルールは `Content-Encoding: br` を対象にする | Cloudflare Changelog | B02を送信しWAFイベントを確認 | `Content-Encoding`なしのB01 | 要 | ⬜ |
| C07 | Brotliルールは `Accept-Encoding: br` だけでは対象にしない | Cloudflare Changelog | B03を送信しB02と比較 | `Content-Encoding: br` のB02 | 要 | ⬜ |
| C08 | BrotliルールはCloudflareのレスポンス圧縮設定を対象にしない | Cloudflare Changelog | B03と通常GETの結果を比較 | request bodyの `Content-Encoding: br` | 要 | ⬜ |
| C09 | Next.jsルールは `/_next/image` を対象にする | Cloudflare Changelog | N03を送信しWAFイベントを確認 | `/health` と通常画像パス | 要 | ⬜ |
| C10 | Next.jsルールの初期ActionはLog | Cloudflare Changelog | N03のActionを確認 | Rule-level Block override | 要 | ⬜ |
| C11 | Next.jsルールをBlockにすると画像最適化に影響し得る | Cloudflare Changelog | N04/N05のステータス・画像内容を比較 | `/health` と通常画像パス | 要 | ⬜ |
| C12 | CVE-2026-111497はNode.js Brotli decoderの境界外書き込みである | Node.js公式 | 公式セキュリティリリースを確認 | 第三者記事の要約 | 不要 | ✅ 確認 |
| C13 | CVE-2026-111497はNode.js 22/24/26系に影響する | Node.js公式 | 影響バージョンを確認 | 修正版リリース番号 | 不要 | ✅ 確認 |
| C14 | Ruleset-level overrideは既存・将来追加ルールに適用される | Cloudflare docs | 仕様文と設定取得結果を確認 | Rule-level override | 要（設定取得） | ✅ 仕様確認 / 実機未確認 |
| C15 | Tag overrideは既存・将来追加ルールに適用される | Cloudflare docs | 仕様文と設定取得結果を確認 | Rule-level override | 要（設定取得） | ✅ 仕様確認 / 実機未確認 |
| C16 | Rule overrideは指定したRule IDだけを対象にする | Cloudflare docs | 対象Ruleと別Ruleの結果を比較 | Ruleset-level override | 要 | ⬜ |
| C17 | Overrideの優先順位はRule > Tag > Rulesetである | Cloudflare docs | 競合する3設定をテスト | 1階層だけ設定したケース | 要 | ✅ 仕様確認 / 実機未確認 |
| C18 | Security Eventsはすべてのイベントを表示するとは限らない | Cloudflare docs | 同一条件のイベント数と表示数を比較 | 狭い時間幅 / GraphQL | 要 | ✅ 仕様確認 |
| C19 | Security AnalyticsはLog/Skip/Allowを「Mitigated by WAF」に数えない | Cloudflare docs | Action別の集計を確認 | Block / Challenge | 要 | ✅ 仕様確認 / 実機未確認 |
| C20 | 正常なBrotli POSTが自環境で対象Ruleに一致する | PRD仮説H1 | B01〜B04を同一条件で送信 | 通常JSON、gzip、Accept-Encodingのみ | 要 | ⬜ |
| C21 | 正常なNext.js画像最適化リクエストが自環境で対象Ruleに一致する | PRD仮説H1 | N01〜N04を送信 | `/health`、通常画像パス | 要 | ⬜ |
| C22 | Default / Log / BlockでHTTP応答とWAF Actionが変わる | PRD仮説H2/H3 | 同一リクエストを設定別に送信 | 同一設定での再送 | 要 | ⬜ |
| C23 | 既存Ruleset-level Block overrideが今回の新規Ruleにも適用される | PRD仮説H4 | 設定APIとSecurity Eventsを突合 | Rule-level Log override | 要 | ⬜ |
| C24 | Rule-levelの限定的なLog/Disable/Exceptionで正常通信を回復できる | PRD仮説H5 | 対応前後の成功率と他Ruleの維持を確認 | Managed Ruleset全体無効化 | 要 | ⬜ |
| C25 | WAFでBlockされたリクエストはWorkerへ到達しない | PRD測定項目 | Worker検証IDログとHTTP応答を突合 | Logで通過する同一リクエスト | 要 | ⬜ |
| C26 | 提供AccountのZone `under18.dev` はFree Websiteである | Cloudflare Zones API | Zone一覧を取得する | APIレスポンスのzone名・plan | 不要 | ✅ 実測 |
| C27 | 提供AccountのZoneにはFree Rulesetしか配備されていない | Cloudflare Rulesets API | ZoneのRuleset一覧を取得する | `http_request_firewall_managed`以外のRuleset | 不要 | ✅ 実測 |
| C28 | 提供AccountのFree Ruleset version 82には10/25の対象2ルールがない | Cloudflare Rulesets API | 全38ルールのdescriptionを検索する | 公式Changelogの2ルール名 | 不要 | ✅ 実測 |
| C29 | 現在のAccountでは10/25対象2ルールの実機検証を完了できない | C28 / Cloudflare WAF docs | 対象Ruleが存在するZoneがあるか確認する | Managed Rulesetを使える別Zone | 不要 | ✅ 条件付き |

---

## ドキュメント同士の注意点

### ① Managed RulesetとFree Rulesetの7ルールは同じではない

| 資料 | ルール | Rule ID末尾の例 | Action |
| --- | --- | --- | --- |
| Managed Ruleset | Generic Rules - Anomalous Execution - 1〜7 | `c438d5dd` など | Block |
| Free Ruleset | Generic Rules - Anomalous Execution - 1〜7 | `b5ccf32f` など | Block |

名前が同じでもRule IDは異なります。検証結果では、Ruleset名・Rule ID・プランを必ず同時に記録します。

### ② 「検知」と「遮断」を分ける

10月25日の2ルールについて、公式Changelogは正常通信も一致し得ることを説明したうえで、初期ActionをLogにしています。

- ルールに一致した = 検知された
- ActionがLog = 記録されるが、そのルール自身は遮断しない
- HTTPリクエストが失敗した = 対象RuleのBlockとは限らない。別のルール、Custom Rules、Bot対策などを確認する

### ③ overrideの継承範囲

Ruleset-level / Tag overrideは将来追加されるルールにも適用されます。Rule overrideはRule IDを指定するため、将来追加される別Ruleに自動適用されると決めつけません。

---

## 実機不要で確認できたこと

### 公式資料の読み合わせ

- 10/21 Managed Rulesetの7行を数え、すべてNew ActionがBlockであることを確認
- 10/21 Free Rulesetの7行とRule ID末尾が違うことを確認
- 10/25の2行が `Log` であることを確認
- Brotli / Next.jsルールの対象範囲を公式本文で確認
- Ruleset / Tag / Rule overrideの適用範囲と優先順位を確認
- Security Eventsのサンプリング、Security Analyticsとの用途差を確認
- Node.js公式資料でCVEの影響と修正版を確認

### 自動取得コマンド

公式資料の更新時に差分を確認するためのコマンド。実行結果は本文に貼らず、必要なら手元の証跡へ保存します。

```sh
curl -sSL https://developers.cloudflare.com/changelog/post/2026-10-25-emergency-waf-release/ \
  | rg -n "Brotli|Next\.js|Log|CVE-2026-111497"

curl -sSL https://developers.cloudflare.com/changelog/post/2026-10-21-emergency-waf-release-cfmr/ \
  | rg -n "Generic Rules|Block|Rule ID"

curl -sSL https://nodejs.org/en/blog/vulnerability/october-2026-security-releases \
  | rg -n "CVE-2026-111497|22\.x|24\.x|26\.x|Brotli"
```

### 実行していないこと

- Cloudflare APIの設定取得
- Cloudflare WAFへのリクエスト送信
- Security Events / GraphQL Analytics APIの取得
- `Content-Encoding: br` の実リクエスト
- Next.js実アプリケーションへの `/_next/image` リクエスト

---

## 実機に必要なもの

- 自分が管理するテスト用Cloudflareゾーンまたはドメイン
- 対象Managed Rulesetを読み取るAPI権限
- 検証用設定を変更・復元する権限（Zone WAF / Account WAF / Rulesets）
- `ZONE_ID` と、必要最小限の権限に絞ったAPIトークン
- WAFの前段に置く検証用Hono Worker
- Next.jsの挙動も確認する場合は、実際のNext.js検証アプリ
- Security Eventsを確認できるプラン、または代替となるGraphQL / Logpushの経路

### 1回しか試せない検証

今回は認可フローやnonceを消費する検証ではありません。設定変更は復元可能ですが、次の2点は最初からスナップショットを保存します。

- 変更前のentry point ruleset設定
- 変更前の対象Ruleとoverrideの状態

それでも、本番ゾーンでは行わず、専用テストゾーンで実施します。

---

## ハーネスの設計

`verify-harness` で実装するもの。全リクエストは1つのクライアント関数とレコーダを通します。

```text
sandbox/
├── .env.example
├── .gitignore
├── package.json
├── src/
│   ├── client.ts       HTTP送信。400も例外にしない
│   ├── evidence.ts     1往復1行のJSONL記録
│   ├── cloudflare.ts   Ruleset設定の取得・保存・復元
│   ├── cases.ts        B01〜B04 / N01〜N05
│   └── summarize.ts    WorkerログとWAFイベントの突合
└── data/               gitignore対象
```

レコーダに残すもの:

- 検証ID
- 送信時刻と実経過時間
- HTTP method / URL / 全レスポンスヘッダー
- リクエストボディのSHA-256と長さ
- `Content-Encoding` / `Accept-Encoding`
- HTTP status / response body
- `cf-ray`などの識別子
- Worker側の検証IDログ
- WAFイベントのRule ID / Action / 時刻

認証トークンは値を残さず、長さとSHA-256の短い指紋だけを保存します。Cloudflare APIのレスポンスにアカウント識別子が含まれる場合は、記事・コミット・公開証跡へ出しません。

---

## 未確認・積み残し

- [ ] C06〜C11: 自環境でのWAFイベントと正常通信の結果
- [ ] C16〜C17: 競合するoverrideの実挙動
- [ ] C20〜C24: 誤検知、Action差、限定的な復旧策
- [ ] C25: Worker未到達と対象Rule Blockの突合
- [ ] Security Eventsのサンプリングを避けたイベント取得
- [ ] 設定を元に戻したことの最終確認

実機測定ができない場合は、これらを「未確認」のまま残し、公式仕様から実測結果を推測して埋めません。

## 開示について

現段階では、Cloudflareの既知の緊急更新を検証する計画であり、新しいセキュリティ脆弱性は見つかっていません。

もし実機測定で、Cloudflare公式の説明を超える影響や、設定変更なしに広範な正常通信が意図せず遮断される再現性の高い挙動が見つかった場合は、次の順序にします。

1. 生ログと再現手順を公開素材から分離
2. 設定情報・ドメイン・トークンを除去
3. Cloudflareへ報告するか判断
4. 回答を待つ
5. 回答内容を含めて記事・スライドへの掲載範囲を決める
