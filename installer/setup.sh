#!/bin/bash
set -e

cd /opt/voicepeak-installer

echo "=== VOICEPEAKダウンローダーを実行 ==="
chmod +x voicepeak-downloader-linux64
./voicepeak-downloader-linux64

echo ""
echo "=== ダウンロード完了。ファイルを移動・解凍中... ==="

# デフォルトの展開先からinstallerディレクトリに移動
if [ -d "/root/Documents/Voicepeak Downloads" ]; then
    mv "/root/Documents/Voicepeak Downloads"/* /opt/voicepeak-installer/
    rm -rf "/root/Documents/Voicepeak Downloads"
else
    echo "=== 警告: /root/Documents/Voicepeak Downloads が見つかりません ==="
    echo "手動で installer/ ディレクトリにzipを配置してください"
    exit 1
fi

# zipを解凍
if ls /opt/voicepeak-installer/*.zip 1>/dev/null 2>&1; then
    unzip -o /opt/voicepeak-installer/*.zip -d /opt/voicepeak-installer/
    echo "=== 解凍完了 ==="
else
    echo "=== 警告: zipファイルが見つかりません ==="
    exit 1
fi

echo "=== セットアップ完了 ==="
ls -la /opt/voicepeak-installer/Voicepeak/
