import { query } from "./db";

export interface Violation {
  id: number;
  property_id: number;
  category_id?: number;
  description: string;
  status: string;
  fine_amount?: number;
  due_date?: string;
  created_at: string;
  updated_at: string;
  property_address?: string;
  category_name?: string;
  owner_name?: string;
  owner_email?: string;
  appeal_token?: string;
}

export async function getViolations(filters?: {
  status?: string;
  property_id?: number;
  category_id?: number;
}): Promise<Violation[]> {
  let sql = `
    SELECT 
      v.*,
      p.address as property_address,
      vc.name as category_name,
      p.owner_name,
      p.owner_email
    FROM violations v
    LEFT JOIN properties p ON v.property_id = p.id
    LEFT JOIN violation_categories vc ON v.category_id = vc.id
    WHERE 1=1
  `;
  const params: unknown[] = [];
  let paramCount = 1;

  if (filters?.status) {
    sql += ` AND v.status = $${paramCount++}`;
    params.push(filters.status);
  }

  if (filters?.property_id) {
    sql += ` AND v.property_id = $${paramCount++}`;
    params.push(filters.property_id);
  }

  if (filters?.category_id) {
    sql += ` AND v.category_id = $${paramCount++}`;
    params.push(filters.category_id);
  }

  sql += " ORDER BY v.created_at DESC";

  const result = await query(sql, params);
  return result.rows;
}

export async function getViolationById(id: number): Promise<Violation | null> {
  const result = await query(
    `SELECT 
      v.*,
      p.address as property_address,
      vc.name as category_name,
      p.owner_name,
      p.owner_email
    FROM violations v
    LEFT JOIN properties p ON v.property_id = p.id
    LEFT JOIN violation_categories vc ON v.category_id = vc.id
    WHERE v.id = $1`,
    [id],
  );
  return result.rows[0] || null;
}

export async function updateViolationStatus(
  id: number,
  status: string,
): Promise<Violation | null> {
  const result = await query(
    "UPDATE violations SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *",
    [status, id],
  );
  return result.rows[0] || null;
}
