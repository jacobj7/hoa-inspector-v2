"use client";

import React from "react";

interface ViolationNoticePDFProps {
  violation: {
    id: number;
    property_address?: string;
    description: string;
    status: string;
    created_at: string;
    category_name?: string;
    fine_amount?: number;
    due_date?: string;
    owner_name?: string;
    owner_email?: string;
  };
}

export default function ViolationNoticePDF({
  violation,
}: ViolationNoticePDFProps) {
  return (
    <div className="p-8 max-w-2xl mx-auto bg-white">
      <h1 className="text-2xl font-bold mb-4">Violation Notice</h1>
      <div className="mb-4">
        <p>
          <strong>Violation ID:</strong> {violation.id}
        </p>
        <p>
          <strong>Date:</strong>{" "}
          {new Date(violation.created_at).toLocaleDateString()}
        </p>
        {violation.property_address && (
          <p>
            <strong>Property:</strong> {violation.property_address}
          </p>
        )}
        {violation.category_name && (
          <p>
            <strong>Category:</strong> {violation.category_name}
          </p>
        )}
        <p>
          <strong>Status:</strong> {violation.status}
        </p>
        {violation.fine_amount && (
          <p>
            <strong>Fine Amount:</strong> ${violation.fine_amount}
          </p>
        )}
        {violation.due_date && (
          <p>
            <strong>Due Date:</strong>{" "}
            {new Date(violation.due_date).toLocaleDateString()}
          </p>
        )}
      </div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">Description</h2>
        <p>{violation.description}</p>
      </div>
      {violation.owner_name && (
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-2">Owner Information</h2>
          <p>
            <strong>Name:</strong> {violation.owner_name}
          </p>
          {violation.owner_email && (
            <p>
              <strong>Email:</strong> {violation.owner_email}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
