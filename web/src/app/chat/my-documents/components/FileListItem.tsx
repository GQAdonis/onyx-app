import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { File as FileIcon, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FileResponse } from "../DocumentsContext";

interface FileListItemProps {
  file: FileResponse;
  isSelected?: boolean;
  onSelect?: () => void;
  view: "grid" | "list";
  onSummarize: (documentId: string) => Promise<string>;
  onAddToCollection: (
    documentId: string,
    collectionId: string
  ) => Promise<void>;
  onRename: (
    itemId: number,
    currentName: string,
    isFolder: boolean
  ) => Promise<void>;
  onDelete: (itemId: number, isFolder: boolean) => Promise<void>;
  onDownload: (documentId: string) => Promise<void>;
}

export const FileListItem: React.FC<FileListItemProps> = ({
  file,
  isSelected,
  onSelect,
  view,
  onSummarize,
  onAddToCollection,
  onRename,
  onDelete,
  onDownload,
}) => {
  return (
    <div
      className={`p-2 group ${
        view === "grid"
          ? "flex flex-col items-center"
          : "flex items-center justify-between hover:bg-neutral-100 rounded cursor-pointer"
      }`}
    >
      <div
        className={`flex items-center ${
          view === "grid" ? "flex-col" : "w-full"
        }`}
        onClick={onSelect}
      >
        {isSelected !== undefined && (
          <Checkbox
            checked={isSelected}
            className={view === "grid" ? "mb-2" : "mr-2"}
          />
        )}
        <FileIcon
          className={`${
            view === "grid" ? "h-12 w-12 mb-2" : "h-5 w-5 mr-2"
          } text-neutral-500`}
        />
        <span
          className={`max-w-full text-sm truncate ${
            view === "grid" ? "text-center" : ""
          }`}
        >
          {file.name}
        </span>
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            className="group-hover:visible invisible h-8 w-8 p-0"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56">
          <div className="space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => onSummarize(file.document_id)}
            >
              Summarize
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() =>
                onAddToCollection(file.document_id, "mock-collection-id")
              }
            >
              Add to collection
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => onRename(file.id, file.name, false)}
            >
              Rename
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => onDelete(file.id, false)}
            >
              Delete
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => onDownload(file.document_id)}
            >
              Download
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export const SkeletonFileListItem: React.FC<{
  view: "grid" | "list";
}> = ({ view }) => {
  return (
    <div
      className={`p-2 ${
        view === "grid"
          ? "flex flex-col items-center"
          : "flex items-center justify-between hover:bg-neutral-100 rounded"
      }`}
    >
      <div
        className={`flex items-center ${
          view === "grid" ? "flex-col" : "w-full"
        }`}
      >
        <div
          className={`${
            view === "grid" ? "h-12 w-12 mb-2" : "h-5 w-5 mr-2"
          } bg-neutral-200 rounded animate-pulse`}
        />
        <div
          className={`h-6 bg-neutral-200 rounded animate-pulse ${
            view === "grid" ? "w-20 mt-2" : "w-72"
          }`}
        />
      </div>
      <div className="h-6 w-6 mr-1 bg-neutral-200 rounded-full animate-pulse" />
    </div>
  );
};
