"use client";

import SidebarWrapper from "@/app/assistants/SidebarWrapper";
import UserFolderContent from "./UserFolderContent";

export default function WrappedUserFolders({
  userFileId,
}: {
  userFileId: string;
}) {
  return (
    <SidebarWrapper size="lg">
      <div className="mx-auto w-full">
        <UserFolderContent
          models={[
            // faux data for now
            {
              modelName: "gpt-4o",
              provider: "openai",
              maxTokens: 1000,
            },
            {
              modelName: "gpt-4o-mini",
              provider: "openai",
              maxTokens: 2000,
            },
          ]}
          folderId={Number(userFileId)}
        />
      </div>
    </SidebarWrapper>
  );
}
