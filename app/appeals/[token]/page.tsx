import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import AppealForm from "./AppealForm";

interface PageProps {
  params: {
    token: string;
  };
}

async function getNoticeByToken(token: string) {
  const result = await db.query(
    `SELECT 
      n.id,
      n.token,
      n.title,
      n.description,
      n.issued_at,
      n.expires_at,
      n.status,
      n.recipient_name,
      n.recipient_email,
      a.id as appeal_id,
      a.status as appeal_status,
      a.submitted_at as appeal_submitted_at
    FROM notices n
    LEFT JOIN appeals a ON a.notice_id = n.id
    WHERE n.token = $1
    LIMIT 1`,
    [token],
  );

  return result.rows[0] || null;
}

export default async function AppealPage({ params }: PageProps) {
  const { token } = params;

  if (!token) {
    notFound();
  }

  const notice = await getNoticeByToken(token);

  if (!notice) {
    notFound();
  }

  const isExpired =
    notice.expires_at && new Date(notice.expires_at) < new Date();
  const hasExistingAppeal = !!notice.appeal_id;
  const isAppealable =
    !isExpired &&
    !hasExistingAppeal &&
    notice.status !== "closed" &&
    notice.status !== "resolved";

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="bg-blue-600 px-6 py-8">
            <h1 className="text-2xl font-bold text-white">Appeal Submission</h1>
            <p className="mt-2 text-blue-100">
              Review the notice details below and submit your appeal if
              applicable.
            </p>
          </div>

          <div className="px-6 py-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Notice Details
            </h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Recipient</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {notice.recipient_name || "N/A"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                      notice.status === "active"
                        ? "bg-green-100 text-green-800"
                        : notice.status === "closed"
                          ? "bg-red-100 text-red-800"
                          : notice.status === "resolved"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {notice.status}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">
                  Issued Date
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {notice.issued_at
                    ? new Date(notice.issued_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : "N/A"}
                </dd>
              </div>
              {notice.expires_at && (
                <div>
                  <dt className="text-sm font-medium text-gray-500">
                    Appeal Deadline
                  </dt>
                  <dd
                    className={`mt-1 text-sm ${
                      isExpired ? "text-red-600 font-medium" : "text-gray-900"
                    }`}
                  >
                    {new Date(notice.expires_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                    {isExpired && " (Expired)"}
                  </dd>
                </div>
              )}
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Title</dt>
                <dd className="mt-1 text-sm text-gray-900">{notice.title}</dd>
              </div>
              {notice.description && (
                <div className="sm:col-span-2">
                  <dt className="text-sm font-medium text-gray-500">
                    Description
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">
                    {notice.description}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          <div className="px-6 py-6">
            {hasExistingAppeal ? (
              <div className="rounded-md bg-yellow-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-yellow-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-yellow-800">
                      Appeal Already Submitted
                    </h3>
                    <div className="mt-2 text-sm text-yellow-700">
                      <p>
                        An appeal has already been submitted for this notice on{" "}
                        {notice.appeal_submitted_at
                          ? new Date(
                              notice.appeal_submitted_at,
                            ).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })
                          : "a previous date"}
                        . Current status:{" "}
                        <span className="font-medium capitalize">
                          {notice.appeal_status}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : isExpired ? (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-red-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Appeal Period Expired
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>
                        The deadline to submit an appeal for this notice has
                        passed. Please contact us directly if you believe this
                        is an error.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : notice.status === "closed" || notice.status === "resolved" ? (
              <div className="rounded-md bg-gray-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-gray-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-gray-800">
                      Notice{" "}
                      {notice.status === "closed" ? "Closed" : "Resolved"}
                    </h3>
                    <div className="mt-2 text-sm text-gray-700">
                      <p>
                        This notice has been {notice.status} and is no longer
                        accepting appeals.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <AppealForm noticeId={notice.id} token={token} />
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-gray-500">
          This is a secure, tokenized link. Do not share this URL with others.
        </p>
      </div>
    </div>
  );
}
