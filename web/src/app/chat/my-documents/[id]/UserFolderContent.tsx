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
import { useAssistants } from "@/components/context/AssistantsContext";
import { AssistantIcon } from "@/components/assistants/AssistantIcon";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function UserFolderContent({ folderId }: { folderId: number }) {
  const router = useRouter();
  const { assistants } = useAssistants();
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

  const [showUploadWarning, setShowUploadWarning] = useState(false);

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
    if (
      folderDetails?.assistant_ids &&
      folderDetails.assistant_ids.length > 0
    ) {
      setShowUploadWarning(true);
    } else {
      await performUpload(files);
    }
  };

  const performUpload = async (files: File[]) => {
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
      setShowUploadWarning(false);
    }
  };

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (!folderDetails) {
    return (
      <div className="min-h-full w-full min-w-0 flex-1 mx-auto mt-[115px] max-w-5xl px-4 pb-20 md:pl-8 lg:mt-6 md:pr-8 2xl:pr-14">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
        </div>
      </div>
    );
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
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to My Knowledge Groups
          </div>

          <h1 className=" flex items-center gap-1.5 text-lg font-medium leading-tight tracking-tight max-md:hidden">
            {folderDetails.name}
          </h1>
          <p className="text-gray-600 mb-4">{folderDetails.description}</p>

          <Popover open={showUploadWarning} onOpenChange={setShowUploadWarning}>
            <PopoverContent className="w-80">
              <div className="space-y-2">
                <h4 className="font-medium">Warning</h4>
                <p className="text-sm">
                  This folder is shared with assistants. Uploading new files
                  will make them accessible to these assistants.
                </p>
                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowUploadWarning(false)}
                  >
                    Cancel
                  </Button>
                  <Button size="sm" onClick={() => performUpload([])}>
                    Continue Upload
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

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
                {folderDetails.assistant_ids &&
                folderDetails.assistant_ids.length > 0 ? (
                  <>
                    <Users className="w-5 h-4 mr-3 text-[#13343a]" />
                    <span className="text-[#13343a] text-sm font-medium leading-tight">
                      Shared with {folderDetails.assistant_ids.length} Assistant
                      {folderDetails.assistant_ids.length > 1 ? "s" : ""}
                    </span>
                  </>
                ) : (
                  <>
                    <User className="w-5 h-4 mr-3 text-[#13343a]" />
                    <span className="text-[#13343a] text-sm font-medium leading-tight">
                      Not shared
                    </span>
                  </>
                )}
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
              folderDetails.assistant_ids &&
              folderDetails.assistant_ids.length > 0 && (
                <div className="mt-2 text-[#64645e] text-sm font-normal leading-tight">
                  Shared with:{" "}
                  <div className="flex flex-wrap gap-2 mt-1">
                    {folderDetails.assistant_ids.map((id) => {
                      const assistant = assistants.find((a) => a.id === id);
                      return assistant ? (
                        <a
                          href={`/assistants/edit/${assistant.id}`}
                          key={assistant.id}
                          className="flex bg-neutral-200/80 hover:bg-neutral-200 cursor-pointer px-2 py-1 rounded-md items-center space-x-2"
                        >
                          <AssistantIcon assistant={assistant} size="xs" />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {assistant.name}
                          </span>
                        </a>
                      ) : null;
                    })}
                  </div>
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
