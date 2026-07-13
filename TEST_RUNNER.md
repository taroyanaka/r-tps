TEST RUNNER — 実行手順

概要
- このリポジトリには Playwright を用いた自動テストランナー `pw_runner.mjs` が含まれます。
- ログはサーバー側で `log/` ディレクトリに保存されます（`server.py` が受け取ります）。

前提
- Node.js と npm がインストールされていること
- Python で `server.py` を実行できること（ローカルのファイル配信とログ受信）

セットアップ
1. 依存をインストール

```bash
npm install
npx playwright install
```

2. サーバー起動（別ターミナル）

```bash
python3 server.py
```

基本的な実行
- package.json のスクリプトを使う:

```bash
npm run playwright:run
```

環境変数オプション
- `RTPS_URL` — テスト対象のベースURL（デフォルト: `http://127.0.0.1:8000/index.html`）
- `RTPS_CONCURRENCY` — 並列実行数（デフォルト: 8）
- `RTPS_TIMEOUT_MS` — 各ケースの最大タイムアウト（ミリ秒）
- `RTPS_STALL_MS` — 進捗停止判定の閾値（ミリ秒）
- `RTPS_HEADLESS` — `false` にするとヘッドレスを無効化
- `RTPS_ONLY_NONVICTORY` — `1` または `true` を指定すると、既にログに victory が記録されているレギュレーションをスキップする

例: 既に victory のケースを除いて並列数4で実行

```bash
RTPS_ONLY_NONVICTORY=1 RTPS_CONCURRENCY=4 npm run playwright:run
```

```power shell
cmd /c "set RTPS_ONLY_NONVICTORY=1&& set RTPS_CONCURRENCY=4&& npm run playwright:run"
```

`RTPS_ONLY_NONVICTORY` の挙動
- `pw_runner.mjs` は `log/` 内の `paramName_log.txt` を読み、以下のパターンで victory を検出します:
  - `showPanel: victory`
  - `[DEBUG-WIN]`
  - 単語としての `victory` (大文字小文字無視)
- 見つかった場合はその `paramName` をスキップします。
- パターンは `pw_runner.mjs` の `hasVictoryLog()` 内の正規表現を編集して拡張できます。

ログ配置について
- クライアント側（`index.html` / `game.js`）は `http://localhost:8000/log` に POST しており、`server.py` が受け取って `log/param_log.txt` として保存します。
- 既存の `_log.txt` を移動したい場合:

```bash
mkdir -p log
mv *_log.txt log/ 2>/dev/null || true
```

トラブルシュート
- `pw_runner.mjs` が `log/` を読むため、`log/` が存在するか確認してください。
- `server.py` を再起動すると設定変更が反映されます。

関連ファイル
- `pw_runner.mjs` — テストランナー本体 ([pw_runner.mjs](pw_runner.mjs))
- `server.py` — ログ受信と zip 出力 ([server.py](server.py))

必要なら `RTPS_ONLY_NONVICTORY` の検出パターン追加やチェック並列化を行います。