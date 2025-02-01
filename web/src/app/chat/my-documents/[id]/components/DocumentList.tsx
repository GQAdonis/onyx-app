import React, { useState } from "react";
import { FileResponse } from "../../DocumentsContext";
import {
  FileListItem,
  SkeletonFileListItem,
} from "../../components/FileListItem";
import { Button } from "@/components/ui/button";
import { Grid, List, Loader2 } from "lucide-react";
import { FileUploadSection } from "./FileUploadSection";
import TextView from "@/components/chat_search/TextView";
import { MinimalOnyxDocument } from "@/lib/search/interfaces";

interface DocumentListProps {
  files: FileResponse[];
  onSummarize: (documentId: string) => Promise<string>;
  onRename: (
    itemId: number,
    currentName: string,
    isFolder: boolean
  ) => Promise<void>;
  onDelete: (itemId: number, isFolder: boolean) => Promise<void>;
  onDownload: (documentId: string) => Promise<void>;
  onUpload: (files: File[]) => void;
  isLoading: boolean;
}

export const DocumentList: React.FC<DocumentListProps> = ({
  files,
  onSummarize,
  onRename,
  onDelete,
  onDownload,
  onUpload,
  isLoading,
}) => {
  const [presentingDocument, setPresentingDocument] =
    useState<MinimalOnyxDocument | null>(null);
  const [view, setView] = useState<"grid" | "list">("list");

  const toggleView = () => {
    setView(view === "grid" ? "list" : "grid");
  };

  return (
    <div className="space-y-4">
      {presentingDocument && (
        <TextView
          presentingDocument={presentingDocument}
          onClose={() => setPresentingDocument(null)}
        />
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold">Documents in this Project</h2>
        <Button onClick={toggleView} variant="outline" size="sm">
          {view === "grid" ? <List size={16} /> : <Grid size={16} />}
        </Button>
      </div>
      <FileUploadSection onUpload={onUpload} />

      <div className={view === "grid" ? "grid grid-cols-4 gap-4" : "space-y-2"}>
        {files.map((file) => (
          <FileListItem
            key={file.id}
            file={file}
            view={view}
            onSummarize={onSummarize}
            onRename={onRename}
            onDelete={onDelete}
            onDownload={onDownload}
            onSelect={() =>
              setPresentingDocument({
                semantic_identifier: file.id.toString(),
                document_id: file.document_id,
              })
            }
          />
        ))}
        {isLoading && <SkeletonFileListItem view={view} />}
      </div>
    </div>
  );
};
