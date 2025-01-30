import React from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { FolderResponse, FileResponse } from "../DocumentsContext";

interface SelectedItemsListProps {
  folders: FolderResponse[];
  files: FileResponse[];
  onRemoveFile: (file: FileResponse) => void;
  onRemoveFolder: (folder: FolderResponse) => void;
}

export const SelectedItemsList: React.FC<SelectedItemsListProps> = ({
  folders,
  files,
  onRemoveFile,
  onRemoveFolder,
}) => {
  return (
    <div className="h-full w-full flex flex-col">
      <h3 className="font-semibold mb-2">Selected Items</h3>
      <div className="w-full overflow-y-auto border-t border-t-text-subtle flex-grow">
        <div className="space-y-2">
          {folders.map((folder) => (
            <div
              key={folder.id}
              className="flex items-center justify-between bg-gray-100 p-2 rounded"
            >
              <span className="text-sm">{folder.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveFolder(folder)}
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
                onClick={() => onRemoveFile(file)}
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
