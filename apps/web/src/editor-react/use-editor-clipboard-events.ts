import { shouldIgnoreGlobalShortcutTarget } from "@punchpress/engine";
import {
  PUNCH_CLIPBOARD_HTML_ATTRIBUTE,
  PUNCH_CLIPBOARD_MIME_TYPE,
  parseClipboardContent,
  serializeClipboardContent,
} from "@punchpress/punch-schema";
import { useEffect } from "react";

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

const hasClipboardFiles = (clipboardData) => {
  return Array.from(clipboardData?.items || []).some((item) => {
    return item.kind === "file";
  });
};

export const useEditorClipboardEvents = (editor) => {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const ownerDocument = window.document;

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
      ownerDocument.removeEventListener("copy", handleCopy);
      ownerDocument.removeEventListener("paste", handlePaste);
    };
  }, [editor]);
};
