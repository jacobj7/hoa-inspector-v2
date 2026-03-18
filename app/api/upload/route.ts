import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const uploadQuerySchema = z.object({
  filename: z.string().min(1).max(255),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filenameParam = searchParams.get("filename");

    const parseResult = uploadQuerySchema.safeParse({
      filename: filenameParam,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Invalid filename parameter",
          details: parseResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { filename } = parseResult.data;

    const allowedExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".webp",
      ".heic",
      ".heif",
      ".pdf",
    ];
    const fileExtension = filename
      .toLowerCase()
      .slice(filename.lastIndexOf("."));

    if (!allowedExtensions.includes(fileExtension)) {
      return NextResponse.json(
        {
          error:
            "File type not allowed. Allowed types: jpg, jpeg, png, gif, webp, heic, heif, pdf",
        },
        { status: 400 },
      );
    }

    if (!request.body) {
      return NextResponse.json(
        { error: "No file body provided" },
        { status: 400 },
      );
    }

    const contentType =
      request.headers.get("content-type") || "application/octet-stream";

    const blob = await put(filename, request.body, {
      access: "public",
      contentType,
      addRandomSuffix: true,
    });

    return NextResponse.json(
      {
        url: blob.url,
        downloadUrl: blob.downloadUrl,
        pathname: blob.pathname,
        contentType: blob.contentType,
        contentDisposition: blob.contentDisposition,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Upload error:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Upload failed", message: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
