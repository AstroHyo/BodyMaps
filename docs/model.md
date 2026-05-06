# Model Notes

BodyMaps uses a SuPreM-based worker for CT organ segmentation.

## Worker Model

- Framework: PyTorch
- Medical imaging stack: MONAI, nibabel, scipy
- Default backbone: `unet`
- Default checkpoint: `supervised_suprem_unet_2100.pth`

The worker loads the model once at startup, then handles RunPod jobs through `handler.py`.

## Supported Organs

- `spleen`
- `kidney_right`
- `kidney_left`
- `gall_bladder`
- `liver`
- `stomach`
- `aorta`
- `postcava`
- `pancreas`

## Outputs

For each requested organ, the worker returns:

- a base64-encoded `.nii.gz` segmentation mask
- `volume_cm`
- `mean_hu`

`aorta` and `postcava` return `volume_cm: "N/A"` because the current worker treats vessel volume differently from organ-volume measurements.

## Measurement Notes

Volume is computed from the generated NIfTI mask when the organ appears complete within the CT field of view. Mean HU is computed after binary erosion of the segmentation mask to reduce boundary effects.
