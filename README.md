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

### 2. Dockerイメージのビルド

**2段階のビルドが必要** (1つのDockerfileでビルドすると大きなバイナリのCOPYに問題が発生するため):

```bash
# Step 1: ベースイメージ (BuildKitで実行される)
docker build -f Dockerfile.build -t voicepeak-base .

# Step 2: ランタイムイメージ
DOCKER_BUILDKIT=0 docker build -t voicepeak .
```

### 3. 動作確認

```bash
mkdir -p output
docker run --rm --platform linux/amd64 \
  -v $(pwd)/output:/output \
  voicepeak -s "テスト" -o /output/test.wav
```

`output/test.wav` が生成されれば成功。

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
| `Dockerfile` | ランタイムイメージ (ベース + Voicepeakバイナリ) |
| `docker-compose.build.yml` | VNC付きビルドコンテナ起動用 |
| `installer/setup.sh` | ダウンローダー実行 + ファイル移動スクリプト |
| `installer/` | Voicepeakバイナリ配置先 (.gitignore) |
| `output/` | 音声出力先 (.gitignore) |

## 備考

- `iconv_open is not supported` という警告が出るが、動作に影響はない
- VOICEPEAK CLIは1回の呼び出しで最大140文字。長文は分割が必要
- Apple Silicon Macではamd64エミュレーションで動作するため遅い。x86_64 Linuxサーバーでは高速
