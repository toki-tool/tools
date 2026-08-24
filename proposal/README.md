# Web提案作成アプリ（初版）

既存の制作スケジュール管理と同じFirebaseプロジェクト、Authentication、`staff/{uid}.active` の利用可否判定を共用する独立アプリです。

## データ分離

- 制作スケジュール: `projects/{projectId}` と `tasks`
- Web提案: `proposalProjects/{proposalId}`

## URL自動診断

- Google PageSpeed Insights APIをブラウザから直接利用します。
- APIキー、Firebase Functions、Cloud Run、有料APIは使用しません。
- モバイル／デスクトップの速度、基本SEO、アクセシビリティを取得し、既存6観点へ編集可能な下書きとして反映します。
- 入力URLは計測のためGoogle PageSpeed Insightsへ送信されます。
- 公開ページから取得できない検索順位、AI検索への掲載、店舗情報、フォーム送信可否などは断定せず、目視確認候補として扱います。
- キーなしの共有利用枠のため、上限到達・タイムアウト時は時間をおいて再実行します。

## Firebaseルール

`schedule/firestore.rules` に `proposalProjects` の認可ルールを統合済みです。既存の `staff/{uid}.active` が有効な認証済みユーザーだけが読み書きできます。

## 初版の範囲

- リニューアル: 現行URLと6観点の「現状・改善提案・期待効果・優先度」
- 営業編集: 顧客向けコメント、採用可否、概算金額、社内メモ
- 新規制作: ヒアリング情報から同じ6観点へ進む共通構造
- A4縦の複数ページプレビューとブラウザの印刷機能によるPDF保存
