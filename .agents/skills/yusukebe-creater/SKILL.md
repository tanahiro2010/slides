---
name: yusukebe-slide-generator
description: Generate presentation slides in Yusuke Wada (yusukebe)'s signature presentation style (ippon Markdown) from text drafts, outlines, or notes. Use when the user requests slide decks in yusukebe style, tech conference talk slides, keynote decks, or developer-focused presentation outlines — and always for any `slide.md` under `slides/slides/` in this repository, since that directory is built with `ippon-slides` regardless of frontmatter (see "Scope" below). Do NOT use for `slides/speakerdeck/` — that directory builds as Marp via the `slide-creater` skill.
---

# yusukebe Style Slide Generator

## Scope: `slides/slides/` only

The build pipeline (`apps/slides/scripts/build.js`) picks the renderer **by folder, not by frontmatter**: every deck under `slides/slides/` is built with `ippon-slides`, every deck under `slides/speakerdeck/` is built with `marp` — unconditionally. A `slides/slides/` deck's frontmatter does not need (and should not set) `marp: true`; it is ignored by the build and just leaves confusing dead text in the source.

So: if the deck you're about to write lives in `slides/slides/`, this is the right skill regardless of the talk's length or register (LT or long-form, technical verification or opinion piece — the draft-creater skill's 検証系/LT系 split is about `draft.md` shape, not slide renderer). If it lives in `slides/speakerdeck/`, use `slide-creater` (Marp) instead.

Before building, confirm the `ippon-slides` git submodule is checked out and built (`git submodule update --init ippon-slides`, then `npm install && npm run build` inside it if `ippon-slides/assets/deck.js` is missing) — otherwise `ippon build` fails with `ENOENT ... assets/deck.js`.

`references/` に **slides.yusu.ke で公開されている本物のスライド 5 本**（計 342 枚）を
ippon Markdown に戻したものが入っている。このスキルの中身は全部そこから測った数字でできている。

**このスキルの唯一のルール: 自分の感覚で書かない。references を読んでから、references に寄せて書く。**

---

## STEP 0（省略禁止）— 書き始める前に references を読む

1 行も書く前に、**必ず**次を実行する。

```sh
cd .claude/skills/yusukebe-creater/references
cat README.md
```

そのうえで、**今回のデッキに近いものを最低 2 本、全文読む**（部分読みではなく全文）。

| 今回つくるもの | 全文読むデッキ |
|---|---|
| LT・勉強会（15〜20分 / 20〜35枚） | `agents-sdk.md` ＋ `cf-demos.md` |
| ネタ寄りのショート LT | `jev-router.md` ＋ `cf-demos.md` |
| カンファレンス基調・長尺（40枚〜） | `honoconf-2026.md` ＋ `web-frameworks-in-the-ai-era.md` |
| 判断がつかない | `cf-demos.md` ＋ `honoconf-2026.md` |

読んだあと、**書き出す前に次の 3 つを宣言する**（ユーザーに短く伝える）:

- 読んだデッキ 2 本の名前
- 選んだ型（LT 型 / 基調型）と、その根拠になった枚数・構成
- 今回のデッキの目標枚数

この宣言ができないなら、まだ読めていない。戻って読む。

---

## 実測値 — references 5 本の数字

これが「yusukebe スタイル」の定義。感覚ではなくこの表に合わせる。

| | honoconf-2026 | web-frameworks | agents-sdk | cf-demos | jev-router |
|---|---:|---:|---:|---:|---:|
| 枚数 | 101 | 155 | 34 | 32 | 20 |
| `::center::` 系 | 38% | 61% | **0%** | **0%** | 15% |
| 章扉 | 11 | 17 | **0** | **0** | **0** |
| `## 見出し` | 58% | 36% | 85% | 90% | 65% |
| 本文 1 行以下 | 33% | 58% | 8% | 31% | 10% |
| 本文行数の中央値 | 3 | 1 | 4 | 3.5 | 5 |
| 箇条書きの中央値 | 3 個 | 3 個 | 3 個 | 2 個 | 3 個 |
| コード | 13% | 5% | 17% | 21% | **50%** |
| 画像 | 15% | 14% | 20% | 25% | 10% |
| `-#` 注釈 | 11% | 0.6% | **0** | **0** | 5% |
| `**太字**` | 23 箇所 | 22 箇所 | **0** | 1 箇所 | **0** |
| 絵文字 | 2 箇所（`✗`） | 4 箇所 | **0** | **0** | **0** |
| 表（table） | **0** | **0** | **0** | **0** | **0** |
| `::note::` | **0** | **0** | **0** | **0** | **0** |
| `!!` 強調行 | **0** | **0** | **0** | **0** | **0** |

読み取れること:

- **`::center::` の連打と章扉は「長尺デッキだけ」の道具。** 34 枚以下の 3 本には章扉が 1 枚も無い。
  LT に章扉を入れた時点で別人のスライドになる。
- **箇条書きは 3 個。** 5 個を超えたら切る。
- **太字と絵文字は基調講演の装飾。** LT 3 本は太字ゼロ・絵文字ゼロで成立している。
- **表は 342 枚で 0 枚。** 数字を並べたいなら箇条書きか `→` を使う。

---

## 型を選ぶ

### LT 型（20〜35枚 / `agents-sdk.md` `cf-demos.md` `jev-router.md`）

```
# タイトル（または ::title:: ＋ # タイトル）
  Yusuke Wada / イベント名
↓
## 自己紹介      ← 箇条書き 2 行 ＋ ::right:: で顔写真
↓
## アジェンダ（or 今日話すこと）   ← 2〜3 行。あとで「まとめ」で回収する
↓
## 見出し ＋ 箇条書き 3 個   ← これをひたすら繰り返す
  間に ## 見出し ＋ コード / ## 見出し ＋ 画像（::wide:: or ::right::）
↓
## デモ
↓
## まとめ        ← アジェンダとほぼ同じ項目を並べ直す
↓
リンク（GitHub / Playground）
```

- **章扉を入れない。`::center::` の 1 行スライドも基本入れない。**
  （`jev-router.md` が 3 枚だけ使っているのがネタとしての上限）
- 見出しは `##` のみ。`###` は 342 枚で 1 回も出てこない。
- 引用は `> ` ＋ 空行 ＋ `> URL`（`agents-sdk.md` の定義スライド）。
- まとめはアジェンダの回収。新しいことを言わない。

### 基調型（40枚〜 / `honoconf-2026.md` `web-frameworks-in-the-ai-era.md`）

```
::title:: 表紙
↓
::center size=1.5 bg=white:: ＋ 一語（時代 / 開発 / 設計 / まとめ）
↓
::center:: の 1 行スライドを 2〜5 枚連打して問いを置く
↓
## 見出し ＋ 箇条書き 3 個（数字は → で before → after）
  -# で出典を落とす
  ::right:: or ::wide:: で図
↓
（章扉に戻って繰り返す）
↓
## まとめ        ← 章扉の語を左に並べて回収する
  例: 「- 時代 → 明らかに新しい時代になった」
↓
::center size=1.5:: ありがとうございました
↓
::center bg=white:: One more thing   ← 任意
```

- 章扉の語は **一語**（`時代` `開発` `ユーザー` `DX` `設計` `Demo`）。文にしない。
- `::center::` の 1 行スライドは惜しまない。`web-frameworks` は 58% が本文 1 行。

---

## 全デッキ共通の固定パーツ

**自己紹介スライドは 5 本中 4 本が完全に同じ形。**

```markdown
## Yusuke Wada

- Cloudflare Senior Developer Advocate
- Creator of Hono

::right::

![me](https://ss.yusukebe.com/d0630d477f3a3a3eb97f2711dcac50cef18715c73da36879f8da6bb904578ed8.png)
```

**表紙の 2 パターン**（どちらでもよい。`agents-sdk` と `cf-demos` は `::title::` 無し）

```markdown
::title::

# タイトル

Yusuke Wada

イベント名 ・ October 11, 2026
```

```markdown
# タイトル

Yusuke Wada

イベント名
```

---

## 記法（ippon）

このリポジトリは **ippon**（`ippon-slides`）でコンパイルする。Marp ではない。

frontmatter は `title` / `description` / `author`（＋任意で `date` / `slug`）。
`---` で 1 枚ずつ区切る。指示はスライド先頭行にまとめる。

| 記法 | 実デッキでの使われ方 |
|---|---|
| `::title::` | 表紙。5 本中 3 本で使用（無くてもよい） |
| `::center::` | 1 行スライド。**86 回**。長尺デッキの主役 |
| `::center size=1.5 bg=white::` | 章扉。**15 回**。長尺デッキのみ |
| `::center bg=blue::` | 強いひとこと。11 回。`#ca8a04` / `orange` / `white` も実例あり |
| `::right::` | 見出し＋箇条書きの右に顔写真・スクショ・図。**22 回** |
| `::wide::` | **`## 見出し` ＋ 大きい図/スクショ 1 枚**のときだけ。20 回 |
| `-# 注釈` | 出典 URL・補足。本文に混ぜない。実質 honoconf 専用（14 回） |
| ` ```ts ` ` ```sh ` ` ```bash ` ` ```console ` | コード。言語は必ず指定 |
| `→` | before → after。**148 回**。`=>` も 41 回（箇条書き内の言い換え） |

`bg=` に使える色: `blue` / `orange` / `purple` / `red` / `green` / `black` / `white` / `#rrggbb`。

### ippon にはあるが yusukebe は使っていないもの

| 機能 | 実測 | 扱い |
|---|---|---|
| `::note::` 発表者ノート | 342 枚で **0** | **このリポジトリでは全スライドに付ける。** 書き方は references ではなく下の「発表者ノート」節（既存の `slides/slides/` デッキ）に合わせる |
| `!!` 行頭ハイライト | **0** | 使わない |
| Markdown の表 | **0** | 使わない。箇条書きか `→` に置き換える |
| `::qr url=...::`（`caption` で URL も表示） | 新機能（v0.1.10〜） | 宣伝・リンク紹介スライドで使う。`::right center::` の右カラムに置くと収まりがいい |
| `::right center::` | 新機能（v0.1.10〜） | 右カラムを上下中央揃え。左が長く右が画像/QR だけのときに使う |

`::qr::` / `::right center::` はサブモジュールが古いとただの段落になる。効かないときは `ippon-slides` を `origin/main` に上げて `npm run build` し直す。

---

## やらないことリスト

**`➔` を使わない。** 実デッキは `→` のみ（148 回）。`➔` は 0 回。

**表を書かない。** 342 枚で 0 枚。before/after は箇条書きで `- 成功率 → 40% → 100%`。

**絵文字を散らさない。** 342 枚で 6 箇所（`✗`×2 / `😊`×2 / `😱` / `🙇`）。
LT 3 本は完全にゼロ。「絵文字で感情を出す」は様式ではない。

**LT に章扉と `::center::` 連打を入れない。** `agents-sdk` `cf-demos` は両方 0 枚。

**太字を乱用しない。** LT 3 本は太字ゼロ。長尺でも 1 デッキ 20 箇所前後＝ 5 枚に 1 回。

**`水を飲む` のスライドを入れない。** `web-frameworks-in-the-ai-era.md`（2026-09-12）に
しか無い。あれは **yusukebe さんが喉を痛めていた回の事情**で、様式ではない。
同じ理由で開幕の「喉がやられて声が出ない😱」も真似しない。
人間味のあるつかみは「その日その人に実際に起きていること」から書く。過去の資料から借りない。

**1 本のデッキにしか出てこない要素は、様式ではなく事情を疑う。**
複数のデッキに共通するものだけを様式として扱う。

**中央に小さいアイテムをポツンと置かない。** `::center::` にコードブロックを 1 行だけ置くと
豆粒になる。`size=1.5`〜`3` に上げるか、文字で書く。

**スライド番号のフッターを書かない**（ippon が自動で出す）。

---

## トーン

references の日本語をそのまま参考にする。作文しない。

- 口語で短い: `マジで` / `〜してみよう！` / `わかったこと` / `いい感じ` / `つらい時` / `敗因`
- 自問の見出し: `なぜ？` / `どうする？` / `そもそも何か？` / `何が変わった？？`
- 1 枚 1 メッセージ。段落を書かない。
- 数字は裸で出す: `2025年10月 → 1,110万 / 月`、`hono → 30.8倍`

### スライド本文は「です・ます」を使わない

一番ズレやすいところ。LT 3 本の本文に「です・ます」はほぼ出てこない。
**しゃべり言葉の丁寧な台詞をスライドに書くと、別人のスライドになる。**

| 書かない | 書く | 実例 |
|---|---|---|
| `本当に健康なことなんでしょうか？` | `それ、本当に健康？` | `動かす？` `どうするか？` |
| `望ましいかもしれません` | `望ましいかも` | `使えるかも`（jev-router） |
| `〜という意味があります` | `→ 面倒を減らすための工夫` | `JevRouter => 意味でルーティングするHonoのルーター` |
| `肩代わりするわけではありません` | `肩代わりするわけじゃない` | `そのまま渡せない`（cf-demos） |
| `……失礼しました` | `……はい` | `Jev!!` |

- 語尾は辞書形（〜する / 〜した / 〜している）か体言止め
- 疑問は `です・ますか` を付けず、裸の `？` で終える
- 丁寧な台詞・言い回しは **`::note::` に移す**。スライドには骨だけ残す
- 例外は**演技としての台詞**（`皆さん、怠惰ですかァ？` のような芝居がかった引用）。
  jev-router の `「AIエージェントからのリクエストだよ」` と同じく、カギ括弧や芝居の中なら口調はそのまま

---

## 発表者ノート（`::note::`）

references（yusukebe さん）には 1 枚も無い。**このリポジトリの既存デッキに合わせる。**

手本: `slides/slides/Terraformで素数をマイニングしたら、ブロックチェーンが生まれた/`、
`slides/slides/Honov5 RCを触ってみる/`、`slides/slides/コミュニティ活動のすゝめ/`。

**`slides/slides/優雅になりたい/` は悪い例。** `- [10秒]` の下に要点を箇条書きにする形は真似しない。

### 形

```markdown
## その怠惰、マジで健康？

- 記憶を外部に頼ることで、人間の能力はどう変わるのか
- …

::note::

……でも、これって本当にいいことなんでしょうか。

覚えなくてよくなる。それは楽かもしれません。でも、便利になることと、健康になることって、同じなんでしょうか？

> ▶ **ここで反転。** 声を少し落とす。
```

- **1 段落目以降: 実際にしゃべる台詞をそのまま文章で。** です・ます調でよい（スライド本文と逆）
- **空行のあとに演出指示。読まない部分は `> ▶ ` で始める。** 発表者ビューでは `-#` のスタイルが効かない（ノートは `.slide` の外に描画される）が、`> ` は引用として字下げされるので、台詞と一目で分かれる。1 段落ごとに `> ▶ ` を付ける
- 演出指示の要所だけ太字: `> ▶ **15 秒で切る。**` `> ▶ **一拍。**` `> ▶ **聞かれたら:** …`
- 質疑の備えは `**聞かれたら:**` で書く
- **1 枚目のノートに全体の枚数・想定時間・巻くときに削る順番を書く**
  （例: `全 98 枚・想定 12 分。巻くなら ①… → ②… の順で落とす。`）
- 全スライドに付ける。`::right::` のあるスライドは画像の**後ろ**に置く
- ノートの太字はスライドの太字に数えない（下のセルフチェックは本文だけを数える）

---

## ワークフロー

1. **references を読む**（STEP 0。省略禁止）。読んだ 2 本と選んだ型を宣言する。
2. **ドラフトを分解**: 課題 / 数字 / 技術的な中身 / うまくいかなかったこと / 結論。
3. **型に流し込む**: LT 型なら見出し＋箇条書き 3 個の反復、基調型なら章扉＋1 行スライド。
4. **実測値に合わせる**: 箇条書き 3 個、本文行数の中央値 3 行前後、表ゼロ、絵文字ゼロ基調。
5. **`slide.md` に書き出す**（ippon Markdown）。
6. **全スライドに `::note::` を書く**（上の「発表者ノート」）。丁寧な台詞はここへ。
7. **セルフチェック**（下記）。
8. **ビルド**: `node ippon-slides/bin/ippon.js build <dir>/slide.md --html` が通ることを確認。

---

## セルフチェック（書き終わったら必ず走らせる）

```sh
f=<dir>/slide.md
b=$(mktemp)   # ノートを除いたスライド本文
awk '/^::note::/{n=1} /^---$/{n=0} !n' "$f" > "$b"
echo "枚数:        $(( $(grep -c '^---$' "$f") - 1 ))"   # frontmatter の分を引く
echo "ノート:      $(grep -c '^::note::' "$f")（枚数と同じはず）"
echo "表(0のはず):  $(grep -c '^|' "$b")"
echo "!!(0のはず):  $(grep -c '^!!' "$b")"
echo "➔(0のはず):   $(grep -c '➔' "$b")"
echo "###(0のはず): $(grep -c '^### ' "$b")"
echo "太字:        $(grep -o '\*\*[^*]*\*\*' "$b" | wc -l)"
echo "::center:    $(grep -c '^::center' "$b")"
echo "章扉:        $(grep -c '^::center size=1\.5' "$b")"
echo "箇条書き最大: $(awk 'BEGIN{RS="\n---\n"}{n=gsub(/\n- /,"");if(n>m)m=n}END{print m}' "$b")"
echo "です・ます（本文。芝居の台詞以外は0のはず）:"
grep -nE '(です|ます|でしょう|ません)(か|ね|よ)?[ァ-ン]?[？?。]?$' "$b"
rm -f "$b"
```

| 項目 | LT 型（20〜35枚） | 基調型（40枚〜） |
|---|---|---|
| 表 / `!!` / `➔` / `###` | 0 | 0 |
| `::center` | 0〜3 | 全体の 35〜60% |
| 章扉 | 0 | 10 枚ごとに 1 枚程度 |
| 太字 | 0〜2 箇所 | 5 枚に 1 箇所まで |
| 絵文字 | 0 | 全体で 5 箇所まで |
| 箇条書き最大 | 5 個まで | 6 個まで |
| ノート | 全スライド | 全スライド |
| 本文のです・ます | 芝居の台詞だけ | 芝居の台詞だけ |

**1 つでも外れたら、該当の reference デッキを開き直して直す。**
（枚数・`::center` の目安は、ユーザーが「気にしなくていい」と言ったら外してよい）

---

## 出力例

作例は書かない。**`references/` の実物がそのまま手本**。

- LT を書くなら `references/cf-demos.md` の 32 枚をそのまま構成の雛形にする
- 基調を書くなら `references/honoconf-2026.md` の章扉の置き方と `## まとめ` での回収を見る
- コード中心の LT なら `references/jev-router.md`（50% がコードスライド）

近いデッキを開いて、その枚数・その情報量・その日本語に寄せる。それがこのスキルの全部。
