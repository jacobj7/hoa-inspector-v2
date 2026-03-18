import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { pool } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  id: z.string().min(1),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = paramsSchema.safeParse(params);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid violation ID", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { id } = parsed.data;

    const client = await pool.connect();
    try {
      // Get the violation with basic details
      const violationResult = await client.query(
        `SELECT
          v.id,
          v.violation_code,
          v.description,
          v.location,
          v.status,
          v.severity,
          v.reported_at,
          v.resolved_at,
          v.created_at,
          v.updated_at,
          v.reported_by,
          v.assigned_to,
          reporter.name AS reporter_name,
          reporter.email AS reporter_email,
          assignee.name AS assignee_name,
          assignee.email AS assignee_email
        FROM violations v
        LEFT JOIN users reporter ON v.reported_by = reporter.id
        LEFT JOIN users assignee ON v.assigned_to = assignee.id
        WHERE v.id = $1`,
        [id],
      );

      if (violationResult.rows.length === 0) {
        return NextResponse.json(
          { error: "Violation not found" },
          { status: 404 },
        );
      }

      const violation = violationResult.rows[0];

      // Get evidence photos
      const photosResult = await client.query(
        `SELECT
          ep.id,
          ep.url,
          ep.caption,
          ep.uploaded_at,
          ep.uploaded_by,
          u.name AS uploaded_by_name
        FROM evidence_photos ep
        LEFT JOIN users u ON ep.uploaded_by = u.id
        WHERE ep.violation_id = $1
        ORDER BY ep.uploaded_at ASC`,
        [id],
      );

      // Get notices
      const noticesResult = await client.query(
        `SELECT
          n.id,
          n.notice_type,
          n.content,
          n.sent_at,
          n.sent_by,
          n.recipient_email,
          n.status AS notice_status,
          u.name AS sent_by_name
        FROM notices n
        LEFT JOIN users u ON n.sent_by = u.id
        WHERE n.violation_id = $1
        ORDER BY n.sent_at ASC`,
        [id],
      );

      // Get fine details
      const finesResult = await client.query(
        `SELECT
          f.id,
          f.amount,
          f.currency,
          f.issued_at,
          f.due_date,
          f.paid_at,
          f.status AS fine_status,
          f.payment_reference,
          f.notes,
          f.issued_by,
          u.name AS issued_by_name
        FROM fines f
        LEFT JOIN users u ON f.issued_by = u.id
        WHERE f.violation_id = $1
        ORDER BY f.issued_at ASC`,
        [id],
      );

      const responseData = {
        ...violation,
        evidence_photos: photosResult.rows,
        notices: noticesResult.rows,
        fines: finesResult.rows,
      };

      return NextResponse.json({ data: responseData }, { status: 200 });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching violation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
