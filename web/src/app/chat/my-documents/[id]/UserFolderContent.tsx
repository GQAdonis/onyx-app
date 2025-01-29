import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Edit, Upload } from "lucide-react";
import { useDocumentsContext, FolderResponse } from "../DocumentsContext";
import { Button } from "@/components/ui/button";
import { FolderHeader } from "./components/FolderHeader";
import { KnowledgeCapacity } from "./components/KnowledgeCapacity";
import { DocumentList } from "./components/DocumentList";
import { UploadWarning } from "./components/UploadWarning";
import { uploadFile } from "@/app/admin/assistants/lib";

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
  const [isLoading, setIsLoading] = useState<boolean | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const refreshFolderDetails = useCallback(async () => {
    const details = await getFolderDetails(folderId);
    setFolderDetails(details);
    setIsLoading(false);
  }, [getFolderDetails, folderId]);

  useEffect(() => {
    refreshFolderDetails();
    // const fetchFolderDetails = async () => {
    //   setIsLoading(true);
    //   setError(null);
    //   try {
    //     const details = await getFolderDetails(folderId);
    //     setFolderDetails(details);
    //   } catch (error) {
    //     console.error("Error fetching folder details:", error);
    //     setError("Failed to fetch folder details. Please try again.");
    //   } finally {
    //     setIsLoading(false);
    //   }
    // };
    // fetchFolderDetails();
  }, [folderId, getFolderDetails]);

  const handleBack = () => {
    router.push("/chat/my-documents");
  };

  const handleStartChat = () => {
    if (folderDetails) {
      // Navigate to a chat page with the folder's documents
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
      }
    }
  };

  const handleUpload = async () => {
    try {
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.accept = ".pdf,.doc,.docx,.txt";

      input.onchange = async (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files) {
          const formData = new FormData();
          for (let i = 0; i < files.length; i++) {
            formData.append("files", files[i]);
          }
          setIsLoading(true);

          await uploadFile(formData, folderId);
          await refreshFolderDetails();
        }
      };

      input.click();
    } catch (error) {
      console.error("Error uploading documents:", error);
      setError("Failed to upload documents. Please try again.");
    }
  };

  if (isLoading === undefined) {
    return <div>Loading folder details...</div>;
  }

  if (error) {
    return <div className="text-red-500">{error}</div>;
  }

  if (!folderDetails) {
    return <div>No folder details found.</div>;
  }

  return (
    <div className="min-h-full w-full min-w-0 flex-1 mx-auto mt-4 w-full max-w-5xl flex-1 px-4 pb-20 md:pl-8 lg:mt-6 md:pr-8 2xl:pr-14">
      <Button onClick={handleBack} variant="ghost" className="px-2 mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to My Documents
      </Button>

      <FolderHeader
        name={folderDetails.name}
        description={folderDetails.description}
        sharedAssistants={folderDetails.sharedAssistants}
        onEdit={handleEditFolder}
      />

      <div className="flex justify-between items-center mt-6 mb-4">
        <Button onClick={handleStartChat}>Start a chat with the docs</Button>
        <Button onClick={handleUpload}>
          <Upload className="mr-2 h-4 w-4" /> Upload Document
        </Button>
      </div>

      <KnowledgeCapacity files={folderDetails.files} />

      <DocumentList
        isLoading={isLoading}
        files={folderDetails.files}
        onSummarize={summarizeDocument}
        onAddToCollection={addToCollection}
        onRename={renameItem}
        onDelete={deleteItem}
        onDownload={downloadItem}
      />

      {folderDetails.sharedAssistants &&
        folderDetails.sharedAssistants.length > 0 && <UploadWarning />}
    </div>
  );
}
