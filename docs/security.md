# Security and Research Use

BodyMaps is intended for JHU CCVL Research Group workflows and is not a clinical diagnostic system.

## Current Access Model

The current web app uses:

- a simple password gate before uploads
- Vercel Blob for temporary CT storage
- RunPod for GPU inference

This is appropriate for controlled research use only after the deployment environment and data policy have been reviewed.

## Data Handling

The API route deletes the uploaded blob after inference completes. However, the temporary upload URL and storage behavior should still be treated carefully.

Do not upload protected health information unless the deployment has appropriate access control, storage policy, audit logging, and compliance review.

## Production Hardening Checklist

- Replace the shared password with authenticated user access.
- Use private object storage and signed URLs.
- Add upload audit logging.
- Add explicit retention policy for uploaded CT files and generated masks.
- Add request IDs for inference traceability.
- Review RunPod endpoint access controls.
- Add rate limiting and file-type validation beyond extension checks.
