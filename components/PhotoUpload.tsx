"use client";

import { useState, useRef } from "react";

interface PhotoUploadProps {
  violationId: number;
  onUploadComplete?: (urls: string[]) => void;
}

export default function PhotoUpload({
  violationId,
  onUploadComplete,
}: PhotoUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: FileList) => {
    setUploading(true);
    setError(null);
    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("violationId", violationId.toString());

      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Upload failed");
        }

        const data = await response.json();
        newUrls.push(data.url);
      } catch (err) {
        setError("Failed to upload one or more files");
        console.error(err);
      }
    }

    const allUrls = [...uploadedUrls, ...newUrls];
    setUploadedUrls(allUrls);
    setUploading(false);

    if (onUploadComplete) {
      onUploadComplete(allUrls);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files) {
            handleUpload(e.dataTransfer.files);
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) {
              handleUpload(e.target.files);
            }
          }}
        />
        {uploading ? (
          <p className="text-gray-500">Uploading...</p>
        ) : (
          <p className="text-gray-500">Click or drag photos here to upload</p>
        )}
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {uploadedUrls.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {uploadedUrls.map((url, index) => (
            <img
              key={index}
              src={url}
              alt={`Uploaded photo ${index + 1}`}
              className="w-full h-24 object-cover rounded"
            />
          ))}
        </div>
      )}
    </div>
  );
}
