#!/bin/bash
set -e

cd /opt/setup

echo "=== VOICEPEAKダウンローダーを実行 ==="
chmod +x voicepeak-downloader-linux64
./voicepeak-downloader-linux64

echo ""
echo "=== ダウンロード完了。ファイルを移動・解凍中... ==="

# デフォルトの展開先から移動
if [ -d "/root/Documents/Voicepeak Downloads" ]; then
    mv "/root/Documents/Voicepeak Downloads"/* /opt/setup/
    rm -rf "/root/Documents/Voicepeak Downloads"
else
    echo "=== 警告: /root/Documents/Voicepeak Downloads が見つかりません ==="
    echo "手動で setup/ ディレクトリにzipを配置してください"
    exit 1
fi

# zipを解凍して /opt/voicepeak に配置
if ls /opt/setup/*.zip 1>/dev/null 2>&1; then
    unzip -o /opt/setup/*.zip -d /opt/setup/
    cp -r /opt/setup/Voicepeak/* /opt/voicepeak/
    echo "=== インストール完了 ==="
else
    echo "=== 警告: zipファイルが見つかりません ==="
    exit 1
fi

ls -la /opt/voicepeak/
