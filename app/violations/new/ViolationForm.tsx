"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";

const violationSchema = z.object({
  propertyId: z.string().min(1, "Property is required"),
  propertyAddress: z.string().min(1, "Property address is required"),
  category: z.string().min(1, "Category is required"),
  severity: z.enum(["low", "medium", "high", "critical"]),
  notes: z.string().min(10, "Notes must be at least 10 characters"),
  photoUrls: z.array(z.string()).optional(),
});

type ViolationFormData = z.infer<typeof violationSchema>;

const CATEGORIES = [
  "Building Code",
  "Fire Safety",
  "Health & Sanitation",
  "Noise Ordinance",
  "Parking",
  "Property Maintenance",
  "Sign Ordinance",
  "Zoning",
  "Other",
];

const SEVERITY_OPTIONS = [
  {
    value: "low",
    label: "Low",
    color: "bg-green-100 text-green-800 border-green-300",
  },
  {
    value: "medium",
    label: "Medium",
    color: "bg-yellow-100 text-yellow-800 border-yellow-300",
  },
  {
    value: "high",
    label: "High",
    color: "bg-orange-100 text-orange-800 border-orange-300",
  },
  {
    value: "critical",
    label: "Critical",
    color: "bg-red-100 text-red-800 border-red-300",
  },
];

interface PropertySuggestion {
  id: string;
  address: string;
  owner: string;
}

export default function ViolationForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Partial<ViolationFormData>>({
    severity: "medium",
    photoUrls: [],
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof ViolationFormData, string>>
  >({});
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PropertySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchProperties = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setIsSearching(true);
    try {
      const res = await fetch(
        `/api/properties/search?q=${encodeURIComponent(query)}`,
      );
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.properties || []);
        setShowSuggestions(true);
      }
    } catch {
      setSuggestions([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setFormData((prev) => ({ ...prev, propertyId: "", propertyAddress: "" }));

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      searchProperties(value);
    }, 300);
  };

  const handleSelectProperty = (property: PropertySuggestion) => {
    setSearchQuery(property.address);
    setFormData((prev) => ({
      ...prev,
      propertyId: property.id,
      propertyAddress: property.address,
    }));
    setSuggestions([]);
    setShowSuggestions(false);
    setErrors((prev) => ({
      ...prev,
      propertyId: undefined,
      propertyAddress: undefined,
    }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingPhotos(true);
    const newUrls: string[] = [];

    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        if (file.size > 10 * 1024 * 1024) {
          setSubmitError(`File ${file.name} exceeds 10MB limit`);
          continue;
        }

        const formDataUpload = new FormData();
        formDataUpload.append("file", file);

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formDataUpload,
        });

        if (res.ok) {
          const data = await res.json();
          newUrls.push(data.url);
        }
      }

      const updatedUrls = [...photoUrls, ...newUrls];
      setPhotoUrls(updatedUrls);
      setFormData((prev) => ({ ...prev, photoUrls: updatedUrls }));
    } catch {
      setSubmitError("Failed to upload photos. Please try again.");
    } finally {
      setUploadingPhotos(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removePhoto = (index: number) => {
    const updatedUrls = photoUrls.filter((_, i) => i !== index);
    setPhotoUrls(updatedUrls);
    setFormData((prev) => ({ ...prev, photoUrls: updatedUrls }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const result = violationSchema.safeParse({
      ...formData,
      photoUrls,
    });

    if (!result.success) {
      const fieldErrors: Partial<Record<keyof ViolationFormData, string>> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof ViolationFormData;
        fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/violations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result.data),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to submit violation");
      }

      const data = await res.json();
      router.push(`/violations/${data.id}?success=true`);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-24">
      {/* Property Search */}
      <div className="relative">
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Property Address <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
            placeholder="Search by address or parcel number..."
            className={`w-full px-4 py-3 text-base border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${
              errors.propertyId
                ? "border-red-400 bg-red-50"
                : "border-gray-300 bg-white"
            }`}
            autoComplete="off"
          />
          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {suggestions.map((property) => (
              <button
                key={property.id}
                type="button"
                onMouseDown={() => handleSelectProperty(property)}
                className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-0"
              >
                <div className="font-medium text-gray-900 text-sm">
                  {property.address}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Owner: {property.owner}
                </div>
              </button>
            ))}
          </div>
        )}

        {errors.propertyId && (
          <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
            <span>⚠</span> {errors.propertyId}
          </p>
        )}
      </div>

      {/* Category */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Violation Category <span className="text-red-500">*</span>
        </label>
        <select
          value={formData.category || ""}
          onChange={(e) => {
            setFormData((prev) => ({ ...prev, category: e.target.value }));
            setErrors((prev) => ({ ...prev, category: undefined }));
          }}
          className={`w-full px-4 py-3 text-base border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors appearance-none bg-white ${
            errors.category ? "border-red-400 bg-red-50" : "border-gray-300"
          }`}
        >
          <option value="">Select a category...</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        {errors.category && (
          <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
            <span>⚠</span> {errors.category}
          </p>
        )}
      </div>

      {/* Severity */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Severity Level <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SEVERITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setFormData((prev) => ({
                  ...prev,
                  severity: option.value as ViolationFormData["severity"],
                }));
                setErrors((prev) => ({ ...prev, severity: undefined }));
              }}
              className={`py-3 px-4 rounded-xl border-2 font-semibold text-sm transition-all ${
                formData.severity === option.value
                  ? `${option.color} border-current scale-105 shadow-sm`
                  : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        {errors.severity && (
          <p className="mt-1.5 text-sm text-red-600 flex items-center gap-1">
            <span>⚠</span> {errors.severity}
          </p>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Violation Notes <span className="text-red-500">*</span>
        </label>
        <textarea
          value={formData.notes || ""}
          onChange={(e) => {
            setFormData((prev) => ({ ...prev, notes: e.target.value }));
            setErrors((prev) => ({ ...prev, notes: undefined }));
          }}
          placeholder="Describe the violation in detail. Include specific observations, measurements, or relevant codes..."
          rows={5}
          className={`w-full px-4 py-3 text-base border rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors resize-none ${
            errors.notes
              ? "border-red-400 bg-red-50"
              : "border-gray-300 bg-white"
          }`}
        />
        <div className="flex justify-between items-center mt-1">
          {errors.notes ? (
            <p className="text-sm text-red-600 flex items-center gap-1">
              <span>⚠</span> {errors.notes}
            </p>
          ) : (
            <span />
          )}
          <span className="text-xs text-gray-400">
            {(formData.notes || "").length} chars
          </span>
        </div>
      </div>

      {/* Photo Upload */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Photos <span className="text-gray-400 font-normal">(optional)</span>
        </label>

        {photoUrls.length > 0 && (
          <div className="grid grid-cols-3 gap-2 mb-3">
            {photoUrls.map((url, index) => (
              <div
                key={url}
                className="relative aspect-square rounded-lg overflow-hidden bg-gray-100"
              >
                <img
                  src={url}
                  alt={`Violation photo ${index + 1}`}
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => removePhoto(index)}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold shadow-md hover:bg-red-600 transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          onChange={handlePhotoUpload}
          className="hidden"
          id="photo-upload"
        />
        <label
          htmlFor="photo-upload"
          className={`flex flex-col items-center justify-center w-full py-6 px-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
            uploadingPhotos
              ? "border-blue-300 bg-blue-50"
              : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50"
          }`}
        >
          {uploadingPhotos ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-blue-600 font-medium">
                Uploading...
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-blue-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <div className="text-center">
                <span className="text-sm font-medium text-blue-600">
                  Tap to add photos
                </span>
                <p className="text-xs text-gray-500 mt-0.5">
                  Camera or gallery • Max 10MB each
                </p>
              </div>
            </div>
          )}
        </label>
      </div>

      {/* Submit Error */}
      {submitError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-700 flex items-start gap-2">
            <span className="text-red-500 mt-0.5">⚠</span>
            {submitError}
          </p>
        </div>
      )}

      {/* Submit Button - Fixed on mobile */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-lg sm:relative sm:p-0 sm:bg-transparent sm:border-0 sm:shadow-none">
        <button
          type="submit"
          disabled={isSubmitting || uploadingPhotos}
          className="w-full py-4 px-6 bg-blue-600 text-white font-semibold text-base rounded-xl shadow-md hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Submitting...
            </span>
          ) : (
            "Submit Violation Report"
          )}
        </button>
      </div>
    </form>
  );
}
