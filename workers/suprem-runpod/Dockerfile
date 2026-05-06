FROM python:3.10-slim

RUN apt-get update && apt-get install --yes \
  ca-certificates \
  curl \
  libgl-dev \
  libglib2.0-0 \
  && rm -rf /var/lib/apt/lists/*

RUN --mount=type=cache,target=/root/.cache/pip pip3 install \
  torch==1.11.0+cu113 --index-url https://download.pytorch.org/whl/cu113

RUN --mount=type=cache,target=/root/.cache/pip pip install \
  numpy==1.26.4 \
  tqdm \
  nibabel==5.2.1 \
  monai==0.9.0 \
  h5py==3.6.0 \
  connected-components-3d==3.12.4 \
  fastremap==1.14.1 \
  pandas==2.2.1 \
  matplotlib==3.8.3 \
  scipy==1.12.0 \
  opencv-python==4.9.0.80 \
  runpod==1.7.1 \
  requests

WORKDIR /app

ADD src .

ARG CHECKPOINT_NAME=supervised_suprem_unet_2100
ARG CHECKPOINT_URL=https://huggingface.co/MrGiovanni/SuPreM/resolve/main/supervised_suprem_unet_2100.pth?download=true

RUN mkdir -p pretrained_checkpoints && \
  if [ ! -f "pretrained_checkpoints/${CHECKPOINT_NAME}.pth" ]; then \
    curl -L "${CHECKPOINT_URL}" -o "pretrained_checkpoints/${CHECKPOINT_NAME}.pth"; \
  fi

ENV CHECKPOINT=${CHECKPOINT_NAME}

ENTRYPOINT ["python", "-u", "/app/handler.py"]
