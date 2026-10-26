---
name: source-playbook
description: Where to look for each kind of source and the exact command to get it — docs, repos, release notes, registries, talk decks, X, participant reports, archives — plus the detours to take when a source cannot be read. Read when gathering facts for references.md.
---

# ソースの棚

上から順に強い。ただし**強い順に当たるのではなく、全部当たる。**

| ソース | 強さ | 取り方 |
| --- | --- | --- |
| 自分の計測 | ◎ | 実際に動かす。条件を書く |
| レジストリ | ◎ | npm / PyPI の API。機械可読で嘘がない |
| リポジトリ（PR / Issue / commit） | ◎ | `gh api`。**設計意図は PR 本文にある** |
| 公式ドキュメント | ○ | raw の Markdown を取る |
| リリースノート | ○ | GitHub Releases |
| 登壇資料 | ○ | SpeakerDeck / Docswell / 自前サイト |
| 本人の X | ○ | 一次だが流れる。スクショか引用で残す |
| 参加レポート・解説記事 | △ | 二次。出どころを書けば使える |
| アーカイブ | △ | 消えたページの最後の手段 |

---

## 公式ドキュメント

HTML を読むより **raw の Markdown** を取る方が速くて正確。
docs サイトの多くは GitHub にソースがある。

```sh
curl -sL "https://raw.githubusercontent.com/honojs/website/main/docs/guides/migrating-to-v5.md"
```

サイト側に `/llms.txt` や `Accept: text/markdown` がある場合もある。

`WebFetch` は要約されて返るので、**表やコードを正確に欲しいときは curl**。

---

## リポジトリ

### PR 本文が一番おいしい

マイグレーションガイドは「何が変わったか」しか書かない。
**「なぜそうしたか」は PR 本文にある。**

```sh
# タイトルで PR を探す
gh api "repos/honojs/hono/pulls?state=all&per_page=100" \
  --jq '.[] | select(.title|test("routable error")) | "#\(.number) \(.html_url)"'

# 本文を読む
gh api repos/honojs/hono/pulls/5541 --jq '.body'
```

### 誰がコミットしているかも情報

```sh
gh api "repos/honojs/hono/pulls?state=all&per_page=10" \
  --jq '.[] | "\(.created_at[:10])  @\(.user.login)  \(.title)"'
```

外部コントリビューターの PR が open のまま溜まっている、
メンテナ 2 人しかマージしていない——こういうのは**書いていない事実**として使える。

### ソースを直接読む

型定義のコメントに思想が書いてあることがある。

```sh
sed -n '1,80p' node_modules/hono/dist/helper/factory/define-handler.d.ts
```

---

## リリースノート

```sh
gh api repos/honojs/hono/releases --jq '.[:10][] | "\(.published_at[:10])  \(.tag_name)  \(.prerelease)"'
```

RC やプレリリースは `--jq` で `prerelease` を見ると取りこぼさない。

---

## レジストリ（npm）

**数字の裏取りはここが最強。** 公開日・サイズ・ファイル数・依存が全部取れる。

> ⚠️ **このリポジトリでは `npm view` が落ちる。**
> ルートの `package.json` に `devEngines.packageManager: bun` があるため
> `EBADDEVENGINES` になる。**registry API を直接叩く。**

```sh
# dist-tags（next / latest）
curl -s https://registry.npmjs.org/hono | python3 -c \
  "import json,sys; print(json.load(sys.stdin)['dist-tags'])"

# サイズ・ファイル数・依存
curl -s https://registry.npmjs.org/hono/5.0.0-rc.1 | python3 -c "
import json,sys; d=json.load(sys.stdin)
print(d['version'], d['dist']['unpackedSize'], d['dist']['fileCount'])
print('deps:', d.get('dependencies') or 'なし')
"

# 初版の公開日（そのパッケージが「いつ切り出されたか」が分かる）
curl -s https://registry.npmjs.org/@hono%2Fbun | python3 -c "
import json,sys; d=json.load(sys.stdin)
vs=sorted(d['versions'], key=lambda v: d['time'][v])
print(vs[0], d['time'][vs[0]][:10])
"
```

スコープ付きパッケージは `/` を `%2F` にする。

**初版公開日は強い。** 「v5 のために切り出された 8 パッケージ」なのか
「元から別だった」のかが、日付一発で分かる。

---

## 登壇資料

| 置き場 | メモ |
| --- | --- |
| SpeakerDeck | PDF 化されていることが多く、テキストが取れないことがある |
| Docswell | 同上 |
| 自前サイト（`slides.yusu.ke` など） | HTML なので `WebFetch` がよく効く |

発表者が自前でホストしていないか先に探す。HTML なら確実。

---

## X（旧 Twitter）

本人の発言は一次ソース。ただし流れるし、取得しづらい。

- 登壇資料にスクショとして貼られていることが多い（そこから拾う）
- 日付と文言を `references.md` に書き写して残す
- 引用するなら URL も

---

## 参加レポート・解説記事

**登壇資料が読めないときの主力。** Qiita / Zenn / はてな / 個人ブログ。

```
"<セッションタイトル>" 参加 レポート
"<イベント名>" 感想 まとめ
<登壇者名> <テーマ> 登壇 内容
```

目次をそのまま書き起こしている記事が当たりで、
発表の構成と結論がまるごと分かる。

二次ソースなので、**「参加レポートによると」と出どころを書いて使う。**
そのうえで、中の数字は自分で引き直せないか考える。

---

## アーカイブ

```
https://web.archive.org/web/2026*/https://example.com/page
```

消えたページ、書き換えられる前のドキュメント、終了したサービスの料金表など。

---

## 読めないときの迂回路

資料に辿り着けない / 読めないときに、この順で試す。

1. **別のホストを探す** — SpeakerDeck がダメでも自前サイトや GitHub にあるかも
2. **参加レポートを探す** — イベント名 + セッション名で検索
3. **登壇者の別の発表を探す** — 同じ話を別の場でしていることが多い
4. **本人の X を探す** — 発表前後にスレッドで書いていることがある
5. **アーカイブ動画 / connpass のイベントページ**
6. **検証できる形に落とす** — 「こう言っていたらしい」を
   レジストリやリポジトリで確かめられないか考える
7. それでもダメなら `references.md` に「未確認」と書いて残す

**1 で諦めない。** 今日の例では、SpeakerDeck のテキストが崩れていた発表の中身が、
参加者の Qiita レポートからほぼ丸ごと取れた。
