import React from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Pencil, Trash, FolderInput } from "lucide-react";

interface ItemContextMenuProps {
  children: React.ReactNode;
  onRename: () => void;
  onDelete: () => void;
  onMove: () => void;
  isFolder: boolean;
}

export const ItemContextMenu: React.FC<ItemContextMenuProps> = ({
  children,
  onRename,
  onDelete,
  onMove,
  isFolder,
}) => {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        <ContextMenuItem onClick={onRename}>
          <Pencil className="mr-2 h-4 w-4" />
          <span>Rename {isFolder ? "Folder" : "File"}</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={onDelete}>
          <Trash className="mr-2 h-4 w-4" />
          <span>Delete {isFolder ? "Folder" : "File"}</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={onMove}>
          <FolderInput className="mr-2 h-4 w-4" />
          <span>Move {isFolder ? "Folder" : "File"}</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
