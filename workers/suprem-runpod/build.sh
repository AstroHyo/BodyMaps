#!/usr/bin/env bash
set -euo pipefail

TAG="${TAG:-$(git rev-parse --short HEAD)}"
IMAGE_NAME="${IMAGE_NAME:-astrohyo/bodymaps-suprem-worker}"

docker build --platform linux/amd64 --tag "${IMAGE_NAME}:${TAG}" .
docker push "${IMAGE_NAME}:${TAG}"
