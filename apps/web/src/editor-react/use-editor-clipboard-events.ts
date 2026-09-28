import { shouldIgnoreGlobalShortcutTarget } from "@punchpress/engine";
import {
  PUNCH_CLIPBOARD_HTML_ATTRIBUTE,
  PUNCH_CLIPBOARD_MIME_TYPE,
  parseClipboardContent,
  serializeClipboardContent,
} from "@punchpress/punch-schema";
import { useEffect } from "react";
import { showToast } from "@/components/ui/toast";
import { importImageFile, isSupportedImageFile } from "@/platform/image-import";

const getClipboardText = (content) => {
  return content.nodes
    .filter((node) => node.type === "text")
    .map((node) => node.text)
    .join("\n")
    .trim();
};

const createClipboardHtml = (content) => {
  return `<div ${PUNCH_CLIPBOARD_HTML_ATTRIBUTE}="${encodeURIComponent(
    serializeClipboardContent(content)
  )}"></div>`;
};

const getClipboardContentFromHtml = (html) => {
  if (typeof html !== "string" || html.length === 0) {
    return null;
  }

  const match = html.match(
    new RegExp(`${PUNCH_CLIPBOARD_HTML_ATTRIBUTE}="([^"]+)"`)
  );

  if (!match?.[1]) {
    return null;
  }

  try {
    return parseClipboardContent(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
};

const hasClipboardFiles = (clipboardData: DataTransfer) => {
  return Array.from(clipboardData?.items || []).some((item) => {
    return item.kind === "file";
  });
};

const getClipboardImageFile = (clipboardData: DataTransfer) => {
  const files = Array.from(clipboardData.items || [])
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => file !== null);

  return files.find(isSupportedImageFile) || null;
};

const pasteClipboardImage = async (editor, file, isActive) => {
  const targetCenter = editor.getViewportCenter();

  if (!(file && targetCenter)) {
    return;
  }

  try {
    const node = await importImageFile({ file, targetCenter });
    if (isActive()) {
      editor.insertNodes([node]);
    }
  } catch (error) {
    console.error(error);
    showToast({
      message: `Import image failed: ${
        error instanceof Error ? error.message : "Unknown file error."
      }`,
      priority: "high",
      type: "error",
    });
  }
};

export const useEditorClipboardEvents = (editor) => {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const ownerDocument = window.document;
    let active = true;

    const handleCopy = (event) => {
      if (
        editor.selectedNodeIds.length === 0 ||
        editor.editingNodeId ||
        shouldIgnoreGlobalShortcutTarget(event.target)
      ) {
        return;
      }

      const content = editor.copySelection();
      if (!(content && event.clipboardData)) {
        return;
      }

      event.preventDefault();
      event.clipboardData.setData(
        PUNCH_CLIPBOARD_MIME_TYPE,
        serializeClipboardContent(content)
      );
      event.clipboardData.setData("text/html", createClipboardHtml(content));
      event.clipboardData.setData(
        "text/plain",
        getClipboardText(content) || " "
      );
    };

    const handlePaste = (event) => {
      if (
        editor.editingNodeId ||
        shouldIgnoreGlobalShortcutTarget(event.target) ||
        !event.clipboardData
      ) {
        return;
      }

      const internalContent =
        event.clipboardData.getData(PUNCH_CLIPBOARD_MIME_TYPE) ||
        getClipboardContentFromHtml(event.clipboardData.getData("text/html"));

      if (internalContent) {
        event.preventDefault();
        editor.pasteClipboardContent(
          typeof internalContent === "string"
            ? parseClipboardContent(internalContent)
            : internalContent
        );
        return;
      }

      if (hasClipboardFiles(event.clipboardData)) {
        event.preventDefault();
        const file = getClipboardImageFile(event.clipboardData);
        pasteClipboardImage(editor, file, () => active);
        return;
      }

      const text = event.clipboardData.getData("text/plain");
      if (typeof text !== "string" || text.trim().length === 0) {
        return;
      }

      event.preventDefault();
      editor.pasteText(text);
    };

    ownerDocument.addEventListener("copy", handleCopy);
    ownerDocument.addEventListener("paste", handlePaste);

    return () => {
      active = false;
      ownerDocument.removeEventListener("copy", handleCopy);
      ownerDocument.removeEventListener("paste", handlePaste);
    };
  }, [editor]);
};
