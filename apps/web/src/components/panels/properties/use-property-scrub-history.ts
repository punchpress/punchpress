import { useCallback, useEffect, useRef } from "react";
import { useEditor } from "../../../editor-react/use-editor";

export const usePropertyScrubHistory = (name = "edit properties") => {
  const editor = useEditor();
  const historyMarkRef = useRef<ReturnType<
    typeof editor.markHistoryStep
  > | null>(null);

  const commitScrubHistory = useCallback(() => {
    const historyMark = historyMarkRef.current;
    historyMarkRef.current = null;

    if (historyMark) {
      editor.commitHistoryStep(historyMark);
    }
  }, [editor]);

  useEffect(() => {
    return () => {
      commitScrubHistory();
    };
  }, [commitScrubHistory]);

  return {
    onScrubEnd: commitScrubHistory,
    onScrubStart: () => {
      if (historyMarkRef.current) {
        return;
      }

      historyMarkRef.current = editor.markHistoryStep(name);
    },
  };
};
