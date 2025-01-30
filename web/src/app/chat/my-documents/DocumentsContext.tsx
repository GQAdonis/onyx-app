"use client";
import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
} from "react";
import { MinimalOnyxDocument } from "@/lib/search/interfaces";

export interface FolderResponse {
  id: number;
  name: string;
  description: string;
  files: FileResponse[];
  sharedAssistants?: string[];
}

export type FileResponse = {
  id: number;
  name: string;
  document_id: string;
  folder_id: number | null;
  size: number;
  type: string;
  lastModified: string;
  tokens: number;
};

interface DocumentsContextType {
  folders: FolderResponse[];
  currentFolder: number | null;
  presentingDocument: MinimalOnyxDocument | null;
  searchQuery: string;
  page: number;
  refreshFolders: () => Promise<void>;
  createFolder: (name: string, description: string) => Promise<void>;
  deleteItem: (itemId: number, isFolder: boolean) => Promise<void>;
  moveItem: (
    itemId: number,
    currentFolderId: number | null,
    isFolder: boolean
  ) => Promise<void>;
  downloadItem: (documentId: string) => Promise<void>;
  renameItem: (
    itemId: number,
    currentName: string,
    isFolder: boolean
  ) => Promise<void>;
  setCurrentFolder: (folderId: number | null) => void;
  setPresentingDocument: (document: MinimalOnyxDocument | null) => void;
  setSearchQuery: (query: string) => void;
  setPage: (page: number) => void;
  getFolderDetails: (folderId: number) => Promise<FolderResponse>;
  updateFolderDetails: (
    folderId: number,
    name: string,
    description: string
  ) => Promise<void>;
  summarizeDocument: (documentId: string) => Promise<string>;
  addToCollection: (documentId: string, collectionId: string) => Promise<void>;
  isLoading: boolean;
  uploadFile: (formData: FormData, folderId: number) => Promise<void>;
  selectedFiles: FileResponse[];
  selectedFolders: FolderResponse[];
  addSelectedFile: (file: FileResponse) => void;
  removeSelectedFile: (file: FileResponse) => void;
  addSelectedFolder: (folder: FolderResponse) => void;
  removeSelectedFolder: (folder: FolderResponse) => void;
  clearSelectedItems: () => void;
}

const DocumentsContext = createContext<DocumentsContextType | undefined>(
  undefined
);

export const DocumentsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [folders, setFolders] = useState<FolderResponse[]>([]);
  const [currentFolder, setCurrentFolder] = useState<number | null>(null);
  const [presentingDocument, setPresentingDocument] =
    useState<MinimalOnyxDocument | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedFiles, setSelectedFiles] = useState<FileResponse[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<FolderResponse[]>([]);

  useEffect(() => {
    const fetchFolders = async () => {
      await refreshFolders();
      setIsLoading(false);
    };
    fetchFolders();
  }, []);

  const refreshFolders = useCallback(async () => {
    const response = await fetch("/api/user/folder");
    if (!response.ok) {
      throw new Error("Failed to fetch folders");
    }
    const data = await response.json();
    setFolders(data);
  }, []);

  const uploadFile = useCallback(
    async (formData: FormData, folderId: number) => {
      formData.append("folder_id", folderId.toString());
      const response = await fetch("/api/user/file/upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error("Failed to upload file");
      }
      // const data: FileUploadResponse = await response.json();
      await refreshFolders();
    },
    [refreshFolders]
  );

  const createFolder = useCallback(
    async (name: string, description: string) => {
      const response = await fetch("/api/user/folder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      if (!response.ok) {
        throw new Error("Failed to create folder");
      }
      await refreshFolders();
    },
    [refreshFolders]
  );

  const deleteItem = useCallback(
    async (itemId: number, isFolder: boolean) => {
      const itemType = isFolder ? "folder" : "file";
      const confirmDelete = window.confirm(
        `Are you sure you want to delete this ${itemType}?`
      );

      if (confirmDelete) {
        const endpoint = isFolder
          ? `/api/user/folder/${itemId}`
          : `/api/user/file/${itemId}`;
        const response = await fetch(endpoint, { method: "DELETE" });
        if (!response.ok) {
          throw new Error(`Failed to delete ${itemType}`);
        }
        if (isFolder) {
          await refreshFolders();
        }
      }
    },
    [refreshFolders]
  );

  const moveItem = useCallback(
    async (
      itemId: number,
      currentFolderId: number | null,
      isFolder: boolean
    ) => {
      const availableFolders = folders
        .filter((folder) => folder.id !== itemId)
        .map((folder) => `${folder.id}: ${folder.name}`)
        .join("\n");

      const promptMessage = `Enter the ID of the destination folder:\n\nAvailable folders:\n${availableFolders}\n\nEnter 0 to move to the root folder.`;
      const destinationFolderId = prompt(promptMessage);

      if (destinationFolderId !== null) {
        const newFolderId = parseInt(destinationFolderId, 10);
        if (isNaN(newFolderId)) {
          throw new Error("Invalid folder ID");
        }

        const endpoint = isFolder
          ? `/api/user/folder/${itemId}/move`
          : `/api/user/file/${itemId}/move`;
        const response = await fetch(endpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            new_folder_id: newFolderId === 0 ? null : newFolderId,
          }),
        });
        if (!response.ok) {
          throw new Error("Failed to move item");
        }
        await refreshFolders();
      }
    },
    [folders, refreshFolders]
  );

  const downloadItem = useCallback(async (documentId: string) => {
    const response = await fetch(
      `/api/chat/file/${encodeURIComponent(documentId)}`,
      {
        method: "GET",
      }
    );
    if (!response.ok) {
      throw new Error("Failed to fetch file");
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const contentDisposition = response.headers.get("Content-Disposition");
    const fileName = contentDisposition
      ? contentDisposition.split("filename=")[1]
      : "document";

    const link = document.createElement("a");
    link.href = url;
    link.download = fileName || "document";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    window.URL.revokeObjectURL(url);
  }, []);

  const renameItem = useCallback(
    async (itemId: number, currentName: string, isFolder: boolean) => {
      const newName = prompt(
        `Enter new name for ${isFolder ? "folder" : "file"}:`,
        currentName
      );
      if (newName && newName !== currentName) {
        const response = await fetch(
          isFolder
            ? `/api/user/folder/${itemId}?name=${encodeURIComponent(newName)}`
            : `/api/user/file/${itemId}/rename?name=${encodeURIComponent(
                newName
              )}`,
          { method: "PUT" }
        );
        if (!response.ok) {
          throw new Error(`Failed to rename ${isFolder ? "folder" : "file"}`);
        }
        if (isFolder) {
          await refreshFolders();
        }
      }
    },
    [refreshFolders]
  );

  const getFolderDetails = useCallback(async (folderId: number) => {
    const response = await fetch(`/api/user/folder/${folderId}`);
    if (!response.ok) {
      throw new Error("Failed to fetch folder details");
    }
    return await response.json();
  }, []);

  const updateFolderDetails = useCallback(
    async (folderId: number, name: string, description: string) => {
      const response = await fetch(`/api/user/folder/${folderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      if (!response.ok) {
        throw new Error("Failed to update folder details");
      }
      await refreshFolders();
    },
    [refreshFolders]
  );

  const summarizeDocument = useCallback(async (documentId: string) => {
    // Implement document summarization logic here
    return "Document summary placeholder";
  }, []);

  const addToCollection = useCallback(
    async (documentId: string, collectionId: string) => {
      // Implement add to collection logic here
    },
    []
  );

  const addSelectedFile = useCallback((file: FileResponse) => {
    setSelectedFiles((prev) => [...prev, file]);
  }, []);

  const removeSelectedFile = useCallback((file: FileResponse) => {
    setSelectedFiles((prev) => prev.filter((f) => f.id !== file.id));
  }, []);

  const addSelectedFolder = useCallback((folder: FolderResponse) => {
    setSelectedFolders((prev) => [...prev, folder]);
  }, []);

  const removeSelectedFolder = useCallback((folder: FolderResponse) => {
    setSelectedFolders((prev) => prev.filter((f) => f.id !== folder.id));
  }, []);

  const clearSelectedItems = useCallback(() => {
    setSelectedFiles([]);
    setSelectedFolders([]);
  }, []);

  const value = {
    folders,
    currentFolder,
    presentingDocument,
    searchQuery,
    page,
    refreshFolders,
    createFolder,
    deleteItem,
    moveItem,
    downloadItem,
    renameItem,
    setCurrentFolder,
    setPresentingDocument,
    setSearchQuery,
    setPage,
    getFolderDetails,
    updateFolderDetails,
    summarizeDocument,
    addToCollection,
    isLoading,
    uploadFile,
    selectedFiles,
    selectedFolders,
    addSelectedFile,
    removeSelectedFile,
    addSelectedFolder,
    removeSelectedFolder,
    clearSelectedItems,
  };

  return (
    <DocumentsContext.Provider value={value}>
      {children}
    </DocumentsContext.Provider>
  );
};

export const useDocumentsContext = () => {
  const context = useContext(DocumentsContext);
  if (context === undefined) {
    throw new Error("useDocuments must be used within a DocumentsProvider");
  }
  return context;
};
