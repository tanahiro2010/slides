---
name: codelab-creater
description: Use this skill whenever the user asks to create a codelab, a hands-on lab, a step-by-step tutorial, or workshop materials in this repository. Covers writing high-quality codelab content (structure, pacing, instructional patterns observed across 20+ official Google codelabs) AND the claat markdown format — frontmatter, steps, Duration, callout boxes, code blocks, image conventions — so new codelabs match Google's official codelab style and the GDG on Campus University of Osaka conventions. Trigger even when the user says "write a tutorial", "make a hands-on doc", "claat を作って", or "コードラボを作りたい"; in this repo, step-by-step workshop guides always mean claat format.
---

# codelab-creater

Every codelab in this repo is a `claat.md` file inside `<content-name>/` that gets exported to `index.html` via `make claat`. Look at `portfolio-2026/claat.md` for a full worked example.

This skill has two halves:

- **[Part 1: Writing](#part-1-writing-a-high-quality-codelab)** — pedagogy patterns distilled from 20+ official Google codelabs across Flutter, Android, Firebase, Cloud, AI/Gemini, AR, IoT, Web, Data. Use these to decide *what* to write.
- **[Part 2: Claat mechanics](#part-2-claat-markdown-mechanics)** — the markdown syntax that the `make claat` pipeline expects. Use these to decide *how* to write it.

Plus one reference doc you should load on demand:

- **Planning a figure, or about to call `/gen-image`?** Read `references/figures.md`. It captures the visual language shared by official Google codelab figures (architecture diagrams, hierarchy trees, concept illustrations) and provides the gen-image prompt template that keeps output on-brand.

## Workflow

1. Create `<content-name>/claat.md` and `<content-name>/img/` for images.
2. Outline the codelab using the [skeleton](#codelab-skeleton) in Part 1.
3. Write the file using the conventions in both parts.
4. Build: `make claat <content-name>/claat.md <content-name>`
5. Verify the generated `index.html` looks right (check callout boxes and code spans especially).

---

# Part 1: Writing a high-quality codelab

These conventions are taken from official Google codelabs. Follow them by default; deviate only with a clear reason.

## Codelab skeleton

Every codelab is built from four blocks. Skip none.

| #     | Step name (pick one)                                           | Purpose                                    |
|-------|----------------------------------------------------------------|--------------------------------------------|
| 1     | `はじめに` / `Introduction` / `Overview` / `Before you begin`   | Frame the codelab                          |
| 2     | `セットアップ` / `Setup` / `Environment setup`                  | Get tools / projects / accounts ready      |
| 3..N  | One step per feature or concept                                | Each step produces visible progress        |
| Last  | `おめでとうございます` / `まとめと次のステップ` / `Congratulations` | Recap + next steps + cleanup (if cloud)   |

Setup is always step 2 — never folded into step 1, never deferred. Every codelab analyzed used this exact skeleton.

## Step 1 — required sub-sections

Step 1 frames the entire codelab. It contains these `###` sub-sections (canonical order shown):

```markdown
## はじめに
Duration: 0:03:00

このコードラボでは…（1〜2 文の概要）

![完成イメージ](img/step1-final-result.png)

### このコードラボで作るもの
具体的な成果物。GIF か最終結果のスクリーンショットを必ず添える。

### このコードラボで学ぶこと
* 動詞で始まる箇条書きを 4〜7 項目
* 「〜の方法」「〜を構築する」など

### 必要なもの
* ツール、アカウント、バージョン、ハードウェアを列挙
* 例: Node.js 20+、Chrome、GitHub アカウント

### 前提知識（任意）
* 「〜の基本的な理解」と書く（「必要なもの」とは区別する）

### このコードラボで扱わないこと（任意・推奨）
* 範囲外のテーマを明示し、代替リソースへのリンクを添える
```

The "扱わないこと" / "What this isn't" section is rare but high-value — Android XR Fundamentals does this and it prevents misaligned expectations. Worth adding whenever scope is fuzzy.

## Writing step headers

**Do:**
- Imperative + concrete noun: `プロジェクトを作成する`, `ボタンを追加する`, `Detect planes in the real world`
- Concept nouns when introducing a concept: `Compose の状態`, `Spaces and Spatial Panels`
- Be specific to the artifact (`ナビゲーションレールを追加する`, not `UI を改善する`)

**Don't:**
- Step numbers in the header — the sidebar auto-numbers
- Marketing words (`最強の…`, `完璧な…`, `amazing`)
- Vague verbs (`〜について学ぶ`, `Working with…`, `Diving into…`)

## Sub-step granularity

Within a step, each `###` sub-section does exactly *one* of:

1. A concrete action — `Flutter をインストールする`, `Authentication をセットアップする`
2. A concept explanation — `Composable functions とは`, `Spatial panels`
3. A single file edit — `ファイル 1: pubspec.yaml`, `index.js を作成する`

Target 3–6 sub-sections per step. More than 7 → split the step.

## Code blocks: filename → code → why

Always use this three-part shape:

````markdown
`lib/main.dart` を以下の内容で上書きします。

```dart
import 'package:flutter/material.dart';
void main() => runApp(MyApp());
…
```

このコードは MaterialApp のルートウィジェットを定義し、…
````

Rules:
- **Announce the filename** with inline code *before* the block, never after
- **Language tag** on the fence (`dart`, `kotlin`, `bash`, `yaml`, …) for syntax highlighting
- **Complete and pasteable** — no `…` placeholders that learners must guess at
- **1–2 sentence "why"** *after* the block — what it does, not how

Chunk long files (>~50 lines) into per-section blocks. Don't paste 200-line files all at once.

## Expected output pattern

Every command paired with what learners should see, plus a recovery hint:

````markdown
```bash
gcloud config list project
```

**期待される出力:**

```
[core] project = your-project-id
```

設定されていない場合は次を実行します:

```bash
gcloud config set project <PROJECT_ID>
```
````

If a command silently succeeds, say so explicitly: 「出力がなければ成功です。」 The point is to remove "is this working?" anxiety.

## Setup step boilerplate (Cloud codelabs)

For codelabs that touch Google Cloud, Step 2 follows this three-part shape almost verbatim across the official corpus:

```
### 自分のペースでの環境設定
- Cloud Console でプロジェクト作成 / 選択
- プロジェクト ID の説明（一意・変更不可・グローバル）
- 課金有効化 + $300 無料トライアルの案内

### Cloud Shell を起動する
- "Activate Cloud Shell" を押す
- `gcloud auth list` で認証確認 + 期待される出力
- `gcloud config list project` でプロジェクト確認 + 期待される出力

### API を有効化する
- `gcloud services enable X.googleapis.com`
- 期待される出力: "Operation 'operations/...' finished successfully."
```

Reuse this scaffold verbatim when applicable — official codelabs do.

## Callout usage

| Keyword (Part 2 syntax)        | Intent                                      | Max length     |
|--------------------------------|---------------------------------------------|----------------|
| `Note` / `補足`                | Side info that aids understanding           | 2 sentences    |
| `Tip` / `Hint`                 | Optional shortcut or improvement            | 1 sentence     |
| `Warning` / `Caution`          | Irreversible action, cost, common error     | 3 sentences    |
| `Troubleshooting`              | Error recovery with links                   | List or 3 sentences |

Rules:
- A callout longer than 3 sentences should be regular prose instead
- Never place two callouts back-to-back — keep at least one prose paragraph between
- Reach for `Warning` for cost-incurring / destructive / data-losing actions

(Syntax in [Part 2](#callout-boxes-syntax).)

## Solution code references

If you have a finished solution, link it in Step 2:

```markdown
完成したコードは GitHub にあります: https://github.com/.../solution

> **Tip:** まずは手順どおりに進めて、詰まったときだけ解答コードを参照してください。
```

Use a `start/` and `done/` layout (or `step_01/`, `step_02/`, …) so learners can compare per-step.

## Visual cadence

| Where                          | What                                         |
|--------------------------------|----------------------------------------------|
| Step 1                         | One image / GIF of the *final* result        |
| UI-action sub-section          | One screenshot of the relevant UI            |
| Concept sub-section            | One diagram (use `/gen-image`)               |
| Pure-code sub-section          | No image needed                              |

Always place the image **immediately before** the action it supports, not after.

## Tone rules

- **Second person** for narrative: 「このステップでは〜を作ります」 / "you'll build…"
- **Imperative** for instructions: 「ファイルを開きます」 / "Click **Create project**"
- **No hedging:** avoid 「たぶん」「とりあえず」, `basically`, `we'll try to`
- **No marketing:** avoid 「最強」「革新的」, `amazing`, `powerful`, `cutting-edge`
- **Name the artifact** consistently: pick a fixed project name (`namer_app`, `FriendlyChat`) and use it everywhere — never 「我々のアプリ」 or `our app`

## Final step convention

The closing step mirrors Step 1 to close the loop:

```markdown
## おめでとうございます！
Duration: 0:05:00

このコードラボでは…（1 文の振り返り）

### 学んだこと
* ステップ 1 の「学ぶこと」と対応させる
* 同じ動詞・同じ順序で書くと達成感が出る

### 次のステップ
* [関連コードラボへのリンク](https://...)
* 公式ドキュメントへのリンク

### クリーンアップ（クラウドリソースを作成した場合）
課金を防ぐため、作成したリソースを削除します:
…
```

The recap intentionally echoes Step 1's promises.

## Length & pacing

| Audience          | Steps | Total duration | Per-step Duration |
|-------------------|-------|----------------|-------------------|
| 初学者 / Beginner   | 7–10  | 15–45 min      | 5–10 min          |
| 中級 / Intermediate | 10–15 | 45–90 min      | 10–20 min         |
| 上級 / Advanced     | 9–11  | 90+ min        | 15–25 min         |

Per-step Duration <5 min → too granular (merge with neighbor). >30 min → too dense (split).

## Antipatterns to avoid

- Vague step titles (`色々やってみる`, `Building things`)
- Commands without expected output (learner can't tell if it worked)
- Code blocks without filename context
- 100+-line code blocks pasted at once
- Multi-paragraph callout boxes (turn into prose)
- Two callouts back-to-back
- No final-result image in Step 1 (loss of motivation)
- Skipping the recap step
- 「我々のアプリ」 / `our app` instead of a fixed artifact name
- Commands with no "if this fails, do X" exit path
- Mixing concept explanation and concrete action in the same `###` sub-section

---

# Part 2: Claat markdown mechanics

The `make claat` pipeline (see `CLAUDE.md`) expects these conventions. Violating them is cosmetic — the build won't error but the output looks wrong.

## File structure

```
<content-name>/
  claat.md          ← you write this
  index.html        ← generated (committed)
  libs/             ← generated (committed)
  img/              ← screenshots and diagrams you provide
```

## Frontmatter (required — goes at the very top, no fences)

```
summary: One-line description shown in the codelab gallery
id: kebab-case-unique-id
categories: Web
environments: Web
status: Published
feedback link: https://github.com/googlecodelabs/your-first-pwapp/issues
author: GDG on Campus University of Osaka
```

`id` becomes the codelab's internal identifier. Use kebab-case matching the directory name.

## Document-level title

The first `#` heading is the codelab title shown at the top of the lab page.

```markdown
# ワークショップのタイトル
```

## Steps

Each `##` heading starts a new step. The text after `##` is the step title displayed in the sidebar.

```markdown
## 環境の準備
Duration: 0:15:00

ステップの本文をここに書く。
```

`Duration: H:MM:SS` is required on the first line of each step's body. It drives the estimated time shown in the UI. Add it to every step — omitting it makes the progress bar inaccurate.

Sub-headings within a step use `###`. **Do not** put `Step 1:` / `Step 2:` prefixes in the heading — the sidebar auto-numbers.

## Callout boxes (syntax)

`> **Keyword:** text` becomes a styled aside box. The `fix-claat-codespans.py` postprocessor handles the conversion. Recognized keywords (first word after `>`):

| Keyword(s)                          | Box style       |
|-------------------------------------|-----------------|
| `Note`, `Notice`, `補足`             | Info (blue)     |
| `Tip`, `Tips`, `Hint`               | Success (green) |
| `Warning`, `Warn`, `Caution`        | Warning (red)   |
| `Troubleshooting`                   | Warning (red)   |

Multi-line callouts: indent continuation lines with `>`.

```markdown
> **Troubleshooting:** インストールがうまくいかない場合は、
> 以下の点を確認してください。
> - ネットワーク接続を確認する
> - 管理者権限で実行する
```

(For *when* to use each box, see [Callout usage](#callout-usage) in Part 1.)

## Code blocks (syntax)

Use fenced code blocks with a language specifier — the renderer does syntax highlighting.

````markdown
`index.html`

```html
<!DOCTYPE html>
<html>
…
</html>
```
````

Inline code uses single backticks: `` `<h1>` ``. The postprocessor escapes raw HTML tags inside inline code so they render correctly.

(For the [filename → code → why](#code-blocks-filename--code--why) writing pattern, see Part 1.)

## Images

```markdown
![スクリーンショットの説明](img/step2-1.png)
```

Place all images in `<content-name>/img/`. Use descriptive alt text that also works as a caption. Name files after the step they appear in: `step2-1.png`, `step2-2.png`, etc.

### Screenshot placeholders

For UI steps where you need a real screenshot but don't have one yet, write a placeholder comment immediately below the image line:

```markdown
![VSCode でファイルを新規作成する手順](img/step2-1.png)
<!-- TODO: screenshot — VSCode explorer, new file icon highlighted -->
```

The codelab will build fine with a missing image (it shows a broken-image icon); replace the placeholder before publishing.

### Generated diagrams — use the gen-image skill

For architecture diagrams, flow charts, hierarchy trees, concept illustrations, or Before/After figures (anything that isn't a screenshot of real software), invoke `/gen-image`.

**Before calling `gen-image`, read `references/figures.md`.** It documents the visual language used across official Google codelab figures (rounded rectangles, pastel-tint fills with full-saturation accents, dashed borders for logical groupings, official product icons, numbered flow markers, orthogonal layout, no shadows/gradients/3D) and provides a prompt template that holds codex to that style. Skipping it produces decorative or photorealistic output that clashes with the rest of the codelab.

Move generated files into `<content-name>/img/` and reference them with the standard `![...](img/...)` syntax.

## Buttons

To render a styled link button:

```markdown
<button>
  [ボタンラベル](https://example.com/url)
</button>
```

## Links and inline markup

Standard Markdown: `[text](url)`, `**bold**`, `*italic*`. These all render normally.

## Build and verify

```bash
make claat <content-name>/claat.md <content-name>
```

After building, open `<content-name>/index.html` in a browser and check:
- Callout boxes render with color (not plain `>` text)
- Inline `<code>` containing HTML tags shows `&lt;…&gt;`, not raw tags
- Images load (or show the placeholder broken-image icon as expected)
- Step durations appear in the sidebar

If callouts are plain text, the aside keywords may not match — check the keyword list above and `CLAUDE.md`'s `ASIDE_KEYWORDS` dict.
