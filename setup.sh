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

# --- Step 1: MACアドレスの確認 ---
step "Step 1: MACアドレスの確認"

if [ -f .env ] && grep -q "MAC_ADDRESS=" .env; then
  MAC=$(grep "MAC_ADDRESS=" .env | cut -d= -f2)
  success "MACアドレス: $MAC (.env から読み込み)"
else
  MAC=$(printf '02:42:%02x:%02x:%02x:%02x' $((RANDOM%256)) $((RANDOM%256)) $((RANDOM%256)) $((RANDOM%256)))
  echo "MAC_ADDRESS=$MAC" > .env
  success "MACアドレスを生成しました: $MAC (.env に保存)"
fi

# --- Step 2: デプロイ先の cpuinfo ---
step "Step 2: デプロイ先の CPU 情報"

if [ -f cpuinfo.txt ] && [ -s cpuinfo.txt ]; then
  CPU_MODEL=$(grep "model name" cpuinfo.txt | head -1 | cut -d: -f2 | xargs)
  success "cpuinfo.txt が見つかりました: $CPU_MODEL"
else
  info "デプロイ先の /proc/cpuinfo の内容が必要です。"
  info "デプロイ先のサーバーで 'cat /proc/cpuinfo > cpuinfo.txt' を実行し、"
  info "このディレクトリに配置してください。"
  echo ""
  info "ローカルでのみ使用する場合は、そのまま Enter を押してください。"
  info "(ローカルの CPU 情報が使用されます。別環境へのデプロイはできません)"
  echo ""
  read -rp "Enter で自動生成 / cpuinfo.txt を配置済みなら Enter: "

  if [ ! -f cpuinfo.txt ] || [ ! -s cpuinfo.txt ]; then
    info "ローカルの CPU 情報を使用します..."
    docker run --rm --platform linux/amd64 ubuntu:20.04 cat /proc/cpuinfo > cpuinfo.txt
    warn "このセットアップはローカル環境でのみ動作します。"
  fi
  CPU_MODEL=$(grep "model name" cpuinfo.txt | head -1 | cut -d: -f2 | xargs)
  success "cpuinfo.txt を確認しました: $CPU_MODEL"
fi

# --- Step 3: ダウンローダーの確認 ---
step "Step 3: ダウンローダーの確認"

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

# --- Step 4: セットアップ用コンテナのビルド・起動 ---
step "Step 4: セットアップ用コンテナのビルド・起動"

if docker ps --filter name=voicepeak-setup --format "{{.Names}}" | grep -q voicepeak-setup; then
  success "voicepeak-setup コンテナは既に起動しています。"
else
  info "イメージをビルドしてコンテナを起動します (MAC: $MAC)..."
  info "cpuinfo フックにより、コンテナ内の /proc/cpuinfo はデプロイ先の CPU 情報を返します。"
  docker compose -f docker-compose.setup.yml up --build -d
  sleep 3
  success "起動しました。"
fi

# cpuinfo フックの動作確認
info "cpuinfo フックを確認しています..."
CONTAINER_CPU=$(docker exec voicepeak-setup head -1 /proc/cpuinfo 2>/dev/null || true)
if echo "$CONTAINER_CPU" | grep -q "processor"; then
  CONTAINER_MODEL=$(docker exec voicepeak-setup grep "model name" /proc/cpuinfo | head -1 | cut -d: -f2 | xargs)
  success "コンテナ内の CPU: $CONTAINER_MODEL"
else
  warn "cpuinfo フックが正常に動作していない可能性があります。"
fi

# --- Step 5: VOICEPEAKのダウンロード・インストール・アクティベーション ---
step "Step 5: VOICEPEAKのダウンロード・インストール・アクティベーション"

info "VNCクライアントで以下に接続してください:"
info "  接続先: localhost:5901"
info "  パスワード: voicepeak"
echo ""
info "接続後、ターミナルで以下を順番に実行してください:"
echo ""
echo "  1. /opt/setup/install.sh"
echo "     (ダウンローダーが起動します。指示に従ってインストールしてください)"
echo ""
echo "  2. /opt/voicepeak/voicepeak"
echo "     (GUIが開くのでアクティベーション・キャラクターインストールを行ってください)"
echo ""
warn "※ install.sh 完了後は「フォルダを開く」ではなく、バツボタンを押して閉じてください"
wait_enter

info "ナレーター一覧を確認しています..."
NARRATORS=$(docker exec voicepeak-setup /opt/voicepeak/voicepeak --list-narrator 2>/dev/null || true)
if [ -z "$NARRATORS" ]; then
  warn "ナレーターが見つかりません。アクティベーションが完了していない可能性があります。"
  exit 1
fi
success "アクティベーション成功: $NARRATORS"

# --- Step 6: VOICEPEAKをコンテナから取り出し ---
step "Step 6: VOICEPEAKファイルの取り出し"

info "コンテナから /opt/voicepeak をホストにコピーしています..."
rm -rf Voicepeak
docker cp voicepeak-setup:/opt/voicepeak Voicepeak
success "Voicepeak/ にコピーしました。"

# セットアップ用コンテナを停止
info "セットアップ用コンテナを停止します..."
docker stop voicepeak-setup
docker rm voicepeak-setup
success "停止しました。"

# --- Step 7: COPY 入りイメージのビルド ---
step "Step 7: voicepeak-api イメージのビルド"

info "Voicepeak/ を含むイメージをビルドしています..."

SETUP_IMAGE=$(docker images --format "{{.Repository}}" | grep "voicepeak.*setup" | head -1)
cat > /tmp/Dockerfile.voicepeak-api <<EOF
FROM ${SETUP_IMAGE}
COPY Voicepeak /opt/voicepeak
COPY cpuinfo.txt /etc/cpuinfo.override
ENV LD_PRELOAD=/usr/lib/cpuinfo_hook.so
CMD ["npm", "run", "start:prod"]
EOF

DOCKER_BUILDKIT=0 docker build -f /tmp/Dockerfile.voicepeak-api -t voicepeak-api .
rm /tmp/Dockerfile.voicepeak-api
success "voicepeak-api イメージをビルドしました。"
warn "重要: このイメージにはライセンス情報が含まれています。"
warn "      docker rmi voicepeak-api を実行する前に必ずディアクティベートしてください。"

# --- Step 8: 起動 ---
step "Step 8: 起動"

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
