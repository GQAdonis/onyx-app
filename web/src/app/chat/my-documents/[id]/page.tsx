import { fetchChatData } from "@/lib/chat/fetchChatData";

import { redirect } from "next/navigation";
import { ChatProvider } from "@/components/context/ChatContext";
import WrappedUserFolders from "./UserFolder";
import { DocumentsProvider } from "../DocumentsContext";

export default async function GalleryPage(props: {
  searchParams: Promise<{ [key: string]: string }>;
  params: { id: string };
}) {
  const searchParams = await props.searchParams;

  return (
    <DocumentsProvider>
      <WrappedUserFolders userFileId={props.params.id} />
    </DocumentsProvider>
  );
}
