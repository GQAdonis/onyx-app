import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Edit,
  Upload,
  Info,
  ChevronRight,
  ChevronDown,
  Plus,
  AlignLeft,
  User,
  Users,
  MessageSquare,
  Database,
} from "lucide-react";
import { useDocumentsContext, FolderResponse } from "../DocumentsContext";
import { Button } from "@/components/ui/button";
import { DocumentList } from "./components/DocumentList";
import { UploadWarning } from "./components/UploadWarning";

export default function UserFolderContent({ folderId }: { folderId: number }) {
  const router = useRouter();
  const {
    getFolderDetails,
    updateFolderDetails,
    summarizeDocument,
    addToCollection,
    downloadItem,
    renameItem,
    deleteItem,
    uploadFile,
  } = useDocumentsContext();

  const [folderDetails, setFolderDetails] = useState<FolderResponse | null>(
    null
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const [isInstructionsOpen, setIsInstructionsOpen] = useState(true);
  const [isSourcesOpen, setIsSourcesOpen] = useState(true);
  const [isFilesOpen, setIsFilesOpen] = useState(true);
  const [isLinksOpen, setIsLinksOpen] = useState(true);
  const [isSharedOpen, setIsSharedOpen] = useState(true);
  const [isCapacityOpen, setIsCapacityOpen] = useState(true);

  const refreshFolderDetails = useCallback(async () => {
    try {
      const details = await getFolderDetails(folderId);
      setFolderDetails(details);
    } catch (error) {
      console.error("Error fetching folder details:", error);
      setError("Failed to fetch folder details. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [getFolderDetails, folderId]);

  useEffect(() => {
    refreshFolderDetails();
  }, [refreshFolderDetails]);

  const handleBack = () => {
    router.push("/chat/my-documents");
  };

  const handleStartChat = () => {
    if (folderDetails) {
      router.push(`/chat?folder=${folderId}`);
    }
  };

  const handleEditFolder = async (name: string, description: string) => {
    if (folderDetails) {
      try {
        await updateFolderDetails(folderId, name, description);
        setFolderDetails((prev) =>
          prev ? { ...prev, name, description } : null
        );
      } catch (error) {
        console.error("Error updating folder details:", error);
        setError("Failed to update folder details. Please try again.");
      } finally {
        setIsEditing(false);
      }
    }
  };

  const handleUpload = async (files: File[]) => {
    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append("files", file);
      });
      setIsLoading(true);

      await uploadFile(formData, folderId);
      await refreshFolderDetails();
    } catch (error) {
      console.error("Error uploading documents:", error);
      setError("Failed to upload documents. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (!folderDetails) {
    return <div>No folder details found.</div>;
  }
  if (isLoading) {
    return <div>Loading...</div>;
  }

  const totalTokens = folderDetails.files.length * 1000; // Mock data: assume 1000 tokens per file
  const maxTokens = 10000; // Mock data: max tokens for the model
  const tokenPercentage = (totalTokens / maxTokens) * 100;

  return (
    <div className="min-h-full w-full min-w-0 flex-1 mx-auto mt-[115px] max-w-5xl px-4 pb-20 md:pl-8 lg:mt-6 md:pr-8 2xl:pr-14">
      <div className="flex justify-between items-start mb-6">
        <div className="flex-1 mr-4">
          <div
            className="flex text-sm mb-4 items-center cursor-pointer"
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to My Documents
          </div>

          <h1 className="text-2xl text-text font-bold mb-2">
            {folderDetails.name}
          </h1>
          <p className="text-gray-600 mb-4">{folderDetails.description}</p>

          {folderDetails.sharedAssistants &&
            folderDetails.sharedAssistants.length > 0 && (
              <UploadWarning className="mb-4" />
            )}

          <DocumentList
            isLoading={isLoading}
            files={folderDetails.files}
            onSummarize={summarizeDocument}
            onAddToCollection={addToCollection}
            onRename={renameItem}
            onDelete={deleteItem}
            onDownload={downloadItem}
            onUpload={handleUpload}
          />
        </div>

        <div className="w-[313.33px] mt-20 relative rounded-md border border-[#d9d9d0]/50 overflow-hidden bg-white/10">
          <div className="p-4 border-b border-[#d9d9d0]">
            <div
              className="flex items-center justify-between"
              onClick={() => setIsCapacityOpen(!isCapacityOpen)}
            >
              <div className="flex items-center">
                <Database className="w-5 h-4 mr-3 text-[#13343a]" />
                <span className="text-[#13343a] text-sm font-medium leading-tight">
                  Knowledge Capacity
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-6 h-6 p-0 rounded-full"
              >
                {isCapacityOpen ? (
                  <ChevronDown className="w-[15px] h-3 text-[#13343a]" />
                ) : (
                  <ChevronRight className="w-[15px] h-3 text-[#13343a]" />
                )}
              </Button>
            </div>
            {isCapacityOpen && (
              <div className="mt-2 text-[#64645e] text-sm font-normal leading-tight">
                <div className="mb-1">
                  Tokens: {totalTokens} / {maxTokens}
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className="bg-blue-600 h-2.5 rounded-full"
                    style={{ width: `${tokenPercentage}%` }}
                  ></div>
                </div>
                {tokenPercentage > 100 && (
                  <div className="mt-1 text-xs text-red-500">
                    Capacity exceeded. Search will be performed over content.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-4 border-b border-[#d9d9d0]">
            <div
              className="flex items-center justify-between"
              onClick={() => setIsSourcesOpen(!isSourcesOpen)}
            >
              <div className="flex items-center">
                <Info className="w-5 h-4 mr-3 text-[#13343a]" />
                <span className="text-[#13343a] text-sm font-medium leading-tight">
                  Sources
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-6 h-6 p-0 rounded-full"
              >
                {isSourcesOpen ? (
                  <ChevronDown className="w-[15px] h-3 text-[#13343a]" />
                ) : (
                  <ChevronRight className="w-[15px] h-3 text-[#13343a]" />
                )}
              </Button>
            </div>
          </div>

          <div className="p-4 border-b border-[#d9d9d0]">
            <div
              className="flex items-center justify-between"
              onClick={() => setIsSharedOpen(!isSharedOpen)}
            >
              <div className="flex items-center">
                <User className="w-5 h-4 mr-3 text-[#13343a]" />
                {/* <Users className="w-5 h-4 mr-3 text-[#13343a]" /> */}
                <span className="text-[#13343a] text-sm font-medium leading-tight">
                  {/* Shared with 2 Assistants */}
                  Not shared
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-6 h-6 p-0 rounded-full"
              >
                {isSharedOpen ? (
                  <ChevronDown className="w-[15px] h-3 text-[#13343a]" />
                ) : (
                  <ChevronRight className="w-[15px] h-3 text-[#13343a]" />
                )}
              </Button>
            </div>
            {isSharedOpen &&
              folderDetails.sharedAssistants &&
              folderDetails.sharedAssistants.length > 0 && (
                <div className="mt-2 text-[#64645e] text-sm font-normal leading-tight">
                  Shared with: {folderDetails.sharedAssistants.join(", ")}
                </div>
              )}
          </div>

          <div className="p-4">
            <Button
              variant="default"
              className="w-full"
              onClick={handleStartChat}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              Chat with This Folder
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
