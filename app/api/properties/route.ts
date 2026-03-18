import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const createPropertySchema = z.object({
  address: z.string().min(1, "Address is required"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  zip_code: z.string().min(1, "Zip code is required"),
  property_type: z.string().optional(),
  owner_name: z.string().min(1, "Owner name is required"),
  owner_email: z.string().email("Valid email is required"),
  owner_phone: z.string().optional(),
  parcel_number: z.string().optional(),
  year_built: z.number().int().optional(),
  square_footage: z.number().positive().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const search = searchParams.get("search") || "";
    const offset = (page - 1) * limit;

    const client = await pool.connect();
    try {
      let whereClause = "";
      const queryParams: (string | number)[] = [];
      let paramIndex = 1;

      if (search) {
        whereClause = `WHERE (
          p.address ILIKE $${paramIndex} OR
          p.city ILIKE $${paramIndex} OR
          p.parcel_number ILIKE $${paramIndex} OR
          o.name ILIKE $${paramIndex} OR
          o.email ILIKE $${paramIndex}
        )`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      const countQuery = `
        SELECT COUNT(DISTINCT p.id) as total
        FROM properties p
        LEFT JOIN owners o ON p.owner_id = o.id
        ${whereClause}
      `;

      const countResult = await client.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0].total);

      const dataQuery = `
        SELECT
          p.id,
          p.address,
          p.city,
          p.state,
          p.zip_code,
          p.property_type,
          p.parcel_number,
          p.year_built,
          p.square_footage,
          p.notes,
          p.created_at,
          p.updated_at,
          o.id as owner_id,
          o.name as owner_name,
          o.email as owner_email,
          o.phone as owner_phone,
          COUNT(DISTINCT v.id) as total_violations,
          COUNT(DISTINCT CASE WHEN v.status = 'open' THEN v.id END) as open_violations,
          COUNT(DISTINCT CASE WHEN v.status = 'resolved' THEN v.id END) as resolved_violations,
          COUNT(DISTINCT CASE WHEN v.status = 'pending' THEN v.id END) as pending_violations,
          CASE
            WHEN COUNT(DISTINCT CASE WHEN v.status = 'open' THEN v.id END) = 0 THEN 'compliant'
            WHEN COUNT(DISTINCT CASE WHEN v.status = 'open' AND v.severity = 'critical' THEN v.id END) > 0 THEN 'critical'
            WHEN COUNT(DISTINCT CASE WHEN v.status = 'open' THEN v.id END) > 0 THEN 'non_compliant'
            ELSE 'compliant'
          END as compliance_status
        FROM properties p
        LEFT JOIN owners o ON p.owner_id = o.id
        LEFT JOIN violations v ON p.id = v.property_id
        ${whereClause}
        GROUP BY p.id, o.id, o.name, o.email, o.phone
        ORDER BY p.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(limit, offset);
      const dataResult = await client.query(dataQuery, queryParams);

      return NextResponse.json({
        properties: dataResult.rows,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error fetching properties:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validationResult = createPropertySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validationResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const data = validationResult.data;
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      let ownerId: string;

      const existingOwner = await client.query(
        "SELECT id FROM owners WHERE email = $1",
        [data.owner_email],
      );

      if (existingOwner.rows.length > 0) {
        ownerId = existingOwner.rows[0].id;

        await client.query(
          `UPDATE owners SET name = $1, phone = $2, updated_at = NOW() WHERE id = $3`,
          [data.owner_name, data.owner_phone || null, ownerId],
        );
      } else {
        const ownerResult = await client.query(
          `INSERT INTO owners (name, email, phone, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())
           RETURNING id`,
          [data.owner_name, data.owner_email, data.owner_phone || null],
        );
        ownerId = ownerResult.rows[0].id;
      }

      const propertyResult = await client.query(
        `INSERT INTO properties (
          address, city, state, zip_code, property_type,
          parcel_number, year_built, square_footage, notes,
          owner_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        RETURNING *`,
        [
          data.address,
          data.city,
          data.state,
          data.zip_code,
          data.property_type || null,
          data.parcel_number || null,
          data.year_built || null,
          data.square_footage || null,
          data.notes || null,
          ownerId,
        ],
      );

      await client.query("COMMIT");

      const property = propertyResult.rows[0];

      return NextResponse.json(
        {
          property: {
            ...property,
            owner_id: ownerId,
            owner_name: data.owner_name,
            owner_email: data.owner_email,
            owner_phone: data.owner_phone || null,
            total_violations: 0,
            open_violations: 0,
            resolved_violations: 0,
            pending_violations: 0,
            compliance_status: "compliant",
          },
        },
        { status: 201 },
      );
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error creating property:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
