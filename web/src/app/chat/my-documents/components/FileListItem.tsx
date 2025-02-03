import React from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle, File as FileIcon, MoreVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FileResponse } from "../DocumentsContext";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MinimalOnyxDocument } from "@/lib/search/interfaces";
import { FiDownload, FiEdit, FiSearch, FiTrash } from "react-icons/fi";
interface FileListItemProps {
  file: FileResponse;
  isSelected?: boolean;
  onSelect?: () => void;
  view: "grid" | "list";
  onSummarize: (documentId: string) => Promise<string>;
  onRename: (
    itemId: number,
    currentName: string,
    isFolder: boolean
  ) => Promise<void>;
  onDelete: (itemId: number, isFolder: boolean) => Promise<void>;
  onDownload: (documentId: string) => Promise<void>;
  isIndexed: boolean;
}

export const FileListItem: React.FC<FileListItemProps> = ({
  file,
  isSelected,
  onSelect,
  view,
  onSummarize,
  onRename,
  onDelete,
  onDownload,
  isIndexed,
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
          className={`w-full flex justify-between items-center text-sm truncate ${
            view === "grid" ? "text-center" : ""
          }`}
        >
          <p>{file.name}</p>
          <TooltipProvider>
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <div
                  className={`h-2 w-2 rounded-full ${
                    isIndexed ? "bg-transparent" : "bg-red-600 animate-pulse"
                  }`}
                />
              </TooltipTrigger>
              <TooltipContent>
                {!isIndexed ? (
                  <p>Not yet indexed. This will be completed momentarily.</p>
                ) : (
                  <p>Indexed</p>
                )}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
        <PopoverContent className="!p-0 w-40">
          <div className=" space-y-0">
            <Button
              variant="menu"
              onClick={() => onSummarize(file.document_id)}
            >
              <FiSearch className="h-4 w-4" />
              Summarize
            </Button>
            <Button
              variant="menu"
              onClick={() => onRename(file.id, file.name, false)}
            >
              <FiEdit className="h-4 w-4" />
              Rename
            </Button>
            <Button variant="menu" onClick={() => onDelete(file.id, false)}>
              <FiTrash className="h-4 w-4" />
              Delete
            </Button>
            <Button variant="menu" onClick={() => onDownload(file.document_id)}>
              <FiDownload className="h-4 w-4" />
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
