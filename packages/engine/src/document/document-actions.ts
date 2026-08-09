import {
  getMissingDocumentFonts,
  loadDesignDocument,
  MissingDocumentFontsError,
  replaceMissingDocumentFonts,
  saveDesignDocument,
} from "@punchpress/punch-schema";
import { finishEditingIfNeeded } from "../editing/editing-actions";
import { recordPerfSpan } from "../perf/perf-hooks";
import { PERF_SPANS } from "../perf/perf-labels";
import {
  toInternalEditorNodes,
  toSerializableDocumentNodes,
} from "../nodes/vector/vector-document-conversion";
import { exportArtboardSvg, exportDesignDocument } from "./export";

export const getDocument = (editor) => {
  if (editor.editingNodeId) {
    editor.finalizeEditing();
  }

  return saveDesignDocument(toSerializableDocumentNodes(editor.nodes)).document;
};

const getOutputNodes = async (editor) => {
  const startedAt = getNow();
  const nodes = [];
  const committedDocumentNodes =
    editor.rasterStrokeRuntime.getCommittedDocumentNodes();

  for (const node of committedDocumentNodes) {
    if (node.type !== "image") {
      nodes.push(node);
      continue;
    }

    const sourceBounds = {
      height: node.baseHeight ?? node.height,
      width: node.baseWidth ?? node.width,
      x: node.baseX ?? 0,
      y: node.baseY ?? 0,
    };
    const snapshotRegion =
      editor.rasterSurface?.getSurfaceGeometry?.(node.id, sourceBounds)
        ?.bounds ?? sourceBounds;
    const snapshot = await editor.rasterSurface?.snapshotSurfaceAsync?.(
      node.id,
      snapshotRegion,
      sourceBounds
    );

    if (!snapshot) {
      nodes.push(node);
      continue;
    }

    nodes.push({
      ...node,
      baseHeight: snapshotRegion.height,
      baseWidth: snapshotRegion.width,
      baseX: snapshotRegion.x,
      baseY: snapshotRegion.y,
      mimeType: "image/png",
      pixelHeight: snapshot.pixelHeight,
      pixelWidth: snapshot.pixelWidth,
      src: snapshot.src,
    });
  }
  const endedAt = getNow();

  recordPerfSpan({
    depth: 0,
    durationMs: endedAt - startedAt,
    endMs: endedAt,
    label: PERF_SPANS.rasterDocumentSnapshot,
    startMs: startedAt,
  });

  return toSerializableDocumentNodes(nodes);
};

const getNow = () =>
  typeof performance === "undefined" ? Date.now() : performance.now();

export const getDocumentAsync = async (editor) =>
  saveDesignDocument(await getOutputNodes(editor)).document;

export const exportDocument = async (editor) => {
  const missingFonts = getMissingDocumentFonts(
    editor.nodes,
    editor.availableFonts
  );

  if (missingFonts.length > 0) {
    throw new MissingDocumentFontsError(missingFonts);
  }

  return exportDesignDocument(await getDocumentAsync(editor), (font) =>
    editor.fonts.loadFontForExport(font)
  );
};

export const exportSelectedArtboardSvg = async (editor, artboardId = editor.selectedNodeId) => {
  const node = editor.getNode(artboardId);

  if (node?.type !== "artboard") {
    return null;
  }

  const missingFonts = getMissingDocumentFonts(
    editor.nodes,
    editor.availableFonts
  );

  if (missingFonts.length > 0) {
    throw new MissingDocumentFontsError(missingFonts);
  }

  return exportArtboardSvg(await getDocumentAsync(editor), node.id, (font) =>
    editor.fonts.loadFontForExport(font)
  );
};

export const loadDocument = (editor, contents) => {
  const { nodes } = loadDesignDocument(contents);
  const resolution = replaceMissingDocumentFonts(
    toInternalEditorNodes(nodes),
    editor.availableFonts,
    editor.getDefaultFont()
  );

  editor.cancelRasterStroke();
  editor.rasterSurface?.resetSurfaces?.();
  editor.getState().loadNodes(resolution.nodes);
  editor.resetHistory();
  editor.resetPasteSequence();

  if (typeof window !== "undefined") {
    editor.scheduleViewportFocus(resolution.nodes.map((node) => node.id));
  }

  return resolution;
};

export const newDocument = (editor) => {
  finishEditingIfNeeded(editor);
  editor.rasterSurface?.resetSurfaces?.();
  editor.getState().loadNodes([]);
  editor.resetHistory();
  editor.resetPasteSequence();
};

export const serializeDocument = (editor) => {
  return saveDesignDocument(toSerializableDocumentNodes(editor.nodes)).contents;
};

export const serializeDocumentAsync = async (editor) =>
  saveDesignDocument(await getOutputNodes(editor)).contents;
