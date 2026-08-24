# 制作スケジュール管理 — Phase 1.5

Firebase AuthenticationとCloud Firestoreを使用する社内向けWebアプリです。未ログイン時はログイン画面のみを表示し、認証済みかつ`staff/{uid}`の`active`が`true`の利用者だけが案件を読み書きできます。

## 構成

- `app.js`: 既存UIと画面操作
- `firebase-repository.js`: 認証・Firestore保存層
- `firebase-config.js`: ブラウザ公開用Firebase設定（秘密鍵ではありません）
- `firestore.rules`: データベース側のアクセス制御
- `styles.css` / `auth.css`: 既存画面とログイン画面のスタイル

`service role key`、秘密鍵、DBパスワードは使用しません。案件データは公開ファイルへ埋め込まず、ログイン後にFirestoreから取得します。
