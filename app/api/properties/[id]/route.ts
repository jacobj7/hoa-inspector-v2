import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Pool } from "pg";

export const dynamic = "force-dynamic";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const updatePropertySchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  price: z.number().positive().optional(),
  address: z.string().min(1).max(500).optional(),
  city: z.string().min(1).max(100).optional(),
  state: z.string().min(1).max(100).optional(),
  zip_code: z.string().min(1).max(20).optional(),
  country: z.string().min(1).max(100).optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().min(0).optional(),
  square_feet: z.number().positive().optional(),
  property_type: z.string().min(1).max(100).optional(),
  status: z
    .enum(["active", "inactive", "pending", "sold", "rented"])
    .optional(),
  amenities: z.array(z.string()).optional(),
  images: z.array(z.string().url()).optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  year_built: z
    .number()
    .int()
    .min(1800)
    .max(new Date().getFullYear())
    .optional(),
  parking_spaces: z.number().int().min(0).optional(),
  lot_size: z.number().positive().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;

  if (!id || isNaN(Number(id))) {
    return NextResponse.json({ error: "Invalid property ID" }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    const propertyResult = await client.query(
      `SELECT 
        p.*,
        u.name AS owner_name,
        u.email AS owner_email,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id', pr.id,
              'reviewer_name', ru.name,
              'rating', pr.rating,
              'comment', pr.comment,
              'created_at', pr.created_at
            )
          ) FILTER (WHERE pr.id IS NOT NULL),
          '[]'
        ) AS reviews,
        COALESCE(AVG(pr.rating), 0) AS average_rating,
        COUNT(DISTINCT pr.id) AS review_count
      FROM properties p
      LEFT JOIN users u ON p.owner_id = u.id
      LEFT JOIN property_reviews pr ON p.id = pr.property_id
      LEFT JOIN users ru ON pr.reviewer_id = ru.id
      WHERE p.id = $1
      GROUP BY p.id, u.name, u.email`,
      [id],
    );

    if (propertyResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 },
      );
    }

    const property = propertyResult.rows[0];

    return NextResponse.json({ property }, { status: 200 });
  } catch (error) {
    console.error("Error fetching property:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession();

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;

  if (!id || isNaN(Number(id))) {
    return NextResponse.json({ error: "Invalid property ID" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = updatePropertySchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parseResult.error.flatten() },
      { status: 422 },
    );
  }

  const data = parseResult.data;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const client = await pool.connect();

  try {
    const existingProperty = await client.query(
      "SELECT id, owner_id FROM properties WHERE id = $1",
      [id],
    );

    if (existingProperty.rows.length === 0) {
      return NextResponse.json(
        { error: "Property not found" },
        { status: 404 },
      );
    }

    const property = existingProperty.rows[0];
    const userEmail = session.user.email;

    const userResult = await client.query(
      "SELECT id, role FROM users WHERE email = $1",
      [userEmail],
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = userResult.rows[0];

    if (property.owner_id !== user.id && user.role !== "admin") {
      return NextResponse.json(
        {
          error:
            "Forbidden: You do not have permission to update this property",
        },
        { status: 403 },
      );
    }

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const fieldMap: Record<string, string> = {
      title: "title",
      description: "description",
      price: "price",
      address: "address",
      city: "city",
      state: "state",
      zip_code: "zip_code",
      country: "country",
      bedrooms: "bedrooms",
      bathrooms: "bathrooms",
      square_feet: "square_feet",
      property_type: "property_type",
      status: "status",
      amenities: "amenities",
      images: "images",
      latitude: "latitude",
      longitude: "longitude",
      year_built: "year_built",
      parking_spaces: "parking_spaces",
      lot_size: "lot_size",
    };

    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (key in data) {
        const value = data[key as keyof typeof data];
        if (Array.isArray(value)) {
          setClauses.push(`${dbField} = $${paramIndex}::jsonb`);
          values.push(JSON.stringify(value));
        } else {
          setClauses.push(`${dbField} = $${paramIndex}`);
          values.push(value);
        }
        paramIndex++;
      }
    }

    setClauses.push(`updated_at = NOW()`);

    values.push(id);
    const updateQuery = `
      UPDATE properties
      SET ${setClauses.join(", ")}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const updateResult = await client.query(updateQuery, values);

    return NextResponse.json(
      { property: updateResult.rows[0] },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error updating property:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  } finally {
    client.release();
  }
}
