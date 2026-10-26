---
name: slide-creater
description: Use this skill whenever the user asks to create slides, a slide deck, a presentation, a talk, 発表資料, スライド, or anything that will become a Marp deck in this repository. Explains the project-specific Marp template at `.marp/template.md` — its load-bearing frontmatter / script / style blocks, slide classes (`title` / `lead` / `section` / `split` / `invert`), CSS variables, figure conventions, and Japanese-copy style — so new decks match GDG on Campus University of Osaka's existing decks. Trigger even when the user just says "make slides" or "create a deck" without mentioning Marp; in this repo, slides always mean Marp + this template.
---

# slide-creater

This repo has a custom Marp template at `.marp/template.md` with bespoke CSS in `.marp/gdg.css`. Every new deck starts by copying that template — it already contains a working example of every supported slide class, so you'll match the visual style by editing example slides in place rather than writing slides from scratch. This skill covers the project-specific conventions only; assume the user knows Marp basics.

## Workflow

1. Pick the destination directory (see `CLAUDE.md`'s content layout):
   ```
   <content-name>/slide.md            ← source (you write this)
   <content-name>/slide/index.html    ← built output (committed)
   <content-name>/img/                ← images referenced from slide.md
   ```
2. **Copy `.marp/template.md` to `<content-name>/slide.md`.** Do not write the frontmatter, the `<script>` block, or the `<style>` block from scratch — all three are load-bearing (see "Load-bearing template blocks" below).
3. Replace the example slides with the user's content. The template's example slides demonstrate every supported class — keep the patterns whose layout you need, delete the rest.
4. Build: `make slide <content-name>`
5. PDF (when asked): `npx -p @marp-team/marp-cli@latest marp --theme-set .marp/gdg.css --html <content-name>/slide.md -o <content-name>/slide.pdf`

### Before you write copy — load the references that apply

- **Slide content in Japanese?** Read `references/japanese-style.md`. Claude's default Japanese reads as AI-translated (heavy `。`, 体言止め, 翻訳調); this deck will be projected live to a Japanese audience, so the difference matters.
- **Planning the figure mix, or about to call `gen-image`?** Read `references/figures.md`. It covers how many slides should carry a figure (most should), which form to pick (table → inline HTML → generated image), and the prompt template that keeps generated images on-brand.

Skip a reference if it doesn't apply — there's no value loading the Japanese guide for an English-only deck.

## Slide-count interpretation

When the user says "around N slides" / "N 枚くらい" / "a 3-slide deck", **the title cover and the closing `lead` (Thank you!) count toward N** — they're part of what the audience sees. So "8 スライドくらい" ≈ 1 cover + 6 content + 1 closer.

- Exact counts (no くらい / "around"): match strictly, no implicit Thank-you slide unless asked.
- Fuzzy counts: ±1 is acceptable but prefer hitting the number.

## Load-bearing template blocks (don't rewrite, don't delete)

The first ~50 lines of `template.md` are three blocks the deck relies on:

1. **Frontmatter** — `marp: true`, `theme: gdg`, `paginate: true`, `size: 16:9`. `theme: gdg` registers `.marp/gdg.css`; without it none of the classes below style correctly.
2. **`<script>` block** — PowerPoint-style auto-shrink. Also drives `<div class="fit">…</div>` for explicit opt-in scaling. Wrap blocks that might overflow:
   ```markdown
   <div class="fit">

   - long bullet list
   - that would otherwise overflow

   </div>
   ```
   The `.fit` div **must be a direct child of `section`** — nesting it in another wrapper breaks the height calc and the shrink silently does nothing.
3. **`<style>` block with `--gdg-university`** — drives the colored university name on every title slide. Edit the string for a different chapter (e.g. `'University of Kyoto'`); deleting the block makes the title slide render without the chapter name.

## Slide classes — one-line reference

Apply via `<!-- _class: <name> -->` at the top of a slide (`_class` = this slide only; `class` without underscore cascades to following slides).

| Class                                                         | Use for                                                                                                     |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `title`                                                       | The deck cover. First slide. Big title + subtitle + metadata. Pair with `<!-- _paginate: false -->` so the cover isn't numbered. |
| `title image`                                                 | Cover with a logo/hero image — place a single `![](...)` right after the heading. Also pair with `<!-- _paginate: false -->`.   |
| `lead`                                                        | Centered oversized heading. Use for interior "Welcome" beats, the closing "Thank you!", and quote slides (write the quote as a `>` blockquote on a `lead` slide — no dedicated quote class exists). |
| `section`, `section yellow`, `section green`, `section red`   | Chapter divider with full-bleed background. Yellow uses dark ink (auto-picked). These four are the only documented variants. |
| *(no class)*                                                  | Default heading + body. Markdown lists, paragraphs, tables, and fenced code blocks all work bare.            |
| `split`                                                       | Two-column grid. The `h1`/`h2` spans both columns (it's `grid-column: 1 / -1`); content after it flows into columns in source order. Used for two-column bullets **and** image-with-text (image first → image on left; text first → image on right). Constrain images to column width with `![w:480]`. |
| `invert`                                                      | Light text on a dark background. Combine with `![bg cover](...)` for full-bleed images, or use alone for code-heavy slides.                                              |

For full-bleed images use Marp's `![bg cover](...)` / `bg fit` / `bg left` / `bg right` directives (no class needed for the slide itself; combine with `_class: invert` if captions need light text).

### Inline two-column: `.container` / `.col`

For two columns *below* a heading and intro paragraph (instead of `split`'s heading-spans-both-columns grid), wrap the columns in inline divs on a default slide:

```markdown
# タイトル文字
本文をここに書ける

<div class="container">

<div class="col">

カラム1のコンテンツ

</div>

<div class="col">

カラム2のコンテンツ

</div>

</div>
```

Blank lines around each `<div>` are required so Marp parses the inner markdown. Pick `split` when the heading should sit beside the columns and the two halves are equally weighted; pick `.container`/`.col` when you want a heading + lead-in above the split.

There is no `card`, `quote`, `flow`, or `chart` class — build those with inline HTML using the CSS variables. The template shows working patterns for a flow diagram (flexbox row of rounded rects), a bar chart (inline `<svg>`), and a takeaway card grid (CSS `grid-template-columns`). Match those when you need a similar structure; Mermaid is not wired up, so render Mermaid externally and embed the image.

## CSS variables (use these, not raw hex)

| Variable          | Value     | Typical use                       |
| ----------------- | --------- | --------------------------------- |
| `--gdg-blue`      | `#4285F4` | primary accent, default section   |
| `--gdg-red`       | `#EA4335` | section red, alerts               |
| `--gdg-yellow`    | `#FBBC04` | section yellow, highlights        |
| `--gdg-green`     | `#34A853` | section green, success            |
| `--gdg-ink`       | `#1A1A1A` | dark text (used on yellow bgs)    |

## Reusable assets

- `.marp/assets/gdg_logo.png` — official logo. Either reference as `assets/gdg_logo.png` from `.marp/template.md`'s location, or copy into `<content-name>/img/` and reference as `img/gdg_logo.png` from `<content-name>/slide.md`.
- `.marp/assets/GoogleSans-Variable.ttf` / `GoogleSans-Italic-Variable.ttf` — already loaded by `gdg.css`.

## Things that commonly break decks

- **`title` ≠ `lead`**: the cover uses `title`. `lead` is for *interior* big-text slides (Welcome / quote / Thank you!). Mixing them up gives a wrong-looking cover.
- **`split` heading inside a column**: don't — the heading spans both columns by CSS rule. Put it before the column content, not nested.
- **`split` images overflow**: column width ≈ half the slide. Always use explicit `![w:480]` (or smaller) for images inside `split`.
- **Inventing new `_class` names**: only the classes listed above exist in `gdg.css`. New names need a CSS change.

## Building

```bash
make slide <content-name>
```

This calls Marp CLI with `--theme-set .marp/gdg.css --html`. `--html` is required — the template and most inline patterns contain raw HTML. The generated HTML is **committed** because GitHub Pages serves it directly at `https://gdsc-osaka.github.io/education/<content-name>/slide/`.
