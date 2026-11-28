---
name: figures
description: Visual language for architecture diagrams, concept illustrations, and flow charts in codelab figures — distilled from official Google codelab figures (ADK multi-agent architecture, agent hierarchy tree, Flutter widget concepts). Plus the gen-image prompt template that keeps generated figures on-brand. Read when planning figures for a codelab or before calling gen-image.
---

# Codelab figures — design language

Architecture diagrams, concept diagrams, and flow charts across official Google codelabs share a tight visual language. Match it so generated figures slot in next to product screenshots without looking foreign.

## When to use which figure form

Codelabs lean on three figure types. Pick by purpose:

| Purpose                              | Form                          | Example                                              |
|--------------------------------------|-------------------------------|------------------------------------------------------|
| Show *what to click* in real software | Screenshot                    | "Click **Create project**" with the dialog visible   |
| Show *how the system fits together*   | Architecture diagram          | Cloud services + arrows + flow markers               |
| Show *a concept's shape*              | Concept illustration          | Column / Row / Box layout primitives                 |
| Show *who does what, when*            | Flow chart / sequence diagram | Numbered steps across a system                       |
| Show *parent → child structure*       | Tree / hierarchy diagram      | Agent → sub-agents → tools                           |
| Show *before → after*                 | Two-panel comparison          | Old layout vs. new layout                            |

Screenshots stay screenshots (just crop and annotate). The other five use the visual language below and are well-suited to `/gen-image`.

## The visual language (8 rules)

### 1. Background

- **Pure white** by default, or a very pale neutral gray (`#F5F5F5`-ish) for concept illustrations
- No textures, no decorative borders, no gradient fills

### 2. Shapes

- **Rounded rectangles** for components — corner radius ~8px, consistent across the figure
- **Dashed-border rounded rectangles** for *logical/conceptual* groupings (regions, scopes, sub-systems)
- **Solid-border rounded rectangles** for actual deployable components or files
- Orthogonal layout only — boxes align on a grid, arrows go horizontal or vertical (not diagonal)

### 3. Color — sparingly, as accents

Use the Google brand palette: blue `#4285F4`, green `#34A853`, red `#EA4335`, yellow `#FBBC04`.

- **Pastel/light tints** (≈20% saturation) for box fills, region backgrounds, and grouping tints
  - e.g. light blue `#E3F2FD` for component cards, light green for an "Agents" region
- **Full saturation** only for accent dots, numbered flow markers, or a single highlighted element
- **Borders and arrows stay dark gray or near-black** — never colored
- **Text stays black or near-black** — never colored. Color carries meaning through fills, not text

### 4. Typography

- Sans-serif throughout (Google Sans-like). Never serif, never mixed font families
- **Bold** for the primary component name; regular weight for a one-line descriptor underneath
- **Monospace font** for code-like identifiers — function names, tool names, file paths, env vars
- All text black or near-black

Example label structure inside a component card:

```
Frontend                       ← bold, primary name
Cloud Run service              ← regular, descriptor
```

Or with a tool reference:

```
checker_agent_instance         ← bold
Purpose: Checks termination.   ← regular descriptor
Tool: check_tool_condition     ← monospace
```

### 5. Icons

- **Official Google product icons** for any Google product referenced by name — Cloud Run, Vertex AI, GKE, Gemini, Firebase, Model Armor, ADK. Place icon to the left of the label, vertically centered
- **Google Material icons** for generic concepts — database, file, API, settings
- **Silhouette/people icons** for external actors at the figure boundaries — "Application users", "AI developers", "Platform administrators"
- Never use 3D or photographic icons

### 6. Flow markers (for sequenced flows)

- Numbered steps shown as small **filled colored circles** containing the digit — `①②③`
- Color is usually green `#34A853` for "this is the happy path"
- Place each marker at the start of the arrow segment it labels, optionally with a short text label next to it ("Prompt", "Subagent invocation")
- Keep markers small but legible

### 7. Grouping & hierarchy

- Nested regions are OK and common — e.g. **Google Cloud** (blue tinted outer) → **Region** (no fill) → **Agents** (green tinted inner) → **Sequence / Iterative refinement** (dashed inner)
- Each grouping uses a tinted fill *and* a thin border (solid for concrete, dashed for conceptual)
- The grouping label sits at the **top-left** of the region, outside or on the border

### 8. Stylistic do-nots

- ❌ No shadows, no gradients, no 3D, no skeuomorphism
- ❌ No diagonal arrows when orthogonal will do
- ❌ No colored text or colored borders
- ❌ No mixed font families
- ❌ No watermarks, decorative logos, or stray text
- ❌ No photographic / watercolor / hand-drawn styles

## Generating figures with `/gen-image`

`/gen-image` (codex) defaults toward decorative / photographic outputs unless held to a flat-infographic style. Spell out the constraints every time.

### Prompt template (English — codex is more stable in English)

```
A [diagram type: architecture diagram / hierarchy tree / flow chart /
concept illustration / Before-After comparison] illustrating [topic
in one sentence].

Language: [Japanese / English]   ← every label inside the figure

Elements (left to right / top to bottom):
- [element 1: label + role + icon if any]
- [element 2: label + role + icon if any]
- [element 3: label + role + icon if any]

Relationships: [arrow from X to Y / X contains Y / X groups Y and Z / ...]

Groupings: [Region "Google Cloud" contains A, B; dashed sub-region
"Agents" contains C, D. Use tinted fills with thin borders — solid
for concrete components, dashed for logical groupings.]

Flow markers (if sequenced): numbered green circles ①②③ at the start
of each arrow.

Layout: [horizontal flow / vertical tree / 2x2 / radial]. Orthogonal
arrows only — no diagonals.

Style: flat, clean, modern infographic on a pure white background.
Rounded rectangles (~8px radius), thin dark gray borders, sans-serif
Google Sans-like typography in black. Bold for primary names, regular
for descriptors, monospace for code identifiers. Pastel/light tints
of the Google brand palette (blue #4285F4, red #EA4335, yellow #FBBC04,
green #34A853) for fills; full saturation only for accent markers.
No shadows, no gradients, no 3D.

Icons: use official Google product icons for any Google product
referenced by name (Cloud Run, Vertex AI, Gemini, Firebase, etc.);
Material icons for generic concepts (database, API, file); silhouette
people icons for external actors.

Aspect ratio: 16:9 unless the layout calls for square or portrait.
All labels in the Language specified above. No logos beyond product
icons, no watermark, no extra decorative text.
```

### Worked example — agent hierarchy tree (English labels)

> Generate a vertical hierarchy tree diagram of an agent system.
> Language: English (all labels in English).
> Root (top): rounded rectangle with light gray fill, bold label `image_scoring`, regular descriptor `(Main Agent)`.
> Level 2 (two children of root): light blue pastel rounded rectangles.
>  - Left child: bold `image_generation_scoring_agent`.
>  - Right child: bold `checker_agent_instance`, regular `Purpose: Checks termination condition.`, monospace `Tool: check_tool_condition`.
> Level 3 (three children of the left Level-2 node): light blue rectangles, each with bold name, regular `Purpose:` line, and monospace `Tool:` (or `Tools:`) line.
> Connections: thin black orthogonal arrows from each parent to each child.
> Background: pure white. No shadows, no gradients, no logos.
> Aspect ratio: 16:9.

### Worked example — Cloud architecture diagram (Japanese labels)

> Generate a horizontal Cloud architecture diagram for a Japanese-language codelab.
> Language: 日本語 (図中のすべてのラベルは日本語).
> Outer region: blue tinted rectangle labeled `Google Cloud` at the top-left.
> Inner region: green tinted dashed rectangle labeled `エージェント` containing three rounded white rectangles (`コーディネータ`, `タスク A`, `タスク B`), thin dark gray borders.
> Left edge: silhouette person icon labeled `アプリ利用者`. Arrow flows right.
> Numbered flow markers: green filled circles `①②③` along the arrows in sequence.
> Inside each component card: bold name + regular descriptor `Cloud Run サービス`. Use official Cloud Run icon to the left of the label.
> Background: pure white. No shadows, no gradients.
> Aspect ratio: 16:9.

## Operational notes

- `/gen-image` writes to `./images/` under the current working directory. After generation, move the file into `<content-name>/img/` (`mv ./images/foo.png <content-name>/img/`) and reference it from `claat.md` with the standard `![...](img/...)` syntax.
- One `codex exec` call produces exactly one file. For variations, call multiple times with different filenames.
- If the result has stray logos or unintended text, add a stronger `no logos, no watermark, no extra text` clause and regenerate. If it still leaks, drop one or two elements — fewer elements come back cleaner.
- If the result looks photorealistic, decorative, or has shadows/gradients, re-emphasize `flat, clean, modern infographic` and explicitly say `no shadows, no gradients, no 3D, no photorealism`.
