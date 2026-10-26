---
name: figures
description: How often slides should carry a figure, which figure form to pick (table → inline HTML/SVG → generated image), and the gen-image prompt template that keeps generated figures on-brand. Read when planning the figure mix for a deck or before calling gen-image.
---

# Figures in slides — frequency and form

Slides that are all text lose the audience. Figures, tables, charts, and illustrations carry weight visually and let the speaker point at something.

## How many slides should carry a figure

Measure by slide: "of the **content** slides, how many have a figure or table?" The cover (`title` / `title image`), `section` dividers, and the closing `lead` (Thank you!) don't count toward the denominator.

| Deck type                       |   Figure-bearing share | Figures that fit                                            |
| ------------------------------- | ---------------------: | ----------------------------------------------------------- |
| Executive / decision-making     |       30–50% of slides | Comparison tables, structure diagrams, roadmaps, KPI charts |
| Proposal / sales                |       50–70% of slides | Problem structures, impact, Before/After, case studies      |
| Training / explanatory          |       40–60% of slides | Flow diagrams, concept diagrams, step diagrams, illustrations |
| Research / analysis             |       60–80% of slides | Graphs, tables, model diagrams, experiment results          |
| Live talk (spoken presentation) |               70%+ ok  | Large figures, photos, simple charts                        |

Decks built in this repo are almost always **training / explanatory** or **live talk** — when unsure, aim for **50–70%**.

**What counts as a "figure"**:

- ○ Markdown table
- ○ Inline HTML diagram / card grid / SVG chart
- ○ Generated or embedded image (`![]()` / `<img>` / `![bg]`)
- ○ A substantive fenced code block (≥ 4 lines or that is the main content of the slide)
- × Plain bullet lists, paragraphs, headings alone — these are text

Quote-only `lead` slides count as content (and as figure-less unless they contain a figure).

**Small-deck rounding**: when content-slide count is ≤ 4, round the target up. For a live talk with 3 content slides at "70%+", treat the target as "all but at most one" (2 of 3 minimum, 3 of 3 ideal).

## Picking the figure form — walk down this list in order

Throwing every figure at image generation makes the deck stylistically uneven and heavy.

1. **Markdown table** — for comparisons and one-to-one mappings, see if a plain table is enough first.
2. **Inline HTML / SVG** — simple structure diagrams, card grids, bar charts. Use `var(--gdg-blue/red/yellow/green)` for colors so they match the template. Patterns to copy from `.marp/template.md`: the Diagram/flow flexbox row, the Chart/graph `<svg>`, and the Takeaways three-card grid.
3. **Generated image** — for complex concept diagrams, illustrations, Before/After figures, and anything the above can't express cleanly. Use the `gen-image` skill with the prompt template below.

## Generating figure images with the `gen-image` skill

The quality of what `gen-image` returns depends almost entirely on the prompt. Three rules at minimum:

- **Match the in-figure text language to the slide language.** If the slide is Japanese, labels inside the figure must be Japanese too; if English, English. Mixing the two costs the reader cognitive effort. State this explicitly (`All labels in Japanese` / `ラベルはすべて日本語`); codex defaults to English when left silent.
- **Match the style to the template.** White background, Google Sans-like sans-serif, four accent colors (blue `#4285F4`, red `#EA4335`, yellow `#FBBC04`, green `#34A853`), rounded corners, flat — no gradients or shadows. Specify the palette and flat style every time. Photorealistic / watercolor / 3D / heavy-gradient outputs visibly clash with the rest of the deck.
- **Be concrete.** A request like "a diagram of data flow" comes back as a decorative picture with no elements or arrows — "just a drawing." Spell out element count, the label on each, arrow directions, and layout (horizontal / vertical / 2x2 / radial).

### Prompt template (English — codex is more stable in English)

```
A [diagram type, e.g. flow diagram / Before-After comparison / concept map]
illustrating [topic in one sentence].
Language: [Japanese / English]   ← language used for every label in the figure
Elements (left to right / top to bottom):
- [element 1 with its label text]
- [element 2 with its label text]
- [element 3 with its label text]
Relationships: [arrow from X to Y / X contains Y / ...].
Layout: [horizontal flow / vertical stack / 2x2 matrix / radial / ...].
Style: flat, clean, modern infographic on a pure white background,
using the Google brand palette (blue #4285F4, red #EA4335,
yellow #FBBC04, green #34A853) for accents, thin rounded
rectangles, Google Sans-like sans-serif typography, no shadows
or gradients.
Aspect ratio: 16:9, designed to be embedded in a slide.
All labels in the Language specified above. No logos, no watermark,
no extra decorative text.
```

### Prompt template (Japanese version)

```
[図の種類: フロー図 / Before-After 比較 / 概念図 など] を生成してください。
テーマ: [一文で要約]
Language: [日本語 / 英語]   ← 図中のすべてのラベルに使う言語
含める要素 (配置順):
- [要素 1 とそのラベル]
- [要素 2 とそのラベル]
- [要素 3 とそのラベル]
要素間の関係: [X から Y への矢印 / X が Y を含む / ...]
レイアウト: [横方向のフロー / 縦並び / 2x2 / 放射状 / ...]
スタイル: 白背景・フラット・モダンなインフォグラフィック。
アクセントカラーは Google ブランドパレット
(青 #4285F4・赤 #EA4335・黄 #FBBC04・緑 #34A853)、
角丸の長方形、Google Sans に近いサンセリフ書体、
影やグラデーションは使わない。
アスペクト比 16:9、スライド埋め込み用。
ラベルはすべて上で指定した Language に揃える。
ロゴ・透かし・装飾的なテキストは入れない。
```

### Worked example — Before/After figure for a Japanese training deck

> Generate a Before/After comparison figure for a Japanese-language slide.
> Language: 日本語 (all labels in Japanese).
> Left "Before": a rounded box labeled 「README だけ・ローカルでしか動かない」 with a red `#EA4335` accent.
> Right "After": a rounded box labeled 「自動 CI / クラウドにデプロイ済み」 with a green `#34A853` accent.
> Center: a thick right-pointing arrow in blue `#4285F4`.
> Style: white background, flat, Google Sans-like typography, no shadows, 16:9.
> No logos, no watermarks, no extra text.

### Operational notes

- `gen-image` writes to `./images/` under the current working directory. After generation, move the file into `<content-name>/img/` (`mv ./images/foo.png <content-name>/img/`) and reference it from `slide.md`.
- One `codex exec` call produces exactly one file. For variations, call multiple times with different filenames.
- If the result has stray logos or unintended text, add a stronger `no logos, no watermark, no extra text` clause and regenerate. If it still leaks, drop one or two elements — fewer elements come back cleaner.
