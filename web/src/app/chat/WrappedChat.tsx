"use client";
import { useChatContext } from "@/components/context/ChatContext";
import { ChatPage } from "./ChatPage";
import FunctionalWrapper from "./shared_chat_search/FunctionalWrapper";

export default function WrappedChat({
  firstMessage,
  defaultSidebarOff,
}: {
  firstMessage?: string;
  // This is required for the chrome extension side panel
  // we don't want to show the sidebar by default when the user opens the side panel
  defaultSidebarOff?: boolean;
}) {
  const { toggledSidebar } = useChatContext();

  return (
    <FunctionalWrapper
      initiallyToggled={toggledSidebar && !defaultSidebarOff}
      content={(toggledSidebar, toggle) => (
        <ChatPage
          toggle={toggle}
          toggledSidebar={toggledSidebar}
          firstMessage={firstMessage}
        />
      )}
    />
  );
}
