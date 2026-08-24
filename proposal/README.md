# Web提案作成アプリ（初版）

既存の制作スケジュール管理と同じFirebaseプロジェクト、Authentication、`staff/{uid}.active` の利用可否判定を共用する独立アプリです。

## データ分離

- 制作スケジュール: `projects/{projectId}` と `tasks`
- Web提案: `proposalProjects/{proposalId}`

## Firebase反映前の作業

`firestore.rules` の `proposalProjects` ルールを既存の本番ルールへ統合し、Firebase側へ反映する必要があります。リポジトリに設定ファイルやCLI構成は含まれていないため、本実装ではデプロイしていません。

## 初版の範囲

- リニューアル: 現行URLと6観点の「現状・改善提案・期待効果・優先度」
- 営業編集: 顧客向けコメント、採用可否、概算金額、社内メモ
- 新規制作: ヒアリング情報から同じ6観点へ進む共通構造
- A4縦の複数ページプレビューとブラウザの印刷機能によるPDF保存
