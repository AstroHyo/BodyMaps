import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { z } from "zod";
import { SUPPORTED_ORGAN_TARGETS } from "@/utils/inference";

const paramsSchema = z.object({
  space_x: z.number().default(1.5),
  space_y: z.number().default(1.5),
  space_z: z.number().default(1.5),
  a_min: z.number().default(-175.0),
  a_max: z.number().default(250.0),
  b_min: z.number().default(0.0),
  b_max: z.number().default(1.0),
  roi_x: z.number().default(96),
  roi_y: z.number().default(96),
  roi_z: z.number().default(96),
  num_samples: z.number().default(1),
});

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  let url;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as string;
    const password = formData.get("password") as string;
    const params = JSON.parse(formData.get("params") as string) || {};

    url = file;

    // Validate inputs
    if (!file || (!password && !process.env.DISABLE_PASSWORD)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate parameters using safeParse
    const parsedParams = paramsSchema.safeParse(params);
    if (!parsedParams.success) {
      return NextResponse.json(
        { error: "Invalid parameters: " + parsedParams.error.message },
        { status: 400 }
      );
    }

    // Validate password (replace with your actual password check)
    if (process.env.PASSWORD !== password) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 });
    }

    const res = await fetch(`${process.env.RUNPOD_ENDPOINT}/runsync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RUNPOD_ENDPOINT_KEY}`,
      },
      body: JSON.stringify({
        input: {
          ...params,
          url: file,
          targets: SUPPORTED_ORGAN_TARGETS,
        },
      }),
    }).then((r) => r.json());

    if (res.error) {
      throw new Error(
        "An error occurred while processing the image: " + res.error
      );
    }

    // Return the download URL to the client
    return NextResponse.json(res.output);
  } catch (error) {
    console.error("Error processing CT image:", error);
    return NextResponse.json(
      { error: "An error occurred while processing the image" },
      { status: 500 }
    );
  } finally {
    if (url) {
      await del(url);
    }
  }
}
