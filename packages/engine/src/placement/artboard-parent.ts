import { getTopmostArtboardAtPoint } from "../nodes/artboard/artboard-hit-test";

export const getArtboardParentPatch = (editor, point) => {
  const artboard = getTopmostArtboardAtPoint(editor, point);

  return artboard
    ? {
        parentId: artboard.id,
      }
    : null;
};
