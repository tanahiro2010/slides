# references — 怠惰は人を健康にするのか？

| | |
| --- | --- |
| 調査日 | 2026-11-15 |
| 対象 | 2050 Project Fes 2026 LT／完全版記事（PRD.md §6 必須調査テーマ） |
| 用途 | slide.md / article.md |

公開されない作業メモ。**記事に書けない過程・読めなかった資料・判定の揺れをここに書く。**

---

## 確認した主張

| # | 主張 | 判定 | 根拠 |
| --- | --- | --- | --- |
| 1 | 顔認識は insightface(buffalo_l)+pgvector で実装済み。生の顔画像はDBに保存されずembeddingのみ | ✅ 確認 | 自分でソースコードを読んだ（face_auth_api） |
| 2 | 「Person Memory」（会話要約・興味抽出の自動蓄積）は構想段階で、現状の実装は人物登録・顔ひも付け・会話の検索のみ | ✅ 確認（かつ重要な訂正） | 自分でソースコードを読んだ（voice_assistant_agent） |
| 3 | PRDは「抽出後に音声/Transcriptを削除する」設計方針を掲げるが、実装では発話テキストそのものがDBに永続保存され全文検索できる | ❌ **PRDと実装が食い違う** | 自分でソースコードを読んだ（search-conversations.ts） |
| 4 | 撮影対象（相手）本人の同意取得方法は未解決の課題として、PRD自身が明記している | ✅ 確認 | PRD原文「Open Questions / Risks」 |
| 5 | 登録者の削除API（`DELETE /faces/{id}`）は実装済み | ✅ 確認 | face_auth_api README |
| 6 | Larry Wallの三大美徳（Laziness/Impatience/Hubris）の定義文言 | ✅ 確認 | perldoc.perl.org / Programming Perl glossary |
| 7 | 三大美徳が「初版の序文」由来だという通説 | ⬜ 未確認 | 第2〜4版の用語集が出典と分かるのみ |
| 8 | WHO憲章（1946年）の健康定義 | ✅ 確認 | WHO公式サイト |
| 9 | Huber et al. 2011 (BMJ) によるWHO定義批判 | ✅ 確認（一部） | BMJ論文（批判部分のみ直接確認、新定義提案文は二次確認） |
| 10 | 認知的オフローディングの定義（Risko & Gilbert 2016） | ⚠️ 二次ソースのみ | 原文ペイウォール、引用経由で確認 |
| 11 | 「Google Effects on Memory」（Sparrow et al. 2011） | ⚠️ **条件付き支持。中核実験は再現失敗** | Science誌論文＋2018年大規模追試 |
| 12 | Saving-enhanced memory（Storm & Stone 2015） | ⚠️ 二次ソースのみ | Psychological Science誌、プレスリリース経由 |
| 13 | Extended Mind（Clark & Chalmers 1998） | ⚠️ 二次ソースのみ | Analysis誌、解説記事経由 |
| 14 | 分散認知（Hutchins 1995） | ⚠️ 二次ソースのみ | 要約サイト経由 |
| 15 | 「脳＝ストレージ」比喩への批判 | ⚠️ 論争中（決着していない） | Epstein (Aeon) 対 批判者 |
| 16 | WHO/UNICEF Global report on assistive technology (2022)「ユーザーをパートナーとして扱う」 | ✅ 確認 | 報告書原文PDF直接抽出 |
| 17 | CRPD第12条（法的能力の平等・意思と選好の尊重） | ✅ 確認 | 条文原文 |
| 18 | Gender Shades論文の誤認識率 | ✅ 確認 | 論文PDF直接抽出（表4の数値） |
| 19 | GDPR第9条（生体データの特別カテゴリーと明示的同意） | ✅ 確認 | 条文原文 |
| 20 | イリノイ州BIPA（生体情報の書面同意義務） | ⚠️ 二次ソース経由 | 公式ilga.govは接続エラー、findlaw経由で確認 |
| 21 | 日本PPC「顔識別機能付きカメラシステムの利用について」の公表時期 | ❌ **「2021年」ではなく2023年3月** | PPC文書原文 |
| 22 | 顔特徴データ＝個人識別符号／要配慮個人情報の同意原則 | ✅ 確認 | 個人情報保護法条文・PPC文書 |
| 23 | NICE Evidence Standards Framework（リスク比例のエビデンス要求） | ✅ 確認 | NICE/PMC論文 |
| 24 | FDA Digital Health Center of Excellence | ✅ 確認 | FDA公式ページ |
| 25 | 日本の「プログラム医療機器」制度・医療DX令和ビジョン2030 | ✅ 確認 | 厚労省/PMDA通知 |
| 26 | 「過度な代行が自立を損なう」という主張を支持する認知症領域の実証研究 | ⬜ **未確認。むしろCochraneは「エビデンス不足」と結論** | Cochrane Review CD009627 (2017) |

---

## 1. E.D.I.T.H（自分のプロジェクト）の実装状況

**判定: 自分でソースコードを確認。実装済み/構想段階を区別。**

対象リポジトリ: `tanahiro2010/edith`（本体・PRD）、`tanahiro2010/face_auth_api`（顔認識API、edithからサブモジュール的に参照）。

### 1-1. 顔認識（実装済み）

- `face_auth_api` は FastAPI + PostgreSQL(pgvector) + insightface(`buffalo_l`)。`src/models.py` の `Person` テーブルは `name` / `info(JSONB)` / `embedding(vector(512))` のみを持ち、**生の顔画像を保存するカラムは存在しない**。
  - → PRD（`smart_glasses_social_memory.md`）の「これはGoals完成後に検討」節にある「顔画像・音声を必要な処理後に破棄し、Face EmbeddingやMemoryなど必要最低限の情報のみを保持する」という設計目標は、少なくともDBスキーマのレベルでは**実際に満たされている**。
- 類似検索は閾値（既定0.5、`.env`で変更可）で一致判定し、未満は404。同一人物の角度違いサンプルを `face_samples` に追加していく設計。
- `DELETE /faces/{id}` で登録者を削除可能（カスケード削除）。

### 1-2. 「Person Memory」は構想段階（実装はまだ薄い）

PRD本文は「Recognize → Remember → Assist」体験や、会話終了後にLLMが興味・所属・好きなもの・次回聞きたいことを構造化抽出し暗号化して蓄積する「Person Memory」を中心機能として描く。しかし `voice_assistant_agent/src/tools/` の実際のツール一覧は次の4つのみ:

- `person/register-person.ts` — クライアントに `capture_face` アクションを要求するだけ（実際の顔登録はクライアント側）
- `person/get-person.ts`
- `person/assign-face.ts`
- `conversation/start-conversation.ts` / `stop-conversation.ts` / `search-conversations.ts`

「興味・所属・好きなもの・次回聞きたいこと」を抽出する機能や「暗号化して保存」という実装は、リポジトリ全体を `memory` で検索しても `smart_glasses_social_memory.md`（PRD自身）以外にヒットしない。**→ Person Memoryは現状、PRD上の構想であり、実装はまだ存在しない。**

ドラフト（draft.md）の「実装済み機能と構想段階の機能は必ず区別する」という注意に従うなら、記事・スライドで紹介してよいのは「顔認識で名前が分かる」ところまでで、「前回の話題を思い出す」部分は明確に「構想」と書く必要がある。

### 1-3. ❌ PRDと実装が食い違う点：Transcriptは消えていない

PRDの Non-Goals には「全会話の録音・Transcriptの永続保存を前提とすることはしない」「必要な情報を抽出した後は音声・Transcriptを削除する運用を基本とする」とある。

しかし `conversation/search-conversations.ts` の実装は次の通り:

```ts
const utterances = await conversationRepo.listUtterances(c.id);
return {
  id: c.id, status: c.status, startedAt: c.startedAt, endedAt: c.endedAt,
  summary: c.summary, topics: c.topics,
  utterances: utterances.map((u) => ({ speaker: u.speakerId, text: u.text })),
};
```

`listUtterances` は発話の `text` をそのまま返している。つまり**発話テキストはDBに永続保存されており、後から全文検索できる**。これはPRDの「抽出後に削除する」という設計方針と矛盾する実装状態である。

> これは「記事に使える切り口」というより「references.mdにだけ書いて、article.mdには実装の美化をしない」ための記録。E.D.I.T.Hを第4章で紹介する際、「設計思想としてはプライバシー配慮を掲げているが、現在のMVP実装ではまだそれが徹底されていない」と正直に書くべき箇所。

### 1-4. ✅ 本人同意の未解決性はPRD自身が認めている

PRDの「Open Questions / Risks」に次の記述がある（原文ママ）:

> 顔認識・会話記録を伴う機能に対して、対象人物自身の同意をどのように取得・管理するか(グラス使用者本人の同意だけでは不十分な場面がある)

これは開発者自身が「撮影されグラスに登録される側の人物」の同意問題を認識しつつ未解決であることを示す一次ソース（PRD）であり、記事第4〜5章でそのまま引用できる最も正直な記述。Non-Goalsの「Web上の情報から本人の同意なく人物を特定・照合することはしない（登録・Opt-inした人物のみを対象）」は、あくまで**グラス使用者が能動的に登録する相手**についての話であり、**登録される側本人の同意**とは別の論点であることに注意（PRD自身がこの区別をしている）。

### 記事に使える切り口

- 「技術的にできること」と「PRDが目指す理想」と「実装の現在地」の3層のズレが、そのままこの記事の主題（怠惰＝負担削減と、健康・尊厳の両立は自動的に一致しない）の具体例になる。
- E.D.I.T.Hの紹介は「Lv.1（顔認識→名前表示）が実装の中心であり、Person Memoryや同意管理は未解決」という誠実な現在地を示すのが良い。誇張しないこと。

---

## 2. エンジニアリングにおける怠惰（Larry Wall）

**判定: ✅ 定義文言は確認。「初版序文由来」という通説は⬜未確認。**

- perldoc.perl.org（Perl公式ドキュメント） https://perldoc.perl.org/perlglossary — "A glossary of terms ... derived from the Glossary of Programming Perl, Fourth Edition." と明記。
  > laziness: The quality that makes you go to great effort to reduce overall energy expenditure.
  > impatience: The anger you feel when the computer is being lazy.
  > hubris: Excessive pride, the sort of thing [for which] Zeus zaps you.
- University of Edinburgh のミラー（Perl CD Bookshelf収録） https://www.dcs.ed.ac.uk/home/timh/PERL-CD/prog/glossary.htm でも同一文言。
- より長い版（個人ノートサイトの書き起こし、⚠️二次）https://notes.zachmanson.com/virtues-of-a-good-programmer :
  > "Laziness: ... It makes you write labor-saving programs that other people will find useful, and document what you wrote so you don't have to answer so many questions about it. Hence, the first great virtue of a programmer."
  > "Impatience: ... This makes you write programs that don't just react to your needs, but actually anticipate them ... Hence, the second great virtue of a programmer."
  > "Hubris: ... Also the quality that makes you write (and maintain) programs that other people won't want to say bad things about. Hence, the third great virtue of a programmer."
  このサイトは「初版と第2版の混成」と述べているが、版の帰属自体は未検証。
- 「初版の序文が原典」という日本語圏でよく見る言説は、今回O'Reillyのサンプル章（403）・archive.orgともに当たれず、**確実に言えるのは「Programming Perlの用語集（第2〜4版）」が出典であること**まで。記事で「初版の序文より」と断定しないこと。
- 日本語の「怠惰」とLazinessの語義ズレを専門的に論じた日本語記事は見つからなかった（Zenn記事は好意的な意訳にとどまる）。最も近い指摘は英語圏のpython.orgメーリングリスト（2007年、Xah Lee氏） https://www.python.org/pipermail/python-list/2007-April/447275.html 。

### 読めなかったもの

- Programming Perl 初版そのもの（403 / 未許可ミラーのため意図的に開かなかった）。

---

## 3. WHOの健康概念と現代的議論

**判定: ✅ 1946年定義は確認。Huber et al. 2011の批判部分は確認、新定義の提案文言は二次確認止まり。**

- WHO憲章（1946年7月22日採択、1948年4月7日発効）: https://www.who.int/about/governance/constitution
  > "Health is a state of complete physical, mental and social well-being and not merely the absence of disease or infirmity."
- Huber M, et al. "How should we define health?" *BMJ* 2011;343:d4163. doi:10.1136/bmj.d4163
  - 直接確認できた批判部分（VCU転載 https://commed.vcu.edu/IntroPH/Introduction/2011/defHtlhjul11_BMJ.html ）:
    > "The WHO definition of health as complete wellbeing is no longer fit for purpose given the rise of chronic disease."
    - 「complete」という基準は達成不可能で、慢性疾患・障害のある人を一律に「病気」と断定してしまう、定義として測定不能（impracticable）という3点の批判。
  - ⚠️ 新定義「the ability to adapt and self manage in the face of social, physical, and emotional challenges」は、BMJ本誌（403）・doi.org経由（403）・moodle2.units.itのPDF（ログイン要求）いずれも直接確認できず、複数の二次要約の一致のみで裏取り。**記事では「二次要約による」と明記するか、提案文の引用自体は避けるのが安全。**
- 「ポジティブヘルス」概念は、2011年BMJ論文がそのまま体系化したものではなく、Huberらの**後続研究**で発展させたもの（Institute for Positive Health, オランダ: https://www.iph.nl/en/knowledge-base/who-definition-of-health-appears-too-static/ ）。「2011年論文＝ポジティブヘルスの原典」と単純化しないこと。
- 健康／well-being／QOLの三者関係を一望できる単一の公的資料は見つからなかった。CDCのページ群（archive.cdc.gov/.../hrqol/concept.htm、cdc.gov/emotional-well-being/...）に分散している。

---

## 4. 記憶の外部化・認知科学

**判定: 全体として⚠️。中心的な実証研究の一つ（Sparrow 2011のGoogle Stroop効果）は独立追試で再現に失敗しており、「外部化で記憶力が落ちる」を強く主張する根拠にはできない。**

### 認知的オフローディング（Risko & Gilbert, 2016, *Trends in Cognitive Sciences*）

- 定義（原文ペイウォールのため後続論文からの引用経由、⚠️）:
  > "the use of physical action to alter the information processing requirements of a task so as to reduce cognitive demand"
- 著者らは「人は内的能力より効率的だと判断したときにオフロードするが、その判断は実際の効率と必ずしも一致しない」とも注記している。**「外部化＝常に合理的」という単純化を避ける根拠になる。**

### Google Effects on Memory（Sparrow, Liu, & Wegner, 2011, *Science*）

- 情報の「内容」より「どこで見つけられるか」を優先的に記憶するという主張（原文PDFは展開失敗、要約記事経由）。
- ⚠️ **重要**: 2018年の大規模追試プロジェクト（21件の社会科学研究）で、この論文の実験1（"Google Stroop効果"）は**再現に失敗**（再現率62%、効果量は元論文の半分程度）。2020年のPeerJ掲載の独立追試（Hesselmann）でも決定的な効果は確認されず。
- McGill大学の科学リテラシー機関は「"デジタル健忘症"はもともとKaspersky社のマーケティング用語であり、現状の実証研究はこの見出しを正当化しない」と評価。**記事でこの論文を引く場合、再現性問題を併記すること。**

### Saving-enhanced memory（Storm & Stone, 2015, *Psychological Science*）

- 「保存した」という認識が新情報の学習を促進する、という実験結果（⚠️二次確認、プレスリリース経由）。ただし「保存が確実に機能すると信じている場合にのみ」出現する効果であり、無条件の効果ではない。
- 類似の「写真を撮ると記憶が悪化する」(photo-taking-impairment effect, Henkel 2014) とは別の現象であり、混同しないこと。

### Extended Mind（Clark & Chalmers, 1998, *Analysis*）

- オットー（ノートに頼るアルツハイマー病患者）とインガ（生物学的記憶）の思考実験。ノートの情報はオットーにとって「記憶と同じ役割」を果たすとする、能動的外在主義（active externalism）の主張（⚠️原文403、Philosophy Now誌の解説経由で引用確認）。
- **これは哲学的な存在論の主張であり、「記憶力が維持される／低下する」という実証的主張ではない。** 認知的オフローディングの実証研究と混同しないこと。

### 分散認知（Hutchins, 1995, *Cognition in the Wild*）

- 認知は個人の頭の中に閉じず、人・道具・環境からなるシステムに分散しているという主張（⚠️要約サイト経由、原著未読）。

### 「脳＝ストレージ」比喩への批判

- Robert Epstein (Aeon誌 "The Empty Brain") が「脳に記憶バンクは存在しない」と主張する一方、批判者は「言い過ぎ、記憶は保持と再構成の両方を含む」と反論。**論争は決着していないので、記事では「一部の論者の立場」として距離を置いて紹介する。**

### 保存と想起の区別

- 符号化・貯蔵・想起という段階の区別、cue-dependent forgetting（Tulving, 1974）という考え方は心理学的に広く受容されているが、**原著論文は未読（講義資料・百科事典経由）**。厳密引用が必要なら追加確認が必要。⬜

---

## 5. 補助技術と利用者の自律性

**判定: ✅ 公的文書の「当事者参加」原則は確認。「依存とパターナリズム」の明示的対比は一次文書になく、学術的解釈（二次）で補う必要がある。**

- WHO/UNICEF *Global report on assistive technology* (2022): https://www.who.int/publications/i/item/9789240049451
  > "Users should be seen as partners in assistive technology service provision, not passive service recipients. ... they should be consulted and actively involved in every aspect at all levels of assistive technology."
  - ⚠️ 本文中に「dependency」「paternalism」という語自体は見当たらなかった（grep確認済み）。「依存と支援の区別」を主張する場合は、この報告書の文言と、学術的パターナリズム論（下記）を分けて引用する必要がある。
- CRPD（障害者権利条約）第12条: https://www.un.org/development/desa/disabilities/convention-on-the-rights-of-persons-with-disabilities/article-12-equal-recognition-before-the-law.html
  > "persons with disabilities enjoy legal capacity on an equal basis with others in all aspects of life"（第2項）
  > "respect the rights, will and preferences of the person"（第4項、セーフガード要件）
  - 条文自体に「パターナリズム」の語はないが、学術的注釈（Kong, *Laws* 2015, doi:10.3390/laws4040709 ほか、⚠️二次）は第12条を「代理決定（パターナリズム）から支援付き意思決定への転換」と解釈している。
- パターナリズム批判の学術文献（⚠️アブストラクトレベル）: Barclay (2024) *Journal of Ethics and Social Philosophy* 27(1)、Ghosh, Liedo & Riek (2024, HRI workshop, "ableist paternalism")。
- "Nothing About Us Without Us": James I. Charlton, *Nothing About Us Without Us: Disability Oppression and Empowerment*, UC Press, 1998（書誌情報は✅）。「1993年に南アフリカの活動家から聞いた」という起源説は複数の二次情報にあるが、原著PDFが403で未確認⬜。

---

## 6. 顔認識技術のプライバシーと同意

**判定: ✅ 誤認識率の一次確認はできた。法制度は条文レベルで確認、BIPAのみ二次ソース経由。**

- Gender Shades (Buolamwini & Gebru, 2018, PMLR Vol.81): https://proceedings.mlr.press/v81/buolamwini18a.html
  - Table 4（PPBデータセット全体）: 暗い肌色の女性の誤り率 Microsoft 20.8% / Face++ 34.5% / IBM 34.7%、明るい肌色の男性は0.0%〜0.8%。
  - ⚠️ よくある誤引用注意: 「34%高い」ではなく「誤り率そのものが最大34.7%」。記事で数字を使う際は正確に。
- GDPR第9条（生体データの特別カテゴリー、明示的同意）: https://gdpr-info.eu/art-9-gdpr/
- イリノイ州BIPA（740 ILCS 14/15(b)）: 書面による通知・目的開示・本人の署名による同意の3条件（⚠️公式ilga.govは接続エラー、findlaw経由で確認）。写真自体は定義上除外されるが、写真から抽出した顔特徴データは判例上規制対象になりうる（Sosa v. Onfido, N.D. Ill. 2022、⚠️）。
- 第三者（被写体以外）への影響: Hasan et al. (2020) "Automatically Detecting Bystanders in Photos" IEEE S&P（⚠️書誌確認のみ、全文未読）。

---

## 7. 日本の個人情報保護法・顔認識関連の規律

**判定: ❌ PRD §6の想定「2021年公表」は誤り。正しくは2023年3月公表。この訂正は記事の正確性上重要。**

- 個人情報保護委員会「犯罪予防や安全確保のための顔識別機能付きカメラシステムの利用について」: **令和5年（2023年）3月公表**（検討会設置は2022年1月、全8回の会合）。PDF: https://www.ppc.go.jp/files/pdf/kaoshikibetsu_camera_system.pdf
  - 2021年に実際に起きたのは、JR東日本が駅の防犯カメラに顔識別機能を導入し出所者等を検知していたことが2021年9月に報道され批判を受けた事案（⚠️報道ベース、二次）。この件が検討会設置の背景と見られるが、PPC自身が2021年に文書を出した一次証拠はない。
- 顔特徴データ＝個人識別符号の定義（PPC文書より直接抽出）:
  > "顔特徴データ：顔特徴量のうち法第２条第２項第１号、施行令第１条第１号ロ及び規則第２条に該当する個人識別符号のこと。"
- 要配慮個人情報と同意原則（法第20条第2項、PPC文書より直接抽出）:
  > "個人情報取扱事業者は、次に掲げる場合を除くほか、あらかじめ本人の同意を得ないで、要配慮個人情報を取得してはならない。"
  - 例外（施行令第9条第1号）: 防犯カメラに偶然犯罪行為が映っただけでは要配慮個人情報に該当しない。一方、**照合用データベースに顔特徴データとして登録する場合は、原則としてあらかじめ本人の同意が必要**（PPC文書の立場）。
- 関連: サーマルカメラに関する注意喚起（2023年9月13日付、⚠️タイトル・日付のみ確認）。

### 記事に使える切り口

- E.D.I.T.Hは「照合用データベースに顔特徴データを登録する」システムそのものであり、PPCの立場に従えば**撮影される本人の同意が原則必要**になる。しかし現状の実装（§1）には同意取得フローがない。この法制度と実装のギャップこそ、第5〜6章で扱うべき具体的な論点。

---

## 8. デジタルヘルスの評価と社会実装

**判定: ✅ 制度の存在と思想（リスクに応じた段階的エビデンス要求）は確認。「過度な代行が自立を損なう」という本記事の核心に直結する実証研究は乏しい。**

- NICE Evidence Standards Framework for Digital Health Technologies（英国、2018年策定、2021年4月改訂）: https://www.nice.org.uk/about/what-we-do/our-programmes/evidence-standards-framework-for-digital-health-technologies （直接フェッチ403、PMC論文で補強 https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8236783/ ）
  - 機能のリスク（Tier1〜3b）に応じて要求エビデンスの質・量を増やす累積方式。採用は任意で、基準適合はNICEによる承認を意味しない。
- FDA Digital Health Center of Excellence: https://www.fda.gov/medical-devices/digital-health-center-excellence/about-digital-health-center-excellence
  > "empower stakeholders to advance health care by fostering responsible and high-quality digital health innovation"
  - 規制助言は行うが、認可の最終判断機関ではないと明記。
- 日本の「プログラム医療機器」制度: 「プログラム医療機器の特性を踏まえた適切かつ迅速な承認及び開発のためのガイダンス」(令和5年5月29日付事務連絡、令和6年6月5日第二版)、「二段階承認に係る取扱いについて」(令和5年11月16日付、医薬機審発1116第2号)。政策的背景は「DASH for SaMD」(2020年11月)、「DASH for SaMD 2」(2023年9月)。
- 医療DX令和ビジョン2030: https://www.mhlw.go.jp/stf/iryoudx_links.html
  > 「『全国医療情報プラットフォーム』の創設、電子カルテの標準化等、診療報酬改定DXその他関連する施策を推進する」
  - 推進チーム設置は2022年9月。出自は自民党政務調査会2022年5月提言、骨太方針2022に明記。
- HTA（医療技術評価）の定義: WHO "Health technology assessment of medical devices" (2025, 2nd ed.) https://www.who.int/publications/i/item/9789240110878
  > "HTA is a multidisciplinary process used to evaluate the clinical, economic, ethical implications and social impact of new health technologies"
  - ⚠️ 「安全性・有効性・受容性・当事者参加」を単一のセットとして明示する公的文書は見つからず、複数ソース（WHO定義、WHO-INTEGRATE、患者参加に関する論文）の合成。記事で「HTAはこの4条件を要求する」と断定しないこと。

### ❌ 核心的な主張に直結するが、根拠が乏しい点

- Cochrane系統的レビュー CD009627（2017）「認知症の記憶支援のための支援技術」: https://www.cochrane.org/evidence/CD009627_assistive-technology-memory-support-dementia
  > "We found no studies that met our criteria." / "Therefore we cannot be sure at the moment whether or not AT can really help people with dementia manage their memory problems."
  - **基準を満たす研究が1件もなく、効果の有無を判断できないというのがレビューの結論。** 「過度な代行が自立を損なう」という主張を直接支持する実証研究は、今回の調査では見つからなかった。
  - 「デジタル健忘（digital amnesia）」という一般向け言説は、Kaspersky社の2015年消費者調査（査読なし企業レポート）が出所であり、学術的再現研究は確認できない。

### 記事に使える切り口

- 「怠惰（努力の削減）は健康を損なうか」という問いに対する直接的な実証研究はまだ乏しい、という**エビデンスの不在そのもの**を論点にするのが誠実。「研究で明らかになっている」ではなく「まだよく分かっていないからこそ議論する価値がある」という構成にする。

---

## 未確認・積み残し

- [ ] Larry Wallの三大美徳が「初版の序文」由来だという通説の原典確認
- [ ] Huber et al. 2011の新健康定義の提案文言そのものの一次確認（現状は二次要約のみ）
- [ ] Risko & Gilbert (2016) 原文の直接確認（ペイウォール）
- [ ] Clark & Chalmers (1998) 原文の直接確認（403）
- [ ] Hutchins (1995) 原著の直接確認（未読、要約のみ）
- [ ] イリノイ州BIPA条文の公式原文（ilga.go.v、接続エラーのため）
- [ ] HTAの「安全性・有効性・受容性・当事者参加」4条件セットを単一文書で裏付ける一次資料（複数ソースの合成に留まっている）
- [ ] 「過度な代行が自立を損なう」という主張を支持する認知症領域の実証研究（現状は見つからず、Cochraneは「エビデンス不足」と結論）

## 探したが取れなかったもの

- Programming Perl 初版の序文原文 — 403 / 無許可ミラーのため意図的に非開封
- BMJ 2011論文（Huber et al.）の全文 — bmj.com・doi.org経由ともに403、moodle2.units.itはログイン要求
- Sparrow et al. (2011) 原文PDF — Harvard研究室ホスト版あるがFlateDecode圧縮で展開不可
- ScienceDirect（Risko & Gilbert）、CogPrints・protevi.com（Clark & Chalmers）、PubMed — いずれもWebFetchで403／Cookie障壁
- イリノイ州BIPA公式条文（ilga.gov） — ECONNREFUSED
- PPC「『顔』情報の活用の留意点」という資料名の一次文書 — 弁護士事務所解説サイトのみで言及され、ppc.go.jp上で該当タイトルの文書を特定できず（別名称の文書との混同の可能性）
