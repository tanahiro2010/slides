# references — Cloudflare WAFの緊急更新と誤検知の検証

| | |
| --- | --- |
| 調査日 | 2026-10-26 |
| 対象 | Cloudflare WAF / Cloudflare Managed Ruleset / CVE-2026-111497 |
| 用途 | `slide.md` / `article.md` の一次ソース |
| 実環境測定 | 未実施。Cloudflareアカウント、対象ドメイン、WAF設定変更権限が必要 |

## Account実査（2026-10-26、読み取り専用）

提供されたAccountをCloudflare APIで確認した結果、次のZoneがありました。

ここでいう `Free Website` はWebサイトZone側のプランです。Workers Paidの契約状況とは別の項目です。Workers Paidでも、Zone側がFreeのままならWAFで利用できるManaged RulesetはFree Managed Rulesetに限定されます。

| Zone | Status | Plan |
| --- | --- | --- |
| `under18.dev` | active | Free Website |

`http_request_firewall_managed` フェーズに見えているManaged Rulesetは次の1つだけでした。

| Ruleset | ID | Version | Last updated |
| --- | --- | ---: | --- |
| Cloudflare Managed Free Ruleset | `77454fe2d30c4220b5701f6fdfb893ba` | 82 | 2026-10-23T15:07:01Z |

10月25日の `Brotli - Request Content-Encoding` と `Next.js - Image Optimizer Path` は、取得したFree Rulesetの38ルール内に存在しませんでした。また、Managed Rulesetのentrypoint rulesetはこのZoneには存在しませんでした。

### Account実査の判定

**対象2ルールの実機検証は、現在のFreeプランのZoneでは実施不能です。**

これは「ルールが全世界に配信されていない」という意味ではありません。今回のAccountのFree Rulesetへは、対象2ルールが入っていないという範囲の観測です。Cloudflare公式ドキュメントでも、FreeプランはFree Managed Rulesetのサブセットを使うと説明されています。

取得コマンドは次の通りです。トークンは出力しません。

```sh
curl -sS "$CF_API_BASE/zones/$ZONE_ID/rulesets" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  | jq '.result[] | select(.phase == "http_request_firewall_managed")'

curl -sS "$CF_API_BASE/zones/$ZONE_ID/rulesets/$RULESET_ID" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  | jq '.result.rules[] | {id, ref, description, action, enabled}'
```

## 調査の結論

Cloudflareの公式資料から、PRDの中心となる前提は確認できました。

- 2026-10-21の緊急更新では、Cloudflare Managed Rulesetに異常なリクエストパターンを検知する7ルールが追加され、初期ActionはBlock
- 2026-10-25の緊急更新では、CVE-2026-111497に関連する2ルールが追加され、初期ActionはLog
- Brotliルールは `Content-Encoding: br` を宣言するリクエストボディを対象にし、`Accept-Encoding: br` やCloudflareのレスポンス圧縮設定とは別物
- Next.jsルールは `/_next/image` を対象にし、Blockへ変更すると画像最適化に影響し得る
- Ruleset-level override と Tag override は既存ルールだけでなく、将来追加されるルールにも適用される。既存ルールだけを対象にするなら Rule override を使う
- Security Eventsはサンプリングされる場合があるため、イベントが表示されないことだけでは「未検知」と判定できない

一方、次の点は公式資料だけでは実アプリケーションへの影響を確定できません。テスト用ドメインで実際にリクエストを送り、Worker到達ログ・HTTP応答・WAFイベントを突き合わせる必要があります。

- 自分の環境でBrotliの正常なPOSTが対象ルールに一致するか
- 自分の環境で `/_next/image` が対象ルールに一致するか
- 既存の設定が対象ゾーンでどのように継承されているか
- Block override時に、対象ルール以外のルールが同時に遮断していないか

---

## 確認した主張

| # | 主張 | 判定 | 根拠 |
| --- | --- | --- | --- |
| 1 | 2026-10-21に7つの異常リクエスト検知ルールが追加された | ✅ 確認 | Cloudflare公式Changelog |
| 2 | 10月21日のManaged Ruleset側7ルールの初期ActionはBlock | ✅ 確認 | Cloudflare公式Changelog |
| 3 | Free Rulesetにも別の7ルール掲載がある | ✅ 確認 | Cloudflare公式Changelog。Managed RulesetとRule ID末尾が異なる |
| 4 | 2026-10-25にCVE-2026-111497関連の2ルールが追加された | ✅ 確認 | Cloudflare公式Changelog / WAF Changelog |
| 5 | Brotliルールの初期ActionはLog | ✅ 確認 | Cloudflare公式Changelog |
| 6 | Brotliルールは `Content-Encoding: br` を対象にし、`Accept-Encoding: br` には一致しない | ✅ 確認 | Cloudflare WAF Changelog本文 |
| 7 | Next.jsルールは `/_next/image` を対象にし、初期ActionはLog | ✅ 確認 | Cloudflare WAF Changelog本文 |
| 8 | Next.jsルールをBlockにすると画像配信に影響し得る | ✅ 公式記載あり | Cloudflare WAF Changelog本文。自環境の実害は未測定 |
| 9 | Ruleset-level overrideは将来追加されるルールにも適用される | ✅ 確認 | Cloudflare Managed Rulesets / Ruleset Engine docs |
| 10 | Rule overrideは特定ルールを対象にできる | ✅ 確認 | Cloudflare Ruleset Engine docs |
| 11 | より具体的なoverrideが優先され、Rule > Tag > Rulesetの順になる | ✅ 確認 | Cloudflare Ruleset Engine docs |
| 12 | Security Eventsはサンプリングされることがある | ✅ 確認 | Cloudflare Security Events docs |
| 13 | Security EventsのFreeプランはSampled logsのみ | ✅ 確認 | Cloudflare Security Events docs |
| 14 | Security Analyticsは全HTTPリクエストを対象にし、Log/Skip/Allowは「Mitigated by WAF」に数えない | ✅ 確認 | Cloudflare Security Analytics docs |
| 15 | CVE-2026-111497はNode.js Brotli decoderの境界外書き込みで、RCEにつながる可能性がある | ✅ 確認 | Node.js公式セキュリティリリース |
| 16 | CVE-2026-111497はNode.js 22.x / 24.x / 26.xに影響する | ✅ 確認 | Node.js公式セキュリティリリース |
| 17 | 正常なBrotli POSTが自分の環境で誤検知される | ⬜ 未確認 | 実環境テストが必要 |
| 18 | 正常なNext.js画像最適化リクエストが自分の環境で誤検知される | ⬜ 未確認 | 実環境テストが必要 |
| 19 | 既存のRuleset-level overrideが、対象ゾーンの新規ルールに実際に適用された | ⬜ 未確認 | 設定取得と実リクエストが必要 |
| 20 | Block化した正常リクエストが対象ルールによって遮断された | ⬜ 未確認 | WAFイベントとWorker到達ログの突合が必要 |

---

## 1. 2026-10-21の緊急更新

**判定: 確認。**

- [WAF Release - 2026-10-21 - Emergency - Cloudflare Managed Ruleset](https://developers.cloudflare.com/changelog/post/2026-10-21-emergency-waf-release-cfmr/) — 2026-10-21付の公式Changelog。異常なリクエストパターンを検知する7ルールを追加したと記載
  - `...c438d5dd` — Generic Rules - Anomalous Execution - 1 — `Block`
  - `...0a0c2f64` — Generic Rules - Anomalous Execution - 2 — `Block`
  - `...545d163c` — Generic Rules - Anomalous Execution - 3 — `Block`
  - `...212afcc9` — Generic Rules - Anomalous Execution - 4 — `Block`
  - `...1867b12e` — Generic Rules - Anomalous Execution - 5 — `Block`
  - `...9d9c073d` — Generic Rules - Anomalous Execution - 6 — `Block`
  - `...48143645` — Generic Rules - Anomalous Execution - 7 — `Block`

### Free Rulesetとの区別

- [WAF Release - 2026-10-21 - Emergency - Cloudflare Free Ruleset](https://developers.cloudflare.com/changelog/post/2026-10-21-emergency-waf-release-free/) — Free Rulesetにも7ルールが掲載されている
  - Rule IDの末尾がManaged Ruleset版とは異なる
  - PRDや記事では、対象プラン・対象Rulesetを混ぜない

### 記事に使える切り口

「Cloudflareが7つのルールを追加した」だけでなく、**Managed RulesetとFree Rulesetは同じ名前の検知でもRule IDが別**なので、検証記録にはRuleset名とRule IDの両方を残す。

---

## 2. 2026-10-25のCVE-2026-111497向け2ルール

**判定: 確認。**

- [WAF Release - 2026-10-25 - Emergency - Cloudflare Managed Ruleset](https://developers.cloudflare.com/changelog/post/2026-10-25-emergency-waf-release/) — CVE-2026-111497に関連する2ルールを追加
  - `...ca706f3c` — Brotli - Request Content-Encoding — `Log`
  - `...402fe5bb` — Next.js - Image Optimizer Path — `Log`
- [WAF Changelog](https://developers.cloudflare.com/waf/change-log/changelog/) — 同じ内容をWAFのChangelog一覧から確認できる

公式Changelog本文には、2ルールとも有効化された状態でActionはLogとあり、マッチするリクエストを可視化してからBlockを選べるようにする趣旨が書かれています。

### Brotliルールの意味

**判定: 確認。**

公式記載では、Brotliルールはリクエストボディの `Content-Encoding: br` を対象にします。通常のブラウザがレスポンスに対して送る `Accept-Encoding: br` とは別です。また、Cloudflareがオリジンからクライアントへ返すレスポンスのBrotli圧縮設定を対象にするルールでもありません。

したがって検証ケースは、少なくとも以下を分けます。

| ケース | ヘッダー | 位置付け |
| --- | --- | --- |
| B01 | `Content-Type: application/json` | 通常のJSON POST。対照 |
| B02 | `Content-Encoding: br` | 対象候補 |
| B03 | `Accept-Encoding: br` | Brotliリクエストボディとの区別 |
| B04 | `Content-Encoding: gzip` | 圧縮方式の比較 |

### Next.jsルールの意味

**判定: 確認。**

公式記載では、Next.js画像最適化エンドポイント `/_next/image` へのリクエストを対象にします。正常な画像最適化トラフィックも一致し得るため、初期ActionはLogです。Blockに変更すると、最適化画像が読み込めず画像配信が壊れる可能性があると明記されています。

検証では、単なるパス一致のスタブと、実際のNext.jsアプリケーションの画像最適化リクエストを分けます。Honoのスタブで確認できるのは、WAFがパスをどう扱ったかまでです。Next.jsの画像処理自体の成否は別途検証します。

---

## 3. CVE-2026-111497の一次資料

**判定: 確認。**

- [Node.js — Wednesday, October 21, 2026 Security Releases](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases) — Node.js公式のセキュリティリリース
  - Brotli decoderが不正な圧縮入力により内部バッファの境界外へ書き込む可能性
  - 影響はクラッシュ、プロセスメモリの漏えい、リモートコード実行につながる可能性
  - `node:zlib` でアプリケーションがBrotliデータを展開する場合が前提
  - Node.js 22.x / 24.x / 26.xが影響対象
  - 修正版として v22.23.4 / v24.22.1 / v26.12.1を案内

### 記事での注意

WAFルールがあることは、Node.js本体の更新が不要という意味ではありません。WAFは到達前の緩和策であり、オリジンのNode.jsを修正版へ更新することとは別の対策です。

CVEの詳細は、攻撃コードの再現や回避手法まで広げず、WAFがどのリクエスト形状を観測対象にしたか、正常通信との境界を検証する範囲に留めます。

---

## 4. Managed Rulesetのoverride

**判定: 公式仕様は確認。自環境の継承結果は未確認。**

- [Managed rulesets](https://developers.cloudflare.com/waf/account/managed-rulesets/) — Ruleset override / Tag overrideは既存および将来追加されるルールに適用される。既存ルールだけならRule overrideを使用する、と記載
- [Override a managed ruleset](https://developers.cloudflare.com/ruleset-engine/managed-rulesets/override-managed-ruleset/) — overrideの3階層と優先順位を説明
  - Ruleset override: 実行するManaged Ruleset全体
  - Tag override: 特定タグのルール群
  - Rule override: Rule IDで特定したルール
  - 優先順位は具体的なものが優先され、Rule > Tag > Ruleset
  - 変更できる基本プロパティは `action` と `enabled`
- [Cloudflare Managed Ruleset](https://developers.cloudflare.com/waf/managed-rules/reference/cloudflare-managed-ruleset/) — Ruleset-level actionにはDefault / Block / Logなどがあり、全ルールや将来追加されるルールへの影響に注意が必要

### PRDの仮説を修正する

「Ruleset-level overrideが新規ルールにも適用される」は公式仕様として確認できます。ただし、**対象ゾーンに実際にそのoverrideが設定されているか**、**対象の新規Rule IDにそのActionが実際に適用されたか**はアカウントの設定とSecurity Eventsで確認する必要があります。

また、Rule-level overrideは特定のRule IDを指定するため、将来追加される別Ruleへ自動的に適用されるとは限りません。記事では、この違いを「緊急更新で設定が勝手に変わった」と表現しないようにします。

### APIで確認する項目

```sh
curl "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/rulesets/phases/http_request_firewall_managed/entrypoint" \
  --header "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```

レスポンスから次を保存します。

- 実行対象のManaged Ruleset ID
- `overrides.action`
- `overrides.enabled`
- `overrides.categories`
- `overrides.rules` とRule ID
- 取得時刻

認証情報・Account ID・Zone IDはリポジトリへ保存しません。

---

## 5. Security EventsとSecurity Analyticsの使い分け

### Security Events

**判定: 確認。**

- [Security Events](https://developers.cloudflare.com/waf/analytics/security-events/) — Cloudflareのセキュリティ機能がActionを実行またはフラグを付けたイベントを確認する画面
- Sampled logsは大量トラフィックではサンプリングされ、すべてのイベントが表示されるとは限らない
- Free / ProはSampled logsのみ。保持期間は最大31日、クエリの最大期間は30日
- Sampled logsから最大500件のraw eventをJSONでエクスポートできる
- GraphQLの基礎データセットは `firewallEventsAdaptive`

**記事に使う判定ルール:**

Security Eventsに出なかったことだけで「WAFが検知しなかった」と言わない。送信側の記録、Worker到達ログ、Security Eventsの3つを突き合わせ、サンプリングや期間制限を明記する。

### Security Analytics

**判定: 確認。**

- [Security Analytics](https://developers.cloudflare.com/waf/analytics/security-analytics/) — セキュリティ製品がActionを実行しなかったリクエストを含め、ドメインへの全HTTPリクエストを分析する
- `Log` / `Skip` / `Allow` は「Mitigated by WAF」には数えられない
- 通常のダッシュボードはサンプリングされるが、raw logsではサンプリングされないと説明されている
- GraphQLの主なデータセットは `httpRequestsAdaptiveGroups` と `httpRequestsAdaptive`

### 測定時の三者突合

| 記録 | 分かること | 分からないこと |
| --- | --- | --- |
| 送信側 | どのHTTPリクエストを何時送ったか | WAFがどう評価したか |
| Workerログ | WAFを通過してWorkerに到達したか | 到達前にどのルールが一致したか |
| Security Events / GraphQL | ルール・Action・イベント | ログにないイベントが本当に未検知か（サンプリング時） |

---

## 6. 自分で実施する測定

現時点ではCloudflareアカウントへの接続情報がないため、以下は**実行前の手順**です。実行後はレスポンスとイベントの実データをここへ追記します。

### 6.1 リクエストの共通記録

各リクエストに検証IDを付け、送信時刻・URL・メソッド・ヘッダー・ステータス・Worker到達を記録します。

```sh
curl -i "https://example.test/health?probe=WAF-$(date +%s)"
```

本番トラフィックと分離したテスト用ドメインを使います。`CVE-2026-111497`の悪用データや、実際の攻撃ペイロードは送信しません。

### 6.2 Brotliの対照

実際のBrotli圧縮データを作り、同じJSONを通常・Brotli・gzipで送ります。圧縮ライブラリの生成物自体に問題がないことを確認し、テストデータは無害な固定JSONにします。

```sh
curl -i "https://example.test/compressed" \
  -H 'Content-Type: application/json' \
  --data-binary @payload.json

curl -i "https://example.test/compressed" \
  -H 'Content-Type: application/json' \
  -H 'Content-Encoding: br' \
  --data-binary @payload.json.br

curl -i "https://example.test/compressed" \
  -H 'Accept-Encoding: br' \
  -H 'Content-Type: application/json' \
  --data-binary @payload.json
```

記録するもの:

- HTTPステータス
- `cf-ray` などのレスポンス識別子
- Worker到達ログ
- Security EventsのRule ID / Action / Path / 時刻
- `Content-Encoding` と `Accept-Encoding` の違い

### 6.3 Next.js画像最適化の対照

```sh
curl -i "https://example.test/health"
curl -i "https://example.test/images/sample.png"
curl -i "https://example.test/_next/image?url=%2Fimages%2Fsample.png&w=640&q=75"
```

Honoのスタブだけで試した場合は「パスに対するWAFの評価」を測ったと記録し、Next.jsが実際に画像を生成・配信できたとは書きません。実アプリでも同じURLを送り、画像のContent-Type・サイズ・ステータス・画面表示を別途確認します。

### 6.4 Actionの比較

設定は次の順に1条件ずつ変えます。

1. Default
2. 対象RuleのRule-level Log override
3. 対象RuleのRule-level Block override
4. Ruleset-level Block override
5. Ruleset-level Log override、または対象RuleだけLogの組み合わせ

各条件で、前のoverrideが残っていないことをAPIまたはDashboardで確認します。Rule-level BlockでHTTP 403になっても、別のCustom RuleやBot対策が原因の可能性があるため、Security EventsのRule IDを確認するまで「対象ルールが遮断した」と判定しません。

---

## 未確認・積み残し

- [ ] 自分のCloudflare環境で対象Rule IDが実際に配信済みか
- [ ] Brotliの正常なPOSTが対象Ruleに一致するか
- [ ] `Accept-Encoding: br` がBrotli request-body ruleに一致しないことを自環境で確認
- [ ] gzipとの比較
- [ ] `/_next/image` の実アプリ通信が対象Ruleに一致するか
- [ ] Default / Rule-level Log / Rule-level Block / Ruleset-level Blockの実測比較
- [ ] 既存Ruleset-level overrideが対象の新規Ruleへ実際に適用されたか
- [ ] Security Eventsのサンプリングを避けるための時間幅・GraphQL取得方法
- [ ] WAF設定を元に戻したことの確認

## 探したが断定に使わないもの

- CVE-2026-111497を扱う第三者記事は見つかったが、CVEの影響範囲や修正版の根拠にはNode.js公式を使う
- 公式ChangelogのRule IDは表示上末尾8文字であり、完全なRule IDは対象アカウントのRuleset取得で確認する
- WAFの誤検知率や「何パーセントの正常通信が一致するか」という一般化された数字は、今回の公式資料にはない。自分のテストデータからのみ算出する

## 文章化するときの注意

- 「Logで一致した」ことと「誤検知で遮断された」ことを分ける
- 「公式が正常通信にも一致し得ると説明している」と「自分の環境で一致した」を分ける
- 「Ruleset-level overrideは将来ルールにも適用される」という仕様と、「自分の既存設定が今回の2ルールに適用された」という観測を分ける
- Managed RulesetとFree Rulesetの7ルールは、Rule IDが違うので混ぜない
- WAFの緩和策とNode.js本体のパッチ適用を別の対策として書く
- 攻撃コードや回避手法ではなく、無害な固定データと対照リクエストで検証する
- 断定できない結果は「未確認」と残し、Security Eventsに表示されなかっただけで「未検知」としない

## 参考：記事の文体メモ

指定された[Qiita記事](https://qiita.com/yama3133/items/16907c517a6e745adda1)から、記事化時に反映する方針をメモする。

- 自分の過去記事や実測結果を基準にし、一般的なAI記事の型をそのまま当てはめない
- 失敗した測定は回数・条件・原因を具体的に書く
- 冒頭で立てた問いには結論部で答える
- 体言止めを連続させず、本文はです・ます調で統一する
- 太字や表は比較に必要な箇所に絞る
- 公式資料にない数字を、雰囲気で補わない
