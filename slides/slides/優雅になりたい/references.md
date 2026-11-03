# references｜優雅になりたい

## 調査対象の主張

- Graceful Degradation は、問題が起きても本質的な機能を残す設計思想である
- それは「全部成功」ではなく、機能を落としても利用者が目的を達成できる状態を作る
- 想定外への対応には、代替経路・切り替え条件・利用者への説明が必要である
- 「優雅さ」を人間の振る舞いに重ねる部分は、技術用語の定義ではなく今回の発表の比喩である

## 一次ソース

### MDN Glossary: Graceful degradation

- URL: https://developer.mozilla.org/en-US/docs/Glossary/Graceful_degradation
- 最終更新表示: 2025-07-11
- 要点: 最新ブラウザー向けの体験を作りつつ、古いブラウザーでも「本質的なコンテンツと機能」を提供する考え方
- 補足: Progressive enhancement とは関連するが別の方向から考える手法で、両者は補完できる

### W3C HTML Design Principles §2.2 Degrade Gracefully

- URL: https://www.w3.org/TR/html-design-principles/#degrade-gracefully
- 要点: 新しい要素・属性・APIを使っても、古い・能力の低いユーザーエージェントでコンテンツが壊れないようにする
- 具体例: 新しい要素が理解されない場合の意味やデフォルト表示、スクリプトAPIの機能検出、`canvas` / `video` のフォールバック
- 関連する原則: §4.3 では、ハードフェイルより graceful error recovery を優先するよう述べる

### Microsoft Azure Well-Architected Framework: Self-preservation

- URL: https://learn.microsoft.com/en-us/azure/well-architected/reliability/self-preservation
- 要点: コンポーネントが一時的に利用不能でも、縮退状態で業務を継続できるように graceful degradation mode を設計する
- 設計要素: 失敗の検知と自動切り替え、縮退状態で何が変わったかの通知、重要な処理を完了する代替経路
- 例: データベース障害時にキャッシュを使った読み取り専用モードへ切り替える

### Microsoft Azure Architecture Center: Throttling Pattern

- URL: https://learn.microsoft.com/en-us/azure/architecture/patterns/throttling/
- 要点: 非本質的な機能を停止・縮退させ、重要な機能のためにリソースを残すのが graceful feature degradation
- トレードオフ: レスポンスの完全性と可用性を交換する
- 例: 動画配信を低解像度に落とし、再生自体を続ける

### W3C Wiki: Graceful degradation versus progressive enhancement

- URL: https://www.w3.org/wiki/Graceful_degradation_versus_progressive_enhancement
- 要点: Graceful degradation は高機能な状態から低い体験へ落とす。Progressive enhancement は利用可能な最低限から拡張する
- 位置づけ: 今回のLTでは両者の優劣を決めず、予想外に対して目的を残す共通点だけを使う

## 発表での扱い

- 「優雅さ＝余裕の設計」は、技術概念を人の振る舞いへ移した今回の主張
- 「余裕」は、想定外が起きたときに選択肢を残すこととして説明する
- 「配慮」は、周囲に状況と次の手を伝え、相手に判断可能な状態を返すこととして説明する
- `ElegantPerson.ts` は実行可能なライブラリではなく、発表用の比喩コード
- 「人生の正しい実装」や性格診断のような断定はしない

## 未検証・採用しなかったもの

- クラシック音楽が人を優雅にする、という因果関係は扱わない。PRDにある発表者のきっかけとしてのみ使う
- 発表者のイベント運営エピソードの具体例・数字はPRDにないため、捏造しない
- 「優雅な人」の客観的な定義を心理学・哲学の学説としては提示しない

## 参考にした記事作成上の注意

- AI生成文の監査基準: https://qiita.com/kawabe0201/items/34b2fdbd4f2eff1872e0
- 記事では調査メモの取得事情を書かず、確認できた内容と今回の比喩を分ける
