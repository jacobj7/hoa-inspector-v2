import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const patchSchema = z.object({
  action: z.enum(["approve", "deny"]),
  reviewer_notes: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession();

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appealId = params.id;

  if (!appealId || isNaN(Number(appealId))) {
    return NextResponse.json({ error: "Invalid appeal ID" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = patchSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parseResult.error.flatten() },
      { status: 422 },
    );
  }

  const { action, reviewer_notes } = parseResult.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const appealResult = await client.query(
      `SELECT a.*, v.id as violation_id
       FROM appeals a
       LEFT JOIN violations v ON v.appeal_id = a.id
       WHERE a.id = $1`,
      [appealId],
    );

    if (appealResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Appeal not found" }, { status: 404 });
    }

    const appeal = appealResult.rows[0];

    if (appeal.status !== "pending") {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Appeal has already been reviewed" },
        { status: 409 },
      );
    }

    const newAppealStatus = action === "approve" ? "approved" : "denied";
    const reviewedAt = new Date().toISOString();
    const reviewerEmail = session.user.email ?? null;

    const updatedAppealResult = await client.query(
      `UPDATE appeals
       SET status = $1,
           reviewer_notes = $2,
           reviewed_at = $3,
           reviewed_by = $4,
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [
        newAppealStatus,
        reviewer_notes ?? null,
        reviewedAt,
        reviewerEmail,
        appealId,
      ],
    );

    if (appeal.violation_id) {
      let newViolationStatus: string;
      if (action === "approve") {
        newViolationStatus = "overturned";
      } else {
        newViolationStatus = "upheld";
      }

      await client.query(
        `UPDATE violations
         SET status = $1,
             updated_at = NOW()
         WHERE id = $2`,
        [newViolationStatus, appeal.violation_id],
      );
    } else {
      const violationByAppealResult = await client.query(
        `SELECT id FROM violations WHERE appeal_id = $1`,
        [appealId],
      );

      if (violationByAppealResult.rows.length > 0) {
        const newViolationStatus =
          action === "approve" ? "overturned" : "upheld";
        await client.query(
          `UPDATE violations
           SET status = $1,
               updated_at = NOW()
           WHERE appeal_id = $2`,
          [newViolationStatus, appealId],
        );
      }
    }

    await client.query("COMMIT");

    return NextResponse.json(
      {
        message: `Appeal successfully ${newAppealStatus}`,
        appeal: updatedAppealResult.rows[0],
      },
      { status: 200 },
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error processing appeal:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
