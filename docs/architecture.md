# BodyMaps Architecture

BodyMaps is split into a user-facing web app and a GPU inference worker.

## Components

- `src/`: Next.js app, upload flow, API routes, and CT visualization.
- `workers/suprem-runpod/`: RunPod worker that runs SuPreM inference.
- `packages/contracts/`: Schema for the worker response consumed by the web viewer.

## Request Flow

```mermaid
sequenceDiagram
  participant User
  participant Web as BodyMaps Web
  participant Blob as Vercel Blob
  participant API as Next.js API
  participant RunPod
  participant Worker as SuPreM Worker

  User->>Web: Select ct.nii.gz
  Web->>Blob: Upload temporary CT volume
  Web->>API: POST /api/process with blob URL
  API->>RunPod: POST /runsync with URL, targets, params
  RunPod->>Worker: Execute inference job
  Worker->>Worker: Segment organs and compute metrics
  Worker-->>RunPod: Return base64 masks and metrics
  RunPod-->>API: Return worker output
  API-->>Web: Return validated inference result
  Web->>Web: Render CT and segmentation overlays
```

## Viewer Flow

The web app keeps the original CT volume URL and decoded segmentation masks in `CornerstoneContext`. The visualization page renders three orthographic CT views through Cornerstone and one 3D canvas through Niivue. Controls update segmentation visibility, opacity, and CT window/level.

## Contract Boundary

The worker returns one object per organ. The web app validates this shape with `src/utils/inference.ts` before converting base64 masks into `ArrayBuffer` values for the viewer.
