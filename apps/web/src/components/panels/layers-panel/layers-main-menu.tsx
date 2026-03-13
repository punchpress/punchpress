import {
  ChevronDownIcon,
  DownloadIcon,
  FilePlus2Icon,
  FolderOpenIcon,
  SaveIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Menu,
  MenuGroup,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuShortcut,
  MenuTrigger,
} from "@/components/ui/menu";

export const LayersMainMenu = ({
  children,
  onOpenSettings,
  runDocumentCommandSafely,
}) => {
  return (
    <Menu modal={false}>
      <Button
        aria-label="Open main menu"
        className="group h-11 rounded-xl px-0 hover:bg-transparent data-pressed:bg-transparent"
        render={<MenuTrigger />}
        style={{
          marginLeft: "var(--shell-logo-offset-x, 0px)",
        }}
        type="button"
        variant="ghost"
      >
        <span className="flex h-10 translate-x-px items-center gap-1.5 rounded-lg px-[9px] group-hover:bg-accent">
          <span className="flex size-5 items-center justify-center">
            <img
              alt=""
              aria-hidden="true"
              className="h-4.5 w-4.5"
              height="18"
              src="/logo.svg"
              width="18"
            />
          </span>
          <ChevronDownIcon className="size-4 opacity-80" strokeWidth={2.2} />
        </span>
      </Button>
      <MenuPopup
        align="start"
        className="min-w-[var(--menu-min-width)]"
        sideOffset={12}
      >
        <MenuGroup>
          <MenuItem
            onClick={() => {
              runDocumentCommandSafely("new");
            }}
          >
            <FilePlus2Icon size={15} />
            New
            <MenuShortcut>⌘N</MenuShortcut>
          </MenuItem>
          <MenuItem
            onClick={() => {
              runDocumentCommandSafely("open");
            }}
          >
            <FolderOpenIcon size={15} />
            Open
            <MenuShortcut>⌘O</MenuShortcut>
          </MenuItem>
          {children}
          <MenuItem
            onClick={() => {
              runDocumentCommandSafely("save");
            }}
          >
            <SaveIcon size={15} />
            Save
            <MenuShortcut>⌘S</MenuShortcut>
          </MenuItem>
          <MenuItem
            onClick={() => {
              runDocumentCommandSafely("save-as");
            }}
          >
            <SaveIcon size={15} />
            Save As...
            <MenuShortcut>⇧⌘S</MenuShortcut>
          </MenuItem>
          <MenuItem
            onClick={() => {
              runDocumentCommandSafely("export");
            }}
          >
            <DownloadIcon size={15} />
            Export SVG
            <MenuShortcut>⌘E</MenuShortcut>
          </MenuItem>
        </MenuGroup>
        <MenuSeparator />
        <MenuGroup>
          <MenuItem onClick={() => onOpenSettings(true)}>Settings</MenuItem>
        </MenuGroup>
      </MenuPopup>
    </Menu>
  );
};
