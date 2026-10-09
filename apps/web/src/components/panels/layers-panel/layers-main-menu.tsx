import {
  ChevronDownIcon,
  DownloadIcon,
  FileInputIcon,
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
      <MenuPopup align="start" sideOffset={12}>
        <MenuGroup>
          <MenuItem
            onClick={() => {
              runDocumentCommandSafely("new");
            }}
          >
            <FilePlus2Icon />
            New
            <MenuShortcut>⌘N</MenuShortcut>
          </MenuItem>
          <MenuItem
            onClick={() => {
              runDocumentCommandSafely("open");
            }}
          >
            <FolderOpenIcon />
            Open
            <MenuShortcut>⌘O</MenuShortcut>
          </MenuItem>
          <MenuItem
            onClick={() => {
              runDocumentCommandSafely("import-svg");
            }}
          >
            <FileInputIcon />
            Import SVG...
          </MenuItem>
          {children}
          <MenuItem
            onClick={() => {
              runDocumentCommandSafely("save");
            }}
          >
            <SaveIcon />
            Save
            <MenuShortcut>⌘S</MenuShortcut>
          </MenuItem>
          <MenuItem
            onClick={() => {
              runDocumentCommandSafely("save-as");
            }}
          >
            <SaveIcon />
            Save As...
            <MenuShortcut>⇧⌘S</MenuShortcut>
          </MenuItem>
          <MenuItem
            onClick={() => {
              runDocumentCommandSafely("export");
            }}
          >
            <DownloadIcon />
            Export
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
