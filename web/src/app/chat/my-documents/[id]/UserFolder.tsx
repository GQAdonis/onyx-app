"use client";

import SidebarWrapper from "@/app/assistants/SidebarWrapper";
import Title from "@/components/ui/title";
import UserFolderContent from "./UserFolderContent";

// import MyDocuments from "./MyDocuments";

export default function WrappedUserFolders({
  userFileId,
}: {
  userFileId: string;
}) {
  return (
    <SidebarWrapper size="lg">
      <div className="mx-auto w-full">
        <UserFolderContent folderId={Number(userFileId)} />
      </div>
    </SidebarWrapper>
  );
}
