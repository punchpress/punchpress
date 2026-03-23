import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEditor } from "../editor-react/use-editor";
import type { PerformanceBenchmarkDefinition } from "./performance-benchmark-types";
import { usePerformance } from "./use-performance";

export const usePerformanceBenchmarkRunner = () => {
  const editor = useEditor();
  const { controller, state } = usePerformance();
  const [pendingBenchmark, setPendingBenchmark] =
    useState<PerformanceBenchmarkDefinition | null>(null);

  const runBenchmark = async (benchmark: PerformanceBenchmarkDefinition) => {
    return await controller.runBenchmark(editor, benchmark);
  };

  const requestBenchmarkRun = async (
    benchmark: PerformanceBenchmarkDefinition | null | undefined
  ) => {
    if (!benchmark || state.benchmarkStatus === "running") {
      return;
    }

    if (editor.nodes.length > 0) {
      setPendingBenchmark(benchmark);
      return;
    }

    await runBenchmark(benchmark);
  };

  const confirmBenchmarkRun = async () => {
    if (!pendingBenchmark) {
      return;
    }

    const benchmark = pendingBenchmark;
    setPendingBenchmark(null);
    await runBenchmark(benchmark);
  };

  const cancelBenchmarkRun = () => {
    setPendingBenchmark(null);
  };

  return {
    cancelBenchmarkRun,
    confirmBenchmarkRun,
    isConfirmOpen: Boolean(pendingBenchmark),
    requestBenchmarkRun,
  };
};

export const PerformanceBenchmarkConfirmDialog = ({
  onConfirm,
  onOpenChange,
  open,
}: {
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => {
  return (
    <Dialog
      disablePointerDismissal
      modal
      onOpenChange={onOpenChange}
      open={open}
    >
      <DialogPopup
        blockOutsidePointerEvents
        bottomStickOnMobile={false}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>Clear the canvas before running benchmark?</DialogTitle>
          <DialogDescription>
            Benchmarks run in a scratch scene and will clear the current canvas.
            Any unsaved work on the canvas will be lost.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="sm:items-center sm:justify-between">
          <Button onClick={() => onOpenChange(false)} variant="ghost">
            Cancel
          </Button>
          <Button onClick={onConfirm} variant="destructive-soft">
            Empty canvas and run
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
};
