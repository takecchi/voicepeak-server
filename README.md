# voicepeak-server

VOICEPEAKをDocker上で動作させるためのプロジェクト。

## 前提条件

- Docker Desktop (BuildKit有効)
- VOICEPEAKの商用ライセンス
- VNCクライアント (手動インストール時のみ)

## セットアップ

### 1. VOICEPEAKバイナリの準備

[AHS公式セットアップページ](https://www.ah-soft.com/voice/setup/) から
`voicepeak-downloader-linux64` をダウンロードし、`installer/` に配置する。

ダウンローダーを実行してVoicepeakを取得する方法は2通り:

#### 方法A: VNC付きコンテナで実行

```bash
docker compose -f docker-compose.build.yml up --build
```

VNCクライアントで `localhost:5901` (パスワード: `voicepeak`) に接続し、
ターミナルから以下を実行:

```bash
/opt/voicepeak-installer/setup.sh
```

ダウンローダーのGUIが起動するので指示に従い、完了後に自動で `installer/` にファイルが移動される。
※ 完了後は「フォルダを開く」ではなく、バツボタンを押して閉じて下さい。

#### 方法B: 既にVoicepeakのzipを持っている場合

`installer/` 配下に展開して以下の構造にする:

```
installer/
  └── Voicepeak/
      ├── voicepeak        (実行バイナリ)
      ├── dic/
      ├── fonts/
      ├── usersettings/
      └── ...
```

### 2. ライセンスのアクティベーション

方法A/Bどちらの場合も、初回はVOICEPEAKのGUIでライセンスアクティベーションが必要。

VNC付きコンテナが起動した状態で、VNCクライアントから以下を実行:

```bash
/opt/voicepeak-installer/Voicepeak/voicepeak
```

GUIが開くのでアクティベーションコードを入力する。完了後、ナレーターがインストールされていることを確認:

```bash
/opt/voicepeak-installer/Voicepeak/voicepeak --list-narrator
```

ナレーター一覧が表示されればアクティベーション成功。

### 3. Dockerイメージのビルド

**2段階のビルドが必要** (1つのDockerfileでビルドすると大きなバイナリのCOPYに問題が発生するため):

```bash
# Step 1: ベースイメージ (BuildKitで実行される)
docker build -f Dockerfile.build -t voicepeak-base .

# Step 2: ランタイムイメージ (用途に応じてどちらかを選択)
DOCKER_BUILDKIT=0 docker build -t voicepeak .             # CLI用
DOCKER_BUILDKIT=0 docker build -f Dockerfile.api -t voicepeak-api .  # APIサーバー用
```

※ APIサーバーをビルドする場合、事前に `cd api && npm ci && npm run build && cd ..` が必要。

### 4. 動作確認

#### CLI

```bash
mkdir -p output
docker run --rm --platform linux/amd64 \
  -v $(pwd)/output:/output \
  voicepeak -s "テスト" -o /output/test.wav
```

`output/test.wav` が生成されれば成功。

#### APIサーバー

事前にビルド済みの `voicepeak-api` イメージが必要 (Step 2 参照)。

```bash
docker compose up
```

別ターミナルで:

```bash
# ヘルスチェック
curl http://localhost:3000/voicepeak/health

# ナレーター一覧
curl http://localhost:3000/voicepeak/narrators

# ナレーターの感情パラメータ一覧
curl http://localhost:3000/voicepeak/narrators/Kasane%20Teto/emotions

# 音声合成
curl -X POST http://localhost:3000/voicepeak/speech \
  -H "Content-Type: application/json" \
  -d '{"text": "こんにちは"}' \
  --output test.wav
```

## API エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/voicepeak/health` | ヘルスチェック |
| GET | `/voicepeak/narrators` | ナレーター一覧 |
| GET | `/voicepeak/narrators/:narrator_name/emotions` | 指定ナレーターの感情パラメータ一覧 |
| POST | `/voicepeak/speech` | 音声合成 (WAVを返す) |

### POST /voicepeak/speech リクエストボディ

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `text` | string | Yes | 読み上げるテキスト (140文字超は自動分割) |
| `narrator` | string | No | ナレーター名 |
| `emotion` | object | No | 感情パラメータ (例: `{"happy": 50}`) |
| `speed` | number | No | 速度 (50-200) |
| `pitch` | number | No | ピッチ (-300 to 300) |

## CLI オプション

| オプション | 説明 |
|-----------|------|
| `-s, --say TEXT` | 読み上げるテキスト (最大140文字) |
| `-t, --text FILE` | テキストファイルから読み上げ |
| `-o, --out FILE` | 出力WAVファイルパス |
| `-n, --narrator NAME` | ナレーター指定 |
| `-e, --emotion EXPR` | 感情指定 (例: `happy=50,sad=25`) |
| `--speed VALUE` | 速度 (50-200) |
| `--pitch VALUE` | ピッチ (-300 to 300) |
| `--list-narrator` | ナレーター一覧 |

## ファイル構成

| ファイル | 用途 |
|---------|------|
| `Dockerfile.build` | ベースイメージ (Ubuntu 20.04 + 依存ライブラリ + VNC) |
| `Dockerfile` | CLIランタイムイメージ (ベース + Voicepeakバイナリ) |
| `Dockerfile.api` | APIサーバーイメージ (ベース + Voicepeak + NestJS) |
| `docker-compose.build.yml` | VNC付きビルドコンテナ起動用 |
| `docker-compose.yml` | APIサーバー起動用 |
| `api/` | NestJS APIサーバーのソースコード |
| `installer/setup.sh` | ダウンローダー実行 + ファイル移動スクリプト |
| `installer/` | Voicepeakバイナリ配置先 (.gitignore) |
| `output/` | 音声出力先 (.gitignore) |

## 備考

- `iconv_open is not supported` という警告が出るが、動作に影響はない
- VOICEPEAK CLIは1回の呼び出しで最大140文字。長文は分割が必要
- Apple Silicon Macではamd64エミュレーションで動作するため遅い。x86_64 Linuxサーバーでは高速
