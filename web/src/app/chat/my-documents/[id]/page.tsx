import WrappedUserFolders from "./UserFolder";
import { DocumentsProvider } from "../DocumentsContext";

export default async function GalleryPage(props: {
  params: Promise<{ ["id"]: string }>;
}) {
  const searchParams = await props.params;
  return (
    <DocumentsProvider>
      <WrappedUserFolders userFileId={searchParams.id} />
    </DocumentsProvider>
  );
}
