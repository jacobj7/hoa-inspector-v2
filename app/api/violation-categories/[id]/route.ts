import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  is_active: z.boolean().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = params.id;
    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = parsed.data;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No fields to update" },
        { status: 400 },
      );
    }

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      setClauses.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.severity !== undefined) {
      setClauses.push(`severity = $${paramIndex++}`);
      values.push(data.severity);
    }
    if (data.is_active !== undefined) {
      setClauses.push(`is_active = $${paramIndex++}`);
      values.push(data.is_active);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(Number(id));

    const query = `
      UPDATE violation_categories
      SET ${setClauses.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const client = await pool.connect();
    try {
      const result = await client.query(query, values);

      if (result.rowCount === 0) {
        return NextResponse.json(
          { error: "Violation category not found" },
          { status: 404 },
        );
      }

      return NextResponse.json(
        {
          data: result.rows[0],
          message: "Violation category updated successfully",
        },
        { status: 200 },
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error updating violation category:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = params.id;
    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      const result = await client.query(
        "DELETE FROM violation_categories WHERE id = $1 RETURNING *",
        [Number(id)],
      );

      if (result.rowCount === 0) {
        return NextResponse.json(
          { error: "Violation category not found" },
          { status: 404 },
        );
      }

      return NextResponse.json(
        {
          data: result.rows[0],
          message: "Violation category deleted successfully",
        },
        { status: 200 },
      );
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error deleting violation category:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
