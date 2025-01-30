import React from "react";
import { Upload } from "lucide-react";

interface FileUploadSectionProps {
  onUpload: (files: File[]) => void;
}

export const FileUploadSection: React.FC<FileUploadSectionProps> = ({
  onUpload,
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      onUpload(newFiles);
    }
  };

  return (
    <div className="mt-6 border border-neutral-100 bg-transparent rounded-lg p-4 shadow-sm hover:bg-neutral-50 transition-colors duration-200 cursor-pointer">
      <label htmlFor="file-upload" className="w-full h-full block">
        <div className="flex flex-col gap-y-2  items-center justify-between">
          <p className="text-sm text-gray-500">Add files to this project </p>
          <Upload className="w-5 h-5 text-gray-400" />
        </div>
        <input
          id="file-upload"
          type="file"
          multiple
          className="hidden"
          onChange={handleChange}
        />
      </label>
    </div>
  );
};
