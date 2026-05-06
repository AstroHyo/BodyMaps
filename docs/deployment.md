# Deployment

BodyMaps has two deployment surfaces:

- Web app: Vercel-hosted Next.js application.
- Inference worker: Docker image deployed to a RunPod serverless endpoint.

## Web App

Required environment variables:

- `RUNPOD_ENDPOINT`
- `RUNPOD_ENDPOINT_KEY`
- `BLOB_READ_WRITE_TOKEN`
- `PASSWORD`

Security-related optional variables:

- `ALLOWED_CT_URL_HOSTS`: comma-separated extra HTTPS hosts that may provide CT `.nii.gz` files. Public Vercel Blob hosts are allowed by default.
- `MAX_CT_DOWNLOAD_BYTES`: worker-side CT download cap. Defaults to 32 MiB.
- `DISABLE_PASSWORD`: local development only. The application ignores this bypass when `NODE_ENV=production`.

Local development:

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
```

## RunPod Worker

Build from the worker directory:

```bash
cd workers/suprem-runpod
./build.sh
```

The default image name is:

```text
astrohyo/bodymaps-suprem-worker:<git-sha>
```

Override with:

```bash
IMAGE_NAME=your-dockerhub/bodymaps-suprem-worker TAG=latest ./build.sh
```

## Checkpoint Handling

The Dockerfile downloads `supervised_suprem_unet_2100.pth` from Hugging Face during image build. If a local checkpoint is placed at `workers/suprem-runpod/src/pretrained_checkpoints/supervised_suprem_unet_2100.pth`, it should be tracked with Git LFS.

## Connecting Web to Worker

Set `RUNPOD_ENDPOINT` to the base RunPod endpoint URL without the trailing `/runsync`. The Next.js API route appends `/runsync` internally.

## RunPod Smoke Test

After deploying the worker image to a RunPod serverless endpoint, run:

```bash
RUNPOD_ENDPOINT=... \
RUNPOD_ENDPOINT_KEY=... \
BODYMAPS_TEST_CT_URL=https://example.com/path/to/ct.nii.gz \
python3 scripts/runpod_smoke_test.py
```

The script validates that the endpoint returns per-organ base64 segmentation masks with `volume_cm` and `mean_hu`.

On Apple Silicon, the locally built `linux/amd64` image may not import the CUDA PyTorch wheel under emulation. Treat local Docker build success as packaging verification, and use RunPod for the real inference smoke test.
