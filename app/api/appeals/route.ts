import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query } from "@/lib/db";
import { z } from "zod";

export const dynamic = "force-dynamic";

const AppealSubmitSchema = z.object({
  token: z.string().min(1),
  reason: z.string().min(10).max(5000),
  contact_email: z.string().email().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userResult = await query(
      "SELECT id, role FROM users WHERE email = $1",
      [session.user.email],
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userResult.rows[0];

    if (user.role !== "manager" && user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = (page - 1) * limit;

    let queryText = `
      SELECT 
        a.id,
        a.reason,
        a.contact_email,
        a.status,
        a.created_at,
        a.updated_at,
        a.reviewed_at,
        a.reviewer_notes,
        b.id AS ban_id,
        b.reason AS ban_reason,
        b.created_at AS ban_created_at,
        bu.id AS banned_user_id,
        bu.email AS banned_user_email,
        bu.name AS banned_user_name,
        rv.id AS reviewer_id,
        rv.email AS reviewer_email,
        rv.name AS reviewer_name
      FROM appeals a
      LEFT JOIN bans b ON a.ban_id = b.id
      LEFT JOIN users bu ON b.user_id = bu.id
      LEFT JOIN users rv ON a.reviewed_by = rv.id
    `;

    const params: (string | number)[] = [];
    const conditions: string[] = [];

    if (status) {
      params.push(status);
      conditions.push(`a.status = $${params.length}`);
    }

    if (conditions.length > 0) {
      queryText += " WHERE " + conditions.join(" AND ");
    }

    queryText += ` ORDER BY a.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const appealsResult = await query(queryText, params);

    const countParams: (string | number)[] = [];
    const countConditions: string[] = [];
    let countQuery = "SELECT COUNT(*) FROM appeals a";

    if (status) {
      countParams.push(status);
      countConditions.push(`a.status = $${countParams.length}`);
    }

    if (countConditions.length > 0) {
      countQuery += " WHERE " + countConditions.join(" AND ");
    }

    const countResult = await query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count, 10);

    return NextResponse.json({
      appeals: appealsResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/appeals error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = AppealSubmitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { token, reason, contact_email } = parsed.data;

    const tokenResult = await query(
      `SELECT 
        at.id AS token_id,
        at.ban_id,
        at.used,
        at.expires_at,
        b.id AS ban_id,
        b.user_id,
        b.active
       FROM appeal_tokens at
       LEFT JOIN bans b ON at.ban_id = b.id
       WHERE at.token = $1`,
      [token],
    );

    if (tokenResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Invalid appeal token" },
        { status: 404 },
      );
    }

    const tokenData = tokenResult.rows[0];

    if (tokenData.used) {
      return NextResponse.json(
        { error: "Appeal token has already been used" },
        { status: 409 },
      );
    }

    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      return NextResponse.json(
        { error: "Appeal token has expired" },
        { status: 410 },
      );
    }

    if (!tokenData.active) {
      return NextResponse.json(
        { error: "Associated ban is no longer active" },
        { status: 400 },
      );
    }

    const existingAppeal = await query(
      "SELECT id, status FROM appeals WHERE ban_id = $1 AND status IN ($2, $3)",
      [tokenData.ban_id, "pending", "under_review"],
    );

    if (existingAppeal.rows.length > 0) {
      return NextResponse.json(
        { error: "An appeal for this ban is already pending review" },
        { status: 409 },
      );
    }

    const insertResult = await query(
      `INSERT INTO appeals (ban_id, reason, contact_email, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'pending', NOW(), NOW())
       RETURNING id, ban_id, reason, contact_email, status, created_at`,
      [tokenData.ban_id, reason, contact_email || null],
    );

    await query(
      "UPDATE appeal_tokens SET used = true, used_at = NOW() WHERE id = $1",
      [tokenData.token_id],
    );

    return NextResponse.json(
      {
        message: "Appeal submitted successfully",
        appeal: insertResult.rows[0],
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/appeals error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
