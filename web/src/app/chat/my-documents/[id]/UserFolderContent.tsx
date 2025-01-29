import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Edit, Upload } from "lucide-react";
import { useDocumentsContext, FolderResponse } from "../DocumentsContext";
import { Button } from "@/components/ui/button";
import { FolderHeader } from "./components/FolderHeader";
import { KnowledgeCapacity } from "./components/KnowledgeCapacity";
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
  } = useDocumentsContext();

  const [folderDetails, setFolderDetails] = useState<FolderResponse | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFolderDetails = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const details = await getFolderDetails(folderId);
        setFolderDetails(details);
      } catch (error) {
        console.error("Error fetching folder details:", error);
        setError("Failed to fetch folder details. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchFolderDetails();
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

  const handleUpload = () => {
    // Implement document upload functionality
    console.log("Upload document");
  };

  if (isLoading) {
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
