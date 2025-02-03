import React from "react";
import { Button } from "@/components/ui/button";
import { X, Folder, File } from "lucide-react";
import {
  FolderResponse,
  FileResponse,
  useDocumentsContext,
} from "../DocumentsContext";
import { useDocumentSelection } from "../../useDocumentSelection";

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
  // const {
  // selectedFiles,
  //   selectedFolders,
  //   setSelectedFiles,
  //   setSelectedFolders,
  // } = useDocumentsContext();
  return (
    <div className="h-full w-full flex flex-col">
      <h3 className="font-semibold fixed mb-2">Selected Items</h3>
      <div className="w-full overflow-y-auto mt-8 border-t border-t-text-subtle flex-grow">
        <div className="space-y-2 pt-2">
          {folders?.map((folder: FolderResponse) => (
            <div
              key={folder.id}
              className="flex items-center justify-between bg-blue-50 p-2 rounded-md border border-blue-200"
            >
              <div className="flex items-center">
                <Folder className="h-4 w-4 mr-2 text-blue-500" />
                <span className="text-sm font-medium">{folder.name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveFolder(folder)}
                className="hover:bg-blue-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {files?.map((file: FileResponse) => (
            <div
              key={file.id}
              className="flex items-center justify-between bg-gray-50 p-2 rounded-md border border-gray-200"
            >
              <div className="flex items-center">
                <File className="h-4 w-4 mr-2 text-gray-500" />
                <span className="text-sm truncate">{file.name}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemoveFile(file)}
                className="hover:bg-gray-100"
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
