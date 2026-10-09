import { HugeiconsIcon } from "@hugeicons/react";
import { Home01Icon } from "@hugeicons-pro/core-stroke-rounded";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tab, TabClose, TabIconTrigger, TabTrigger } from "@/components/ui/tab";
import { useWorkspace } from "./use-workspace";

// The title bar's tab strip: the pinned Scratchpad, the file tabs (scrolling
// when they overflow), then the new-tab button. Tabs are `no-drag`; the empty
// bar space after them stays a window drag region on desktop.
export const WorkspaceTabs = ({ onCloseTab, onNewFile }) => {
  const workspace = useWorkspace();
  const scratchpadTab =
    workspace.tabs.find((tab) => tab.kind === "scratchpad") ||
    workspace.tabs[0];
  const fileTabs = workspace.tabs.filter((tab) => tab.id !== scratchpadTab?.id);

  return (
    <div className="flex h-full min-w-0 flex-1" data-workspace-tabs="">
      {scratchpadTab ? (
        <div className="no-drag flex shrink-0">
          <Tab active={scratchpadTab.isActive} size="icon">
            <TabIconTrigger
              label={scratchpadTab.title}
              onSelect={() => workspace.focusTab(scratchpadTab.id)}
            >
              <HugeiconsIcon
                color="currentColor"
                icon={Home01Icon}
                // Matches the 2px Lucide stroke at 14px when drawn at 16px.
                strokeWidth={1.75}
              />
            </TabIconTrigger>
          </Tab>
        </div>
      ) : null}

      <div className="no-drag flex min-w-0 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {fileTabs.map((tab) => (
          <Tab active={tab.isActive} dirty={tab.isDirty} key={tab.id}>
            <TabTrigger onSelect={() => workspace.focusTab(tab.id)}>
              {tab.title}
            </TabTrigger>
            {tab.isClosable ? (
              <TabClose
                label={`Close ${tab.title}`}
                onClose={() => onCloseTab(tab.id)}
              />
            ) : null}
          </Tab>
        ))}
      </div>

      <div className="flex shrink-0 items-center pl-(--tab-add-gap)">
        <Button
          aria-label="New file"
          className="no-drag"
          onClick={onNewFile}
          size="icon-chrome"
          variant="tab"
        >
          <PlusIcon />
        </Button>
      </div>
    </div>
  );
};
