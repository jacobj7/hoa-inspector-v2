"use client";

import { useState, useEffect } from "react";
import { z } from "zod";

const ViolationCategorySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be 100 characters or less"),
  description: z
    .string()
    .max(500, "Description must be 500 characters or less")
    .optional(),
  base_fine_amount: z
    .number({ invalid_type_error: "Base fine amount must be a number" })
    .min(0, "Base fine amount must be non-negative")
    .max(1000000, "Base fine amount is too large"),
  escalation_multiplier: z
    .number({ invalid_type_error: "Escalation multiplier must be a number" })
    .min(1, "Escalation multiplier must be at least 1")
    .max(100, "Escalation multiplier is too large"),
});

type ViolationCategoryFormData = z.infer<typeof ViolationCategorySchema>;

interface ViolationCategory {
  id: number;
  name: string;
  description?: string;
  base_fine_amount: number;
  escalation_multiplier: number;
  created_at: string;
  updated_at: string;
}

interface FormErrors {
  name?: string;
  description?: string;
  base_fine_amount?: string;
  escalation_multiplier?: string;
  general?: string;
}

const defaultFormData: ViolationCategoryFormData = {
  name: "",
  description: "",
  base_fine_amount: 0,
  escalation_multiplier: 1,
};

export default function ViolationCategoriesClient() {
  const [categories, setCategories] = useState<ViolationCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<ViolationCategory | null>(null);
  const [formData, setFormData] =
    useState<ViolationCategoryFormData>(defaultFormData);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/violation-categories");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to fetch categories");
      }
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setEditingCategory(null);
    setFormData(defaultFormData);
    setFormErrors({});
    setIsModalOpen(true);
  }

  function openEditModal(category: ViolationCategory) {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || "",
      base_fine_amount: category.base_fine_amount,
      escalation_multiplier: category.escalation_multiplier,
    });
    setFormErrors({});
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingCategory(null);
    setFormData(defaultFormData);
    setFormErrors({});
  }

  function handleInputChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "base_fine_amount" || name === "escalation_multiplier"
          ? parseFloat(value) || 0
          : value,
    }));
    if (formErrors[name as keyof FormErrors]) {
      setFormErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormErrors({});

    const parseResult = ViolationCategorySchema.safeParse(formData);
    if (!parseResult.success) {
      const errors: FormErrors = {};
      parseResult.error.errors.forEach((err) => {
        const field = err.path[0] as keyof FormErrors;
        if (field) errors[field] = err.message;
      });
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const url = editingCategory
        ? `/api/violation-categories/${editingCategory.id}`
        : "/api/violation-categories";
      const method = editingCategory ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parseResult.data),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save category");
      }

      await fetchCategories();
      closeModal();
    } catch (err: unknown) {
      setFormErrors({
        general:
          err instanceof Error ? err.message : "An unexpected error occurred",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/violation-categories/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete category");
      }
      await fetchCategories();
      setDeleteConfirmId(null);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setDeleting(false);
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Violation Categories
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage violation categories, base fines, and escalation
              multipliers
            </p>
          </div>
          <button
            onClick={openAddModal}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
          >
            <svg
              className="-ml-1 mr-2 h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                clipRule="evenodd"
              />
            </svg>
            Add Category
          </button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4 flex items-start">
            <svg
              className="h-5 w-5 text-red-400 mt-0.5 mr-3 flex-shrink-0"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm text-red-700">{error}</p>
            </div>
            <button
              onClick={() => setError(null)}
              className="ml-3 text-red-400 hover:text-red-600"
            >
              <svg
                className="h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
            <span className="ml-3 text-gray-500">Loading categories...</span>
          </div>
        )}

        {/* Empty State */}
        {!loading && categories.length === 0 && !error && (
          <div className="text-center py-16 bg-white rounded-lg border-2 border-dashed border-gray-300">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              No categories yet
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              Get started by creating your first violation category.
            </p>
            <button
              onClick={openAddModal}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Add Category
            </button>
          </div>
        )}

        {/* Categories Table */}
        {!loading && categories.length > 0 && (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Name
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Description
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Base Fine
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Escalation Multiplier
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Created
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {categories.map((category) => (
                  <tr
                    key={category.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {category.name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 max-w-xs truncate">
                        {category.description || (
                          <span className="italic text-gray-400">
                            No description
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {formatCurrency(category.base_fine_amount)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                        ×{category.escalation_multiplier}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(category.created_at).toLocaleDateString(
                        "en-US",
                        {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        },
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(category)}
                          className="text-indigo-600 hover:text-indigo-900 font-medium transition-colors"
                        >
                          Edit
                        </button>
                        <span className="text-gray-300">|</span>
                        {deleteConfirmId === category.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              Confirm?
                            </span>
                            <button
                              onClick={() => handleDelete(category.id)}
                              disabled={deleting}
                              className="text-red-600 hover:text-red-900 font-medium transition-colors disabled:opacity-50"
                            >
                              {deleting ? "Deleting..." : "Yes"}
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              disabled={deleting}
                              className="text-gray-500 hover:text-gray-700 font-medium transition-colors disabled:opacity-50"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(category.id)}
                            className="text-red-600 hover:text-red-900 font-medium transition-colors"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
              onClick={closeModal}
            />

            {/* Modal Panel */}
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full relative z-10">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-6 pt-6 pb-4">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {editingCategory ? "Edit Category" : "Add New Category"}
                    </h3>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <svg
                        className="h-6 w-6"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
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

                  {formErrors.general && (
                    <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
                      <p className="text-sm text-red-700">
                        {formErrors.general}
                      </p>
                    </div>
                  )}

                  <div className="space-y-5">
                    {/* Name */}
                    <div>
                      <label
                        htmlFor="name"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Category Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="e.g., Speeding, Parking Violation"
                        className={`w-full px-3 py-2 border rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                          formErrors.name
                            ? "border-red-300 bg-red-50"
                            : "border-gray-300"
                        }`}
                      />
                      {formErrors.name && (
                        <p className="mt-1 text-xs text-red-600">
                          {formErrors.name}
                        </p>
                      )}
                    </div>

                    {/* Description */}
                    <div>
                      <label
                        htmlFor="description"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Description
                      </label>
                      <textarea
                        id="description"
                        name="description"
                        value={formData.description || ""}
                        onChange={handleInputChange}
                        rows={3}
                        placeholder="Optional description of this violation category..."
                        className={`w-full px-3 py-2 border rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors resize-none ${
                          formErrors.description
                            ? "border-red-300 bg-red-50"
                            : "border-gray-300"
                        }`}
                      />
                      {formErrors.description && (
                        <p className="mt-1 text-xs text-red-600">
                          {formErrors.description}
                        </p>
                      )}
                    </div>

                    {/* Base Fine Amount */}
                    <div>
                      <label
                        htmlFor="base_fine_amount"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Base Fine Amount <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 text-sm">$</span>
                        </div>
                        <input
                          type="number"
                          id="base_fine_amount"
                          name="base_fine_amount"
                          value={formData.base_fine_amount}
                          onChange={handleInputChange}
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          className={`w-full pl-7 pr-3 py-2 border rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                            formErrors.base_fine_amount
                              ? "border-red-300 bg-red-50"
                              : "border-gray-300"
                          }`}
                        />
                      </div>
                      {formErrors.base_fine_amount && (
                        <p className="mt-1 text-xs text-red-600">
                          {formErrors.base_fine_amount}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-500">
                        The initial fine amount for a first offense
                      </p>
                    </div>

                    {/* Escalation Multiplier */}
                    <div>
                      <label
                        htmlFor="escalation_multiplier"
                        className="block text-sm font-medium text-gray-700 mb-1"
                      >
                        Escalation Multiplier{" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <span className="text-gray-500 text-sm">×</span>
                        </div>
                        <input
                          type="number"
                          id="escalation_multiplier"
                          name="escalation_multiplier"
                          value={formData.escalation_multiplier}
                          onChange={handleInputChange}
                          min="1"
                          step="0.1"
                          placeholder="1.0"
                          className={`w-full pl-7 pr-3 py-2 border rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors ${
                            formErrors.escalation_multiplier
                              ? "border-red-300 bg-red-50"
                              : "border-gray-300"
                          }`}
                        />
                      </div>
                      {formErrors.escalation_multiplier && (
                        <p className="mt-1 text-xs text-red-600">
                          {formErrors.escalation_multiplier}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-gray-500">
                        Fine multiplier for repeat offenses (e.g., 2 = double
                        the fine each time)
                      </p>
                      {formData.base_fine_amount > 0 &&
                        formData.escalation_multiplier > 1 && (
                          <div className="mt-2 p-2 bg-blue-50 rounded-md">
                            <p className="text-xs text-blue-700 font-medium">
                              Preview:
                            </p>
                            <p className="text-xs text-blue-600">
                              1st offense:{" "}
                              {formatCurrency(formData.base_fine_amount)} → 2nd:{" "}
                              {formatCurrency(
                                formData.base_fine_amount *
                                  formData.escalation_multiplier,
                              )}{" "}
                              → 3rd:{" "}
                              {formatCurrency(
                                formData.base_fine_amount *
                                  Math.pow(formData.escalation_multiplier, 2),
                              )}
                            </p>
                          </div>
                        )}
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="bg-gray-50 px-6 py-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    disabled={submitting}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50"
                  >
                    {submitting && (
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    )}
                    {submitting
                      ? "Saving..."
                      : editingCategory
                        ? "Save Changes"
                        : "Add Category"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
