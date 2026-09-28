import type { Editor } from "@punchpress/engine";
import {
  getDocumentBaseName,
  type PunchDocumentHandle,
  savePunchDocumentFile,
} from "@/platform/web-document-files";

interface FileTab {
  baseName: string;
  editor: Editor;
  fileHandle: PunchDocumentHandle;
  id: string;
}

interface SaveDocumentTabOptions {
  forceDialog?: boolean;
  tab: FileTab;
  updateIdentity: (
    tabId: string,
    identity: { baseName: string | null; fileHandle: PunchDocumentHandle }
  ) => void;
  writeFile?: typeof savePunchDocumentFile;
}

export const saveDocumentTab = async ({
  forceDialog = false,
  tab,
  updateIdentity,
  writeFile = savePunchDocumentFile,
}: SaveDocumentTabOptions) => {
  const checkpoint = tab.editor.createDocumentSaveCheckpoint();
  const snapshot = await tab.editor.serializeDocumentAsync();
  const result = await writeFile(
    snapshot,
    tab.baseName,
    tab.fileHandle,
    forceDialog
  );

  if (result.canceled) {
    return null;
  }

  updateIdentity(tab.id, {
    baseName: result.fileName ? getDocumentBaseName(result.fileName) : null,
    fileHandle: result.fileHandle || tab.fileHandle,
  });
  tab.editor.markDocumentSaved(checkpoint);

  return { fileName: result.fileName };
};
