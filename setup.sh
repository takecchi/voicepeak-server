#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# 色付き出力
info() { echo -e "\033[1;34m[INFO]\033[0m $1"; }
success() { echo -e "\033[1;32m[OK]\033[0m $1"; }
warn() { echo -e "\033[1;33m[WARN]\033[0m $1"; }
step() { echo -e "\n\033[1;36m=== $1 ===\033[0m"; }

wait_enter() {
  echo ""
  read -rp "準備ができたら Enter を押してください..."
}

# --- Step 1: MACアドレスの生成 ---
step "Step 1: MACアドレスの確認"

if [ -f .env ] && grep -q "MAC_ADDRESS=" .env; then
  MAC=$(grep "MAC_ADDRESS=" .env | cut -d= -f2)
  success "MACアドレス: $MAC (.env から読み込み)"
else
  MAC=$(printf '02:42:%02x:%02x:%02x:%02x' $((RANDOM%256)) $((RANDOM%256)) $((RANDOM%256)) $((RANDOM%256)))
  echo "MAC_ADDRESS=$MAC" > .env
  success "MACアドレスを生成しました: $MAC (.env に保存)"
fi

# --- Step 2: VOICEPEAKのインストール ---
step "Step 2: VOICEPEAKの確認"

if [ -f "Voicepeak/voicepeak" ]; then
  success "Voicepeak/voicepeak が見つかりました。インストールをスキップします。"
  NEED_INSTALL=false
else
  warn "Voicepeak/voicepeak が見つかりません。"
  NEED_INSTALL=true

  # ダウンローダーの確認
  if ! ls setup/voicepeak-downloader-* 1>/dev/null 2>&1; then
    echo ""
    info "先に以下のページからダウンローダーを取得し、setup/ に配置してください:"
    info "https://www.ah-soft.com/voice/setup/"
    info "ファイル名: voicepeak-downloader-linux64"
    wait_enter

    if ! ls setup/voicepeak-downloader-* 1>/dev/null 2>&1; then
      echo "ダウンローダーが見つかりません。中断します。"
      exit 1
    fi
  fi
  success "ダウンローダーを確認しました。"
fi

# --- Step 3: セットアップ用コンテナの起動 ---
if [ "$NEED_INSTALL" = true ]; then
  step "Step 3: セットアップ用コンテナの起動"

  if docker ps --filter name=voicepeak-setup --format "{{.Names}}" | grep -q voicepeak-setup; then
    success "voicepeak-setup コンテナは既に起動しています。"
  else
    info "セットアップ用コンテナを起動します (MAC: $MAC)..."
    docker compose -f docker-compose.setup.yml up --build -d
    sleep 3
    success "起動しました。"
  fi

  # --- Step 4: ダウンロード ---
  step "Step 4: VOICEPEAKのダウンロード"
  info "VNCクライアントで以下に接続してください:"
  info "  接続先: localhost:5901"
  info "  パスワード: voicepeak"
  echo ""
  info "接続後、ターミナルで以下を実行してください:"
  echo ""
  echo "  /opt/setup/install.sh"
  echo ""
  info "※ 完了後は「フォルダを開く」ではなく、バツボタンを押して閉じてください。"
  wait_enter

  if [ ! -f "Voicepeak/voicepeak" ]; then
    echo "Voicepeak/voicepeak が見つかりません。ダウンロードが完了していない可能性があります。"
    exit 1
  fi
  success "VOICEPEAKバイナリを確認しました。"

  # --- Step 5: アクティベーション ---
  step "Step 5: キャラクターのインストール・アクティベーション"
  info "VNCクライアントのターミナルで以下を実行してください:"
  echo ""
  echo "  /opt/voicepeak/voicepeak"
  echo ""
  info "GUIが開くのでキャラクターのインストールを行ってください。"
  warn "重要: 必ず /opt/voicepeak/voicepeak を実行してください"
  wait_enter

  info "ナレーター一覧を確認しています..."
  NARRATORS=$(docker exec voicepeak-setup /opt/voicepeak/voicepeak --list-narrator 2>/dev/null || true)
  if [ -z "$NARRATORS" ]; then
    warn "ナレーターが見つかりません。アクティベーションが完了していない可能性があります。"
    exit 1
  fi
  success "アクティベーション成功: $NARRATORS"

  # セットアップ用コンテナを停止
  info "セットアップ用コンテナを停止します..."
  docker compose -f docker-compose.setup.yml down
  success "停止しました。"
fi

# --- Step 6: イメージのタグ付け ---
step "Step 6: voicepeak-api イメージのタグ付け"

SETUP_IMAGE=$(docker compose -f docker-compose.setup.yml images -q voicepeak-setup 2>/dev/null || true)
if [ -z "$SETUP_IMAGE" ]; then
  # compose images で取れない場合はイメージ名から探す
  SETUP_IMAGE=$(docker images --format "{{.Repository}}" | grep "voicepeak.*setup" | head -1)
fi

if [ -n "$SETUP_IMAGE" ]; then
  docker tag "$SETUP_IMAGE" voicepeak-api
  success "セットアップイメージを voicepeak-api としてタグ付けしました。"
  warn "重要: docker build で再ビルドしないでください。アクティベーションが無効になります。"
else
  warn "セットアップイメージが見つかりません。"
  info "docker-compose.setup.yml でビルド済みのイメージが必要です。"
  exit 1
fi

# --- Step 7: 起動 ---
step "Step 7: 起動"

info "APIサーバーを起動しますか？"
read -rp "[y/N]: " RUN_API
if [ "$RUN_API" = "y" ] || [ "$RUN_API" = "Y" ]; then
  docker compose up -d
  sleep 3
  HEALTH=$(curl -s http://localhost:8181/voicepeak/health 2>/dev/null || true)
  if echo "$HEALTH" | grep -q "ok"; then
    success "APIサーバーが起動しました。"
    info "Swagger UI: http://localhost:8181/api"
    info "ヘルスチェック: http://localhost:8181/voicepeak/health"
  else
    warn "APIサーバーの起動を確認できませんでした。docker compose logs を確認してください。"
  fi
fi

echo ""
success "セットアップ完了!"
