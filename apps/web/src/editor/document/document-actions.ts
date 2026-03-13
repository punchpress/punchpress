import {
  getMissingDocumentFonts,
  replaceMissingDocumentFonts,
} from "../../document/document-fonts";
import { MissingDocumentFontsError } from "../../document/errors";
import { exportDesignDocument } from "../../document/export";
import { loadDesignDocument } from "../../document/load";
import { saveDesignDocument } from "../../document/save";
import { finishEditingIfNeeded } from "../editing/editing-actions";

export const getDocument = (editor) => {
  if (editor.editingNodeId) {
    editor.finalizeEditing();
  }

  return saveDesignDocument(editor.nodes).document;
};

export const exportDocument = async (editor) => {
  await editor.initializeLocalFonts().catch(() => undefined);
  const missingFonts = getMissingDocumentFonts(
    editor.nodes,
    editor.availableFonts
  );

  if (missingFonts.length > 0) {
    throw new MissingDocumentFontsError(missingFonts);
  }

  return exportDesignDocument(getDocument(editor), (font) =>
    editor.fonts.loadFontForExport(font)
  );
};

export const loadDocument = (editor, contents) => {
  const { nodes } = loadDesignDocument(contents);
  const resolution = replaceMissingDocumentFonts(
    nodes,
    editor.availableFonts,
    editor.getDefaultFont()
  );

  editor.getState().loadNodes(resolution.nodes);
  editor.resetHistory();

  if (typeof window !== "undefined") {
    editor.scheduleViewportFocus(resolution.nodes.map((node) => node.id));
  }

  return resolution;
};

export const newDocument = (editor) => {
  finishEditingIfNeeded(editor);
  editor.getState().loadNodes([]);
  editor.resetHistory();
};

export const serializeDocument = (editor) => {
  return saveDesignDocument(editor.nodes).contents;
};
