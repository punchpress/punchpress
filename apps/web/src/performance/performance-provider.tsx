import { shouldIgnoreGlobalShortcutTarget } from "@punchpress/engine";
import { createContext, useEffect, useState } from "react";
import { useEditor } from "../editor-react/use-editor";
import {
  findPerformanceBenchmark,
  performanceBenchmarks,
} from "./performance-benchmarks";
import { PerformanceController } from "./performance-controller";

export const PerformanceContext = createContext<PerformanceController | null>(
  null
);

const HUD_SHORTCUT_KEY = "p";

export const PerformanceProvider = ({ children }) => {
  const editor = useEditor();
  const [controller] = useState(() => new PerformanceController());

  useEffect(() => {
    if (!controller.getSnapshot().selectedBenchmarkId) {
      controller.setSelectedBenchmarkId(performanceBenchmarks[0]?.id || "");
    }

    return () => {
      controller.dispose();
    };
  }, [controller]);

  useEffect(() => {
    const updateNodeStats = (state = editor.getState()) => {
      if (!controller.isRuntimeActive()) {
        return;
      }

      controller.setNodeStats({
        selectedNodeCount: state.selectedNodeIds.length,
        totalNodeCount: state.nodes.length,
        visibleTextNodeCount: state.nodes.filter((node) => {
          return (
            node.type === "text" && editor.isNodeEffectivelyVisible(node.id)
          );
        }).length,
      });
    };

    let previousNodes = editor.nodes;
    let previousSelectedNodeIds = editor.selectedNodeIds;
    let previousRuntimeActive = controller.isRuntimeActive();

    const unsubscribeController = controller.subscribe(() => {
      const runtimeActive = controller.isRuntimeActive();

      if (runtimeActive && !previousRuntimeActive) {
        updateNodeStats();
      }

      previousRuntimeActive = runtimeActive;
    });
    const unsubscribeStore = editor.store.subscribe((state) => {
      const nodesChanged = state.nodes !== previousNodes;
      const selectionChanged =
        state.selectedNodeIds !== previousSelectedNodeIds;

      previousNodes = state.nodes;
      previousSelectedNodeIds = state.selectedNodeIds;

      if (!(nodesChanged || selectionChanged)) {
        return;
      }

      updateNodeStats(state);
    });

    return () => {
      unsubscribeController();
      unsubscribeStore();
    };
  }, [controller, editor]);

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (
        shouldIgnoreGlobalShortcutTarget(event.target) ||
        event.altKey ||
        !event.shiftKey ||
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== HUD_SHORTCUT_KEY
      ) {
        return;
      }

      event.preventDefault();
      controller.toggleHud();
    };

    window.addEventListener("keydown", handleWindowKeyDown);

    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown);
    };
  }, [controller]);

  useEffect(() => {
    const win = window as Window & {
      __PUNCHPRESS_PERF__?: {
        getSnapshot: () => ReturnType<PerformanceController["getSnapshot"]>;
        listBenchmarks: () => typeof performanceBenchmarks;
        setHudOpen: (open: boolean) => void;
        runBenchmark: (
          benchmarkId: string
        ) => ReturnType<PerformanceController["runBenchmark"]>;
        toggleHud: () => void;
      };
    };

    win.__PUNCHPRESS_PERF__ = {
      getSnapshot: controller.getSnapshot,
      listBenchmarks: () => performanceBenchmarks,
      setHudOpen: controller.setHudOpen,
      runBenchmark: (benchmarkId: string) => {
        const benchmark = findPerformanceBenchmark(benchmarkId);

        if (!benchmark) {
          throw new Error(`Unknown benchmark: ${benchmarkId}`);
        }

        return controller.runBenchmark(editor, benchmark);
      },
      toggleHud: controller.toggleHud,
    };

    return () => {
      if (win.__PUNCHPRESS_PERF__) {
        win.__PUNCHPRESS_PERF__ = undefined;
      }
    };
  }, [controller, editor]);

  return (
    <PerformanceContext.Provider value={controller}>
      {children}
    </PerformanceContext.Provider>
  );
};
