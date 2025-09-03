# mcp-gemini-image

[![npm version](https://badge.fury.io/js/mcp-gemini-image.svg)](https://www.npmjs.com/package/mcp-gemini-image)
[![Docker Hub](https://img.shields.io/docker/v/4kk11/mcp-gemini-image?label=docker)](https://hub.docker.com/r/4kk11/mcp-gemini-image)

Google の Gemini API を使用して画像を生成・編集・分析するための MCP サーバーです。  
生成された画像は指定されたディレクトリに保存され、縮小されたプレビュー画像と共に返されます。


https://github.com/user-attachments/assets/e871be40-91d0-4391-ba4c-b289b1ef1d1f


## 主な機能

### 1. 画像生成 (generate_image)
Google の Gemini 2.5 Flash Image モデルを使用してテキストプロンプトから新しい画像を生成します。また、参照画像を指定して編集やバリエーションを作成することもできます。

**入力パラメータ:**
- `prompt`: 生成したい画像の説明または編集内容（必須）
- `images`: 参照画像のファイルパス配列（オプション）

### 2. 画像分析 (analyze_image)
Gemini 2.5 Flash の優れた視覚理解能力を使用して、画像を分析し品質確認や改善アドバイスを提供します。

**入力パラメータ:**
- `prompt`: 画像について質問するテキストプロンプト（必須）
- `images`: 分析する画像のファイルパス配列（必須）

## インストール方法

### npx を使用

設定例 (claude_desktop_config.json):
```json
{
  "mcpServers": {
    "gemini-image": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-gemini-image"
      ],
      "env": {
        "GEMINI_API_KEY": "YOUR_GEMINI_API_KEY",
        "IMAGES_DIR": "YOUR_IMAGES_DIR"
      }
    }
  }
}
```

### Docker を使用

1. Docker イメージをビルド
```bash
docker build -t mcp-gemini-image .
```

2. 設定例 (claude_desktop_config.json)
```json
{
  "mcpServers": {
    "gemini-image": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-v",
        "YOUR_IMAGES_DIR:/app/temp",
        "-e",
        "GEMINI_API_KEY=YOUR_GEMINI_API_KEY",
        "mcp-gemini-image"
      ]
    }
  }
}
```

## 環境変数

| 変数名 | 説明 | デフォルト値 |
|-------|------|-------------|
| GEMINI_API_KEY | Google Gemini API キー（必須） | - |
| GOOGLE_API_KEY | Google API キーの別名 | - |
| IMAGES_DIR | 生成・編集された画像を保存するディレクトリのパス | ./temp |

## Gemini API キーの取得方法

1. [Google AI Studio](https://aistudio.google.com/) にアクセス
2. Google アカウントでサインイン
3. 左サイドバーの「API キーを取得」をクリック
4. 新しい API キーを作成するか、既存のものを使用
5. API キーをコピーして `GEMINI_API_KEY` 環境変数に設定

## Gemini 2.5 Flash Image について

この MCP サーバーは **Gemini 2.5 Flash Image Preview** を使用します。Google のネイティブ画像生成モデルで、以下の特徴があります：

- **対話的な画像生成**: 自然な会話を通じて画像を作成・改良
- **高品質な出力**: 優秀なテキストレンダリング機能を持つ高品質な画像
- **マルチモーダル編集**: テキストプロンプトと組み合わせて既存画像を編集
- **コスト効率**: 画像あたり約 $0.039
- **反復的な改良**: 複数回のやり取りを通じて画像を段階的に改善

## 使用例

### 基本的な画像生成
```json
{
  "tool": "generate_image",
  "arguments": {
    "prompt": "夕日の時間帯の静かな山の景色と湖面の反射"
  }
}
```

### 画像編集（参照画像を使った生成）
```json
{
  "tool": "generate_image",
  "arguments": {
    "prompt": "空に虹を追加し、色をより鮮やかにしてください",
    "images": ["/path/to/your/image.jpg"]
  }
}
```

### 画像分析
```json
{
  "tool": "analyze_image",
  "arguments": {
    "prompt": "この画像の品質を評価し、改善点を教えてください",
    "images": ["/path/to/your/image.jpg"]
  }
}
```

### 複数画像の比較分析
```json
{
  "tool": "analyze_image",
  "arguments": {
    "prompt": "これらの画像を比較して違いを教えてください",
    "images": ["/path/to/image1.jpg", "/path/to/image2.jpg"]
  }
}
```

## 開発者向け

### ローカル開発

```bash
# 依存関係をインストール
npm install

# プロジェクトをビルド
npm run build

# ローカルで実行
node build/index.js
```

### Docker イメージのビルド

```bash
# Docker イメージをビルド
make docker-build

# Docker イメージをクリーン
make docker-clean
```

### プロジェクト構造

```
mcp-gemini-image/
├── src/
│   ├── index.ts      # エントリーポイント
│   └── imagen.ts     # メインサーバーロジック
├── build/            # コンパイルされた JavaScript
├── package.json      # 依存関係
├── tsconfig.json     # TypeScript 設定
├── Dockerfile        # コンテナ設定
└── Makefile          # ビルド自動化
```

## 重要な注意事項

- 生成されたすべての画像には SynthID ウォーターマークが含まれます（Imagen 3 の場合）
- プレビュー用に画像は自動的に 1/4 サイズにリサイズされます
- オリジナルのフルサイズ画像は指定されたディレクトリに保存されます
- サーバーが機能するには有効な Gemini API キーが必要です
- エラーハンドリングには詳細なエラーメッセージが含まれトラブルシューティングに役立ちます

## トラブルシューティング

### API キーの問題
- `GEMINI_API_KEY` が有効で期限切れでないことを確認してください
- Google AI Studio アカウントに十分なクォータ/クレジットがあることを確認してください

### 権限の問題
- `IMAGES_DIR` パスが存在し書き込み可能であることを確認してください
- Docker 使用時は、ボリュームマウントが正しい権限を持っていることを確認してください

### モデルの可用性
- 一部のモデルには地域的な利用制限がある場合があります
- 最新のモデルの可用性については Google AI Studio を確認してください

## ライセンス

このプロジェクトは MIT ライセンスの下でリリースされています。詳細は [LICENSE](LICENSE) ファイルを参照してください。
