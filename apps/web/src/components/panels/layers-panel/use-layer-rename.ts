import { useLayoutEffect, useRef, useState } from "react";
import { useEditor } from "../../../editor-react/use-editor";

// In-place rename for a layer row: `start` opens the input on the next frame
// (after the context menu closes), Enter or blur commits, Escape cancels.
export const useLayerRename = (nodeId: string, label: string | undefined) => {
  const editor = useEditor();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [value, setValue] = useState("");

  useLayoutEffect(() => {
    if (label === undefined) {
      return;
    }

    if (!isRenaming) {
      setValue(label);
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isRenaming, label]);

  const commit = () => {
    editor.renameGroup(nodeId, value);
    setIsRenaming(false);
  };

  const cancel = () => {
    setValue(label ?? "");
    setIsRenaming(false);
  };

  return {
    inputProps: {
      onBlur: commit,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        setValue(event.target.value),
      onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
          commit();
        }

        if (event.key === "Escape") {
          cancel();
        }
      },
      onPointerDown: (event: React.PointerEvent) => event.stopPropagation(),
      ref: inputRef,
      value,
    },
    isRenaming,
    start: () => {
      window.requestAnimationFrame(() => {
        setIsRenaming(true);
      });
    },
  };
};
