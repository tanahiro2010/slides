summary: ユーティリティファースト CSS フレームワーク Tailwind CSS の基礎を、HTML だけでプロフィールカードを作りながら学ぶ 60 分のハンズオン。
id: tailwind-css-basics-workshop
categories: Web
environments: Web
status: Published
feedback link: https://github.com/gdsc-osaka/education/issues
author: GDG on Campus University of Osaka

# Tailwind CSS 入門ハンズオン

## はじめに
Duration: 0:03:00

このコードラボでは、ユーティリティファースト CSS フレームワーク **Tailwind CSS** の基礎を、1 枚の HTML ファイルだけでプロフィールカードを作りながら学びます。`style.css` を 1 行も書かず、HTML の `class` 属性だけでレイアウト・色・レスポンシブ対応・ホバー効果まで実装します。

![完成したプロフィールカードのスクリーンショット](img/step1-final-result.png)
<!-- TODO: screenshot — 完成したプロフィールカード。アバター画像、名前、肩書き、フォローボタン。デスクトップでは横並び、モバイルでは縦並びになる比較スクリーンショット -->

### このコードラボで作るもの

1 枚の HTML ファイルだけで動くプロフィールカードを作ります。アバター画像・名前・肩書き・自己紹介・フォローボタンを含み、スマートフォンでは縦並び、PC では横並びに自動で切り替わります。ホバーするとボタンの色が変わり、ボタンを押した瞬間（フォーカス時）にはアウトラインが表示されます。

### このコードラボで学ぶこと

* Tailwind CSS の「ユーティリティファースト」という考え方を理解する
* Play CDN を使って Tailwind を 30 秒で導入する方法
* `flex` / `gap` / `items-center` などのレイアウトユーティリティの使い方
* `p-4` `text-lg` `bg-blue-500` などの数字スケールの読み方
* `sm:` `md:` `lg:` プレフィックスでレスポンシブデザインを書く方法
* `hover:` `focus:` プレフィックスで状態に応じたスタイルを当てる方法

### 必要なもの

* テキストエディタ（VSCode 推奨）
* Google Chrome などのモダンブラウザ
* インターネット接続（Play CDN を使うため）
* HTML と CSS の基本的な知識（`class` 属性、`padding` `margin` `flex` などの単語を聞いたことがあるレベル）

### 前提知識

* HTML タグ（`<div>` `<h1>` `<img>` `<button>` など）の基本的な理解
* CSS の `padding` `margin` `font-size` `color` などのプロパティを書いたことがある

### このコードラボで扱わないこと

* Tailwind の本番ビルド（`npx tailwindcss` での CLI ビルドや PostCSS 連携）。本格運用するなら [公式インストールガイド](https://tailwindcss.com/docs/installation) を参照してください。
* `tailwind.config.js` でのカスタムテーマ拡張。
* React / Vue / Next.js などのフレームワークとの組み合わせ。今回は素の HTML のみを扱います。
* ダークモード対応（`dark:` プレフィックス）。

## セットアップ
Duration: 0:05:00

このステップでは作業フォルダと最小限の HTML ファイルを 1 つ作り、Tailwind CSS を Play CDN で読み込みます。ビルドツールも `npm` も不要です。

### 作業フォルダを作る

任意の場所に `tailwind-workshop` フォルダを作り、VSCode で開きます。ターミナルから作る場合は次のコマンドを実行します。

```bash
mkdir tailwind-workshop
cd tailwind-workshop
code .
```

`code .` が動かない場合は、VSCode の「ファイル」→「フォルダーを開く」から手動で開いても構いません。

### `index.html` を作成する

VSCode のサイドバーで `tailwind-workshop` フォルダ内に `index.html` という新規ファイルを作成し、以下の内容を貼り付けます。

```html
<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tailwind ハンズオン</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <h1>Hello, Tailwind!</h1>
  </body>
</html>
```

`<script src="https://cdn.tailwindcss.com"></script>` が Tailwind CSS の Play CDN です。この 1 行を読み込むだけで、`class="text-blue-500"` のようなユーティリティクラスがすべて使えるようになります。

> **Note:** Play CDN は学習・プロトタイピング専用です。本番サイトでは公式ガイドにある CLI ビルドや PostCSS プラグインを使ってください。

### ブラウザで開いて確認する

`index.html` をダブルクリックするか、VSCode の Live Server などで開きます。画面に「Hello, Tailwind!」と表示されれば成功です。

**期待される表示:**

ブラウザのタブに「Tailwind ハンズオン」、画面左上に「Hello, Tailwind!」が表示されます。

> **Troubleshooting:** 何も表示されない、またはスタイルが当たらない場合は次を確認してください。
> - ブラウザの DevTools（F12）の Network タブで `cdn.tailwindcss.com` が 200 OK で返っているか
> - `<script>` タグが `<head>` 内にあるか（`<body>` に書くとクラスが反映されないことがあります）
> - インターネットに接続されているか

## ユーティリティファースト CSS とは
Duration: 0:07:00

Tailwind CSS を書き始める前に、なぜ「クラス名だらけ」になるのかを 5 分だけ理解しておきましょう。これを押さえると残りのステップが一気に楽になります。

### 従来の CSS との違い

普段の CSS では、HTML 側に意味のあるクラス名（`.profile-card` など）を付け、`.profile-card { padding: 16px; ... }` のように **CSS ファイル側で見た目を定義** します。

Tailwind では発想を逆転させ、「`padding: 16px;` を意味する `p-4` というクラス」「`font-size: 1.125rem;` を意味する `text-lg` というクラス」をあらかじめ用意しておき、**HTML の `class` 属性に組み合わせて書く** だけで完結させます。これを **ユーティリティファースト（utility-first）** と呼びます。

### 最初のユーティリティを書いてみる

`index.html` の `<body>` を以下のように書き換えてください。

```html
<body class="bg-gray-100 p-8">
  <h1 class="text-3xl font-bold text-blue-600">Hello, Tailwind!</h1>
  <p class="mt-2 text-gray-700">ユーティリティクラスだけでスタイルを当てます。</p>
</body>
```

ブラウザをリロードすると、背景がうっすら灰色、見出しが大きな青文字、その下に説明文が表示されます。`style` 属性も `<style>` タグも一切書いていないのに、見た目が変わったことを確認してください。

![ユーティリティクラスを当てた後の表示](img/step3-1.png)
<!-- TODO: screenshot — 灰色背景に青い太字の見出しと小さなグレーの段落 -->

### クラス名の読み方ルール

Tailwind のクラス名は **「プロパティの略 + 数字スケール」** で構成されます。最初は呪文に見えますが、ルールは単純です。

| クラス例           | 意味                                              |
|--------------------|---------------------------------------------------|
| `p-4`              | `padding: 1rem;` （4 × 0.25rem = 1rem）           |
| `mt-2`             | `margin-top: 0.5rem;`                             |
| `text-lg`          | `font-size: 1.125rem;`                            |
| `text-blue-600`    | `color: #2563eb;` （青系の 600 番）              |
| `bg-gray-100`      | `background-color: #f3f4f6;` （灰系の 100 番）   |
| `font-bold`        | `font-weight: 700;`                               |

数字スケールには共通ルールがあります。

* **間隔系**（`p-` `m-` `gap-` など）の数字は `0.25rem` 刻みです。`p-4` は `1rem`、`p-8` は `2rem`。
* **色系**（`text-` `bg-` `border-`）の数字は `50, 100, 200, ..., 900` で、数字が大きいほど濃くなります。
* **テキストサイズ**は `xs` `sm` `base` `lg` `xl` `2xl` `3xl` ... と英語スケールです。

> **Tip:** クラス名を覚える必要はありません。[tailwindcss.com](https://tailwindcss.com/docs) の検索窓に `padding` と入れれば対応クラスが出てきます。最初は調べながらで OK です。

## レイアウトを Flexbox で組む
Duration: 0:10:00

このステップでは Tailwind の **Flexbox ユーティリティ** を使い、アバター画像と名前を横並びに並べます。素の CSS で `display: flex;` を書いたことがある人ほど、Tailwind の `flex` 系クラスは直感的に感じるはずです。

### カードの土台を作る

`<body>` の中身を以下のコードで丸ごと置き換えます。

```html
<body class="bg-gray-100 p-8">
  <div class="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto">
    <img
      src="https://i.pravatar.cc/96?img=12"
      alt="プロフィール画像"
      class="w-24 h-24 rounded-full"
    />
    <h2 class="text-xl font-bold mt-4">Sakura Tanaka</h2>
    <p class="text-gray-500">フロントエンドエンジニア</p>
  </div>
</body>
```

リロードすると、白背景・角丸・薄い影付きのカードが画面中央に表示されます。`max-w-md` で最大幅を制限し、`mx-auto` で左右の `margin` を `auto` にして中央寄せしています。

![カードの土台（縦並び）](img/step4-1.png)
<!-- TODO: screenshot — アバター画像の下に名前と肩書きが縦に並んでいる白いカード -->

### Flexbox でアバターと名前を横並びにする

現状は縦並びです。アバターと名前ブロックを横並びにするため、`<img>` と `<h2>`/`<p>` を 1 つの `<div>` で囲み、その親に `flex` を付けます。`<body>` 内のカード部分を以下のように書き換えます。

```html
<div class="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto">
  <div class="flex items-center gap-4">
    <img
      src="https://i.pravatar.cc/96?img=12"
      alt="プロフィール画像"
      class="w-24 h-24 rounded-full"
    />
    <div>
      <h2 class="text-xl font-bold">Sakura Tanaka</h2>
      <p class="text-gray-500">フロントエンドエンジニア</p>
    </div>
  </div>
</div>
```

`flex` は `display: flex;`、`items-center` は `align-items: center;`、`gap-4` は子要素の間に `1rem` のすき間を空けます。`gap` を使うと `margin-right` を子要素に書いて回らなくて済むので、Flexbox では `gap-*` が定番です。

![Flex でアバターと名前を横並びにした状態](img/step4-2.png)
<!-- TODO: screenshot — アバター左、名前と肩書きが右に横並びになった白いカード -->

### 自己紹介とボタンを追加する

カードの中身を肉付けします。`<div class="flex ...">` の **外** に、自己紹介文とフォローボタンを足します。

```html
<div class="bg-white rounded-lg shadow-md p-6 max-w-md mx-auto">
  <div class="flex items-center gap-4">
    <img
      src="https://i.pravatar.cc/96?img=12"
      alt="プロフィール画像"
      class="w-24 h-24 rounded-full"
    />
    <div>
      <h2 class="text-xl font-bold">Sakura Tanaka</h2>
      <p class="text-gray-500">フロントエンドエンジニア</p>
    </div>
  </div>
  <p class="mt-4 text-gray-700">
    React と Tailwind が好きな大学生。GDG on Campus University of Osaka でフロントエンドの勉強会を主催しています。
  </p>
  <button class="mt-4 bg-blue-500 text-white font-semibold py-2 px-4 rounded">
    フォローする
  </button>
</div>
```

`mt-4` で上方向に `1rem` のすき間を空け、ボタンには `bg-blue-500`（青背景）・`text-white`（白文字）・`py-2 px-4`（縦 0.5rem 横 1rem の内余白）・`rounded`（角丸）を組み合わせました。クラスをひとつずつ読めば、CSS で何を書いたかが見えてきます。

> **Note:** Tailwind の class 属性が長くなって読みづらいときは、VSCode の拡張機能「Tailwind CSS IntelliSense」と「Prettier Tailwind Plugin」を入れると、補完と自動並べ替えが効いて一気に快適になります。

## レスポンシブデザインを実装する
Duration: 0:10:00

PC ではカードを横長に、スマートフォンでは縦長に切り替えたい——そんなとき、Tailwind では **ブレークポイントプレフィックス** を使います。CSS で `@media (min-width: 768px) { ... }` を書く代わりに、クラス名の前に `md:` を付けるだけです。

### ブレークポイントの読み方

Tailwind は **モバイルファースト** です。プレフィックスなしのクラスはすべての画面サイズに当たり、`md:` を付けたクラスは「**画面幅が `md` 以上のとき** に上書きする」という意味になります。

| プレフィックス | 適用される画面幅            | 想定デバイス               |
|----------------|-----------------------------|----------------------------|
| (なし)         | すべて                      | モバイルファースト         |
| `sm:`          | `640px` 以上                | 大きめのスマホ・小型タブレット |
| `md:`          | `768px` 以上                | タブレット                 |
| `lg:`          | `1024px` 以上               | ノート PC                  |
| `xl:`          | `1280px` 以上               | デスクトップ               |

つまり「モバイルでこう、PC で違う見た目」と書きたいなら、「先にモバイル向けクラスを書き、`md:` で PC 向けを上書きする」という順番になります。

### モバイルでは縦・PC では横にする

現在カードはどの画面サイズでも常に横並びです。スマホでは縦並びにしたいので、内側の Flex 要素を `flex-col`（縦並び）にし、`md:` で `flex-row`（横並び）に上書きします。`text-center` と `md:text-left` も足してテキストの揃えも切り替えます。

該当箇所を以下のように書き換えます。

```html
<div class="flex flex-col items-center gap-4 md:flex-row md:items-center text-center md:text-left">
  <img
    src="https://i.pravatar.cc/96?img=12"
    alt="プロフィール画像"
    class="w-24 h-24 rounded-full"
  />
  <div>
    <h2 class="text-xl font-bold">Sakura Tanaka</h2>
    <p class="text-gray-500">フロントエンドエンジニア</p>
  </div>
</div>
```

ブラウザの DevTools（F12）を開き、左上のデバイスツールバーアイコンをクリックして「iPhone 14」や「Responsive」モードに切り替えてみてください。幅を狭めると縦並び、幅 768px を超えた瞬間に横並びに切り替わります。

![モバイルとデスクトップで切り替わるカード](img/step5-1.png)
<!-- TODO: screenshot — 左にモバイル表示（縦並び）、右にデスクトップ表示（横並び）の Before/After 比較 -->

### カード全体の幅もレスポンシブに

ついでにカードの最大幅もブレークポイントごとに変えてみましょう。`max-w-md`（中サイズ）を基本にしつつ、`lg:` でノート PC 以上の画面では `max-w-lg`（より広い）に広げます。

カード外側の `<div>` を以下のように書き換えます。

```html
<div class="bg-white rounded-lg shadow-md p-6 max-w-md lg:max-w-lg mx-auto">
```

幅 1024px を超えたタイミングでカードが少し広がることを確認できます。`max-w-md` と `lg:max-w-lg` を縦に並べただけで、CSS のメディアクエリブロックを書く必要は一切ありません。

> **Tip:** 「モバイル → タブレット → PC」の順に書く癖をつけると、Tailwind では `(base) → md: → lg:` と自然に並びます。「ベースはモバイル、`md:` で上書き」という発想が定着すると、レスポンシブ設計が驚くほど早くなります。

## ホバーとフォーカスで対話性を加える
Duration: 0:08:00

ボタンにマウスを乗せた瞬間や、Tab キーで選択された瞬間にスタイルを変えたい——これも Tailwind では **状態プレフィックス（state variant）** で表現します。仕組みはブレークポイントプレフィックスと完全に同じです。

### `hover:` で色を変える

「フォローする」ボタンのクラスに `hover:bg-blue-600` を足します。普段は `bg-blue-500`、マウスが乗った瞬間だけ 1 段濃い `bg-blue-600` に切り替わります。

```html
<button class="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded">
  フォローする
</button>
```

ブラウザでマウスをボタンに乗せると、青がほんの少し濃くなるはずです。Tailwind のカラースケールは 50 → 900 と進むにつれて濃くなるので、「ホバー時は数字を 100 上げる」が安定パターンです。

### `transition` で滑らかにする

色がパッと切り替わると安っぽく見えるので、CSS transition を当てて滑らかにします。

```html
<button class="mt-4 bg-blue-500 hover:bg-blue-600 transition-colors duration-200 text-white font-semibold py-2 px-4 rounded">
  フォローする
</button>
```

`transition-colors` で「色のプロパティだけ」アニメーションさせ、`duration-200` で `200ms` の長さを指定しました。ホバー時にじんわり青が濃くなれば成功です。

### `focus:` でキーボード操作対応

最後に、キーボードで Tab キーを押してボタンに到達したとき（フォーカス時）に青いリングを表示します。マウス操作だけでなくキーボードユーザーのアクセシビリティも保てます。

```html
<button class="mt-4 bg-blue-500 hover:bg-blue-600 transition-colors duration-200 text-white font-semibold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-blue-300">
  フォローする
</button>
```

ブラウザでボタンの外側をクリックして選択を外し、`Tab` キーを押してボタンにフォーカスを移すと、青い 2px の輪郭線（リング）が現れます。

![フォーカス時に青いリングが表示されたボタン](img/step6-1.png)
<!-- TODO: screenshot — 「フォローする」ボタンに focus:ring が出ている拡大スクリーンショット -->

> **Warning:** `focus:outline-none` でブラウザ既定のアウトラインを消したときは、必ず `focus:ring-*` などの代替を入れてください。デフォルトのアウトラインを消したまま代替を置かないとキーボード操作のユーザーが現在地を見失い、アクセシビリティ違反になります。

## プロフィールカードを完成させる
Duration: 0:12:00

ここまでに学んだ要素を 1 つにまとめ、完成形のプロフィールカードを仕上げます。仕上げに少しだけ装飾を足し、最後に学んだクラスを声に出して読み直してみましょう。

### 最終形の HTML

`index.html` 全体を以下の内容で丸ごと置き換えます。コピペで OK ですが、コピペした後で **1 行ずつクラスを読み、自分の言葉で何をしているか説明できる** か確認するのが今日のゴールです。

```html
<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tailwind ハンズオン</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-gray-100 min-h-screen flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-lg p-6 max-w-md lg:max-w-lg w-full">
      <div class="flex flex-col items-center gap-4 md:flex-row text-center md:text-left">
        <img
          src="https://i.pravatar.cc/96?img=12"
          alt="プロフィール画像"
          class="w-24 h-24 rounded-full ring-4 ring-blue-100"
        />
        <div>
          <h2 class="text-xl font-bold text-gray-900">Sakura Tanaka</h2>
          <p class="text-gray-500">フロントエンドエンジニア</p>
        </div>
      </div>
      <p class="mt-4 text-gray-700 leading-relaxed">
        React と Tailwind が好きな大学生。GDG on Campus University of Osaka でフロントエンドの勉強会を主催しています。
      </p>
      <button
        class="mt-6 w-full md:w-auto bg-blue-500 hover:bg-blue-600 transition-colors duration-200 text-white font-semibold py-2 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
      >
        フォローする
      </button>
    </div>
  </body>
</html>
```

このコードでは、これまで使っていない次の 3 つを追加しました。`min-h-screen` で `<body>` の高さを画面いっぱいに広げ、`flex items-center justify-center` でカードを画面中央に置きます。アバター画像の `ring-4 ring-blue-100` は、画像の周囲に薄い青のリングを描いて視覚的なアクセントにします。`leading-relaxed` は `line-height: 1.625;` で、自己紹介文の行間を少し広げて読みやすくしています。

### 動作確認

ブラウザをリロードし、以下をすべて確認します。

* PC 幅で開く → アバターが左、テキストが右、ボタンは小さめのサイズ
* DevTools でモバイル幅に切り替える → アバターが上、テキストが中央寄せ、ボタンは横幅いっぱい
* ボタンにマウスを乗せる → 青がじんわり濃くなる
* Tab キーでボタンにフォーカス → 青いリングが出る

![完成したプロフィールカード（モバイル/PC 両方）](img/step7-1.png)
<!-- TODO: screenshot — 完成形のカードのモバイル/デスクトップ Before/After。アバターのリング、ボタンのホバー前後、フォーカス時のリングをすべて確認できるショット -->

### 自分なりに変えてみる（任意）

時間に余裕があれば、以下のいずれかを試してみてください。Tailwind の数字スケールに慣れる最良の練習になります。

* ボタンの色を青系から `emerald-*` 系（緑）に変える（`bg-emerald-500` `hover:bg-emerald-600` `focus:ring-emerald-300`）
* カード全体に `border border-gray-200` を追加してフチを付ける
* 名前の上に `text-xs uppercase tracking-wider text-blue-500` のラベル（例: `MEMBER`）を `<p>` で挟む

> **Tip:** 公式ドキュメント [tailwindcss.com/docs](https://tailwindcss.com/docs) は、左のサイドバーが Layout / Flexbox / Spacing / Typography / Colors のように **CSS のカテゴリ別** に整理されています。CSS で書きたいプロパティの名前さえ知っていれば、Tailwind での書き方は 30 秒で見つかります。

## おめでとうございます！
Duration: 0:05:00

おつかれさまでした。あなたは `style.css` を 1 行も書かずに、レスポンシブでホバー対応のプロフィールカードを 60 分で組み上げました。ユーティリティファースト CSS の感覚が少しでも掴めていれば成功です。

### 学んだこと

* Tailwind CSS の「ユーティリティファースト」の考え方を理解した
* Play CDN で Tailwind を 30 秒で導入する方法を覚えた
* `flex` / `gap` / `items-center` などのレイアウトユーティリティの使い方を身につけた
* `p-4` `text-lg` `bg-blue-500` などの数字スケールの読み方を理解した
* `sm:` `md:` `lg:` プレフィックスでレスポンシブデザインを書けるようになった
* `hover:` `focus:` プレフィックスで状態に応じたスタイルを当てられるようになった

### 次のステップ

ここから先に進むなら、次の順番がおすすめです。

* [Tailwind CSS 公式ドキュメント](https://tailwindcss.com/docs) — 今日の内容はすべてここから来ています。ブックマーク必須。
* [Tailwind UI](https://tailwindui.com/) と [Headless UI](https://headlessui.com/) — 公式が出しているコンポーネント集。実際の HTML を読むだけでも勉強になります。
* [Tailwind CLI でのインストール](https://tailwindcss.com/docs/installation) — 本番運用では Play CDN ではなく CLI ビルドに移行しましょう。`npx tailwindcss -i input.css -o output.css --watch` で始められます。
* `tailwind.config.js` でカスタムテーマを定義する — ブランドカラーや独自のフォントサイズを Tailwind の数字スケールに組み込めます。
* React / Next.js / Vue で Tailwind を使う — フレームワークと組み合わせると、コンポーネント単位で class を整理できてさらに快適になります。

### 今日の成果物を残す

`index.html` を Gist や GitHub にコミットして残しておくと、後日 React や Vue のハンズオンに進んだとき「Tailwind 単体ではこう書いていた」と振り返れて便利です。GDG on Campus University of Osaka の次回勉強会で React + Tailwind を扱う予定なので、ぜひ今日のカードを React コンポーネントに移植してみてください。
