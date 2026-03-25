#!/bin/bash
set -e

cd /opt/voicepeak-installer

echo "=== VOICEPEAKダウンローダーを実行 ==="
chmod +x voicepeak-downloader-linux64
./voicepeak-downloader-linux64

echo ""
echo "=== ダウンロード完了。ファイルを移動中... ==="

# デフォルトの展開先からinstallerディレクトリに移動
if [ -d "/root/Documents/Voicepeak Downloads" ]; then
    mv "/root/Documents/Voicepeak Downloads"/* /opt/voicepeak-installer/
    rm -rf "/root/Documents/Voicepeak Downloads"
    echo "=== 完了: /opt/voicepeak-installer/ に配置されました ==="
    ls -la /opt/voicepeak-installer/
else
    echo "=== 警告: /root/Documents/Voicepeak Downloads が見つかりません ==="
    echo "手動で installer/ ディレクトリに配置してください"
fi
