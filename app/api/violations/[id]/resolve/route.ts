import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const resolveViolationSchema = z.object({
  resolution_notes: z.string().min(1, "Resolution notes are required"),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession();

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const violationId = params.id;

    if (!violationId || isNaN(Number(violationId))) {
      return NextResponse.json(
        { error: "Invalid violation ID" },
        { status: 400 },
      );
    }

    const body = await request.json();

    const validationResult = resolveViolationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { resolution_notes } = validationResult.data;

    const client = await pool.connect();

    try {
      const checkResult = await client.query(
        "SELECT id, status FROM violations WHERE id = $1",
        [violationId],
      );

      if (checkResult.rows.length === 0) {
        return NextResponse.json(
          { error: "Violation not found" },
          { status: 404 },
        );
      }

      const violation = checkResult.rows[0];

      if (violation.status === "resolved") {
        return NextResponse.json(
          { error: "Violation is already resolved" },
          { status: 409 },
        );
      }

      const resolvedAt = new Date().toISOString();

      const updateResult = await client.query(
        `UPDATE violations
         SET
           status = 'resolved',
           resolution_notes = $1,
           resolved_at = $2,
           resolved_by = $3,
           updated_at = $2
         WHERE id = $4
         RETURNING *`,
        [
          resolution_notes,
          resolvedAt,
          session.user.email || session.user.name,
          violationId,
        ],
      );

      const updatedViolation = updateResult.rows[0];

      return NextResponse.json(
        {
          message: "Violation resolved successfully",
          violation: updatedViolation,
        },
        { status: 200 },
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error resolving violation:", error);

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
