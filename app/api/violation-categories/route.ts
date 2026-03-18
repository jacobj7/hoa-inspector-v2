import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const CreateCategorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  base_fine: z.number().positive("Base fine must be positive"),
  escalation_multiplier: z
    .number()
    .min(1, "Escalation multiplier must be at least 1"),
});

export async function GET(request: NextRequest) {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT 
        id,
        name,
        description,
        base_fine,
        escalation_multiplier,
        created_at,
        updated_at
      FROM violation_categories
      ORDER BY name ASC`,
    );

    return NextResponse.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error("Error fetching violation categories:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch violation categories" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}

export async function POST(request: NextRequest) {
  const client = await pool.connect();
  try {
    const body = await request.json();

    const validationResult = CreateCategorySchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validationResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const { name, description, base_fine, escalation_multiplier } =
      validationResult.data;

    const existingCategory = await client.query(
      "SELECT id FROM violation_categories WHERE name = $1",
      [name],
    );

    if (existingCategory.rows.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "A violation category with this name already exists",
        },
        { status: 409 },
      );
    }

    const result = await client.query(
      `INSERT INTO violation_categories (name, description, base_fine, escalation_multiplier, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       RETURNING id, name, description, base_fine, escalation_multiplier, created_at, updated_at`,
      [name, description || null, base_fine, escalation_multiplier],
    );

    return NextResponse.json(
      {
        success: true,
        data: result.rows[0],
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating violation category:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create violation category" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
