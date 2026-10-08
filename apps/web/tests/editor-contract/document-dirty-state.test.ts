import { expect, test } from "bun:test";
import { createDefaultShapeNode, Editor } from "@punchpress/engine";
import { saveDesignDocument } from "@punchpress/punch-schema";

// Workspace tabs re-render only when a dirty-state notification flips the
// value, so each transition must notify after `isDirty` has its final value.
test("dirty-state listeners observe edits, saves, undo, and redo", () => {
  const shape = createDefaultShapeNode("ellipse");
  const editor = new Editor();
  editor.loadDocument(saveDesignDocument([shape]).contents);
  editor.markDocumentSaved();

  const observed: boolean[] = [];
  const unsubscribe = editor.subscribeDirtyState(() => {
    observed.push(editor.isDirty);
  });
  const lastObserved = () => observed.at(-1);

  editor.updateNodes([shape.id], (node) => ({ ...node, width: 321 }));
  expect(lastObserved()).toBe(true);

  editor.markDocumentSaved();
  expect(lastObserved()).toBe(false);

  editor.undo();
  expect(lastObserved()).toBe(true);

  editor.redo();
  expect(lastObserved()).toBe(false);

  unsubscribe();
  const count = observed.length;
  editor.updateNodes([shape.id], (node) => ({ ...node, width: 123 }));
  expect(observed.length).toBe(count);
});

test("uncommitted gesture edits read as dirty until reverted", () => {
  const shape = createDefaultShapeNode("ellipse");
  const editor = new Editor();
  editor.loadDocument(saveDesignDocument([shape]).contents);
  editor.markDocumentSaved();

  const mark = editor.markHistoryStep("scrub");
  editor.updateNodes([shape.id], (node) => ({ ...node, width: 321 }));
  expect(editor.isDirty).toBe(true);

  editor.updateNodes([shape.id], (node) => ({ ...node, width: shape.width }));
  expect(editor.isDirty).toBe(false);

  editor.commitHistoryStep(mark);
  expect(editor.isDirty).toBe(false);
});
