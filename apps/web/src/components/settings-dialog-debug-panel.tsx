import { CheckIcon, CopyIcon, RefreshCwIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useEditor } from "../editor-react/use-editor";

const getFormattedDebugDump = (editor) => {
  return JSON.stringify(editor.getDebugDump(), null, 2);
};

export const SettingsDialogDebugPanel = ({ isActive }) => {
  const editor = useEditor();
  const [copyState, setCopyState] = useState("idle");
  const [dumpText, setDumpText] = useState("");

  useEffect(() => {
    if (!isActive) {
      return;
    }

    setDumpText(getFormattedDebugDump(editor));
    setCopyState("idle");
  }, [editor, isActive]);

  useEffect(() => {
    if (copyState !== "copied") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCopyState("idle");
    }, 1600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [copyState]);

  const refreshDump = () => {
    const nextDump = getFormattedDebugDump(editor);

    setDumpText(nextDump);
    setCopyState("idle");

    return nextDump;
  };
  const handleCopyDump = async () => {
    try {
      const clipboard = window.navigator?.clipboard;
      const nextDump = refreshDump();

      if (!clipboard) {
        throw new Error("Clipboard API unavailable");
      }

      await clipboard.writeText(nextDump);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
  };

  return (
    <>
      <div className="space-y-1">
        <h2 className="font-semibold text-foreground text-lg">Debug</h2>
        <p className="text-muted-foreground text-sm">
          Inspect the current editor debug dump and copy it to the clipboard for
          tests or agent workflows.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={refreshDump} size="sm" variant="outline">
          <RefreshCwIcon />
          Refresh dump
        </Button>
        <Button onClick={handleCopyDump} size="sm">
          {copyState === "copied" ? <CheckIcon /> : <CopyIcon />}
          {copyState === "copied" ? "Copied" : "Copy dump"}
        </Button>
        <span className="text-muted-foreground text-xs">
          {copyState === "error"
            ? "Clipboard access failed. Refresh and copy from the panel content."
            : "The dump is formatted JSON from Editor.getDebugDump()."}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border bg-muted/20">
        <div className="border-b px-4 py-2.5 font-medium text-muted-foreground text-xs uppercase tracking-wider">
          Debug dump
        </div>
        <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap px-4 pt-3 pb-6 font-mono text-[11px] text-foreground leading-5">
          {dumpText}
        </pre>
      </div>
    </>
  );
};
