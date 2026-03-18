"use client";

import { useState, useTransition } from "react";

interface Appeal {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  reason: string;
  status: "pending" | "approved" | "denied";
  createdAt: string;
  updatedAt: string;
  moderatorNote?: string;
}

interface AppealsClientProps {
  initialAppeals: Appeal[];
}

async function updateAppealStatus(
  appealId: string,
  status: "approved" | "denied",
  moderatorNote: string,
): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(`/api/appeals/${appealId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, moderatorNote }),
  });

  if (!response.ok) {
    const data = await response.json();
    return { success: false, error: data.error || "Failed to update appeal" };
  }

  return { success: true };
}

function StatusBadge({ status }: { status: Appeal["status"] }) {
  const styles = {
    pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
    approved: "bg-green-100 text-green-800 border-green-200",
    denied: "bg-red-100 text-red-800 border-red-200",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function AppealCard({
  appeal,
  onUpdate,
}: {
  appeal: Appeal;
  onUpdate: (id: string, status: "approved" | "denied", note: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [moderatorNote, setModeratorNote] = useState(
    appeal.moderatorNote || "",
  );
  const [isPending, startTransition] = useTransition();
  const [localStatus, setLocalStatus] = useState(appeal.status);
  const [error, setError] = useState<string | null>(null);

  const handleAction = (action: "approved" | "denied") => {
    setError(null);
    startTransition(async () => {
      const result = await updateAppealStatus(appeal.id, action, moderatorNote);
      if (result.success) {
        setLocalStatus(action);
        onUpdate(appeal.id, action, moderatorNote);
      } else {
        setError(result.error || "An error occurred");
      }
    });
  };

  const formattedDate = new Date(appeal.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-semibold text-gray-900 truncate">
                {appeal.userName}
              </h3>
              <StatusBadge status={localStatus} />
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{appeal.userEmail}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              Submitted: {formattedDate}
            </p>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex-shrink-0 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
            aria-expanded={isExpanded}
          >
            {isExpanded ? "Collapse" : "View Details"}
          </button>
        </div>

        <div className="mt-3">
          <p className="text-sm text-gray-700 line-clamp-2">{appeal.reason}</p>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-4 space-y-4">
          <div>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Appeal Reason
            </h4>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {appeal.reason}
            </p>
          </div>

          {localStatus === "pending" && (
            <div>
              <label
                htmlFor={`note-${appeal.id}`}
                className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2"
              >
                Moderator Note (optional)
              </label>
              <textarea
                id={`note-${appeal.id}`}
                value={moderatorNote}
                onChange={(e) => setModeratorNote(e.target.value)}
                placeholder="Add a note for the user..."
                rows={3}
                className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                disabled={isPending}
              />
            </div>
          )}

          {appeal.moderatorNote && localStatus !== "pending" && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Moderator Note
              </h4>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {appeal.moderatorNote}
              </p>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {localStatus === "pending" && (
            <div className="flex gap-3">
              <button
                onClick={() => handleAction("approved")}
                disabled={isPending}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-green-400 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  "✓ Approve"
                )}
              </button>
              <button
                onClick={() => handleAction("denied")}
                disabled={isPending}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
              >
                {isPending ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  "✗ Deny"
                )}
              </button>
            </div>
          )}

          {localStatus !== "pending" && (
            <div
              className={`rounded-md p-3 ${
                localStatus === "approved"
                  ? "bg-green-50 border border-green-200"
                  : "bg-red-50 border border-red-200"
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  localStatus === "approved" ? "text-green-700" : "text-red-700"
                }`}
              >
                This appeal has been {localStatus}.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AppealsClient({ initialAppeals }: AppealsClientProps) {
  const [appeals, setAppeals] = useState<Appeal[]>(initialAppeals);
  const [filter, setFilter] = useState<
    "all" | "pending" | "approved" | "denied"
  >("all");
  const [searchQuery, setSearchQuery] = useState("");

  const handleUpdate = (
    id: string,
    status: "approved" | "denied",
    note: string,
  ) => {
    setAppeals((prev) =>
      prev.map((appeal) =>
        appeal.id === id
          ? {
              ...appeal,
              status,
              moderatorNote: note,
              updatedAt: new Date().toISOString(),
            }
          : appeal,
      ),
    );
  };

  const filteredAppeals = appeals.filter((appeal) => {
    const matchesFilter = filter === "all" || appeal.status === filter;
    const query = searchQuery.toLowerCase();
    const matchesSearch =
      !query ||
      appeal.userName.toLowerCase().includes(query) ||
      appeal.userEmail.toLowerCase().includes(query) ||
      appeal.reason.toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  });

  const counts = {
    all: appeals.length,
    pending: appeals.filter((a) => a.status === "pending").length,
    approved: appeals.filter((a) => a.status === "approved").length,
    denied: appeals.filter((a) => a.status === "denied").length,
  };

  const filterOptions: Array<{ value: typeof filter; label: string }> = [
    { value: "all", label: `All (${counts.all})` },
    { value: "pending", label: `Pending (${counts.pending})` },
    { value: "approved", label: `Approved (${counts.approved})` },
    { value: "denied", label: `Denied (${counts.denied})` },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Appeals Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review and manage user appeals
        </p>
      </div>

      <div className="mb-6 space-y-4">
        <div>
          <input
            type="text"
            placeholder="Search by name, email, or reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-sm border border-gray-300 rounded-md px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilter(option.value)}
              className={`px-4 py-2 text-sm font-medium rounded-full border transition-colors ${
                filter === option.value
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {filteredAppeals.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <div className="text-4xl mb-3">📋</div>
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            No appeals found
          </h3>
          <p className="text-sm text-gray-500">
            {searchQuery || filter !== "all"
              ? "Try adjusting your search or filter criteria."
              : "There are no appeals to review at this time."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAppeals.map((appeal) => (
            <AppealCard
              key={appeal.id}
              appeal={appeal}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
