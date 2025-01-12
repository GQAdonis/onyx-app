"use client";

import { useRouter } from "next/navigation";
import { ChatSession } from "../interfaces";
import { useState, useEffect, useContext, useRef } from "react";
import {
  deleteChatSession,
  getChatRetentionInfo,
  renameChatSession,
} from "../lib";
import { BasicSelectable } from "@/components/BasicClickable";
import Link from "next/link";
import {
  FiCheck,
  FiEdit2,
  FiMoreHorizontal,
  FiShare2,
  FiTrash,
  FiX,
} from "react-icons/fi";
import { DefaultDropdownElement } from "@/components/Dropdown";
import { Popover } from "@/components/popover/Popover";
import { ShareChatSessionModal } from "../modal/ShareChatSessionModal";
import { CHAT_SESSION_ID_KEY, FOLDER_ID_KEY } from "@/lib/drag/constants";
import { SettingsContext } from "@/components/settings/SettingsProvider";
import { DragHandle } from "@/components/table/DragHandle";
import { WarningCircle } from "@phosphor-icons/react";
import { CustomTooltip } from "@/components/tooltip/CustomTooltip";
import SlideOverModal from "@/components/ui/SlideOverModal";
import { useChatContext } from "@/components/context/ChatContext";

export function ChatSessionDisplay({
  chatSession,
  search,
  isSelected,
  skipGradient,
  closeSidebar,
  showShareModal,
  showDeleteModal,
}: {
  chatSession: ChatSession;
  isSelected: boolean;
  search?: boolean;
  // needed when the parent is trying to apply some background effect
  // if not set, the gradient will still be applied and cause weirdness
  skipGradient?: boolean;
  closeSidebar?: () => void;
  showShareModal?: (chatSession: ChatSession) => void;
  showDeleteModal?: (chatSession: ChatSession) => void;
}) {
  const router = useRouter();
  const [isHovering, setIsHovering] = useState(false);
  const [isRenamingChat, setIsRenamingChat] = useState(false);
  const [isMoreOptionsDropdownOpen, setIsMoreOptionsDropdownOpen] =
    useState(false);
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [chatName, setChatName] = useState(chatSession.name);
  const settings = useContext(SettingsContext);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const chatSessionRef = useRef<HTMLDivElement>(null);

  const onRename = async () => {
    const response = await renameChatSession(chatSession.id, chatName);
    if (response.ok) {
      setIsRenamingChat(false);
      router.refresh();
    } else {
      alert("Failed to rename chat session");
    }
  };

  if (!settings) {
    return <></>;
  }

  const { daysUntilExpiration, showRetentionWarning } = getChatRetentionInfo(
    chatSession,
    settings?.settings
  );
  const { refreshChatSessions, reorderFolders } = useChatContext();

  return (
    <>
      {isShareModalVisible && (
        <ShareChatSessionModal
          chatSessionId={chatSession.id}
          existingSharedStatus={chatSession.shared_status}
          onClose={() => setIsShareModalVisible(false)}
        />
      )}

      <div ref={chatSessionRef}>
        <Link
          className="flex -ml-5 group items-center w-full relative"
          key={chatSession.id}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => {
            setIsMoreOptionsDropdownOpen(false);
            setIsHovering(false);
          }}
          onClick={() => {
            if (settings?.isMobile && closeSidebar) {
              closeSidebar();
            }
          }}
          href={
            search
              ? `/search?searchId=${chatSession.id}`
              : `/chat?chatId=${chatSession.id}`
          }
          scroll={false}
          draggable="true"
          onDragStart={(event) => {
            event.dataTransfer.setData(
              CHAT_SESSION_ID_KEY,
              chatSession.id.toString()
            );
            event.dataTransfer.setData(
              FOLDER_ID_KEY,
              chatSession.folder_id?.toString() || ""
            );
          }}
        >
          <DragHandle
            size={16}
            className="w-4 mr-1 invisible group-hover:visible flex-none"
          />
          <BasicSelectable
            fullWidth
            selected={isSelected}
            removeColors={isRenamingChat}
          >
            <>
              <div className="flex  text-text-darker text-sm leading-normal relative gap-x-2">
                {isRenamingChat ? (
                  <input
                    value={chatName}
                    onChange={(e) => setChatName(e.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        onRename();
                        event.preventDefault();
                      }
                    }}
                    className="text-sm bg-transparent  border-b border-text-darker flex-1 min-w-0 -my-px mr-2"
                  />
                ) : (
                  <p className="break-all overflow-hidden whitespace-nowrap w-full mr-3 relative">
                    {chatName || `Chat ${chatSession.id}`}
                    <span
                      className={`absolute right-0 top-0 h-full w-8 bg-gradient-to-r from-transparent 
                      ${
                        isSelected
                          ? "to-background-chat-selected"
                          : "group-hover:to-background-chat-hover to-background-sidebar"
                      } `}
                    />
                  </p>
                )}

                {isHovering &&
                  (isRenamingChat ? (
                    <div className="flex ml-auto my-auto">
                      <div
                        onClick={onRename}
                        className="hover:bg-black/10 p-1 -m-1 rounded"
                      >
                        <FiCheck size={16} />
                      </div>
                      <div
                        onClick={() => {
                          setChatName(chatSession.name);
                          setIsRenamingChat(false);
                        }}
                        className="hover:bg-black/10 p-1 -m-1 rounded ml-2"
                      >
                        <FiX size={16} />
                      </div>
                    </div>
                  ) : (
                    <div className="ml-auto my-auto justify-end flex z-30">
                      {!showShareModal && showRetentionWarning && (
                        <CustomTooltip
                          line
                          content={
                            <p>
                              This chat will expire{" "}
                              {daysUntilExpiration < 1
                                ? "today"
                                : `in ${daysUntilExpiration} day${
                                    daysUntilExpiration !== 1 ? "s" : ""
                                  }`}
                            </p>
                          }
                        >
                          <div className="mr-1 hover:bg-black/10 p-1 -m-1 rounded z-50">
                            <WarningCircle className="text-warning" />
                          </div>
                        </CustomTooltip>
                      )}
                      <div>
                        <div
                          onClick={(e) => {
                            e.preventDefault();
                            setIsMoreOptionsDropdownOpen(
                              !isMoreOptionsDropdownOpen
                            );
                          }}
                          className="-my-1"
                        >
                          <Popover
                            open={isMoreOptionsDropdownOpen}
                            onOpenChange={(open: boolean) =>
                              setIsMoreOptionsDropdownOpen(open)
                            }
                            content={
                              <div className="p-1 rounded">
                                <FiMoreHorizontal size={16} />
                              </div>
                            }
                            popover={
                              <div className="border border-border rounded-lg bg-background z-50 w-32">
                                {showShareModal && (
                                  <DefaultDropdownElement
                                    name="Share"
                                    icon={FiShare2}
                                    onSelect={() => showShareModal(chatSession)}
                                  />
                                )}
                                {!search && (
                                  <DefaultDropdownElement
                                    name="Rename"
                                    icon={FiEdit2}
                                    onSelect={() => setIsRenamingChat(true)}
                                  />
                                )}
                                {showDeleteModal && (
                                  <DefaultDropdownElement
                                    name="Delete"
                                    icon={FiTrash}
                                    onSelect={() => setIsDeleteModalOpen(true)}
                                  />
                                )}
                              </div>
                            }
                            requiresContentPadding
                            sideOffset={6}
                            triggerMaxWidth
                          />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </>
          </BasicSelectable>
        </Link>
      </div>

      <SlideOverModal
        isOpen={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        anchor={chatSessionRef}
      >
        <div className="px-4 pb-4">
          <h2 className="text-xl font-semibold mb-4">Delete Chat Session</h2>
          <p className="mb-4">
            Are you sure you want to delete this chat session?
          </p>
          <div className="flex justify-end space-x-2">
            <button
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded"
              onClick={() => setIsDeleteModalOpen(false)}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 bg-red-500 text-white rounded"
              onClick={async () => {
                await deleteChatSession(chatSession.id);
                setIsDeleteModalOpen(false);
                refreshChatSessions();
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </SlideOverModal>
    </>
  );
}
