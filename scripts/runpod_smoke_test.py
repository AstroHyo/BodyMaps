#!/usr/bin/env python3
"""Smoke-test the deployed BodyMaps SuPreM RunPod endpoint.

Required environment variables:
  RUNPOD_ENDPOINT       Base endpoint URL without trailing /runsync
  RUNPOD_ENDPOINT_KEY   RunPod endpoint API key
  BODYMAPS_TEST_CT_URL  Publicly reachable ct.nii.gz URL
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request


TARGETS = [
    "spleen",
    "kidney_right",
    "kidney_left",
    "gall_bladder",
    "liver",
    "stomach",
    "aorta",
    "postcava",
    "pancreas",
]

DEFAULT_PARAMS = {
    "space_x": 1.5,
    "space_y": 1.5,
    "space_z": 1.5,
    "a_min": -175.0,
    "a_max": 250.0,
    "b_min": 0.0,
    "b_max": 1.0,
    "roi_x": 96,
    "roi_y": 96,
    "roi_z": 96,
    "num_samples": 1,
}


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def post_runsync(endpoint: str, api_key: str, ct_url: str) -> dict:
    payload = {
        "input": {
            **DEFAULT_PARAMS,
            "url": ct_url,
            "targets": TARGETS,
        }
    }
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        endpoint.rstrip("/") + "/runsync",
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
    )

    with urllib.request.urlopen(request, timeout=600) as response:
        return json.loads(response.read().decode("utf-8"))


def validate_output(response: dict) -> None:
    if response.get("error"):
        raise RuntimeError(f"RunPod returned error: {response['error']}")

    output = response.get("output")
    if not isinstance(output, dict) or not output:
        raise RuntimeError("RunPod response did not contain a non-empty output object.")

    for organ, result in output.items():
        if organ not in TARGETS:
            raise RuntimeError(f"Unexpected organ in output: {organ}")
        if not isinstance(result, dict):
            raise RuntimeError(f"Output for {organ} is not an object.")
        for key in ("content", "volume_cm", "mean_hu"):
            if key not in result:
                raise RuntimeError(f"Output for {organ} is missing {key}.")
        if not isinstance(result["content"], str) or not result["content"]:
            raise RuntimeError(f"Output for {organ} has empty segmentation content.")

    print("RunPod smoke test passed.")
    print("Organs:", ", ".join(sorted(output.keys())))
    for organ in sorted(output.keys()):
        result = output[organ]
        print(f"- {organ}: volume_cm={result['volume_cm']} mean_hu={result['mean_hu']}")


def main() -> int:
    try:
        endpoint = require_env("RUNPOD_ENDPOINT")
        api_key = require_env("RUNPOD_ENDPOINT_KEY")
        ct_url = require_env("BODYMAPS_TEST_CT_URL")
        response = post_runsync(endpoint, api_key, ct_url)
        validate_output(response)
    except urllib.error.HTTPError as error:
        print(f"HTTP error from RunPod: {error.code}", file=sys.stderr)
        print(error.read().decode("utf-8", errors="replace"), file=sys.stderr)
        return 1
    except Exception as error:
        print(str(error), file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
