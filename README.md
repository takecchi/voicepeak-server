# voicepeak-server

VOICEPEAKをDocker上で動作させ、CLIまたはREST APIとして利用するためのプロジェクト。

## 前提条件

- Docker Desktop (BuildKit有効)
- VOICEPEAKのアクティベーションコード
- VNCクライアント (macOSは標準搭載の画面共有、[RealVNC Viewer](https://www.realvnc.com/en/connect/download/viewer/) 等)

## クイックスタート

対話形式のセットアップスクリプトですべての手順を案内します:

```bash
./setup.sh
```

手動で行う場合:

```bash
# 1. VNC付きビルドコンテナを起動
docker compose -f docker-compose.build.yml up --build

# 2. VNCで localhost:5901 に接続 (パスワード: voicepeak)
#    → setup.sh でダウンロード、voicepeak コマンドでアクティベーション (後述)

# 3. ベースイメージをビルド
docker build -f Dockerfile.build -t voicepeak-base .

# 4. 用途に応じてイメージをビルド
DOCKER_BUILDKIT=0 docker build -t voicepeak .             # CLI用
DOCKER_BUILDKIT=0 docker build -f Dockerfile.api -t voicepeak-api .  # APIサーバー用

# 5. 起動
docker compose up  # APIサーバー (http://localhost:8181)
```

## セットアップ詳細

### 1. VOICEPEAKバイナリの準備

[AHS公式セットアップページ](https://www.ah-soft.com/voice/setup/) から
`voicepeak-downloader-linux64` をダウンロードし、`installer/` に配置する。

```bash
docker compose -f docker-compose.build.yml up --build
```

VNCクライアントで `localhost:5901` (パスワード: `voicepeak`) に接続し、ターミナルから:

```bash
/opt/voicepeak-installer/setup.sh
```

ダウンローダーのGUIが起動するので指示に従う。完了後に自動で `installer/` にファイルが移動される。  
※ 完了後は「フォルダを開く」ではなく、バツボタンを押して閉じること。

### 2. ライセンスのアクティベーション

初回はVOICEPEAKのGUIでライセンスアクティベーションが必要。

VNC付きコンテナが起動した状態で、VNCクライアントのターミナルから:

```bash
# GUIが起動するのでアクティベーションコードを入力
/opt/voicepeak-installer/Voicepeak/voicepeak

# アクティベーション完了後、ナレーター一覧で確認
/opt/voicepeak-installer/Voicepeak/voicepeak --list-narrator
```

ナレーター一覧が表示されれば成功 (例: `Kasane Teto`)。

### 3. Dockerイメージのビルド

**2段階のビルドが必要** (1つのDockerfileでビルドすると大きなバイナリのCOPYに問題が発生するため):

```bash
# Step 1: ベースイメージ
docker build -f Dockerfile.build -t voicepeak-base .

# Step 2: 用途に応じてどちらかを選択
DOCKER_BUILDKIT=0 docker build -t voicepeak .             # CLI用
DOCKER_BUILDKIT=0 docker build -f Dockerfile.api -t voicepeak-api .  # APIサーバー用
```

APIサーバーはマルチステージビルドのため、NestJSのビルドもDockerfile内で行われる。ホスト側での事前ビルドは不要。

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

```bash
docker compose up
```

Swagger UI: http://localhost:8181/api

別ターミナルで:

```bash
# ヘルスチェック
curl http://localhost:8181/voicepeak/health

# ナレーター一覧
curl http://localhost:8181/voicepeak/narrators

# ナレーターの感情パラメータ一覧
curl http://localhost:8181/voicepeak/narrators/Kasane%20Teto/emotions

# 音声合成
curl -X POST http://localhost:8181/voicepeak/speech \
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
| `emotion` | object | No | 感情パラメータ (例: `{"teto-overactive": 50}`) |
| `speed` | number | No | 速度 (50-200) |
| `pitch` | number | No | ピッチ (-300 to 300) |

## CLI オプション

| オプション | 説明 |
|-----------|------|
| `-s, --say TEXT` | 読み上げるテキスト (最大140文字) |
| `-t, --text FILE` | テキストファイルから読み上げ |
| `-o, --out FILE` | 出力WAVファイルパス |
| `-n, --narrator NAME` | ナレーター指定 |
| `-e, --emotion EXPR` | 感情指定 (例: `teto-overactive=50,teto-sweet=25`) |
| `--speed VALUE` | 速度 (50-200) |
| `--pitch VALUE` | ピッチ (-300 to 300) |
| `--list-narrator` | ナレーター一覧 |
| `--list-emotion NARRATOR` | 指定ナレーターの感情パラメータ一覧 |

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
- VOICEPEAK CLIは1回の呼び出しで最大140文字。APIサーバーでは長文を自動分割して結合する
- Apple Silicon Macではamd64エミュレーションで動作するため遅い。x86_64 Linuxサーバーでは高速
