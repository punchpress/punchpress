import { round } from "@punchpress/engine";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowUpIcon,
  CornerDownLeftIcon,
  ImagesIcon,
} from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { AssetSearchPanel } from "@/components/assets/asset-search-panel";
import { useAutocompleteFilter } from "@/components/ui/autocomplete";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useEditor } from "@/editor-react/use-editor";
import type { Asset, ImportedAsset } from "@/platform/assets/magnific-assets";
import { createImageNodeFromDataUrl } from "@/platform/image-import";
import { importSvgToNodes } from "@/platform/svg-import-document";

interface CommandItemModel {
  icon: typeof ImagesIcon;
  keywords: string[];
  label: string;
  value: string;
}

interface CommandGroupModel {
  items: CommandItemModel[];
  value: string;
}

const canUseAssetSearch = () => {
  return (
    import.meta.env.DEV || Boolean(window.electron?.assets?.isSearchAvailable)
  );
};

const getCommandGroups = (): CommandGroupModel[] => [
  {
    items: canUseAssetSearch()
      ? [
          {
            icon: ImagesIcon,
            keywords: ["assets", "artwork", "svg", "image"],
            label: "Assets",
            value: "assets",
          },
        ]
      : [],
    value: "Actions",
  },
];

type CommandView = "commands" | "assets";

export const CommandMenu = () => {
  const editor = useEditor();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<CommandView>("commands");
  const [searchQuery, setSearchQuery] = useState("");
  const commandGroups = useMemo(() => getCommandGroups(), []);
  const { contains } = useAutocompleteFilter({ sensitivity: "base" });

  const reset = useCallback(() => {
    setView("commands");
    setSearchQuery("");
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);

      if (!nextOpen) {
        reset();
      }
    },
    [reset]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        !(event.metaKey || event.ctrlKey) ||
        event.key.toLowerCase() !== "k"
      ) {
        return;
      }

      event.preventDefault();
      setOpen((currentOpen) => !currentOpen);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filterItem = useCallback(
    (itemValue: unknown, query: string): boolean => {
      if (typeof itemValue !== "object" || itemValue === null) {
        return false;
      }

      const item = itemValue as CommandItemModel;

      return (
        contains(item.label, query) ||
        contains(item.value, query) ||
        item.keywords.some((keyword) => contains(keyword, query))
      );
    },
    [contains]
  );

  const hasResults = useMemo(() => {
    return (
      !searchQuery.trim() ||
      commandGroups.some((group) =>
        group.items.some((item) => filterItem(item, searchQuery))
      )
    );
  }, [commandGroups, filterItem, searchQuery]);

  const openAssets = useCallback(() => {
    setSearchQuery("");
    setView("assets");
  }, []);

  const addAsset = useCallback(
    async (asset: Asset, importedAsset: ImportedAsset) => {
      const center = editor.getViewportCenter();
      const targetCenter = {
        x: round(center.x, 2),
        y: round(center.y, 2),
      };

      if (importedAsset.svg) {
        const nodes = importSvgToNodes(importedAsset.svg, {
          targetCenter,
        });

        editor.insertNodes(nodes);
        return;
      }

      if (!(importedAsset.dataUrl && importedAsset.mimeType)) {
        return;
      }

      const imageNode = await createImageNodeFromDataUrl({
        mimeType: importedAsset.mimeType,
        name: asset.title || "Image",
        src: importedAsset.dataUrl,
        targetCenter,
      });

      editor.insertNodes([imageNode]);
    },
    [editor]
  );

  return (
    <CommandDialog onOpenChange={handleOpenChange} open={open}>
      <CommandDialogPopup>
        {view === "commands" ? (
          <Command filter={filterItem} items={commandGroups}>
            <CommandInput
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Type a command or search..."
              value={searchQuery}
            />
            <CommandPanel>
              <CommandEmpty>
                {searchQuery.trim() ? "No results found." : null}
              </CommandEmpty>
              <CommandList>
                {(group: CommandGroupModel) => (
                  <Fragment key={group.value}>
                    <CommandGroup items={group.items}>
                      <CommandGroupLabel>{group.value}</CommandGroupLabel>
                      <CommandCollection>
                        {(item: CommandItemModel) => {
                          const Icon = item.icon;

                          return (
                            <CommandItem
                              key={item.value}
                              onClick={openAssets}
                              value={item}
                            >
                              <Icon className="size-4 text-muted-foreground" />
                              <span className="flex-1">{item.label}</span>
                              <CommandShortcut>Open</CommandShortcut>
                            </CommandItem>
                          );
                        }}
                      </CommandCollection>
                    </CommandGroup>
                    <CommandSeparator />
                  </Fragment>
                )}
              </CommandList>
            </CommandPanel>
            <CommandFooter>
              {hasResults ? (
                <>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <KbdGroup>
                        <Kbd>
                          <ArrowUpIcon />
                        </Kbd>
                        <Kbd>
                          <ArrowDownIcon />
                        </Kbd>
                      </KbdGroup>
                      <span>Navigate</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Kbd>
                        <CornerDownLeftIcon />
                      </Kbd>
                      <span>Open</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Kbd>Esc</Kbd>
                    <span>Close</span>
                  </div>
                </>
              ) : (
                <div className="ms-auto flex items-center gap-2">
                  <Kbd>Esc</Kbd>
                  <span>Close</span>
                </div>
              )}
            </CommandFooter>
          </Command>
        ) : (
          <div className="relative z-10 flex h-[min(720px,calc(100vh-64px))] min-h-0 flex-col overflow-hidden rounded-[inherit] bg-background">
            <div className="flex shrink-0 items-center gap-2 border-border border-b px-3 py-2">
              <Button onClick={reset} size="sm" variant="ghost">
                <ArrowLeftIcon />
                Back
              </Button>
              <div className="min-w-0 flex-1 truncate text-muted-foreground text-sm">
                Assets
              </div>
            </div>
            <AssetSearchPanel
              onAddAsset={addAsset}
              onAdded={() => {
                setOpen(false);
                reset();
              }}
            />
          </div>
        )}
      </CommandDialogPopup>
    </CommandDialog>
  );
};
