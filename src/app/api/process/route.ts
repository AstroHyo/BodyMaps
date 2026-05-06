import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { z } from "zod";
import { SUPPORTED_ORGAN_TARGETS } from "@/utils/inference";
import {
  isManagedVercelBlobUrl,
  validateCtDownloadUrl,
  validateSharedPassword,
} from "@/utils/security";

const paramsSchema = z
  .object({
    space_x: z.number().finite().min(0.5).max(5).default(1.5),
    space_y: z.number().finite().min(0.5).max(5).default(1.5),
    space_z: z.number().finite().min(0.5).max(5).default(1.5),
    a_min: z.number().finite().min(-2048).max(4096).default(-175.0),
    a_max: z.number().finite().min(-2048).max(4096).default(250.0),
    b_min: z.number().finite().min(0).max(1).default(0.0),
    b_max: z.number().finite().min(0).max(1).default(1.0),
    roi_x: z.number().int().min(32).max(192).default(96),
    roi_y: z.number().int().min(32).max(192).default(96),
    roi_z: z.number().int().min(32).max(192).default(96),
    num_samples: z.number().int().min(1).max(4).default(1),
  })
  .refine((params) => params.a_min < params.a_max, {
    message: "a_min must be smaller than a_max",
  })
  .refine((params) => params.b_min < params.b_max, {
    message: "b_min must be smaller than b_max",
  });

function toSerializable(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(toSerializable);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        entry === undefined ? null : toSerializable(entry),
      ])
    );
  }

  return value;
}

type RunPodResponse = {
  id?: string;
  status?: string;
  output?: unknown;
  error?: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function redactUrls(message: string): string {
  return message.replace(/https:\/\/[^\s'")]+/g, "[redacted-url]");
}

async function fetchRunPodStatus(jobId: string): Promise<RunPodResponse> {
  return fetch(`${process.env.RUNPOD_ENDPOINT}/status/${jobId}`, {
    headers: {
      Authorization: `Bearer ${process.env.RUNPOD_ENDPOINT_KEY}`,
    },
  }).then(async (r) => {
    const payload = await r.json();
    if (!r.ok) {
      throw new Error(
        payload?.error ?? `RunPod status failed with status ${r.status}`
      );
    }
    return payload;
  });
}

async function waitForRunPodOutput(
  initialResponse: RunPodResponse
): Promise<RunPodResponse> {
  if (initialResponse.output || initialResponse.error) {
    return initialResponse;
  }

  if (!initialResponse.id) {
    return initialResponse;
  }

  const deadline = Date.now() + 270_000;
  let latest = initialResponse;

  while (Date.now() < deadline) {
    if (latest.status === "COMPLETED" || latest.output || latest.error) {
      return latest;
    }

    if (latest.status === "FAILED" || latest.status === "CANCELLED") {
      return latest;
    }

    await sleep(5_000);
    latest = await fetchRunPodStatus(initialResponse.id);
  }

  return latest;
}

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  let url: string | undefined;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const password = formData.get("password");
    const rawParams = formData.get("params");

    const auth = validateSharedPassword(password);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    try {
      url = validateCtDownloadUrl(file);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid CT URL" },
        { status: 400 }
      );
    }

    let params: unknown = {};
    try {
      params = rawParams ? JSON.parse(rawParams.toString()) : {};
    } catch {
      return NextResponse.json({ error: "Invalid parameters JSON" }, { status: 400 });
    }

    // Validate parameters using safeParse
    const parsedParams = paramsSchema.safeParse(params);
    if (!parsedParams.success) {
      return NextResponse.json(
        { error: "Invalid parameters: " + parsedParams.error.message },
        { status: 400 }
      );
    }

    if (!process.env.RUNPOD_ENDPOINT || !process.env.RUNPOD_ENDPOINT_KEY) {
      return NextResponse.json(
        { error: "RunPod environment variables are not configured" },
        { status: 500 }
      );
    }

    const res = await fetch(`${process.env.RUNPOD_ENDPOINT}/runsync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RUNPOD_ENDPOINT_KEY}`,
      },
      body: JSON.stringify({
        input: {
          ...parsedParams.data,
          url,
          targets: SUPPORTED_ORGAN_TARGETS,
        },
      }),
    }).then(async (r) => {
      const payload = await r.json();
      if (!r.ok) {
        throw new Error(
          payload?.error ?? `RunPod request failed with status ${r.status}`
        );
      }
      return payload;
    });

    const completed = await waitForRunPodOutput(res);

    if (completed.error) {
      throw new Error(
        "An error occurred while processing the image: " + completed.error
      );
    }

    if (!completed.output) {
      return NextResponse.json(
        {
          error: `RunPod job did not complete before timeout. Last status: ${
            completed.status ?? "unknown"
          }`,
        },
        { status: 504 }
      );
    }

    // Return the download URL to the client
    return NextResponse.json(toSerializable(completed.output));
  } catch (error) {
    console.error(
      "Error processing CT image:",
      error instanceof Error ? redactUrls(error.message) : "Unknown error"
    );
    return NextResponse.json(
      { error: "An error occurred while processing the image" },
      { status: 500 }
    );
  } finally {
    if (url && isManagedVercelBlobUrl(url)) {
      await del(url).catch((error) => {
        console.warn("Failed to delete uploaded blob:", error);
      });
    }
  }
}
