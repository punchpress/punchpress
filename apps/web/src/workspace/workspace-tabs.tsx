import { PlusIcon, XIcon } from "lucide-react";
import { useWorkspace } from "./use-workspace";

export const WorkspaceTabs = ({ onCloseTab, onNewFile }) => {
  const workspace = useWorkspace();

  return (
    <div
      className="pointer-events-auto inline-flex h-full min-w-0 max-w-full translate-y-[3px] items-center gap-3 px-2"
      style={{ WebkitAppRegion: "no-drag" }}
    >
      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
        {workspace.tabs.map((tab) => (
          <div
            className="group flex h-7 min-w-0 max-w-44 items-center rounded-xl border border-transparent bg-[var(--workspace-tab-bg)] text-[var(--workspace-tab-text)] hover:bg-[var(--workspace-tab-bg-hover)] data-active:bg-[var(--workspace-tab-bg-active)] data-active:text-[var(--workspace-tab-text-active)] data-active:shadow-[var(--workspace-tab-shadow)]"
            data-active={tab.isActive ? "true" : "false"}
            key={tab.id}
          >
            <button
              className="flex h-full min-w-0 items-center gap-2 px-2 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => workspace.focusTab(tab.id)}
              title={tab.title}
              type="button"
            >
              <span
                className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40 data-dirty:bg-primary"
                data-dirty={tab.isDirty ? "true" : "false"}
              />
              <span className="truncate">{tab.title}</span>
            </button>
            {tab.isClosable ? (
              <button
                aria-label={`Close ${tab.title}`}
                className="mr-1 grid size-5 shrink-0 place-items-center rounded-md opacity-0 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100"
                onClick={(event) => {
                  event.stopPropagation();
                  onCloseTab(tab.id);
                }}
                type="button"
              >
                <XIcon className="size-3.5" />
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <button
        aria-label="New file"
        className="grid size-7 shrink-0 place-items-center rounded-lg border border-transparent text-[var(--workspace-tab-text)] outline-none hover:bg-[var(--workspace-tab-bg-hover)] focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onNewFile}
        type="button"
      >
        <PlusIcon className="size-4" />
      </button>
    </div>
  );
};
