# BodyMaps SuPreM RunPod Worker

This worker is the GPU inference backend for BodyMaps. It receives a CT volume URL from the Next.js app, runs SuPreM organ segmentation on RunPod, and returns per-organ NIfTI masks plus quantitative measurements.

## Runtime Flow

1. RunPod sends a job to `handler.py`.
2. The worker validates `input.url`, `input.targets`, and numeric inference parameters.
3. The CT file is downloaded into a temporary case folder as `ct.nii.gz`.
4. The SuPreM model performs sliding-window inference.
5. Organ masks are post-processed and saved as `.nii.gz` files.
6. The worker returns base64-encoded segmentation masks with `volume_cm` and `mean_hu` values.

## Supported Targets

- `spleen`
- `kidney_right`
- `kidney_left`
- `gall_bladder`
- `liver`
- `stomach`
- `aorta`
- `postcava`
- `pancreas`

`aorta` and `postcava` return `volume_cm: "N/A"` because vessel volume is not treated as a stable organ-volume measurement in the current worker logic.

## Example Input

See `input.example.json`.

## Checkpoint Strategy

The model checkpoint is intentionally not committed as a normal Git file. The Dockerfile downloads `supervised_suprem_unet_2100.pth` from Hugging Face during image build unless a file with the expected name already exists in `src/pretrained_checkpoints`.

If you decide to keep checkpoints in the repository, use Git LFS. The root `.gitattributes` already tracks `*.pth` through LFS.

## Build

```bash
./build.sh
```

By default this builds and pushes:

```text
astrohyo/bodymaps-suprem-worker:<git-sha>
```

Override the image name or tag with:

```bash
IMAGE_NAME=your-dockerhub/bodymaps-suprem-worker TAG=latest ./build.sh
```

## Environment Variables

- `BACKBONE`: model backbone, default `unet`
- `CHECKPOINT`: checkpoint basename without `.pth`, default `supervised_suprem_unet_2100`
- `NUM_SAMPLES`: default `1`
