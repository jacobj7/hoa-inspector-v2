"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface AppealFormProps {
  token: string;
  banReason?: string;
  userName?: string;
}

async function submitAppeal(
  token: string,
  reason: string,
): Promise<{ success: boolean; message: string }> {
  const response = await fetch("/api/appeals/submit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, reason }),
  });

  const data = await response.json();

  if (!response.ok) {
    return {
      success: false,
      message: data.message || "Failed to submit appeal",
    };
  }

  return {
    success: true,
    message: data.message || "Appeal submitted successfully",
  };
}

export default function AppealForm({
  token,
  banReason,
  userName,
}: AppealFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [charCount, setCharCount] = useState(0);

  const MIN_CHARS = 50;
  const MAX_CHARS = 2000;

  const handleReasonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_CHARS) {
      setReason(value);
      setCharCount(value.length);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (reason.trim().length < MIN_CHARS) {
      setError(
        `Please provide at least ${MIN_CHARS} characters explaining your appeal.`,
      );
      return;
    }

    startTransition(async () => {
      const result = await submitAppeal(token, reason.trim());

      if (result.success) {
        setSuccess(result.message);
        setReason("");
        setCharCount(0);
        setTimeout(() => {
          router.push("/");
        }, 3000);
      } else {
        setError(result.message);
      }
    });
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
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
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Appeal Submitted
          </h2>
          <p className="text-gray-600 mb-4">{success}</p>
          <p className="text-sm text-gray-500">
            Redirecting you to the homepage...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg w-full">
        {/* Header */}
        <div className="mb-6">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-4">
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Submit an Appeal</h1>
          {userName && (
            <p className="text-gray-600 mt-1">
              Hello, <span className="font-medium">{userName}</span>
            </p>
          )}
          <p className="text-gray-500 text-sm mt-2">
            Please explain why you believe this action should be reconsidered.
            Be honest and provide as much detail as possible.
          </p>
        </div>

        {/* Ban Reason Display */}
        {banReason && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-semibold text-red-800 mb-1">
              Reason for ban:
            </h3>
            <p className="text-sm text-red-700">{banReason}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="reason"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Your Appeal <span className="text-red-500">*</span>
            </label>
            <textarea
              id="reason"
              name="reason"
              value={reason}
              onChange={handleReasonChange}
              rows={8}
              disabled={isPending}
              placeholder="Explain why you believe this ban was unjust or why you should be given another chance. Please be specific and honest..."
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-colors disabled:bg-gray-50 disabled:text-gray-500"
            />
            <div className="flex justify-between items-center mt-1">
              <span
                className={`text-xs ${charCount < MIN_CHARS ? "text-amber-600" : "text-gray-400"}`}
              >
                {charCount < MIN_CHARS
                  ? `${MIN_CHARS - charCount} more characters required`
                  : "Minimum length met"}
              </span>
              <span
                className={`text-xs ${charCount > MAX_CHARS * 0.9 ? "text-amber-600" : "text-gray-400"}`}
              >
                {charCount}/{MAX_CHARS}
              </span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <svg
                className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5"
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
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Guidelines */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-blue-800 mb-2">
              Tips for a successful appeal:
            </h3>
            <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
              <li>Be honest and take responsibility if applicable</li>
              <li>Explain any misunderstandings or context</li>
              <li>Describe how you plan to follow the rules going forward</li>
              <li>Avoid making accusations or being confrontational</li>
            </ul>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isPending || reason.trim().length < MIN_CHARS}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 flex items-center justify-center gap-2"
          >
            {isPending ? (
              <>
                <svg
                  className="animate-spin w-5 h-5"
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
                    d="M4 12a8 8 0 018-8V0C5.373 0 14 0 14 8h-4z"
                  />
                </svg>
                Submitting Appeal...
              </>
            ) : (
              <>
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
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
                Submit Appeal
              </>
            )}
          </button>

          <p className="text-xs text-gray-400 text-center">
            By submitting this appeal, you agree that all information provided
            is truthful and accurate.
          </p>
        </form>
      </div>
    </div>
  );
}
