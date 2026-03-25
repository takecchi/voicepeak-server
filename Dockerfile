ARG BASE_IMAGE=voicepeak-base
FROM ${BASE_IMAGE}

COPY installer/Voicepeak /opt/voicepeak
WORKDIR /opt/voicepeak
ENTRYPOINT ["./voicepeak"]
