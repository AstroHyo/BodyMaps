# Evidence Capture

Captured on May 6, 2026 for the BodyMaps + SuPreM worker integration.

## RunPod Worker Smoke Test

- Endpoint ID: `dcghe3wcokwgcs`
- Endpoint image shown in RunPod: `astrohyo/suprem-runpod-worker:3df66ee`
- Request ID: `131b4c72-6347-42ef-868a-9c3a08602f08-u2`
- Public CT input: `https://huggingface.co/datasets/Angelou0516/totalsegmentator-ribs/resolve/main/s0058/ct.nii.gz`
- Requested targets: `liver`, `spleen`, `kidney_left`, `kidney_right`
- Dashboard status: `Completed`
- Dashboard timing: 4m31s delay, 135ms reported execution time

Screenshots:

- `runpod-completed-request.png`: RunPod request panel showing completed status and returned segmentation output.
- `runpod-worker-logs.png`: worker log showing CT download and organ segmentation files saved.

Note: the worker log also shows a RunPod `job_done` 400 warning after processing. The dashboard still showed the request as completed with output, but this warning should be investigated before treating the endpoint as production-ready.

## Local Viewer Evidence

The local viewer was opened with:

```bash
NEXT_PUBLIC_ALLOW_SAMPLE_DATA=1 npm run dev -- --hostname 127.0.0.1 --port 3000
```

The direct sample viewer URL is:

```text
http://127.0.0.1:3000/visualization?sample=1
```

Screenshots and recording:

- `bodymaps-home.png`: BodyMaps landing page with JHU CCVL Research Group branding.
- `bodymaps-viewer-sample.png`: 2D orthographic panes plus 3D Niivue segmentation view.
- `bodymaps-viewer-liver-hidden.png`: viewer after toggling liver visibility off.
- `bodymaps-segmentation-data-modal.png`: segmentation data modal with fixture metrics.
- `bodymaps-viewer-interaction.mov`: short recording of the 3D view being dragged/rotated and an organ visibility toggle.

Sample files in `public/samples` are generated from the existing repository fixture. The `ct.nii.gz` file is a synthetic non-PHI volume assembled from segmentation masks for local viewer validation, not an uploaded patient CT.
