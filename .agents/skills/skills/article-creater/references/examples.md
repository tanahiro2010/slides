---
name: examples
description: The published articles that define the house style, with what each one is a good example of. Read one end-to-end before writing a new article.
---

# 実例

公開中の記事。**新しく書く前に、近い形のものを 1 本は通しで読む。**
公開版は下のリンク、原稿は手元の `article.md`。

| 記事 | 字数 | 原稿 |
| --- | ---: | --- |
| [PHPの命名規則、結局camelCaseとsnake_caseどっちなんだ](https://blog.tanahiro2010.com/articles/php-naming-convention/) | 19,151 | `slides/speakerdeck/PHPの命名規則、結局camelCaseとsnake_caseどっちなんだ/` |
| [Terraformで素数をマイニングしたら、ブロックチェーンが生まれた](https://blog.tanahiro2010.com/articles/terraform-prime-blockchain/) | 16,823 | `slides/slides/Terraformで素数をマイニングしたら、ブロックチェーンが生まれた/` |
| [WebMCP のハンズオン講師をして、今はまだいらないと思った](https://blog.tanahiro2010.com/articles/webmcp/) | 10,401 | `slides/speakerdeck/Googleが発表した新Web標準ドラフト――WebMCP。実際どうなの？ IO Extendedで実装・登壇して分かったこと/` |
| [初心者でも簡単理解。GitHub講座](https://blog.tanahiro2010.com/articles/github-beginners/) | 9,267 | `slides/speakerdeck/初心者でも簡単理解。Github講座/` |
| [LLM AgentでTRPGを動かしたら、Agentの地獄を（多分）全部見た](https://blog.tanahiro2010.com/articles/llm-agent-trpg/) | 8,656 | `slides/speakerdeck/LLM AgentでTRPGを動かしたらAgent地獄を全部見た/` |
| [Serverlessのすゝめ](https://blog.tanahiro2010.com/articles/serverless-susume/) | 8,425 | `slides/speakerdeck/Serverlessのすゝめ/` |
| [底辺作家でも、流行に乗れば舞えるのか](https://blog.tanahiro2010.com/articles/ranking-analysis-ai/) | 7,909 | `slides/speakerdeck/Q. 底辺作家でも流行に乗れば舞えますか？ A. はい。分析ランキング分析AIを使えば/` |
| [個人開発者よ、Honoを使え](https://blog.tanahiro2010.com/articles/use-hono/) | 7,438 | `slides/speakerdeck/個人開発者よ、Honoを使え/` |
| [LTできたらバンジー飛べる](https://blog.tanahiro2010.com/articles/lt-bungee/) | 5,125 | `slides/speakerdeck/LTできたらバンジー飛べる/` |
| [OSSコミュニティがくれた「人との繋がり」](https://blog.tanahiro2010.com/articles/oss-community-connections/) | 4,575 | `slides/speakerdeck/OSSコミュニティがくれた「人との繋がり」/` |
| [Serverlessしかなかったので、ブラウザに働いてもらいました](https://blog.tanahiro2010.com/articles/browser-does-the-work/) | 3,110 | `slides/speakerdeck/Serverlessしかなかったので、ブラウザに働いてもらいました/` |

## どれを読むか

| 書こうとしているもの | 読む記事 |
| --- | --- |
| 作ってみた系・計測がある | Terraformで素数をマイニングしたら、ブロックチェーンが生まれた |
| 歴史や仕様を一次資料で辿る | PHPの命名規則、結局camelCaseとsnake_caseどっちなんだ |
| 動かなかった・失敗した話 | LLM AgentでTRPGを動かしたら、Agentの地獄を（多分）全部見た |
| 新しい技術を評価して結論を出す | WebMCP のハンズオン講師をして、今はまだいらないと思った |
| 設計方針を主張する | 個人開発者よ、Honoを使え |
| 講座・入門の書き起こし | 初心者でも簡単理解。GitHub講座 |
| 体験・エッセイ寄り | OSSコミュニティがくれた「人との繋がり」 |

## 読むときに見るところ

- エピグラフが何を置いているか
- `## この記事の結論` に何が入っているか（箇条書き・表・太字の一文・出自の引用）
- 見出しの採番と、ハマりポイント / 計測 / 考察の切り分け
- 確認できなかったことをどう書いているか
- 失敗をどう書いているか

## この表の更新

記事を足したら作り直す:

```sh
cd apps/articles && vp run build   # src/data/articles.json が更新される
```
