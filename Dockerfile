FROM --platform=linux/amd64 ubuntu:20.04

ENV DEBIAN_FRONTEND=noninteractive
ENV LANG=ja_JP.UTF-8
ENV LANGUAGE=ja_JP:ja
ENV LC_ALL=ja_JP.UTF-8

# VOICEPEAK動作に必要なパッケージ群 + Node.js
# xfce4の依存ライブラリがVOICEPEAKの音声合成に必要なため、デスクトップ環境ごとインストール
RUN apt-get update && apt-get install -y \
    locales fonts-noto-cjk \
    xfce4 xfce4-terminal dbus-x11 \
    tigervnc-standalone-server tigervnc-common \
    libpulse0 libasound2 libgl1-mesa-glx libxkbcommon-x11-0 \
    libxcb-xinerama0 libxcb-icccm4 libxcb-image0 libxcb-keysyms1 \
    libxcb-randr0 libxcb-render-util0 libxcb-shape0 \
    wget curl file sudo unzip \
    && locale-gen ja_JP.UTF-8 \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# VNC設定 (手動作業時にGUIアクセスするため)
RUN mkdir -p /root/.vnc \
    && echo "voicepeak" | vncpasswd -f > /root/.vnc/passwd \
    && chmod 600 /root/.vnc/passwd

RUN echo '#!/bin/sh\nstartxfce4 &' > /root/.vnc/xstartup \
    && chmod +x /root/.vnc/xstartup

# machine-idを固定 (ライセンス認証の一貫性のため)
RUN echo "voicepeak-server" > /etc/machine-id

# cpuinfo フック (デプロイ先と異なるCPUでもアクティベーションを維持するため)
COPY setup/cpuinfo-hook/cpuinfo_hook.c /tmp/cpuinfo_hook.c
RUN apt-get update && apt-get install -y --no-install-recommends gcc libc6-dev \
    && gcc -shared -fPIC -o /usr/lib/cpuinfo_hook.so /tmp/cpuinfo_hook.c -ldl \
    && rm /tmp/cpuinfo_hook.c \
    && apt-get purge -y gcc libc6-dev && apt-get autoremove -y \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# VOICEPEAKインストール先
RUN mkdir -p /opt/voicepeak

# NestJSアプリのビルド
COPY api/package.json /tmp/build/package.json
COPY package-lock.json /tmp/build/package-lock.json
RUN cd /tmp/build && npm ci

COPY api/ /tmp/build/
RUN cd /tmp/build && npm run build \
    && mkdir -p /app \
    && cp -r dist /app/dist \
    && cp package.json /app/package.json \
    && cp /tmp/build/package-lock.json /app/package-lock.json \
    && cd /app && npm ci --omit=dev \
    && rm -rf /tmp/build

WORKDIR /app

# VNC起動スクリプト
RUN echo '#!/bin/bash\n\
vncserver :1 -geometry 1280x720 -depth 24 -localhost no\n\
echo "VNC server started on port 5901 (password: voicepeak)"\n\
tail -f /root/.vnc/*:1.log' > /start-vnc.sh \
    && chmod +x /start-vnc.sh

ENV PORT=8181
EXPOSE 8181 5901

CMD ["npm", "run", "start:prod"]
