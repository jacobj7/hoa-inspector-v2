import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const ViolationQuerySchema = z.object({
  status: z.enum(["open", "closed", "pending", "appealed"]).optional(),
  property_id: z.string().optional(),
  category: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const CreateViolationSchema = z.object({
  property_id: z.string().uuid("Invalid property ID"),
  category: z.string().min(1, "Category is required").max(100),
  description: z.string().min(1, "Description is required").max(2000),
  base_fine: z.number().positive("Base fine must be positive"),
  status: z.enum(["open", "pending"]).default("open"),
  notes: z.string().max(1000).optional(),
});

const ESCALATION_MULTIPLIERS: Record<number, number> = {
  0: 1.0,
  1: 1.5,
  2: 2.0,
  3: 2.5,
};

function getEscalationMultiplier(priorViolationCount: number): number {
  if (priorViolationCount >= 3) return 3.0;
  return ESCALATION_MULTIPLIERS[priorViolationCount] ?? 1.0;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const queryParams = Object.fromEntries(searchParams.entries());

  const parseResult = ViolationQuerySchema.safeParse(queryParams);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "Invalid query parameters",
        details: parseResult.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { status, property_id, category, page, limit } = parseResult.data;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (status) {
    conditions.push(`v.status = $${paramIndex++}`);
    values.push(status);
  }

  if (property_id) {
    conditions.push(`v.property_id = $${paramIndex++}`);
    values.push(property_id);
  }

  if (category) {
    conditions.push(`v.category ILIKE $${paramIndex++}`);
    values.push(`%${category}%`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const client = await pool.connect();
  try {
    const countQuery = `
      SELECT COUNT(*) as total
      FROM violations v
      ${whereClause}
    `;
    const countResult = await client.query(countQuery, values);
    const total = parseInt(countResult.rows[0].total, 10);

    const dataQuery = `
      SELECT
        v.id,
        v.property_id,
        v.category,
        v.description,
        v.base_fine,
        v.escalated_fine,
        v.escalation_multiplier,
        v.prior_violation_count,
        v.status,
        v.notes,
        v.created_at,
        v.updated_at,
        p.address as property_address,
        p.owner_name as property_owner
      FROM violations v
      LEFT JOIN properties p ON p.id = v.property_id
      ${whereClause}
      ORDER BY v.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    const dataValues = [...values, limit, offset];
    const dataResult = await client.query(dataQuery, dataValues);

    return NextResponse.json({
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching violations:", error);
    return NextResponse.json(
      { error: "Failed to fetch violations" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = CreateViolationSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parseResult.error.flatten() },
      { status: 400 },
    );
  }

  const { property_id, category, description, base_fine, status, notes } =
    parseResult.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const priorCountResult = await client.query(
      `SELECT COUNT(*) as count
       FROM violations
       WHERE property_id = $1
         AND category = $2
         AND status IN ('open', 'closed', 'pending', 'appealed')`,
      [property_id, category],
    );
    const priorViolationCount = parseInt(priorCountResult.rows[0].count, 10);

    const multiplier = getEscalationMultiplier(priorViolationCount);
    const escalatedFine = parseFloat((base_fine * multiplier).toFixed(2));

    const propertyCheck = await client.query(
      "SELECT id FROM properties WHERE id = $1",
      [property_id],
    );
    if (propertyCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 },
      );
    }

    const insertResult = await client.query(
      `INSERT INTO violations (
        property_id,
        category,
        description,
        base_fine,
        escalated_fine,
        escalation_multiplier,
        prior_violation_count,
        status,
        notes,
        created_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING *`,
      [
        property_id,
        category,
        description,
        base_fine,
        escalatedFine,
        multiplier,
        priorViolationCount,
        status,
        notes ?? null,
      ],
    );

    await client.query("COMMIT");

    const newViolation = insertResult.rows[0];

    return NextResponse.json(
      {
        data: newViolation,
        escalation_info: {
          prior_violation_count: priorViolationCount,
          multiplier,
          base_fine,
          escalated_fine: escalatedFine,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Error creating violation:", error);
    return NextResponse.json(
      { error: "Failed to create violation" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
