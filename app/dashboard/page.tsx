import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  let stats = {
    total: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
    dismissed: 0,
  };

  try {
    const result = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
        COUNT(*) FILTER (WHERE status = 'dismissed') as dismissed
      FROM violations
    `);

    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0];
      stats = {
        total: parseInt(row.total, 10) || 0,
        pending: parseInt(row.pending, 10) || 0,
        inProgress: parseInt(row.in_progress, 10) || 0,
        resolved: parseInt(row.resolved, 10) || 0,
        dismissed: parseInt(row.dismissed, 10) || 0,
      };
    }
  } catch (error) {
    console.error("Failed to fetch violation stats:", error);
  }

  return <DashboardClient stats={stats} session={session} />;
}
