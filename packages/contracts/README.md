# BodyMaps Contracts

This package documents the interface between the BodyMaps web app and the SuPreM RunPod worker.

## Inference Result

`inference.schema.json` describes the worker response consumed by the viewer. Each key is an organ name and each value contains:

- `content`: base64-encoded `.nii.gz` segmentation mask
- `volume_cm`: organ volume in cubic centimeters, or a string status such as `N/A`
- `mean_hu`: mean Hounsfield unit value, or a string status such as `N/A`

The current supported organs are:

- `spleen`
- `kidney_right`
- `kidney_left`
- `gall_bladder`
- `liver`
- `stomach`
- `aorta`
- `postcava`
- `pancreas`
