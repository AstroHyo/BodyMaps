import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { validateSharedPassword } from "@/utils/security";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (
        pathname: string,
        clientPayload?: string | null
      ) => {
        const { password } = JSON.parse(clientPayload || "{}");
        const auth = validateSharedPassword(password);
        if (!auth.ok) {
          throw new Error(auth.error);
        }

        if (!pathname.toLowerCase().endsWith(".nii.gz")) {
          throw new Error("Only .nii.gz CT volumes can be uploaded");
        }

        return {
          addRandomSuffix: false,
          allowOverwrite: false,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
        };
      },
      onUploadCompleted: async ({ blob }) => {
        // Get notified of client upload completion
        // ⚠️ This will not work on `localhost` websites,
        // Use ngrok or similar to get the full upload flow

        console.log("blob upload completed", {
          pathname: blob.pathname,
        });

        // try {
        //   // Run any logic after the file upload completed
        //   // const { userId } = JSON.parse(tokenPayload);
        //   // await db.update({ avatar: blob.url, userId });
        // } catch (error) {
        //   throw new Error('Could not update user');
        // }
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
