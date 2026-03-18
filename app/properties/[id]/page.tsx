import { notFound } from "next/navigation";
import Link from "next/link";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function getProperty(id: string) {
  const client = await pool.connect();
  try {
    const propertyResult = await client.query(
      `SELECT 
        p.id,
        p.address,
        p.city,
        p.state,
        p.zip_code,
        p.parcel_number,
        p.property_type,
        p.year_built,
        p.square_footage,
        p.lot_size,
        p.zoning,
        p.compliance_status,
        p.last_inspection_date,
        p.created_at,
        p.updated_at,
        o.id as owner_id,
        o.first_name,
        o.last_name,
        o.email,
        o.phone,
        o.mailing_address,
        o.owner_since
      FROM properties p
      LEFT JOIN owners o ON p.owner_id = o.id
      WHERE p.id = $1`,
      [id],
    );

    if (propertyResult.rows.length === 0) {
      return null;
    }

    const violationsResult = await client.query(
      `SELECT 
        v.id,
        v.violation_code,
        v.description,
        v.severity,
        v.status,
        v.issued_date,
        v.due_date,
        v.resolved_date,
        v.fine_amount,
        v.notes,
        i.name as inspector_name
      FROM violations v
      LEFT JOIN inspectors i ON v.inspector_id = i.id
      WHERE v.property_id = $1
      ORDER BY v.issued_date DESC`,
      [id],
    );

    return {
      property: propertyResult.rows[0],
      violations: violationsResult.rows,
    };
  } finally {
    client.release();
  }
}

function getComplianceStatusColor(status: string) {
  switch (status?.toLowerCase()) {
    case "compliant":
      return "bg-green-100 text-green-800 border-green-200";
    case "non-compliant":
      return "bg-red-100 text-red-800 border-red-200";
    case "pending":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "under_review":
      return "bg-blue-100 text-blue-800 border-blue-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

function getViolationSeverityColor(severity: string) {
  switch (severity?.toLowerCase()) {
    case "critical":
      return "bg-red-100 text-red-800";
    case "high":
      return "bg-orange-100 text-orange-800";
    case "medium":
      return "bg-yellow-100 text-yellow-800";
    case "low":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getViolationStatusColor(status: string) {
  switch (status?.toLowerCase()) {
    case "resolved":
      return "bg-green-100 text-green-800";
    case "open":
      return "bg-red-100 text-red-800";
    case "in_progress":
      return "bg-blue-100 text-blue-800";
    case "appealed":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function formatDate(dateString: string | null) {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export default async function PropertyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const data = await getProperty(params.id);

  if (!data) {
    notFound();
  }

  const { property, violations } = data;

  const openViolations = violations.filter(
    (v) => v.status?.toLowerCase() === "open",
  );
  const resolvedViolations = violations.filter(
    (v) => v.status?.toLowerCase() === "resolved",
  );
  const totalFines = violations.reduce(
    (sum, v) => sum + (parseFloat(v.fine_amount) || 0),
    0,
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
            <Link href="/" className="hover:text-gray-700 transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link
              href="/properties"
              className="hover:text-gray-700 transition-colors"
            >
              Properties
            </Link>
            <span>/</span>
            <span className="text-gray-900">{property.address}</span>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {property.address}
              </h1>
              <p className="text-gray-500 mt-1">
                {property.city}, {property.state} {property.zip_code}
              </p>
              {property.parcel_number && (
                <p className="text-sm text-gray-400 mt-1">
                  Parcel: {property.parcel_number}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium border ${getComplianceStatusColor(
                  property.compliance_status,
                )}`}
              >
                {property.compliance_status
                  ? property.compliance_status
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (l: string) => l.toUpperCase())
                  : "Unknown"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500 font-medium">
              Total Violations
            </p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {violations.length}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500 font-medium">Open Violations</p>
            <p className="text-3xl font-bold text-red-600 mt-1">
              {openViolations.length}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500 font-medium">
              Resolved Violations
            </p>
            <p className="text-3xl font-bold text-green-600 mt-1">
              {resolvedViolations.length}
            </p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500 font-medium">Total Fines</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {formatCurrency(totalFines)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-1 space-y-6">
            {/* Property Details */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Property Details
              </h2>
              <dl className="space-y-3">
                {property.property_type && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Type
                    </dt>
                    <dd className="text-sm text-gray-900 mt-0.5">
                      {property.property_type}
                    </dd>
                  </div>
                )}
                {property.zoning && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Zoning
                    </dt>
                    <dd className="text-sm text-gray-900 mt-0.5">
                      {property.zoning}
                    </dd>
                  </div>
                )}
                {property.year_built && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Year Built
                    </dt>
                    <dd className="text-sm text-gray-900 mt-0.5">
                      {property.year_built}
                    </dd>
                  </div>
                )}
                {property.square_footage && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Square Footage
                    </dt>
                    <dd className="text-sm text-gray-900 mt-0.5">
                      {Number(property.square_footage).toLocaleString()} sq ft
                    </dd>
                  </div>
                )}
                {property.lot_size && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Lot Size
                    </dt>
                    <dd className="text-sm text-gray-900 mt-0.5">
                      {property.lot_size}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Last Inspection
                  </dt>
                  <dd className="text-sm text-gray-900 mt-0.5">
                    {formatDate(property.last_inspection_date)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Record Created
                  </dt>
                  <dd className="text-sm text-gray-900 mt-0.5">
                    {formatDate(property.created_at)}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Owner Information */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Owner Information
              </h2>
              {property.owner_id ? (
                <dl className="space-y-3">
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Name
                    </dt>
                    <dd className="text-sm text-gray-900 mt-0.5">
                      {property.first_name} {property.last_name}
                    </dd>
                  </div>
                  {property.email && (
                    <div>
                      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Email
                      </dt>
                      <dd className="text-sm mt-0.5">
                        <a
                          href={`mailto:${property.email}`}
                          className="text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          {property.email}
                        </a>
                      </dd>
                    </div>
                  )}
                  {property.phone && (
                    <div>
                      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Phone
                      </dt>
                      <dd className="text-sm mt-0.5">
                        <a
                          href={`tel:${property.phone}`}
                          className="text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          {property.phone}
                        </a>
                      </dd>
                    </div>
                  )}
                  {property.mailing_address && (
                    <div>
                      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Mailing Address
                      </dt>
                      <dd className="text-sm text-gray-900 mt-0.5">
                        {property.mailing_address}
                      </dd>
                    </div>
                  )}
                  {property.owner_since && (
                    <div>
                      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                        Owner Since
                      </dt>
                      <dd className="text-sm text-gray-900 mt-0.5">
                        {formatDate(property.owner_since)}
                      </dd>
                    </div>
                  )}
                  {property.owner_id && (
                    <div className="pt-2">
                      <Link
                        href={`/owners/${property.owner_id}`}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                      >
                        View Owner Profile →
                      </Link>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-gray-500">
                  No owner information available.
                </p>
              )}
            </div>

            {/* Compliance Status */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Compliance Status
              </h2>
              <div
                className={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-semibold border ${getComplianceStatusColor(
                  property.compliance_status,
                )}`}
              >
                {property.compliance_status
                  ? property.compliance_status
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (l: string) => l.toUpperCase())
                  : "Unknown"}
              </div>
              {openViolations.length > 0 && (
                <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-100">
                  <p className="text-sm text-red-700 font-medium">
                    {openViolations.length} open violation
                    {openViolations.length !== 1 ? "s" : ""} require
                    {openViolations.length === 1 ? "s" : ""} attention
                  </p>
                </div>
              )}
              {openViolations.length === 0 && violations.length > 0 && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-100">
                  <p className="text-sm text-green-700 font-medium">
                    All violations have been resolved
                  </p>
                </div>
              )}
              {violations.length === 0 && (
                <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-100">
                  <p className="text-sm text-green-700 font-medium">
                    No violations on record
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Violation History */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="px-6 py-5 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Violation History
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {violations.length} total record
                  {violations.length !== 1 ? "s" : ""}
                </p>
              </div>

              {violations.length === 0 ? (
                <div className="px-6 py-12 text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-6 h-6 text-green-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-900 font-medium">
                    No violations on record
                  </p>
                  <p className="text-gray-500 text-sm mt-1">
                    This property has a clean compliance history.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {violations.map((violation) => (
                    <div key={violation.id} className="px-6 py-5">
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            {violation.violation_code && (
                              <span className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                                {violation.violation_code}
                              </span>
                            )}
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getViolationSeverityColor(
                                violation.severity,
                              )}`}
                            >
                              {violation.severity
                                ? violation.severity.charAt(0).toUpperCase() +
                                  violation.severity.slice(1)
                                : "Unknown"}{" "}
                              Severity
                            </span>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getViolationStatusColor(
                                violation.status,
                              )}`}
                            >
                              {violation.status
                                ? violation.status
                                    .replace(/_/g, " ")
                                    .replace(/\b\w/g, (l: string) =>
                                      l.toUpperCase(),
                                    )
                                : "Unknown"}
                            </span>
                          </div>
                          <p className="text-sm text-gray-900 font-medium">
                            {violation.description || "No description provided"}
                          </p>
                          {violation.notes && (
                            <p className="text-sm text-gray-500 mt-1">
                              {violation.notes}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                            <span className="text-xs text-gray-500">
                              Issued: {formatDate(violation.issued_date)}
                            </span>
                            {violation.due_date && (
                              <span className="text-xs text-gray-500">
                                Due: {formatDate(violation.due_date)}
                              </span>
                            )}
                            {violation.resolved_date && (
                              <span className="text-xs text-green-600">
                                Resolved: {formatDate(violation.resolved_date)}
                              </span>
                            )}
                            {violation.inspector_name && (
                              <span className="text-xs text-gray-500">
                                Inspector: {violation.inspector_name}
                              </span>
                            )}
                          </div>
                        </div>
                        {violation.fine_amount && (
                          <div className="sm:text-right flex-shrink-0">
                            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                              Fine
                            </p>
                            <p className="text-sm font-semibold text-gray-900 mt-0.5">
                              {formatCurrency(
                                parseFloat(violation.fine_amount),
                              )}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
