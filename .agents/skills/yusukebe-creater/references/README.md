# references — yusukebe さんの実スライド（ippon 形式）

[slides.yusu.ke](https://slides.yusu.ke/) で公開されている Yusuke Wada (yusukebe) さんの
スライド本体を Markdown に戻したものです。すべて `ippon` でそのままコンパイルできます。

```sh
node ippon-slides/bin/ippon.js build .claude/skills/yusukebe-creater/references/honoconf-2026.md --html
```

| ファイル | タイトル | 枚数 | 日付 |
|---|---|---:|---|
| `honoconf-2026.md` | Hono in this era（Hono Conference 2026） | 101 | 2026-10-11 |
| `jev-router.md` | JevRouterについて（Cloudflare Workers実践LT） | 20 | 2026-09-24 |
| `web-frameworks-in-the-ai-era.md` | AI時代のWebフレームワークはどこへ行く？（フロントエンドカンファレンス福岡 2026） | 155 | 2026-09-12 |
| `cf-demos.md` | 動くデモサイトを作る（Workers Tech Talks in Osaka #3） | 32 | 2026-08-07 |
| `agents-sdk.md` | Cloudflare Agents SDKについて（Workers Tech Talks in Kyoto #2） | 34 | 2026-07-08 |

## 変換について

- slides.yusu.ke は ippon と同じ記法（`::title::` / `::center size=1.5 bg=white::` / `::right::` / `-#`）
  で書かれているため、公開 HTML から元の Markdown をほぼそのまま復元できる
- frontmatter（`title` / `description` / `author` / `date` / `slug` / `source`）はこちらで付与したもの
- `bg=mustard` は ippon の色名にないため、本家と同じ値の `bg=#ca8a04` に置き換えている
- 画像は `https://ss.yusukebe.com/...` の元 URL をそのまま参照している（ローカルには置いていない）
- SpeakerDeck / SlideShare 側のスライドは画像 PDF なので対象外

## 読みどころ

**長尺（`honoconf-2026` 101枚 / `web-frameworks-in-the-ai-era` 155枚）だけの道具**

- **1 枚 1 メッセージ**：`::center::` の 1 行スライドを何枚も連打して間を作る
  （`web-frameworks` は全 155 枚のうち 58% が本文 1 行）
- **章扉**：`::center size=1.5 bg=white::` ＋ 一語（`時代` / `開発` / `まとめ`）
- **問いを置く**：「何が変わった？？」「OSSは死んだ？」で章を切り替える
- **注釈**：`-#` で出典・言い訳・小ネタを本文から落とす（実質 `honoconf-2026` 専用）
- **まとめで回収**：章扉の語を左に並べて `- 時代 → 明らかに新しい時代になった`

**LT（`agents-sdk` 34枚 / `cf-demos` 32枚 / `jev-router` 20枚）はまったく別物**

- **章扉も `::center::` 連打も無い**（`agents-sdk` `cf-demos` は 0 枚）
- `## 見出し` ＋ 箇条書き 3 個をひたすら繰り返すだけ（見出し率 85〜90%）
- **太字 0・絵文字 0** で成立している
- 表紙 → `## Yusuke Wada` → `## アジェンダ` → 本編 → `## まとめ`（アジェンダの回収）→ リンク

**5 本すべてに共通**

- **数字で殴る**：`2025年10月 → 1,110万 / 月` のように before → after を並べる
- 矢印は `→` のみ（148 回）。`➔` は 0 回
- 見出しは `##` のみ。`###` は 342 枚で 0 回
- **表（table）は 0 枚**、`!!` 強調行も 0 回、`::note::` も 0 回
- 絵文字は 342 枚で 6 箇所だけ（`✗`×2 / `😊`×2 / `😱` / `🙇`）
- **左右分割**：見出し＋箇条書きの後に `::right::` でスクリーンショットや顔写真
- **`::wide::`** は `## 見出し` ＋ 大きい図 1 枚のときだけ

## 注意

`web-frameworks-in-the-ai-era.md` の冒頭にある「喉がやられて声が出ない😱」「水を飲む」は、
**その回だけの事情**であって様式ではない。他の 4 本には 1 枚も無い。
1 本にしか出てこない要素は、様式ではなく事情を疑うこと。
