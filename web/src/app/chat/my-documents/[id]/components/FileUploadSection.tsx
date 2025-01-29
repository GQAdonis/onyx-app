import React from "react";
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
    <div className="mt-6 border border-neutral-100 bg-transparent rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Add files to this project to help your Assistants answer questions
        </p>

        <label htmlFor="file-upload" className="cursor-pointer">
          <input
            id="file-upload"
            type="file"
            multiple
            className="hidden"
            onChange={handleChange}
          />
        </label>
      </div>
    </div>
  );
};
