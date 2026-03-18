"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

type ViolationStatus = "all" | "open" | "resolved" | "appealed";

type Violation = {
  id: string;
  title: string;
  description: string;
  status: "open" | "resolved" | "appealed";
  severity: "low" | "medium" | "high" | "critical";
  createdAt: string;
  updatedAt: string;
  assignedTo: string | null;
  location: string;
};

type SortField = keyof Pick<
  Violation,
  "title" | "status" | "severity" | "createdAt" | "updatedAt" | "location"
>;
type SortDirection = "asc" | "desc";

const SEVERITY_ORDER: Record<Violation["severity"], number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

const STATUS_COLORS: Record<Violation["status"], string> = {
  open: "bg-red-100 text-red-800",
  resolved: "bg-green-100 text-green-800",
  appealed: "bg-yellow-100 text-yellow-800",
};

const SEVERITY_COLORS: Record<Violation["severity"], string> = {
  low: "bg-blue-100 text-blue-800",
  medium: "bg-orange-100 text-orange-800",
  high: "bg-red-100 text-red-800",
  critical: "bg-purple-100 text-purple-800",
};

interface ViolationsClientProps {
  initialViolations: Violation[];
}

export default function ViolationsClient({
  initialViolations,
}: ViolationsClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ViolationStatus>("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const tabs: { label: string; value: ViolationStatus; count: number }[] = [
    { label: "All", value: "all", count: initialViolations.length },
    {
      label: "Open",
      value: "open",
      count: initialViolations.filter((v) => v.status === "open").length,
    },
    {
      label: "Resolved",
      value: "resolved",
      count: initialViolations.filter((v) => v.status === "resolved").length,
    },
    {
      label: "Appealed",
      value: "appealed",
      count: initialViolations.filter((v) => v.status === "appealed").length,
    },
  ];

  const filteredAndSorted = useMemo(() => {
    let filtered =
      activeTab === "all"
        ? initialViolations
        : initialViolations.filter((v) => v.status === activeTab);

    return [...filtered].sort((a, b) => {
      let aVal: string | number = a[sortField] ?? "";
      let bVal: string | number = b[sortField] ?? "";

      if (sortField === "severity") {
        aVal = SEVERITY_ORDER[a.severity];
        bVal = SEVERITY_ORDER[b.severity];
      } else if (sortField === "createdAt" || sortField === "updatedAt") {
        aVal = new Date(a[sortField]).getTime();
        bVal = new Date(b[sortField]).getTime();
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [initialViolations, activeTab, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAndSorted.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSorted.map((v) => v.id)));
    }
  };

  const clearMessages = () => {
    setActionError(null);
    setActionSuccess(null);
  };

  const handleBulkAction = async (action: "resolve" | "appeal" | "reopen") => {
    if (selectedIds.size === 0) return;
    clearMessages();
    setIsLoading(true);

    try {
      const response = await fetch("/api/violations/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), action }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Action failed");
      }

      setActionSuccess(
        `Successfully ${action}d ${selectedIds.size} violation(s).`,
      );
      setSelectedIds(new Set());
      router.refresh();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSingleAction = async (
    id: string,
    action: "resolve" | "appeal" | "reopen",
  ) => {
    clearMessages();
    setIsLoading(true);

    try {
      const response = await fetch(`/api/violations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Action failed");
      }

      setActionSuccess(`Violation ${action}d successfully.`);
      router.refresh();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <span className="ml-1 text-gray-400">
          <svg
            className="inline w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
            />
          </svg>
        </span>
      );
    }
    return (
      <span className="ml-1 text-blue-600">
        {sortDirection === "asc" ? (
          <svg
            className="inline w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 15l7-7 7 7"
            />
          </svg>
        ) : (
          <svg
            className="inline w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        )}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Violations Dashboard
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage and track all violations across your organization.
          </p>
        </div>

        {/* Alerts */}
        {actionError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start justify-between">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-red-500 mr-2 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm text-red-700">{actionError}</p>
            </div>
            <button
              onClick={clearMessages}
              className="text-red-400 hover:text-red-600 ml-4"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        {actionSuccess && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start justify-between">
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-green-500 mr-2 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm text-green-700">{actionSuccess}</p>
            </div>
            <button
              onClick={clearMessages}
              className="text-green-400 hover:text-green-600 ml-4"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Status Filter Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => {
                  setActiveTab(tab.value);
                  setSelectedIds(new Set());
                }}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-150
                  ${
                    activeTab === tab.value
                      ? "border-blue-500 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }
                `}
              >
                {tab.label}
                <span
                  className={`ml-2 py-0.5 px-2 rounded-full text-xs font-medium ${
                    activeTab === tab.value
                      ? "bg-blue-100 text-blue-600"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </nav>
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <span className="text-sm text-blue-700 font-medium">
              {selectedIds.size} violation(s) selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleBulkAction("resolve")}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Resolve Selected
              </button>
              <button
                onClick={() => handleBulkAction("appeal")}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-medium bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Appeal Selected
              </button>
              <button
                onClick={() => handleBulkAction("reopen")}
                disabled={isLoading}
                className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Reopen Selected
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-1.5 text-xs font-medium bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          {filteredAndSorted.length === 0 ? (
            <div className="text-center py-16">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No violations found
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {activeTab === "all"
                  ? "No violations have been recorded."
                  : `No ${activeTab} violations.`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={
                          selectedIds.size === filteredAndSorted.length &&
                          filteredAndSorted.length > 0
                        }
                        onChange={toggleSelectAll}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded cursor-pointer"
                      />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort("title")}
                    >
                      Title <SortIcon field="title" />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort("status")}
                    >
                      Status <SortIcon field="status" />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort("severity")}
                    >
                      Severity <SortIcon field="severity" />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort("location")}
                    >
                      Location <SortIcon field="location" />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort("createdAt")}
                    >
                      Created <SortIcon field="createdAt" />
                    </th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => handleSort("updatedAt")}
                    >
                      Updated <SortIcon field="updatedAt" />
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAndSorted.map((violation) => (
                    <tr
                      key={violation.id}
                      className={`hover:bg-gray-50 transition-colors ${selectedIds.has(violation.id) ? "bg-blue-50" : ""}`}
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(violation.id)}
                          onChange={() => toggleSelect(violation.id)}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900 truncate max-w-xs">
                            {violation.title}
                          </p>
                          <p className="text-xs text-gray-500 truncate max-w-xs mt-0.5">
                            {violation.description}
                          </p>
                          {violation.assignedTo && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              Assigned: {violation.assignedTo}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[violation.status]}`}
                        >
                          {violation.status}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${SEVERITY_COLORS[violation.severity]}`}
                        >
                          {violation.severity}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600 max-w-xs truncate">
                        {violation.location}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {new Date(violation.createdAt).toLocaleDateString(
                          "en-US",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          },
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500 whitespace-nowrap">
                        {new Date(violation.updatedAt).toLocaleDateString(
                          "en-US",
                          {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          },
                        )}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {violation.status !== "resolved" && (
                            <button
                              onClick={() =>
                                handleSingleAction(violation.id, "resolve")
                              }
                              disabled={isLoading}
                              title="Resolve"
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              <svg
                                className="w-4 h-4"
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
                            </button>
                          )}
                          {violation.status !== "appealed" && (
                            <button
                              onClick={() =>
                                handleSingleAction(violation.id, "appeal")
                              }
                              disabled={isLoading}
                              title="Appeal"
                              className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
                                />
                              </svg>
                            </button>
                          )}
                          {violation.status !== "open" && (
                            <button
                              onClick={() =>
                                handleSingleAction(violation.id, "reopen")
                              }
                              disabled={isLoading}
                              title="Reopen"
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() =>
                              router.push(`/violations/${violation.id}`)
                            }
                            title="View Details"
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer summary */}
        {filteredAndSorted.length > 0 && (
          <div className="mt-4 text-sm text-gray-500 text-right">
            Showing {filteredAndSorted.length} of {initialViolations.length}{" "}
            violation(s)
          </div>
        )}
      </div>
    </div>
  );
}
