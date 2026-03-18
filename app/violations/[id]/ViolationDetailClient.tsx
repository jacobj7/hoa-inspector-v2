"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface Photo {
  id: string;
  url: string;
  caption?: string;
  takenAt: string;
}

interface FineEscalation {
  id: string;
  amount: number;
  dueDate: string;
  status: "pending" | "paid" | "overdue";
  issuedAt: string;
}

interface Violation {
  id: string;
  title: string;
  description: string;
  status: "open" | "resolved" | "pending_review" | "escalated";
  severity: "low" | "medium" | "high" | "critical";
  location: string;
  reportedAt: string;
  resolvedAt?: string;
  reportedBy: string;
  assignedTo?: string;
  photos: Photo[];
  fineEscalations: FineEscalation[];
  notes?: string;
}

interface ViolationDetailClientProps {
  violation: Violation;
}

const severityColors: Record<string, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-800",
  resolved: "bg-green-100 text-green-800",
  pending_review: "bg-yellow-100 text-yellow-800",
  escalated: "bg-red-100 text-red-800",
};

const fineStatusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800",
};

export default function ViolationDetailClient({
  violation,
}: ViolationDetailClientProps) {
  const router = useRouter();
  const [isResolving, setIsResolving] = useState(false);
  const [isGeneratingNotice, setIsGeneratingNotice] = useState(false);
  const [generatedNotice, setGeneratedNotice] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleResolve = async () => {
    setIsResolving(true);
    setError(null);
    try {
      const response = await fetch(`/api/violations/${violation.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: resolveNotes }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to resolve violation");
      }

      setSuccessMessage("Violation resolved successfully");
      setShowResolveModal(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsResolving(false);
    }
  };

  const handleGenerateNotice = async () => {
    setIsGeneratingNotice(true);
    setError(null);
    setGeneratedNotice(null);
    try {
      const response = await fetch(
        `/api/violations/${violation.id}/generate-notice`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        },
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate notice");
      }

      const data = await response.json();
      setGeneratedNotice(data.notice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsGeneratingNotice(false);
    }
  };

  const totalFines = violation.fineEscalations.reduce(
    (sum, fine) => sum + fine.amount,
    0,
  );
  const unpaidFines = violation.fineEscalations
    .filter((f) => f.status !== "paid")
    .reduce((sum, fine) => sum + fine.amount, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {violation.title}
          </h1>
          <p className="text-sm text-gray-500 mt-1">ID: {violation.id}</p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${severityColors[violation.severity]}`}
          >
            {violation.severity.charAt(0).toUpperCase() +
              violation.severity.slice(1)}
          </span>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[violation.status]}`}
          >
            {violation.status
              .replace("_", " ")
              .replace(/\b\w/g, (c) => c.toUpperCase())}
          </span>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 text-sm">
          {successMessage}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        {violation.status !== "resolved" && (
          <button
            onClick={() => setShowResolveModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm flex items-center gap-2"
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
            Mark as Resolved
          </button>
        )}
        <button
          onClick={handleGenerateNotice}
          disabled={isGeneratingNotice}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGeneratingNotice ? (
            <>
              <svg
                className="w-4 h-4 animate-spin"
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
              Generating...
            </>
          ) : (
            <>
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              Generate Notice
            </>
          )}
        </button>
      </div>

      {/* Generated Notice */}
      {generatedNotice && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Generated Notice
            </h2>
            <button
              onClick={() => {
                navigator.clipboard.writeText(generatedNotice);
              }}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
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
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Copy
            </button>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap font-mono leading-relaxed">
            {generatedNotice}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Description
            </h2>
            <p className="text-gray-700 leading-relaxed">
              {violation.description}
            </p>
            {violation.notes && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h3 className="text-sm font-medium text-gray-600 mb-2">
                  Additional Notes
                </h3>
                <p className="text-gray-700 text-sm leading-relaxed">
                  {violation.notes}
                </p>
              </div>
            )}
          </div>

          {/* Photo Gallery */}
          {violation.photos.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Photos ({violation.photos.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {violation.photos.map((photo) => (
                  <button
                    key={photo.id}
                    onClick={() => setSelectedPhoto(photo)}
                    className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity group"
                  >
                    <Image
                      src={photo.url}
                      alt={photo.caption || "Violation photo"}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                      <svg
                        className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                        />
                      </svg>
                    </div>
                    {photo.caption && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">
                        {photo.caption}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fine Escalation */}
          {violation.fineEscalations.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Fine Escalation
                </h2>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Total Outstanding</p>
                  <p className="text-xl font-bold text-red-600">
                    ${unpaidFines.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {violation.fineEscalations.map((fine, index) => (
                  <div
                    key={fine.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium text-gray-600">
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          ${fine.amount.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">
                          Issued: {new Date(fine.issuedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${fineStatusColors[fine.status]}`}
                      >
                        {fine.status.charAt(0).toUpperCase() +
                          fine.status.slice(1)}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        Due: {new Date(fine.dueDate).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between text-sm">
                <span className="text-gray-600">Total Fines Issued</span>
                <span className="font-semibold text-gray-900">
                  ${totalFines.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Metadata */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Details
            </h2>
            <dl className="space-y-3">
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Location
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {violation.location}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Reported By
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {violation.reportedBy}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Reported At
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(violation.reportedAt).toLocaleString()}
                </dd>
              </div>
              {violation.assignedTo && (
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Assigned To
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {violation.assignedTo}
                  </dd>
                </div>
              )}
              {violation.resolvedAt && (
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Resolved At
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {new Date(violation.resolvedAt).toLocaleString()}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Fine Summary */}
          {violation.fineEscalations.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Fine Summary
              </h2>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Total Fines</span>
                  <span className="font-medium">
                    {violation.fineEscalations.length}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Paid</span>
                  <span className="font-medium text-green-600">
                    {
                      violation.fineEscalations.filter(
                        (f) => f.status === "paid",
                      ).length
                    }
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Pending</span>
                  <span className="font-medium text-yellow-600">
                    {
                      violation.fineEscalations.filter(
                        (f) => f.status === "pending",
                      ).length
                    }
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Overdue</span>
                  <span className="font-medium text-red-600">
                    {
                      violation.fineEscalations.filter(
                        (f) => f.status === "overdue",
                      ).length
                    }
                  </span>
                </div>
                <div className="pt-2 border-t border-gray-100 flex justify-between text-sm font-semibold">
                  <span>Outstanding</span>
                  <span className="text-red-600">
                    ${unpaidFines.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resolve Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">
              Resolve Violation
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to mark this violation as resolved? This
              action will update the status and notify relevant parties.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Resolution Notes (optional)
              </label>
              <textarea
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                rows={3}
                placeholder="Describe how the violation was resolved..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowResolveModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={isResolving}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isResolving ? (
                  <>
                    <svg
                      className="w-4 h-4 animate-spin"
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
                    Resolving...
                  </>
                ) : (
                  "Confirm Resolve"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div
            className="relative max-w-4xl w-full max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <svg
                className="w-8 h-8"
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
            <div
              className="relative w-full"
              style={{ paddingBottom: "66.67%" }}
            >
              <Image
                src={selectedPhoto.url}
                alt={selectedPhoto.caption || "Violation photo"}
                fill
                className="object-contain rounded-lg"
              />
            </div>
            {selectedPhoto.caption && (
              <p className="text-white text-center mt-3 text-sm">
                {selectedPhoto.caption}
              </p>
            )}
            <p className="text-gray-400 text-center mt-1 text-xs">
              Taken: {new Date(selectedPhoto.takenAt).toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
