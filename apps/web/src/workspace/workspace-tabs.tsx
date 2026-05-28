import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabButton } from "@/components/ui/tab-button";
import { useWorkspace } from "./use-workspace";

export const WorkspaceTabs = ({ onCloseTab, onNewFile }) => {
  const workspace = useWorkspace();
  const scratchpadTab =
    workspace.tabs.find((tab) => tab.kind === "scratchpad") ||
    workspace.tabs[0];
  const fileTabs = workspace.tabs.filter((tab) => tab.id !== scratchpadTab?.id);

  return (
    <div
      className="pointer-events-auto flex h-full min-w-0 flex-1 translate-y-[3px] items-center gap-2 px-2"
      style={{ WebkitAppRegion: "no-drag" }}
    >
      {scratchpadTab ? (
        <WorkspaceTab onCloseTab={onCloseTab} tab={scratchpadTab} />
      ) : null}

      <Button
        aria-label="New file"
        className="shrink-0"
        onClick={onNewFile}
        size="icon-sm"
        variant="ghost"
      >
        <PlusIcon className="size-4" />
      </Button>

      <div className="flex min-w-0 flex-1 items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max items-center gap-2">
          {fileTabs.map((tab) => (
            <WorkspaceTab key={tab.id} onCloseTab={onCloseTab} tab={tab} />
          ))}
        </div>
      </div>
    </div>
  );
};

const WorkspaceTab = ({ onCloseTab, tab }) => {
  const workspace = useWorkspace();

  return (
    <TabButton
      active={tab.isActive}
      closable={tab.isClosable}
      dirty={tab.isDirty}
      onClose={() => onCloseTab(tab.id)}
      onSelect={() => workspace.focusTab(tab.id)}
      title={tab.title}
    >
      {tab.title}
    </TabButton>
  );
};
