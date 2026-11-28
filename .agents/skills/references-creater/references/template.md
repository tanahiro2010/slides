---
name: template
description: The shape of references.md — claim table, per-claim entries with sources and verdicts, own measurements with commands, unresolved list. Copy this when creating references.md.
---

# `references.md` の形

公開されない作業メモ。**記事に書けない過程をここに書く。**

````markdown
# references — <テーマ>

| | |
| --- | --- |
| 調査日 | 2026-10-18 |
| 対象 | Hono v5 RC（5.0.0-rc.1） |
| 用途 | slide.md / article.md |

## 確認した主張

| # | 主張 | 判定 | 根拠 |
| --- | --- | --- | --- |
| 1 | `onError()` がミドルウェアになった | ✅ 確認 | 公式ガイド / PR #5541 / 実測 |
| 2 | アダプタ分離はサプライチェーン対策でもある | ⚠️ 二次のみ | 参加レポート |
| 3 | 依存を減らした | ❌ **前提が違う** | v4 から依存ゼロ（registry） |
| 4 | サブアプリの `notFound()` の優先順位 | ⬜ 未確認 | PR 本文に記述あり・未実測 |

---

## 1. `onError()` がミドルウェアになった

**判定: 確認。**

- [Migrating to v5](https://hono.dev/docs/guides/migrating-to-v5) — 一次
  > `onError()` now accepts middleware with the `(c, next)` signature instead of `(err, c)`.
- [honojs/hono#5541](https://github.com/honojs/hono/pull/5541) — 一次。**設計意図はこっち**
  > The goal is to model error and not-found handling using Hono's routing system
  - 内部では `@ERROR` / `@NOT_FOUND` の予約メソッドで Router に登録される
- 自分の実測 → 下の「計測」

### 記事に使える切り口

- v4 は上書き、v5 は合成。**型エラーにならないので実行するまで気づけない**

---

## 2. アダプタ分離はサプライチェーン対策でもある

**判定: 二次ソースのみ。出どころ付きで書く。**

- [Honoでのサプライチェーン侵害対策 〜 3つのライブラリに学ぶ](https://speakerdeck.com/yusukebe/...) — 一次だが**テキストが取れない**
- [参加レポート（Qiita / kouki_engineer）](https://qiita.com/kouki_engineer/items/fd371f4258941b3ae149) — 二次。中身はここから
  - GMO Flatt Security 勉強会・2026-06-23
  - 対策に「アダプター機能をコアから外す」が入っている
  - 他に OIDC trusted publishing、`pull_request_target` 不使用、Actions の pin

> ⚠️ **この「テキストが取れない」は references.md に書くこと。article.md には書かない。**

---

## 計測（自分で取った一次ソース）

### パッケージサイズ

```sh
curl -s https://registry.npmjs.org/hono/4.13.13 | python3 -c \
  "import json,sys; d=json.load(sys.stdin); print(d['dist']['unpackedSize'], d['dist']['fileCount'])"
```

| | unpackedSize | fileCount | dependencies |
| --- | ---: | ---: | ---: |
| `hono@4.13.13` | 1.23 MB | 574 | **0** |
| `hono@5.0.0-rc.1` | 0.66 MB | 310 | **0** |

→ **-46%。** 登壇資料の数字（1.29MB → 0.70MB、574 → 310）と一致。
→ ただし**依存は v4 からゼロ**。「依存を減らした」は Hono に関しては成り立たない。

### 環境

- Node.js v24.22.0 / TypeScript 7.0.2 / Apple M4 (arm64)
- 計測日 2026-10-18

---

## 未確認・積み残し

- [ ] サブアプリの `notFound()` の優先順位（PR 本文に記述、未実測）
- [ ] `basePath()` と `onError()` の組み合わせ
- [ ] 実 HTTP サーバー経由のベンチ（今回は `app.fetch()` のみ）

## 探したが取れなかったもの

- 外部 PR 停止の**公式な理由表明** — `CONTRIBUTING.md` / `SECURITY.md` ともに無し。
  登壇資料と二次記事しか見つからなかった
````

## 判定の記号

| | 意味 |
| --- | --- |
| ✅ | 一次ソース、または自分の計測で確認 |
| ⚠️ | 二次ソースのみ。出どころ付きで書く |
| ❌ | 調べたら前提が違った。**これが一番の収穫になることがある** |
| ⬜ | 未確認。記事では「確認できていません」と書くか、落とす |

## 書くときのコツ

- **「記事に使える切り口」を主張ごとに 1 行足す。** 調べただけで終わらせない
- **計測はコマンドごと残す。** あとで記事と sandbox にそのまま移せる
- **❌ を消さない。** 「依存ゼロだった」のような否定の発見は、記事の山場になる
