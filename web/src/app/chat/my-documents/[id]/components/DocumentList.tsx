import React, { useState } from "react";
import { FileResponse } from "../../DocumentsContext";
import {
  FileListItem,
  SkeletonFileListItem,
} from "../../components/FileListItem";
import { Button } from "@/components/ui/button";
import { Grid, List, Loader2 } from "lucide-react";

interface DocumentListProps {
  files: FileResponse[];
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
  isLoading: boolean;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  files,
  onSummarize,
  onAddToCollection,
  onRename,
  onDelete,
  onDownload,
  isLoading,
}) => {
  const [view, setView] = useState<"grid" | "list">("list");

  const toggleView = () => {
    setView(view === "grid" ? "list" : "grid");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Documents</h2>
        <Button onClick={toggleView} variant="outline" size="sm">
          {view === "grid" ? <List size={16} /> : <Grid size={16} />}
        </Button>
      </div>
      <div className={view === "grid" ? "grid grid-cols-4 gap-4" : "space-y-2"}>
        {files.map((file) => (
          <FileListItem
            key={file.id}
            file={file}
            view={view}
            onSummarize={onSummarize}
            onAddToCollection={onAddToCollection}
            onRename={onRename}
            onDelete={onDelete}
            onDownload={onDownload}
          />
        ))}
        {isLoading && <SkeletonFileListItem view={view} />}
      </div>
    </div>
  );
};
