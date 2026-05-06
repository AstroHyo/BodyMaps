import { NextRequest, NextResponse } from "next/server";
import { validateSharedPassword } from "@/utils/security";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json().catch(() => ({}));
  const auth = validateSharedPassword(body?.password);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (!process.env.RUNPOD_ENDPOINT || !process.env.RUNPOD_ENDPOINT_KEY) {
    return NextResponse.json(
      { error: "RunPod environment variables are not configured" },
      { status: 500 }
    );
  }

  const {
    jobs: { inQueue },
  } = await fetch(`${process.env.RUNPOD_ENDPOINT}/runsync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.RUNPOD_ENDPOINT_KEY}`,
    },
  }).then((r) => r.json());

  return NextResponse.json({ inQueue });
}
