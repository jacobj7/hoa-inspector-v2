import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { put } from "@vercel/blob";
import { z } from "zod";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const uploadSchema = z.object({
  description: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession();
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const violationId = params.id;
    if (!violationId) {
      return NextResponse.json(
        { error: "Violation ID is required" },
        { status: 400 },
      );
    }

    const client = await pool.connect();
    try {
      const violationCheck = await client.query(
        "SELECT id FROM violations WHERE id = $1",
        [violationId],
      );

      if (violationCheck.rows.length === 0) {
        return NextResponse.json(
          { error: "Violation not found" },
          { status: 404 },
        );
      }
    } finally {
      client.release();
    }

    const formData = await request.formData();
    const file = formData.get("photo") as File | null;
    const descriptionRaw = formData.get("description") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "Photo file is required" },
        { status: 400 },
      );
    }

    const validatedData = uploadSchema.parse({
      description: descriptionRaw || undefined,
    });

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        {
          error:
            "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.",
        },
        { status: 400 },
      );
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size exceeds 10MB limit" },
        { status: 400 },
      );
    }

    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const blobPath = `violations/${violationId}/photos/${timestamp}-${sanitizedFileName}`;

    const blob = await put(blobPath, file, {
      access: "public",
      contentType: file.type,
    });

    const dbClient = await pool.connect();
    try {
      const result = await dbClient.query(
        `INSERT INTO evidence_photos (violation_id, photo_url, file_name, file_size, content_type, description, uploaded_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING *`,
        [
          violationId,
          blob.url,
          file.name,
          file.size,
          file.type,
          validatedData.description || null,
          session.user.email || session.user.name,
        ],
      );

      const photo = result.rows[0];

      return NextResponse.json(
        {
          success: true,
          photo: {
            id: photo.id,
            violationId: photo.violation_id,
            photoUrl: photo.photo_url,
            fileName: photo.file_name,
            fileSize: photo.file_size,
            contentType: photo.content_type,
            description: photo.description,
            uploadedBy: photo.uploaded_by,
            createdAt: photo.created_at,
          },
        },
        { status: 201 },
      );
    } finally {
      dbClient.release();
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.errors },
        { status: 400 },
      );
    }

    console.error("Error uploading photo:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
