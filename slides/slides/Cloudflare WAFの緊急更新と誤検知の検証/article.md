---
published: false
summary: Cloudflare WAFの緊急更新とWorkers Paidの違い
---

# Cloudflare WAFの緊急更新を調べて分かったこと。Workers PaidでもWAFは別だった

> Workers Paidに入っているのに、なぜ対象のWAFルールが見えないのか。

## この記事の結論

Cloudflareは2026年10月、Node.jsの脆弱性に対応するWAFルールを緊急公開しました。10月21日には実行異常を検出する7ルール、10月25日にはBrotliリクエストとNext.js Image Optimizerを対象にする2ルールが追加されています。

今回調べて分かったことがあります。Workers PaidとWAF Managed Rulesetの契約は別です。Workersを有料化していても、ゾーン側がFree Websiteなら、利用できるWAF Managed RulesetはFree Managed Rulesetに限られます。

実際に対象アカウントを読み取り専用で確認したところ、ゾーンのプランはFree Websiteでした。Free Managed Rulesetは有効でしたが、今回の10月25日追加ルールはそのルール一覧にはありませんでした。

そのため、現段階では「このアカウントで緊急ルールが誤検知した」とは言えません。確認できたのは、ルールの公開内容、契約プランの境界、そして対象アカウントではまだ測定対象のルールに到達していないことです。

## 1. 最初に確認したのはWAF Changelogだった

今回のきっかけは、CloudflareのWAFに緊急更新が出ていることでした。まず契約を分けます。CloudflareのChangelogには、通常のManaged Ruleset更新とは分けて、次の2回の緊急リリースが掲載されています。

| 公開日 | ルール | 初期アクション | 対象 |
| --- | --- | --- | --- |
| 2026-10-21 | Generic Rules - Anomalous Execution 1〜7 | Block | 異常な実行パターン |
| 2026-10-25 | Brotli - Request Content-Encoding | Log | リクエスト本文のBrotli |
| 2026-10-25 | Next.js - Image Optimizer Path | Log | `/_next/image` |

10月21日の7ルールは、Cloudflare Managed RulesetとFree Managed Rulesetで別々に公開されています。名称は似ていますが、ルールIDは同じではありません。Free向けにも同じ種類の防御が追加された、と読み飛ばさないことが大切です。

10月25日の2ルールは、どちらも初期アクションがLogです。Logは遮断ではありません。追加されたから即座にリクエストを遮断する設定ではありません。まず検出結果を記録し、実際の通信への影響を見てからアクションを変更できる形です。

## 2. 10月25日のルールは何を見ているのか

今回の記事で中心にしたかったのは、BrotliのルールとNext.jsのルールです。これは別の防御です。どちらもアプリケーションの正常な通信と見分けにくい条件を持っています。

### Brotliルール

Brotliルールが見るのは、リクエストヘッダーの `Content-Encoding: br` です。ブラウザーがレスポンスをBrotliで受け取れることを示す `Accept-Encoding: br` ではありません。

つまり、レスポンス圧縮を使っているだけの通常のブラウザーアクセスが、このルールの対象になるわけではありません。リクエスト本文そのものをBrotliで圧縮して送る通信が対象です。

ここを取り違えると、「Brotliを有効にしたら全部のアクセスが検出された」という誤った検証になります。検証では、次の2つを分けます。

```http
Accept-Encoding: br
```

```http
Content-Encoding: br
```

前者はレスポンスの受け入れ能力、後者は送信するリクエスト本文のエンコーディングです。名前だけでは判断できません。今回のルール説明に該当するのは後者です。

### Next.js Image Optimizerルール

もう一つのルールは、Next.jsの画像最適化エンドポイントである `/_next/image` を見ます。Cloudflareの説明では、アクションをBlockに変えると最適化画像の配信を壊す可能性があります。

このエンドポイントは、攻撃用のリクエストだけでなく、通常のNext.jsアプリケーションも利用します。したがって、Logの記録を確認せずにBlockへ変更するのは危険です。画像URL、幅、品質などのクエリを付けた通常アクセスがどのように記録されるかを先に確認します。

## 3. WAFの緊急更新とNode.jsの修正は同じものではない

今回のWAF更新は、Node.jsのCVE-2026-111497に対応しています。Node.jsのセキュリティリリースでは、Brotliデコーダーの境界外書き込みについて、クラッシュ、メモリ情報の漏えい、条件によってはコード実行につながる可能性が説明されています。

Node.js側の修正版は、22系、24系、26系で公開されています。アプリケーションが攻撃者から受け取ったBrotli本文を `node:zlib` で展開する場合は、まずNode.jsを修正済みバージョンへ更新するのが本筋です。

WAFルールは、その前段で不審な通信を検出する追加の防御です。WAFを入れたからNode.jsの更新が不要になるわけではありません。逆方向に、Node.jsを更新したからWAFのログを見なくてよいわけでもありません。

## 4. Workers PaidでもWAF Managed Rulesetが使えるとは限らない

ここが、実際に調べていて一番混乱しやすかったところです。

CloudflareのWorkers Paidは、Workersの実行やリクエストに関する料金プランです。一方、WAF Managed Rulesetの利用可否は、Webサイトを載せているゾーン側のプランで決まります。ここは読み違えやすい。Workers Paidの契約があることだけでは、WAFの有料Managed Rulesetが有効になったことにはなりません。

CloudflareのWAFドキュメントでは、FreeプランはFree Managed Rulesetを利用でき、Pro・Business・EnterpriseではCloudflare Managed Rulesetを利用できます。Free Managed Rulesetは全プランで利用できますが、Cloudflare Managed RulesetはFreeでは利用できません。

画面に `Workers Paid` と表示されていても、WAFの画面で確認すべきなのは別のプラン情報です。請求画面とゾーンのWAF設定画面を同じものとして読むと、今回のように「有料なのにルールがない」という状態に見えます。

## 5. APIでアカウントとルールを読み取り専用で確認した

管理画面だけで判断せず、Cloudflare APIで次の順に確認しました。

1. アカウントに紐づくゾーンとゾーンプラン
2. アカウントレベルのRuleset
3. ゾーンレベルのRuleset
4. Free Managed Rulesetに含まれる個別ルール

対象アカウントには `under18.dev` という有効なゾーンがあり、ゾーンのプランは `Free Website` でした。ゾーンのRulesetには、Cloudflare Normalization Ruleset、Cloudflare Managed Response Firewall Default、Free Managed Ruleset、DDoS L7 Rulesetが登録されています。

Free Managed Rulesetのルール数は38件でした。その一覧に、10月25日に公開された次の2ルールはありませんでした。

- Brotli - Request Content-Encoding - CVE-2026-111497
- Next.js - Image Optimizer Path - CVE-2026-111497

ここで確認したのは設定情報だけです。設定は変えていません。対象サイトへテストリクエストを送ったわけではなく、WAFの検出ログや誤検知ログを取得したわけでもありません。APIでルールが見つからないことと、通信が安全に通ることは同じではないので、この点は分けて記録しています。

## 6. まだ「誤検知した」と書けない理由

当初は、正常なBrotli通信やNext.js画像配信を送り、緊急ルールが誤検知するかを測る予定でした。しかし、対象アカウントで有効なのはFree Managed Rulesetで、測定したい10月25日の2ルールが見つかりませんでした。

この状態で正常リクエストを送っても、「緊急ルールが誤検知しなかった」という結果にはなりません。そもそも対象ルールが評価されていない可能性が残るからです。

検証結果として成立させるには、対象ルールが実際に有効なゾーンを用意し、Security Eventsで該当ルールIDのイベントを確認します。Logアクションはリクエストを通すため、HTTPレスポンスだけで判定せず、WAFイベントの記録を見ます。

## 7. ここから実際に検証するなら

次に必要なのは、対象ルールが利用できるPro以上のゾーン、またはCloudflare Managed Rulesetが有効な検証環境です。その上で、次のリクエストを分けて送ります。

| ケース | 目的 |
| --- | --- |
| 通常のGET | ベースラインを取る |
| `Accept-Encoding: br` のGET | レスポンス圧縮とBrotliルールを分離する |
| Brotli圧縮した本文 + `Content-Encoding: br` | Brotliルールの対象条件を確認する |
| `/_next/image` への通常アクセス | 画像最適化ルールの正常系を確認する |
| クエリや本文を変えた境界ケース | 誤検知条件を絞る |

各リクエストにはケース名を付け、送信時刻、レスポンス、WAFイベントのaction、ルールIDを保存します。特に、HTTP 200だったから検出されていないとは判断しません。今回の2ルールは初期状態がLogなので、通信を通したままイベントだけが残る可能性があります。

Wranglerは検証用Workerのデプロイやリクエスト生成には使えます。Workerはまだ公開していません。ただし、Wranglerを実行しただけでWAF Managed Rulesetの有効化や、Security Eventsの確認まで完了するわけではありません。WAF設定とイベント確認はCloudflareのダッシュボードまたはAPIの担当範囲です。

## 8. 現段階で書けること、書けないこと

ここまでで書けるのは、緊急更新の内容、対象ヘッダーとパス、Node.js修正との関係、Workers Paidとの契約境界、そして対象アカウントの実際のルール構成です。これは、単なるChangelogの要約ではなく、読者が自分のCloudflare画面でどこを確認すべきかまで落とし込めます。

一方で、次のことはまだ書けません。

- 対象2ルールが正常なリクエストを誤検知した
- `Content-Encoding: br` の本文が実際にBlockされた
- `/_next/image` の通常アクセスが実際に検出された
- Security Eventsにどの程度の遅延で表示された

これらは、対象ルールが有効な環境で通信を送り、イベントを確認してから判断します。今の段階で無理に「検証結果」にすると、ルールが評価されていない状態を陰性結果として扱うことになります。

## この記事のまとめ

今回の調査で分かったことは三つです。

1. CloudflareはNode.jsのCVE-2026-111497に対して、10月21日と25日にWAFルールを緊急公開した。
2. 10月25日のルールは、レスポンス圧縮ではなく、リクエスト本文の `Content-Encoding: br` と `/_next/image` を対象にする。
3. Workers PaidとWAF Managed Rulesetは別の契約であり、対象アカウントのFree Websiteでは今回の2ルールを確認できなかった。

したがって、現時点の結論は「誤検知を確認した」ではなく、「誤検知を測定できる前提条件を確認した」です。WAFの検証では、リクエストを送る前に、そのリクエストを評価するルールが本当に有効かを確認してから送ります。

### 参考

- [Cloudflare WAF: Emergency Managed Ruleset update for CVE-2026-111497](https://developers.cloudflare.com/changelog/post/2026-10-25-emergency-waf-release/)
- [Cloudflare WAF: Emergency Managed Ruleset update](https://developers.cloudflare.com/changelog/post/2026-10-21-emergency-waf-release-cfmr/)
- [Cloudflare WAF: Emergency Free Managed Ruleset update](https://developers.cloudflare.com/changelog/post/2026-10-21-emergency-waf-release-free/)
- [Cloudflare WAF overview](https://developers.cloudflare.com/waf/)
- [Cloudflare WAF managed rules](https://developers.cloudflare.com/waf/managed-rules/)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Node.js security releases: October 2026](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases)
- [Cloudflare managed ruleset overrides](https://developers.cloudflare.com/ruleset-engine/managed-rulesets/override-managed-ruleset/)
