import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import ViolationDetailClient from "./ViolationDetailClient";

interface ViolationDetailPageProps {
  params: { id: string };
}

async function getViolation(id: string, userId: string) {
  const result = await db.query(
    `SELECT 
      v.id,
      v.violation_number,
      v.status,
      v.type,
      v.description,
      v.location,
      v.fine_amount,
      v.due_date,
      v.created_at,
      v.updated_at,
      v.notes,
      v.officer_id,
      v.property_id,
      u.name AS officer_name,
      u.email AS officer_email,
      p.address AS property_address,
      p.owner_id AS property_owner_id,
      po.name AS property_owner_name,
      po.email AS property_owner_email
    FROM violations v
    LEFT JOIN users u ON v.officer_id = u.id
    LEFT JOIN properties p ON v.property_id = p.id
    LEFT JOIN users po ON p.owner_id = po.id
    WHERE v.id = $1`,
    [id],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
}

async function getEvidencePhotos(violationId: string) {
  const result = await db.query(
    `SELECT 
      id,
      url,
      caption,
      uploaded_at,
      uploaded_by,
      u.name AS uploader_name
    FROM violation_evidence ve
    LEFT JOIN users u ON ve.uploaded_by = u.id
    WHERE ve.violation_id = $1
    ORDER BY ve.uploaded_at ASC`,
    [violationId],
  );

  return result.rows;
}

async function getNoticeHistory(violationId: string) {
  const result = await db.query(
    `SELECT 
      n.id,
      n.type,
      n.sent_at,
      n.delivery_status,
      n.recipient_email,
      n.subject,
      n.body,
      u.name AS sent_by_name
    FROM violation_notices n
    LEFT JOIN users u ON n.sent_by = u.id
    WHERE n.violation_id = $1
    ORDER BY n.sent_at DESC`,
    [violationId],
  );

  return result.rows;
}

async function getPaymentHistory(violationId: string) {
  const result = await db.query(
    `SELECT 
      p.id,
      p.amount,
      p.payment_date,
      p.payment_method,
      p.transaction_id,
      p.status,
      p.notes
    FROM violation_payments p
    WHERE p.violation_id = $1
    ORDER BY p.payment_date DESC`,
    [violationId],
  );

  return result.rows;
}

export default async function ViolationDetailPage({
  params,
}: ViolationDetailPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Authentication Required
          </h2>
          <p className="text-gray-600 mb-6">
            Please sign in to view violation details.
          </p>
          <Link
            href="/auth/signin"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const violation = await getViolation(params.id, session.user.id as string);

  if (!violation) {
    notFound();
  }

  const [evidencePhotos, noticeHistory, paymentHistory] = await Promise.all([
    getEvidencePhotos(params.id),
    getNoticeHistory(params.id),
    getPaymentHistory(params.id),
  ]);

  const isAdmin =
    (session.user as any).role === "admin" ||
    (session.user as any).role === "officer";
  const isOwner = violation.property_owner_id === session.user.id;
  const canManage = isAdmin;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/violations"
                className="text-gray-500 hover:text-gray-700 flex items-center space-x-1"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                <span>Back to Violations</span>
              </Link>
            </div>
            <div className="flex items-center space-x-2">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  violation.status === "open"
                    ? "bg-red-100 text-red-800"
                    : violation.status === "pending"
                      ? "bg-yellow-100 text-yellow-800"
                      : violation.status === "resolved"
                        ? "bg-green-100 text-green-800"
                        : violation.status === "appealed"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-800"
                }`}
              >
                {violation.status.charAt(0).toUpperCase() +
                  violation.status.slice(1)}
              </span>
            </div>
          </div>
          <div className="mt-4">
            <h1 className="text-3xl font-bold text-gray-900">
              Violation #{violation.violation_number}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Created on{" "}
              {new Date(violation.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Violation Details */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Violation Details
                </h2>
              </div>
              <div className="px-6 py-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">Type</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {violation.type}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Location
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {violation.location ||
                        violation.property_address ||
                        "N/A"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Fine Amount
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-red-600">
                      ${parseFloat(violation.fine_amount || 0).toFixed(2)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Due Date
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {violation.due_date
                        ? new Date(violation.due_date).toLocaleDateString(
                            "en-US",
                            {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            },
                          )
                        : "N/A"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Issuing Officer
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {violation.officer_name || "N/A"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Last Updated
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {new Date(violation.updated_at).toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        },
                      )}
                    </dd>
                  </div>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Description
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">
                    {violation.description || "No description provided."}
                  </dd>
                </div>
                {violation.notes && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Internal Notes
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap bg-yellow-50 p-3 rounded-md">
                      {violation.notes}
                    </dd>
                  </div>
                )}
              </div>
            </div>

            {/* Property Information */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Property Information
                </h2>
              </div>
              <div className="px-6 py-4 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Property Address
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {violation.property_address || "N/A"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-500">
                      Property Owner
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {violation.property_owner_name || "N/A"}
                    </dd>
                  </div>
                  {isAdmin && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500">
                        Owner Email
                      </dt>
                      <dd className="mt-1 text-sm text-gray-900">
                        {violation.property_owner_email || "N/A"}
                      </dd>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Evidence Photos */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  Evidence Photos
                </h2>
                <span className="text-sm text-gray-500">
                  {evidencePhotos.length} photo
                  {evidencePhotos.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="px-6 py-4">
                {evidencePhotos.length === 0 ? (
                  <div className="text-center py-8">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="mt-2 text-sm text-gray-500">
                      No evidence photos uploaded
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {evidencePhotos.map((photo: any) => (
                      <div key={photo.id} className="relative group">
                        <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
                          <img
                            src={photo.url}
                            alt={photo.caption || "Evidence photo"}
                            className="w-full h-full object-cover group-hover:opacity-90 transition-opacity"
                          />
                        </div>
                        {photo.caption && (
                          <p className="mt-1 text-xs text-gray-500 truncate">
                            {photo.caption}
                          </p>
                        )}
                        <p className="text-xs text-gray-400">
                          {new Date(photo.uploaded_at).toLocaleDateString()} by{" "}
                          {photo.uploader_name || "Unknown"}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Notice History */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  Notice History
                </h2>
                <span className="text-sm text-gray-500">
                  {noticeHistory.length} notice
                  {noticeHistory.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="px-6 py-4">
                {noticeHistory.length === 0 ? (
                  <div className="text-center py-8">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="mt-2 text-sm text-gray-500">
                      No notices sent yet
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {noticeHistory.map((notice: any) => (
                      <div
                        key={notice.id}
                        className="border border-gray-200 rounded-lg p-4"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {notice.subject || notice.type}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Sent to: {notice.recipient_email}
                            </p>
                            <p className="text-xs text-gray-500">
                              By: {notice.sent_by_name || "System"} on{" "}
                              {new Date(notice.sent_at).toLocaleDateString(
                                "en-US",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </p>
                          </div>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              notice.delivery_status === "delivered"
                                ? "bg-green-100 text-green-800"
                                : notice.delivery_status === "failed"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {notice.delivery_status || "pending"}
                          </span>
                        </div>
                        {notice.body && (
                          <div className="mt-3 text-sm text-gray-600 bg-gray-50 p-3 rounded-md max-h-32 overflow-y-auto">
                            <p className="whitespace-pre-wrap">{notice.body}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Payment History */}
            {paymentHistory.length > 0 && (
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Payment History
                  </h2>
                </div>
                <div className="px-6 py-4">
                  <div className="space-y-3">
                    {paymentHistory.map((payment: any) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            ${parseFloat(payment.amount).toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {payment.payment_method} •{" "}
                            {new Date(
                              payment.payment_date,
                            ).toLocaleDateString()}
                          </p>
                          {payment.transaction_id && (
                            <p className="text-xs text-gray-400">
                              Transaction: {payment.transaction_id}
                            </p>
                          )}
                        </div>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            payment.status === "completed"
                              ? "bg-green-100 text-green-800"
                              : payment.status === "failed"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {payment.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Fine Summary */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Fine Summary
                </h2>
              </div>
              <div className="px-6 py-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Original Fine</span>
                  <span className="text-sm font-medium text-gray-900">
                    ${parseFloat(violation.fine_amount || 0).toFixed(2)}
                  </span>
                </div>
                {paymentHistory.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Total Paid</span>
                    <span className="text-sm font-medium text-green-600">
                      -$
                      {paymentHistory
                        .filter((p: any) => p.status === "completed")
                        .reduce(
                          (sum: number, p: any) =>
                            sum + parseFloat(p.amount || 0),
                          0,
                        )
                        .toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-3 flex justify-between">
                  <span className="text-sm font-semibold text-gray-900">
                    Balance Due
                  </span>
                  <span className="text-sm font-bold text-red-600">
                    $
                    {Math.max(
                      0,
                      parseFloat(violation.fine_amount || 0) -
                        paymentHistory
                          .filter((p: any) => p.status === "completed")
                          .reduce(
                            (sum: number, p: any) =>
                              sum + parseFloat(p.amount || 0),
                            0,
                          ),
                    ).toFixed(2)}
                  </span>
                </div>
                {violation.due_date && (
                  <div className="text-xs text-gray-500 text-center">
                    Due by{" "}
                    {new Date(violation.due_date).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons - Client Component */}
            <ViolationDetailClient
              violation={violation}
              canManage={canManage}
              isOwner={isOwner}
              session={session}
            />

            {/* Quick Info */}
            <div className="bg-white shadow rounded-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Quick Info
                </h2>
              </div>
              <div className="px-6 py-4 space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Violation Number</p>
                    <p className="text-sm font-medium text-gray-900">
                      #{violation.violation_number}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Issued By</p>
                    <p className="text-sm font-medium text-gray-900">
                      {violation.officer_name || "N/A"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Date Issued</p>
                    <p className="text-sm font-medium text-gray-900">
                      {new Date(violation.created_at).toLocaleDateString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        },
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Property</p>
                    <p className="text-sm font-medium text-gray-900 truncate max-w-[160px]">
                      {violation.property_address || "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
