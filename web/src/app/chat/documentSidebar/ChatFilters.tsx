import { OnyxDocument } from "@/lib/search/interfaces";
import { ChatDocumentDisplay } from "./ChatDocumentDisplay";
import { usePopup } from "@/components/admin/connectors/Popup";
import { removeDuplicateDocs } from "@/lib/documentUtils";
import { Message } from "../interfaces";
import {
  Dispatch,
  ForwardedRef,
  forwardRef,
  SetStateAction,
  useEffect,
  useState,
} from "react";
import { SourcesIcon, XIcon } from "@/components/icons/icons";

interface ChatFiltersProps {
  closeSidebar: () => void;
  selectedMessage: Message | null;
  selectedDocuments: OnyxDocument[] | null;
  toggleDocumentSelection: (document: OnyxDocument) => void;
  clearSelectedDocuments: () => void;
  selectedDocumentTokens: number;
  maxTokens: number;
  initialWidth: number;
  isOpen: boolean;
  isSharedChat?: boolean;
  modal: boolean;
  setPresentingDocument: Dispatch<SetStateAction<OnyxDocument | null>>;
}

export const ChatFilters = forwardRef<HTMLDivElement, ChatFiltersProps>(
  (
    {
      closeSidebar,
      modal,
      selectedMessage,
      selectedDocuments,
      toggleDocumentSelection,
      clearSelectedDocuments,
      selectedDocumentTokens,
      maxTokens,
      initialWidth,
      isSharedChat,
      isOpen,
      setPresentingDocument,
    },
    ref: ForwardedRef<HTMLDivElement>
  ) => {
    const { popup, setPopup } = usePopup();
    const [delayedSelectedDocumentCount, setDelayedSelectedDocumentCount] =
      useState(0);

    const handleOutsideClick = (event: MouseEvent) => {
      const sidebar = document.getElementById("onyx-chat-sidebar");
      if (sidebar && !sidebar.contains(event.target as Node)) {
        closeSidebar();
      }
    };

    useEffect(() => {
      if (isOpen) {
        document.addEventListener("mousedown", handleOutsideClick);
      } else {
        document.removeEventListener("mousedown", handleOutsideClick);
      }

      return () => {
        document.removeEventListener("mousedown", handleOutsideClick);
      };
    }, [isOpen]);

    useEffect(() => {
      const timer = setTimeout(
        () => {
          setDelayedSelectedDocumentCount(selectedDocuments?.length || 0);
        },
        selectedDocuments?.length == 0 ? 1000 : 0
      );

      return () => clearTimeout(timer);
    }, [selectedDocuments]);

    const selectedDocumentIds =
      selectedDocuments?.map((document) => document.document_id) || [];

    const currentDocuments = selectedMessage?.documents || null;
    const dedupedDocuments = removeDuplicateDocs(currentDocuments || []);

    const tokenLimitReached = selectedDocumentTokens > maxTokens - 75;

    const hasSelectedDocuments = selectedDocumentIds.length > 0;

    return (
      <div
        id="onyx-chat-sidebar"
        className={`relative rounded-lg bg-background max-w-full ${
          !modal ? "border-l h-full border-sidebar-border" : ""
        }`}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            closeSidebar();
          }
        }}
      >
        <div
          className={`ml-auto h-full relative sidebar transition-all duration-300 
            ${
              isOpen
                ? "opacity-100 translate-x-0"
                : "opacity-0 translate-x-[10%]"
            }`}
          style={{
            width: modal ? undefined : initialWidth,
          }}
        >
          <div className="flex flex-col h-full">
            {popup}
            <div className="p-4 flex items-center justify-start gap-x-2">
              <SourcesIcon size={32} />
              <h2 className="text-xl font-bold text-text-900">Sources</h2>
            </div>
            <div className="border-b border-divider-history-sidebar-bar mx-3" />
            <div className="overflow-y-auto pb-8 -mx-1 sm:mx-0 flex-grow gap-y-0 default-scrollbar dark-scrollbar flex flex-col">
              {dedupedDocuments.length > 0 ? (
                dedupedDocuments.map((document, ind) => (
                  <div key={document.document_id} className="w-full">
                    <ChatDocumentDisplay
                      setPresentingDocument={setPresentingDocument}
                      closeSidebar={closeSidebar}
                      modal={modal}
                      document={document}
                      isSelected={selectedDocumentIds.includes(
                        document.document_id
                      )}
                      handleSelect={(documentId) => {
                        toggleDocumentSelection(
                          dedupedDocuments.find(
                            (doc) => doc.document_id === documentId
                          )!
                        );
                      }}
                      hideSelection={isSharedChat}
                      tokenLimitReached={tokenLimitReached}
                    />
                  </div>
                ))
              ) : (
                <div className="mx-3" />
              )}
            </div>
          </div>
          <div
            className={`sticky bottom-4 w-full left-0 flex justify-center transition-opacity duration-300 ${
              hasSelectedDocuments
                ? "opacity-100"
                : "opacity-0 pointer-events-none"
            }`}
          >
            <button
              className="text-sm font-medium py-2 px-4 rounded-full transition-colors bg-gray-900 text-white"
              onClick={clearSelectedDocuments}
            >
              {`Remove ${
                delayedSelectedDocumentCount > 0
                  ? delayedSelectedDocumentCount
                  : ""
              } Source${delayedSelectedDocumentCount > 1 ? "s" : ""}`}
            </button>
          </div>
        </div>
      </div>
    );
  }
);

ChatFilters.displayName = "ChatFilters";
