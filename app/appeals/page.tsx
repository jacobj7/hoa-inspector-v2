import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { pool } from "@/lib/db";
import AppealsClient from "./AppealsClient";

export default async function AppealsPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect("/login");
  }

  const userRole = (session.user as { role?: string }).role;
  if (userRole !== "manager" && userRole !== "admin") {
    redirect("/dashboard");
  }

  const client = await pool.connect();
  let appeals: Appeal[] = [];

  try {
    const result = await client.query<Appeal>(`
      SELECT
        a.id,
        a.status,
        a.reason,
        a.created_at,
        a.updated_at,
        a.reviewer_notes,
        u.id AS user_id,
        u.name AS user_name,
        u.email AS user_email,
        p.id AS penalty_id,
        p.type AS penalty_type,
        p.description AS penalty_description,
        p.created_at AS penalty_created_at
      FROM appeals a
      JOIN users u ON a.user_id = u.id
      JOIN penalties p ON a.penalty_id = p.id
      ORDER BY
        CASE a.status
          WHEN 'pending' THEN 1
          WHEN 'under_review' THEN 2
          WHEN 'approved' THEN 3
          WHEN 'denied' THEN 4
          ELSE 5
        END,
        a.created_at DESC
    `);
    appeals = result.rows;
  } catch (error) {
    console.error("Error fetching appeals:", error);
    appeals = [];
  } finally {
    client.release();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Appeals Management
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Review and manage user appeals for penalties and restrictions.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 mb-8">
          <StatCard label="Total Appeals" value={appeals.length} color="blue" />
          <StatCard
            label="Pending"
            value={appeals.filter((a) => a.status === "pending").length}
            color="yellow"
          />
          <StatCard
            label="Under Review"
            value={appeals.filter((a) => a.status === "under_review").length}
            color="purple"
          />
          <StatCard
            label="Resolved"
            value={
              appeals.filter(
                (a) => a.status === "approved" || a.status === "denied",
              ).length
            }
            color="green"
          />
        </div>

        <AppealsClient
          appeals={appeals}
          currentUserId={session.user.id as string}
        />
      </div>
    </div>
  );
}

interface Appeal {
  id: string;
  status: "pending" | "under_review" | "approved" | "denied";
  reason: string;
  created_at: string;
  updated_at: string;
  reviewer_notes: string | null;
  user_id: string;
  user_name: string;
  user_email: string;
  penalty_id: string;
  penalty_type: string;
  penalty_description: string;
  penalty_created_at: string;
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "blue" | "yellow" | "purple" | "green";
}) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
    purple: "bg-purple-50 border-purple-200 text-purple-700",
    green: "bg-green-50 border-green-200 text-green-700",
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  );
}
