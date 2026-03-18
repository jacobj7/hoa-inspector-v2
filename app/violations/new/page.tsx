import { Metadata } from "next";
import ViolationForm from "./ViolationForm";

export const metadata: Metadata = {
  title: "Report New Violation",
  description: "Submit a new violation report",
};

export default function NewViolationPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Report a Violation</h1>
        <p className="mt-2 text-gray-600">
          Use this form to submit a new violation report. Please provide as much
          detail as possible.
        </p>
      </div>
      <ViolationForm />
    </div>
  );
}
