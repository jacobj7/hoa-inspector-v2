import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Pool } from "pg";
import PropertiesClient from "./PropertiesClient";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export interface Property {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  property_type: string;
  units: number;
  owner_id: string;
  created_at: string;
  updated_at: string;
  compliance_status: "compliant" | "non_compliant" | "pending" | "unknown";
  total_inspections: number;
  open_issues: number;
  last_inspection_date: string | null;
}

async function getProperties(userId: string): Promise<Property[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(
      `
      SELECT
        p.id,
        p.name,
        p.address,
        p.city,
        p.state,
        p.zip_code,
        p.property_type,
        p.units,
        p.owner_id,
        p.created_at,
        p.updated_at,
        COALESCE(
          CASE
            WHEN COUNT(CASE WHEN ci.status = 'open' AND ci.severity = 'critical' THEN 1 END) > 0 THEN 'non_compliant'
            WHEN COUNT(CASE WHEN ci.status = 'open' THEN 1 END) > 0 THEN 'pending'
            WHEN COUNT(i.id) > 0 THEN 'compliant'
            ELSE 'unknown'
          END,
          'unknown'
        ) AS compliance_status,
        COUNT(DISTINCT i.id)::int AS total_inspections,
        COUNT(CASE WHEN ci.status = 'open' THEN 1 END)::int AS open_issues,
        MAX(i.inspection_date) AS last_inspection_date
      FROM properties p
      LEFT JOIN inspections i ON i.property_id = p.id
      LEFT JOIN compliance_issues ci ON ci.inspection_id = i.id
      WHERE p.owner_id = $1
      GROUP BY p.id, p.name, p.address, p.city, p.state, p.zip_code, p.property_type, p.units, p.owner_id, p.created_at, p.updated_at
      ORDER BY p.created_at DESC
      `,
      [userId],
    );
    return result.rows as Property[];
  } finally {
    client.release();
  }
}

export default async function PropertiesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/auth/signin");
  }

  const properties = await getProperties(session.user.id);

  return <PropertiesClient properties={properties} />;
}
