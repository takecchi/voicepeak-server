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

# --- Step 1: VOICEPEAKバイナリの確認 ---
step "Step 1: VOICEPEAKバイナリの確認"

if [ -f "installer/Voicepeak/voicepeak" ]; then
  success "installer/Voicepeak/voicepeak が見つかりました。ダウンロードをスキップします。"
  NEED_DOWNLOAD=false
else
  warn "installer/Voicepeak/voicepeak が見つかりません。"
  info "VOICEPEAKのダウンロードとアクティベーションを行います。"
  NEED_DOWNLOAD=true

  # ダウンローダーの確認
  if ! ls installer/voicepeak-downloader-* 1>/dev/null 2>&1; then
    echo ""
    info "先に以下のページからダウンローダーを取得し、installer/ に配置してください:"
    info "https://www.ah-soft.com/voice/setup/"
    info "ファイル名: voicepeak-downloader-linux64"
    wait_enter

    if ! ls installer/voicepeak-downloader-* 1>/dev/null 2>&1; then
      echo "ダウンローダーが見つかりません。中断します。"
      exit 1
    fi
  fi
  success "ダウンローダーを確認しました。"
fi

# --- Step 2: VNCコンテナ起動 (必要な場合) ---
if [ "$NEED_DOWNLOAD" = true ] || [ ! -f "installer/Voicepeak/voicepeak" ]; then
  step "Step 2: VNC付きビルドコンテナの起動"

  if docker ps --filter name=voicepeak-build --format "{{.Names}}" | grep -q voicepeak-build; then
    success "voicepeak-build コンテナは既に起動しています。"
  else
    info "VNC付きビルドコンテナを起動します..."
    docker compose -f docker-compose.build.yml up --build -d
    sleep 3
    success "起動しました。"
  fi

  # --- Step 3: ダウンロード ---
  step "Step 3: VOICEPEAKのダウンロード"
  info "VNCクライアントで以下に接続してください:"
  info "  接続先: localhost:5901"
  info "  パスワード: voicepeak"
  echo ""
  info "接続後、ターミナルで以下を実行してください:"
  echo ""
  echo "  /opt/voicepeak-installer/setup.sh"
  echo ""
  info "※ 完了後は「フォルダを開く」ではなく、バツボタンを押して閉じてください。"
  wait_enter

  if [ ! -f "installer/Voicepeak/voicepeak" ]; then
    echo "installer/Voicepeak/voicepeak が見つかりません。ダウンロードが完了していない可能性があります。"
    exit 1
  fi
  success "VOICEPEAKバイナリを確認しました。"

  # --- Step 4: アクティベーション ---
  step "Step 4: ライセンスのアクティベーション"
  info "VNCクライアントのターミナルで以下を実行してください:"
  echo ""
  echo "  /opt/voicepeak-installer/Voicepeak/voicepeak"
  echo ""
  info "GUIが開くのでアクティベーションコードを入力してください。"
  wait_enter

  info "ナレーター一覧を確認しています..."
  NARRATORS=$(docker exec voicepeak-build /opt/voicepeak-installer/Voicepeak/voicepeak --list-narrator 2>/dev/null || true)
  if [ -z "$NARRATORS" ]; then
    warn "ナレーターが見つかりません。アクティベーションが完了していない可能性があります。"
    exit 1
  fi
  success "アクティベーション成功: $NARRATORS"
fi

# --- Step 5: ベースイメージのビルド ---
step "Step 5: ベースイメージのビルド"

if docker image inspect voicepeak-base >/dev/null 2>&1; then
  info "voicepeak-base イメージは既に存在します。再ビルドしますか？"
  read -rp "[y/N]: " REBUILD_BASE
  if [ "$REBUILD_BASE" != "y" ] && [ "$REBUILD_BASE" != "Y" ]; then
    success "スキップしました。"
  else
    docker build -f Dockerfile.build -t voicepeak-base .
    success "ベースイメージをビルドしました。"
  fi
else
  info "ベースイメージをビルドします..."
  docker build -f Dockerfile.build -t voicepeak-base .
  success "ベースイメージをビルドしました。"
fi

# --- Step 6: 用途選択 ---
step "Step 6: ランタイムイメージのビルド"
echo ""
echo "  1) CLI用イメージ (voicepeak)"
echo "  2) APIサーバーイメージ (voicepeak-api)"
echo "  3) 両方"
echo ""
read -rp "どちらをビルドしますか？ [1/2/3]: " BUILD_CHOICE

build_cli() {
  info "CLI用イメージをビルドしています..."
  DOCKER_BUILDKIT=0 docker build -t voicepeak .
  success "voicepeak イメージをビルドしました。"
}

build_api() {
  info "APIサーバーイメージをビルドしています..."
  DOCKER_BUILDKIT=0 docker build -f Dockerfile.api -t voicepeak-api .
  success "voicepeak-api イメージをビルドしました。"
}

case "$BUILD_CHOICE" in
  1) build_cli ;;
  2) build_api ;;
  3) build_cli; build_api ;;
  *) warn "無効な選択です。スキップします。" ;;
esac

# --- Step 7: 起動 ---
step "Step 7: 起動"

case "$BUILD_CHOICE" in
  1)
    info "CLI用イメージで動作確認を行います。"
    echo ""
    echo "  mkdir -p output"
    echo "  docker run --rm --platform linux/amd64 \\"
    echo "    -v \$(pwd)/output:/output \\"
    echo "    voicepeak -s \"テスト\" -o /output/test.wav"
    echo ""
    read -rp "実行しますか？ [y/N]: " RUN_CLI
    if [ "$RUN_CLI" = "y" ] || [ "$RUN_CLI" = "Y" ]; then
      mkdir -p output
      docker run --rm --platform linux/amd64 \
        -v "$(pwd)/output:/output" \
        voicepeak -s "テスト" -o /output/test.wav
      success "output/test.wav を生成しました。"
    fi
    ;;
  2|3)
    info "APIサーバーを起動しますか？"
    read -rp "[y/N]: " RUN_API
    if [ "$RUN_API" = "y" ] || [ "$RUN_API" = "Y" ]; then
      docker compose up -d
      sleep 3
      HEALTH=$(curl -s http://localhost:8080/voicepeak/health 2>/dev/null || true)
      if echo "$HEALTH" | grep -q "ok"; then
        success "APIサーバーが起動しました。"
        info "Swagger UI: http://localhost:8080/api"
        info "ヘルスチェック: http://localhost:8080/voicepeak/health"
      else
        warn "APIサーバーの起動を確認できませんでした。docker logs voicepeak-api を確認してください。"
      fi
    fi
    ;;
esac

echo ""
success "セットアップ完了!"
