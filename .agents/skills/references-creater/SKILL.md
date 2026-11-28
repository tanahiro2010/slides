---
name: references-creater
description: Use this skill whenever a deck or article in this repository needs its facts gathered and verified before writing — producing `<デッキ>/references.md`. Triggers include 「調べて」「裏取りして」「ファクトチェックして」「ソース集めて」「一次ソース当たって」「references 作って」, or any request to research a topic for a talk or article. Covers where to look for each kind of source (公式ドキュメント / リポジトリ / リリースノート / レジストリ / 登壇資料 / X / 参加レポート / アーカイブ), how to verify a claim by measuring it yourself, and what to do when a source cannot be read. `article-creater` names 一次ソース as one of its three inputs; this skill is what produces it.
---

# references-creater

`article-creater` は「ドラフト / スライド / 一次ソース」の 3 つを入力に取る。
3 つ目の「自分で調べる」を成果物にしたのが `<デッキ>/references.md`。

**記事やスライドを書き始める前にこれを作る。** 書きながら調べると、
調べきれなかったところが無難な文章になって消える。

## 仕様の検証なら、その先がある

このスキルは**ソースを集める**（何が書いてあるか）。
集めた記述が**本当にその通り動くか**を確かめるなら、`verify-claims` に続く。

```
references-creater  何が書いてあるか
       ↓
verify-claims       記述を検証可能な主張に割る → claims.md
       ↓
verify-harness      実際に叩くコードを書く → sandbox/
       ↓
verify-judge        判定・報告・公開判断
```

全部まとめて回すなら `verify-pipeline`（順番とゲートを持つ）。

「ドキュメント通りか」「2つの仕様は何が違うか」が主題のデッキは、この流れに乗せる。

## 置き場所

```
slides/<group>/<名前>/
├── draft.md         素材
├── references.md    ← これを作る
├── slide.md
└── article.md
```

`references.md` は **公開されない作業メモ**。記事と違って、
「ここは読めなかった」「この二次情報しか無い」を書いていい。
むしろ書く。本番の原稿に持ち込まないための記録なので。

## Workflow

1. **主張を先に箇条書きにする。** 何を裏取りすべきかが決まらないと探せない。
   draft.md の断定文を抜き出すのが早い。
2. **1 つの主張に複数のソースを当てる。** 棚は `references/source-playbook.md`。
3. **自分で検証できるものは自分で測る。** これが一番強い（下記）。
4. **埋まらなかったものに印をつける。** 消さない。
5. `references.md` に書き出す。雛形は `references/template.md`。
6. 以下の記事に該当する箇所をfix
  - https://qiita.com/yama3133/items/16907c517a6e745adda1
  

## 原則

### ソースは1つに絞らない

ひとつの資料を「ここに書いていないから無い」の根拠にしない。
**資料に載っていないことと、事実として無いことは別。**

同じ人が別のイベントで、違う切り口で話していることはよくある。
1 本で足りないと思ったら、**時期・イベント・媒体を変えて探す。**

### 一次ソースだけを信仰しない

二次ソース（解説記事、参加レポート、まとめ）から書いていい。
出どころを書いて、誰の観測なのかが分かるようにすればいい。

一次が強いのは事実だが、**一次が取れないことを理由に話を落とす方が損失が大きい。**

### 読めなかったら、検索しまくる

資料が読めない（画像だけ、テキスト抽出が崩れる、ログインが要る）ときに
そこで止めない。**別の入口から同じ内容に辿り着く。**

- イベント名・セッションタイトルで検索する
- 参加者の Qiita / Zenn / はてな / X
- 登壇者が同じ話を別の場でしていないか
- アーカイブ動画、connpass のイベントページ
- `web.archive.org`

詳しい手は `references/source-playbook.md` の「読めないときの迂回路」。

### 自分で測れるものは、測るのが最強

二次ソースで読んだ数字を、**自分で再現できる形に落とす**と一次ソースになる。

- 「パッケージが小さくなった」→ npm registry の `unpackedSize` / `fileCount` を引く
- 「依存を減らした」→ `dependencies` を引く（**ゼロだったら前提が崩れる**）
- 「API が変わった」→ 両バージョンを入れて同じコードを流す
- 「速くなった」→ 測る。ラウンド数も記録する

実測は `references.md` に**コマンドごと**残す。あとで記事に貼れる。

## よくある失敗

- **1 本の資料で結論を出す** — 「あのスライドに無いから無い」は成り立たない。
- **読めなかった資料を諦めて、話ごと落とす** — 迂回路を全部試してから判断する。
- **二次ソースだから使わない** — 出どころを書けば使える。
- **二次ソースの数字をそのまま信じる** — 引けるものは自分で引く。
  今日の例: 「アダプタ分離で依存を減らした」→ 実際は v4 から依存ゼロだった。
- **検証の過程を本番原稿に持ち込む** — 「抽出が崩れて読めなかった」は
  `references.md` に書くもので、`article.md` には書かない。
- **調べる前に書き始める** — 埋まらなかった箇所が無難な一般論になる。
