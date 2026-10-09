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
        <h2 className="text-(length:--dialog-title-text) font-semibold text-foreground">
          Debug
        </h2>
        <p className="text-(length:--chrome-text) text-muted-foreground">
          Inspect the current editor debug dump and copy it to the clipboard for
          tests or agent workflows.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={refreshDump} size="chrome" variant="outline">
          <RefreshCwIcon />
          Refresh dump
        </Button>
        <Button onClick={handleCopyDump} size="chrome">
          {copyState === "copied" ? <CheckIcon /> : <CopyIcon />}
          {copyState === "copied" ? "Copied" : "Copy dump"}
        </Button>
        {copyState === "error" ? (
          <span className="text-(length:--chrome-text-sm) text-muted-foreground">
            Clipboard access failed. Refresh and copy from the panel content.
          </span>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-(--surface-radius) border bg-muted/20">
        <div className="text-(length:--section-title-text) border-b px-3 py-2 font-semibold text-(--section-title-color) tracking-(--section-title-tracking) [text-transform:var(--section-title-case)]">
          Debug dump
        </div>
        <pre className="text-(length:--chrome-text-sm) max-h-[320px] overflow-auto whitespace-pre-wrap px-3 pt-2 pb-4 font-mono text-foreground leading-4">
          {dumpText}
        </pre>
      </div>
    </>
  );
};
