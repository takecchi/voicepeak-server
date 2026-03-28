# voicepeak-server

> **⚠ 注意: `voicepeak-api` イメージは `docker build` で再ビルドしないでください。アクティベーションが無効になります。**

> **⚠ 注意: イメージを削除する前に、必ずVNC（画面共有）でコンテナに接続し、VOICEPEAK の UI 上でアクティベーションコードの解除（ディアクティベーション）を行ってください。**
> アクティベーションコードの認証回数には制限があり、解除せずにイメージを削除すると認証が停止される場合があります。

VOICEPEAKをDocker上で動作させ、REST APIとして利用するためのプロジェクト。

## 前提条件

- Docker Desktop (BuildKit有効)
- VOICEPEAKのアクティベーションコード
- VNCクライアント (macOSは標準搭載の画面共有、[RealVNC Viewer](https://www.realvnc.com/en/connect/download/viewer/) 等)

## クイックスタート

対話形式のセットアップスクリプトですべての手順を案内します:

```bash
./setup.sh
```

## セットアップの仕組み

1. `Dockerfile` からベースイメージをビルド（Ubuntu + VNC + Node.js + NestJS）
2. セットアップ用コンテナを固定MACアドレスで起動（`setup/` のみマウント）
3. VNC接続してVOICEPEAKのダウンロード・インストール・アクティベーション（コンテナ内で完結）
4. `docker cp` でアクティベーション済みの Voicepeak をコンテナから取り出し
5. セットアップイメージを FROM にして `COPY` で Voicepeak を焼き込んだイメージを `voicepeak-api` としてビルド

**重要:** アクティベーションはセットアップ時のイメージに紐づいています。同じ Dockerfile でも `docker build` し直すと別イメージになり、アクティベーションが無効になります。

## セットアップ詳細

### 1. VOICEPEAKダウンローダーの準備

[AHS公式セットアップページ](https://www.ah-soft.com/voice/setup/) から
`voicepeak-downloader-linux64` をダウンロードし、`setup/` に配置する。

### 2. セットアップ実行

```bash
./setup.sh
```

スクリプトが以下を行います:
- `.env` にMACアドレスを生成・保存
- セットアップ用コンテナをビルド・起動
- VNCでのダウンロード・アクティベーションを案内
- `docker cp` で Voicepeak を取り出し
- `COPY` で焼き込んだイメージを `voicepeak-api` としてビルド

### 3. 手動でのVNC操作

VNCクライアントで `localhost:5901` (パスワード: `voicepeak`) に接続し、ターミナルから:

```bash
# ダウンローダー実行
/opt/setup/install.sh

# GUIでアクティベーション・キャラクターインストール
/opt/voicepeak/voicepeak

# 確認
/opt/voicepeak/voicepeak --list-narrator
```

ナレーター一覧が表示されれば成功。

### 4. 起動

```bash
docker compose up -d
```

Swagger UI: http://localhost:8181/api

## 動作確認

```bash
# ヘルスチェック
curl http://localhost:8181/voicepeak/health

# ナレーター一覧
curl http://localhost:8181/voicepeak/narrators

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

## ファイル構成

| ファイル | 用途 |
|---------|------|
| `Dockerfile` | ベースイメージ (Ubuntu 20.04 + VNC + Node.js + NestJS) |
| `docker-compose.setup.yml` | セットアップ用コンテナ起動 |
| `docker-compose.yml` | APIサーバー起動用 |
| `setup.sh` | 対話形式セットアップスクリプト |
| `.env` | MACアドレス (setup.sh が生成、.gitignore 対象) |
| `api/` | NestJS APIサーバーのソースコード |
| `setup/` | ダウンローダー + コンテナ内セットアップスクリプト |

## 備考

- `iconv_open is not supported` という警告が出るが、動作に影響はない
- VOICEPEAK CLIは1回の呼び出しで最大140文字。APIサーバーでは長文を自動分割して結合する
- VOICEPEAK CLIは同時に1インスタンスしか実行できない。APIサーバーではキューイングで直列実行している
- Apple Silicon Macではamd64エミュレーションで動作するため遅い。x86_64 Linuxサーバーでは高速
