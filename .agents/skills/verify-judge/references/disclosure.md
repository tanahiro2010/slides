---
name: disclosure
description: Responsible disclosure mechanics for a public repo — the report shape, the evidence bundle, scrubbing findings out of files AND commit messages, and publishing after the vendor responds. Read before reporting anything or before pushing a deck that contains an unreported finding.
---

# 開示の手順

公開リポジトリで検証していると、**報告より先に発見が公開されてしまう**。
順番を守るための手順書。

```
発見 → 公開素材から外す → 報告 → 回答を待つ → 公開する
```

---

## 1. 公開素材から外す

発見を見つけたら、**報告より先に**公開リポジトリから引き剥がす。

### 外すもの

- 検証スクリプト（発見を再現するコード）
- `references.md` / `draft.md` / `article.md` の該当節
- 結果テーブルの該当**行**（節を消しても表に残っていることがある）

### 手元には残す

検証は続けたいので、消さずに **gitignore 済みの場所に退避**する。

```
sandbox/
├── private/          ← gitignore。完全版の調査資料とスクリプト
│   ├── references-FULL.md
│   └── <scripts>.ts
├── src/<scripts>.ts  ← gitignore に個別指定
└── .gitignore
```

`package.json` の npm scripts に名前を残すと、**スクリプトの存在が公開される**。
ローカル専用のランナー（gitignore 済みのシェルスクリプト）に逃がす。

### 番号の欠番を作らない

`#19 #20 #22` を消して `#21` を残すと、**何か消したことが分かる**。
残った項目を繰り上げて連番にする。

## 2. 漏れを探す

ファイルを消しただけでは終わらない。**3 箇所とも見る。**

```sh
# ① 作業ツリー
git grep -nE '<発見を示す語>' -- '<デッキ>'

# ② 全履歴のファイル内容
git grep -I -l -E '<発見を示す語>' $(git rev-list --all)

# ③ コミットメッセージ ← 見落とす
git log --all --format='%H%n%B' | grep -niE '<発見を示す語>'
```

> ⚠️ **③ が本番。** 実際に、ファイルは消えたのにコミットメッセージ本文へ
> 「proof のリプレイが成立することを記録」「同じ nonce を 6 回使って全部 200」と
> 書いてあった。`filter-repo --invert-paths` は**パスしか消さない**。

## 3. 履歴から消す

**先にバックアップを取る。** 戻せない操作。

```sh
git tag -m "scrub 前" backup/pre-scrub-$(date +%Y%m%d) HEAD
git bundle create ~/<repo>-backup.bundle --all   # リポジトリの外に置く
```

パスを全履歴から除去:

```sh
git filter-repo --paths-from-file purge-paths.txt --invert-paths --force
```

メッセージを差し替え（`--message-callback` は関数本体だけを渡す）:

```python
# msg_body.py
rules = [("feat: 古い件名の先頭", "chore: 差し替え後の件名\n")]
for prefix, new in rules:
    if message.startswith(prefix.encode("utf-8")):
        return new.encode("utf-8")
return message
```

```sh
git filter-repo --message-callback "$(cat msg_body.py)" --force
```

注意:

- `filter-repo` は **`origin` を外す**。終わったら付け直す
- パスを消すと**空になったコミットは自動で消える**（件名リストが短くなる）
- ファイルを全履歴から消すと、そのファイルの**履歴も消える**。消した後に
  クリーン版を新規コミットで入れ直す

### 正直に言うべきこと

履歴を書き換えて force push しても、**完全には消えない**。

- GitHub は古いコミットを SHA 直指定でしばらく配信する
- すでに clone / fork した相手の手元には残る
- Actions のログ、PR / Issue の参照にも残る

**「確実に消えた」前提で動かない。** 消す前に公開していた時間が長いなら、
消すより先に報告した方が早い。

## 4. 報告書の形

**深刻度を先頭に書く。** 盛らない。相手が最初に見る「これ本当に効くの？」に
こちらから答えておく。

```markdown
# <一行で挙動を書いたタイトル>

**Reporter / Date / Component / Endpoint**
**Severity (self-assessed):** Low — see "Impact and severity".
  This is primarily a documentation-vs-implementation contradiction.

## Summary
何が起きるか 3〜4 行。

## Observed vs documented behavior
### 1. <主張>
> ドキュメントの原文を引用
測定結果を表で。対照も載せる。

## Why this is a spec gap
RFC の該当条文を引用し、満たしていない条件を名指しする。

## Impact and severity
**何が増えていないか**を先に書く。CVSS ベクタは参考として添える。

## Suggested remediation
直し方を 2〜3 択で。「ドキュメントを直す」も選択肢に入れる。

## Reproduction
環境、手順、添付した証跡ファイル名。

## References
```

要点:

- **ドキュメントの原文を引用する。** 「〜と書いてある」では弱い
- **対照を載せる。** 無いと「測り方が悪いのでは」で終わる
- **影響が限定的なら自分で書く。** 隠すと、相手が見つけて信用を失う
- 直し方に「**ドキュメントを修正する**」を必ず入れる。挙動が仕様なら、それが答え

## 5. 証跡バンドル

報告書に**生の往復**を添える。整形した出力だけでは再現できない。

```
evidence-bundle/
├── REPORT.md
├── MANIFEST.md                  各ファイルが何を示すか
├── 01-findings.jsonl            主要な往復（指紋付き）
├── 01-findings.transcript.md    人間可読ログ
└── 02-<シナリオ>.jsonl
```

`MANIFEST.md` に書くこと:

- 各ファイルがレポートの**どの節に対応するか**
- JSONL 1 行の読み方
- **伏せ方の説明**（何を指紋に置き換えたか、何を平文で残したか、なぜか）
- 環境（ランタイム、バージョン、日付、テスト用アカウントである旨）

> ⚠️ **伏せ字あり版＝公開してよい、ではない。** クライアント識別子が平文なら、
> それは報告先にだけ渡すもの。MANIFEST に明記する。

生ログ（伏せ字なし）は**バンドルに入れない**。手元に置き、「求められれば提供する」と書く。

## 6. 回答が来たら

- **却下されても、それは結論の一部。** 理由ごと記事に書く
- 却下理由が「影響が限定的」なら、それは **finding の性質がドキュメント問題だと
  ベンダーが位置づけた**ということ。主張の裏付けになる
- 回答を受けて、退避していた素材を**公開素材に戻す**
- 報告書にも結果を記録しておく（`**Disposition:** ... Won't Fix, <日付>`）

## 7. 公開する

- 退避した節を戻し、番号を振り直す
- 「報告した → こう返ってきた」を**記事の節として独立させる**
- コミットメッセージも通常運用に戻す

---

## チェックリスト

**報告前**

- [ ] 作業ツリー / 全履歴のファイル / **コミットメッセージ** の 3 箇所を grep した
- [ ] バックアップ（tag + bundle をリポジトリ外に）を取った
- [ ] 退避先が gitignore 済みで、検証は続けられる
- [ ] 番号に欠番が出ていない
- [ ] 報告書の深刻度が盛られていない
- [ ] 証跡の秘密が指紋に置き換わっている / 生ログは入れていない

**公開前**

- [ ] 報告して、回答が返ってきた
- [ ] 回答の内容を記事に反映した（却下も含めて）
- [ ] 退避素材を戻し、番号を振り直した
