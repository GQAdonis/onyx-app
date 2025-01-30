import React from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { UserFile, UserFolder } from "./types";
import { FolderResponse, FileResponse } from "../DocumentsContext";

interface SelectedItemsListProps {
  uploadedFiles: File[];
  allFolders: FolderResponse[];
  allFiles: FileResponse[];
  folders: FolderResponse[];
  files: FileResponse[];
  onRemove: (type: "file" | "folder", id: number) => void;
  onRemoveUploadedFile: (name: string) => void;
  links: string[];
}

export const SelectedItemsList: React.FC<SelectedItemsListProps> = ({
  links,
  uploadedFiles,
  allFolders,
  folders,
  allFiles,
  files,
  onRemove,
  onRemoveUploadedFile,
}) => {
  return (
    <div className="h-full w-full flex flex-col">
      <h3 className="font-semibold mb-2">Selected Items</h3>
      <div className="w-full overflow-y-auto border-t  border-t-text-subtle flex-grow">
        <div className="space-y-2">
          {links.map((link: string) => (
            <div
              key={link}
              className="flex  w-full items-center justify-between bg-gray-100 p-1.5 rounded"
            >
              <span className="text-sm">{link}</span>
              <Button variant="ghost" size="sm">
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {uploadedFiles.map((file) => (
            <div
              key={file.name}
              className="flex  w-full items-center justify-between bg-gray-100 p-1.5 rounded"
            >
              <span className="text-sm">
                {file.name}{" "}
                <span className="text-xs w-full truncate text-gray-500">
                  (uploaded)
                </span>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveUploadedFile(file.name)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {folders.map((folder) => (
            <div
              key={folder.id}
              className="flex items-center justify-between bg-gray-100 p-2 rounded"
            >
              <span className="text-sm">{folder.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove("folder", folder.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center justify-between bg-gray-100 p-2 rounded"
            >
              <span className="w-full truncate text-sm">{file.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove("file", file.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
