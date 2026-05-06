# BodyMaps Dark App Flow Evidence

This folder contains screenshots and a short recording captured from the local
BodyMaps web app after the dark-mode refresh.

The inference result used in the visualization was produced through the
BodyMaps `/api/process` route against the RunPod Serverless endpoint
`dcghe3wcokwgcs`. The local route returned HTTP `200` with nine SuPreM organ
segmentations for the public CT volume:

`https://huggingface.co/datasets/Angelou0516/totalsegmentator-ribs/resolve/main/s0058/ct.nii.gz`

Raw JSON output and unpacked NIfTI assets are intentionally ignored by Git. They
can be regenerated locally from the RunPod response and are not required for the
checked-in visual proof.

## Captures

- `01-home-dark-chrome.png`: dark default landing/upload screen.
- `02-runpod-result-loading.png`: transition into the RunPod-result viewer.
- `03-runpod-visualization-default.png`: default four-pane visualization.
- `05-sidebar-controls-adjusted.png`: organ visibility and window/level/opacity controls adjusted.
- `06-segmentation-data-modal.png`: segmentation data table.
- `07-axial-fullscreen.png` and `07-axial-scrolled.png`: axial viewport interactions.
- `08-sagittal-fullscreen.png` and `08-sagittal-scrolled.png`: sagittal viewport interactions.
- `09-coronal-fullscreen.png` and `09-coronal-scrolled.png`: coronal viewport interactions.
- `10-3d-fullscreen-before-rotate.png` and `10-3d-rotated-fullscreen.png`: 3D viewport before and after rotation.
- `11-sidebar-collapsed.png` and `12-sidebar-expanded-final.png`: sidebar/menu state changes.
- `bodymaps-dark-runpod-visualization.mp4`: short interaction recording assembled from the captured app states.
