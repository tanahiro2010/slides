---
name: ippon-slides
description: ippon（ippon-slides）の Markdown スライドを編集する。ユーザーが ippon serve でプレビュー中に「ここ直して」「このスライド」「選択したところ」「今のページ」のように、ブラウザで表示・選択している箇所を指して修正を頼んだときは、必ず最初にこのスキルで表示中のスライドと選択中の文字列を取得する。
---

# ippon serve で表示中のスライドを直す

ユーザーは `ippon serve slide.md` でスライドをブラウザに表示しながら書いている。
ブラウザで**いま表示しているスライド**と、デッキ上で**選択している文字列**を取得できる。

## 手順

1. 次を実行する（`ippon` コマンドが無ければ `npx -y ippon-slides current`）。

   ```sh
   ippon current
   ```

   複数のデッキを serve している場合は `ippon current talk.md` のように Markdown を指定する。
   次のような JSON が返る。

   ```json
   {
     "file": "/abs/path/slide.md",
     "slide": 3,
     "total": 12,
     "lines": { "start": 21, "end": 30 },
     "source": "## 3 枚目\n\n- 選択された行\n...",
     "selection": "選択された行"
   }
   ```

   - `file`: 編集する Markdown
   - `slide` / `total`: 表示中のスライド番号（1 始まり）と枚数
   - `lines`: そのスライドの `file` 上の行範囲（1 始まり・両端を含む）
   - `source`: そのスライドの Markdown（`::note::` 以降は発表者ノート）
   - `selection`: ブラウザで選択中の文字列（無ければ `""`）

2. `selection` があれば、それがユーザーの言う「ここ」。`source` の中から該当箇所を探す。
   表示された文字列なので、Markdown 側では `**太字**` や `` `コード` ``、リンクの記法が付いていることがある。
   `selection` が空なら、スライド全体（`lines` の範囲）が対象。

3. `file` の `lines.start`〜`lines.end` の範囲を編集する。頼まれていない他のスライドは変えない。

4. 保存すると、開いているデッキは自動で再読み込みされ、同じスライドに戻る。
   ユーザーにブラウザで確かめてもらう。

## 取得できないとき

- `ippon serve が見つかりません`: ユーザーに `ippon serve slide.md` を起動してもらう。
- `デッキがまだ開かれていません`: ippon serve が表示した「この PC で開く」の URL をブラウザで開いてもらう。

## ippon の記法（抜粋）

- `---` だけの行でスライドを区切る（コードフェンス内は除く）。1 枚に 1 メッセージが基本。
- スライドの 1 行目の `::center::` / `::title::` / `::wide::` / `::bg=blue::` / `::size=1.5::` で見せ方を指定する（`::center bg=blue size=2::` のようにまとめて書ける）。
- `::right::` の行から右カラム（`left-wide` / `right-wide` で幅、`center` で上下中央揃え）。
- `::note::` 以降は発表者ノート（スライドには出ない）。
- `-# ` で始まる段落は小さい注釈。コードの行頭の `!! ` はその行を強調する。
- `::qr url=...::` で QR コード、`::http method=GET url=...::` で HTTP リクエストのプレイグラウンド。
