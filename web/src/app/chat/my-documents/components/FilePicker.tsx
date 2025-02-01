import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/Modal";
import {
  Grid,
  List,
  UploadIcon,
  FolderIcon,
  FileIcon,
  PlusIcon,
  Router,
} from "lucide-react";
import { SelectedItemsList } from "./SelectedItemsList";
import { Separator } from "@/components/ui/separator";
import {
  useDocumentsContext,
  FolderResponse,
  FileResponse,
} from "../DocumentsContext";
import {
  DndContext,
  closestCenter,
  DragOverlay,
  DragEndEvent,
  DragStartEvent,
  useSensor,
  useSensors,
  PointerSensor,
  DragMoveEvent,
  KeyboardSensor,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { useRouter } from "next/navigation";

const ListIcon = () => <List className="h-4 w-4" />;
const GridIcon = () => <Grid className="h-4 w-4" />;

const IconButton: React.FC<{
  icon: React.ComponentType;
  onClick: () => void;
  active: boolean;
}> = ({ icon: Icon, onClick, active }) => (
  <button
    className={`p-2 flex-none h-10 w-10 flex items-center justify-center rounded ${
      active ? "bg-gray-200" : "hover:bg-gray-100"
    }`}
    onClick={onClick}
  >
    <Icon />
  </button>
);

const DraggableItem: React.FC<{
  id: string;
  type: "folder" | "file";
  item: FolderResponse | FileResponse;
  onClick?: () => void;
  isSelected: boolean;
}> = ({ id, type, item, onClick, isSelected }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
    zIndex: isDragging ? 1 : "auto",
  };

  if (type === "folder") {
    return (
      <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
        <FilePickerFolderItem
          folder={item as FolderResponse}
          onClick={onClick || (() => {})}
          onSelect={() => {}}
          isSelected={isSelected}
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex items-center p-2 hover:bg-gray-100 cursor-pointer rounded-md ${
        isDragging ? "bg-gray-200" : ""
      }`}
      onClick={onClick}
    >
      <FileIcon className="mr-2 text-gray-500" />
      <span className="text-sm font-medium">{(item as FileResponse).name}</span>
    </div>
  );
};

const FilePickerFolderItem: React.FC<{
  folder: FolderResponse;
  onClick: () => void;
  onSelect: () => void;
  isSelected: boolean;
}> = ({ folder, onClick, onSelect, isSelected }) => {
  return (
    <div
      className="from-[#f2f0e8]/80 to-[#F7F6F0] border-0.5 border-border hover:from-[#f2f0e8] hover:to-[#F7F6F0] hover:border-border-200 text-md group relative flex cursor-pointer flex-col overflow-x-hidden text-ellipsis rounded-xl bg-gradient-to-b py-4 pl-5 pr-4 transition-all ease-in-out hover:shadow-sm active:scale-[0.99]"
      onClick={onClick}
    >
      <div className="flex flex-col flex-1">
        <div className="font-tiempos flex items-center justify-between">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-truncate text-text-dark inline-block max-w-md">
                  {folder.name}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{folder.name}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="ghost"
            size="sm"
            className={`ml-2 ${isSelected ? "text-blue-500" : "text-gray-500"}`}
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
          >
            <PlusIcon size={16} />
          </Button>
        </div>
        {folder.description && (
          <div className="text-text-400 mt-1 line-clamp-2 text-xs">
            {folder.description}
          </div>
        )}
      </div>
    </div>
  );
};

export interface FilePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  title: string;
  buttonContent: string;
  selectedFiles: FileResponse[];
  selectedFolders: FolderResponse[];
  addSelectedFile: (file: FileResponse) => void;
  removeSelectedFile: (file: FileResponse) => void;
  addSelectedFolder: (folder: FolderResponse) => void;
  removeSelectedFolder: (folder: FolderResponse) => void;
}

export const FilePickerModal: React.FC<FilePickerModalProps> = ({
  isOpen,
  onClose,
  onSave,
  title,
  buttonContent,
  selectedFiles,
  selectedFolders,
  addSelectedFile,
  removeSelectedFile,
  addSelectedFolder,
  removeSelectedFolder,
}) => {
  const {
    folders,
    refreshFolders,
    uploadFile,
    currentFolder,
    setCurrentFolder,
    renameItem,
    deleteItem,
    moveItem,
    summarizeDocument,
    addToCollection,
    downloadItem,
  } = useDocumentsContext();

  const router = useRouter();
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [links, setLinks] = useState<string[]>([]);

  const [view, setView] = useState<"grid" | "list">("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentFolderFiles, setCurrentFolderFiles] = useState<FileResponse[]>(
    []
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isHoveringRight, setIsHoveringRight] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (isOpen) {
      refreshFolders();
    }
  }, [isOpen, refreshFolders]);

  useEffect(() => {
    if (currentFolder) {
      const folder = folders.find((f) => f.id === currentFolder);
      setCurrentFolderFiles(folder?.files || []);
    } else {
      setCurrentFolderFiles([]);
    }
  }, [currentFolder, folders]);

  useEffect(() => {
    if (searchQuery) {
      setCurrentFolder(null);
    }
  }, [searchQuery]);

  const handleSave = () => {
    // onSave(selectedItems);
    onClose();
  };

  const handleFolderClick = (folderId: number) => {
    console.log(`Folder clicked: ${folderId}`);
    setCurrentFolder(folderId);
    const clickedFolder = folders.find((f) => f.id === folderId);
    if (clickedFolder) {
      console.log(`Found folder: ${clickedFolder.name}`);
      setCurrentFolderFiles(clickedFolder.files || []);
    } else {
      console.log(`Folder not found for id: ${folderId}`);
      setCurrentFolderFiles([]);
    }
  };

  const handleFileSelect = (file: FileResponse) => {
    if (selectedFiles.some((f) => f.id === file.id)) {
      removeSelectedFile(file);
    } else {
      addSelectedFile(file);
    }
  };

  const handleFolderSelect = (folder: FolderResponse) => {
    if (selectedFolders.some((f) => f.id === folder.id)) {
      removeSelectedFolder(folder);
    } else {
      addSelectedFolder(folder);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("File upload started");
    const files = e.target.files;
    if (files) {
      setUploadedFiles((prev) => [...prev, ...Array.from(files)]);
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);
        await uploadFile(formData, currentFolder || 0);
      }
      refreshFolders();
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    console.log("Drag started:", event);
    setActiveId(event.active.id.toString());
  };

  const handleDragMove = (event: DragMoveEvent) => {
    console.log("Drag move:", event);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    console.log("Drag ended:", { active, over, isHoveringRight });

    if (active.id !== over?.id && isHoveringRight) {
      const activeType = active.id.toString().startsWith("folder")
        ? "folders"
        : "files";
      const activeId = parseInt(active.id.toString().split("-")[1], 10);

      console.log(`Added ${activeType} with id ${activeId} to selected items`);
    } else {
      console.log("Item not added to selection");
    }

    setActiveId(null);
    setIsHoveringRight(false);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setIsHoveringRight(false);
  };

  const filteredFolders = folders.filter((folder) =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderNavigation = () => {
    if (currentFolder !== null) {
      return (
        <div
          className="flex items-center mb-4 text-sm text-gray-600 cursor-pointer hover:text-gray-800"
          onClick={() => setCurrentFolder(null)}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-1"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Folders
        </div>
      );
    }
    return null;
  };

  return (
    <Modal
      hideDividerForTitle
      onOutsideClick={onClose}
      className="max-w-4xl flex flex-col w-full !overflow-hidden h-[70vh]"
      title={title}
    >
      <div className="flex w-full items-center flex-col h-full">
        <div className="grid h-full grid-cols-2 overflow-y-hidden w-full divide-x divide-gray-200">
          <div className="w-full pb-4 overflow-y-auto">
            <div className="mb-4 flex gap-x-2 w-full pr-4">
              <div className="w-full relative">
                <input
                  type="text"
                  placeholder="Search folders..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:border-transparent"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-text-dark"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {filteredFolders.length + currentFolderFiles.length > 0 ? (
              <div className="flex-grow overflow-y-auto pr-4">
                {renderNavigation()}
                <DndContext
                  sensors={sensors}
                  onDragStart={handleDragStart}
                  onDragMove={handleDragMove}
                  onDragEnd={handleDragEnd}
                  onDragCancel={handleDragCancel}
                  collisionDetection={closestCenter}
                >
                  <SortableContext
                    items={[
                      ...filteredFolders.map((f) => `folder-${f.id}`),
                      ...currentFolderFiles.map((f) => `file-${f.id}`),
                    ]}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {currentFolder === null
                        ? filteredFolders.map((folder) => (
                            <FilePickerFolderItem
                              key={`folder-${folder.id}`}
                              folder={folder}
                              onClick={() => handleFolderClick(folder.id)}
                              onSelect={() => handleFolderSelect(folder)}
                              isSelected={selectedFolders.some(
                                (f) => f.id === folder.id
                              )}
                            />
                          ))
                        : currentFolderFiles.map((file) => (
                            <DraggableItem
                              key={`file-${file.id}`}
                              id={`file-${file.id}`}
                              type="file"
                              item={file}
                              onClick={() => handleFileSelect(file)}
                              isSelected={selectedFiles.some(
                                (f) => f.id === file.id
                              )}
                            />
                          ))}
                    </div>
                  </SortableContext>

                  <DragOverlay>
                    {activeId ? (
                      <DraggableItem
                        id={activeId}
                        type={activeId.startsWith("folder") ? "folder" : "file"}
                        item={
                          activeId.startsWith("folder")
                            ? folders.find(
                                (f) =>
                                  f.id === parseInt(activeId.split("-")[1], 10)
                              )!
                            : currentFolderFiles.find(
                                (f) =>
                                  f.id === parseInt(activeId.split("-")[1], 10)
                              )!
                        }
                        isSelected={
                          activeId.startsWith("folder")
                            ? selectedFolders.some(
                                (f) =>
                                  f.id === parseInt(activeId.split("-")[1], 10)
                              )
                            : selectedFiles.some(
                                (f) =>
                                  f.id === parseInt(activeId.split("-")[1], 10)
                              )
                        }
                      />
                    ) : null}
                  </DragOverlay>
                </DndContext>
              </div>
            ) : folders.length > 0 ? (
              <div className="flex-grow overflow-y-auto px-4">
                <p className="text-text-subtle">No files or folders found</p>
              </div>
            ) : (
              <div className="flex-grow flex-col overflow-y-auto px-4 flex items-start justify-start gap-y-2">
                <p className="text-sm text-muted-foreground">
                  No files or folders found
                </p>
                <a
                  href="/chat/my-documents"
                  className="inline-flex items-center text-sm justify-center"
                >
                  <FolderIcon className="mr-2 h-4 w-4" />
                  Create folder in My Documents
                </a>
              </div>
            )}
          </div>
          <div
            className={`w-full px-4 pb-4 flex flex-col h-[450px] ${
              isHoveringRight ? "bg-blue-50" : ""
            }`}
            onDragEnter={() => setIsHoveringRight(true)}
            onDragLeave={() => setIsHoveringRight(false)}
          >
            <div className="shrink flex h-full overflow-y-auto mb-1">
              <SelectedItemsList
                folders={selectedFolders}
                files={selectedFiles}
                onRemoveFile={removeSelectedFile}
                onRemoveFolder={removeSelectedFolder}
              />
            </div>

            <div className="flex flex-col">
              <div className="p-4 flex-none border rounded-lg bg-neutral-50">
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex items-center justify-center space-x-2"
                >
                  <UploadIcon className="w-5 h-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">
                    Upload files
                  </span>
                </label>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>

              <Separator className="my-2" />

              <div className="flex flex-col">
                <div className="flex flex-col gap-y-2">
                  <p className="text-sm text-text-subtle">
                    Add links to the context
                  </p>
                </div>
                <form
                  className="flex gap-x-4 mt-2"
                  onSubmit={(e) => e.preventDefault()}
                >
                  <div className="w-full gap-x-2 flex">
                    <input
                      type="url"
                      placeholder="Enter URL"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      onChange={(e) => {
                        // Handle URL input change
                        console.log(e.target.value);
                        // You might want to add state to store this value
                      }}
                    />
                    <Button
                      type="button"
                      onClick={(e) => {
                        const input = e.currentTarget.form?.querySelector(
                          'input[type="url"]'
                        ) as HTMLInputElement;
                        if (input && input.value) {
                          setLinks((prevLinks) => [...prevLinks, input.value]);
                          input.value = "";
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
        <div className="pt-4 flex-col w-full flex border-t mt-auto items-center justify-between">
          <div className="mb-4 font-medium text-lg text-text-dark">
            Total items: {selectedFiles.length + selectedFolders.length}
          </div>
          <div className="flex justify-center">
            <Button
              className="text-lg"
              size="lg"
              onClick={() => {
                onSave();
                onClose();
              }}
              variant="default"
            >
              {buttonContent}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
