import {
  CircleIcon,
  SquareIcon,
  StarIcon,
} from "@hugeicons-pro/core-stroke-rounded";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChevronUpIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Menu, MenuItem, MenuPopup, MenuShortcut } from "@/components/ui/menu";
import { cn } from "@/lib/utils";
import { useEditor } from "../../editor-react/use-editor";
import { useEditorValue } from "../../editor-react/use-editor-value";

const SHAPE_OPTIONS = [
  {
    icon: SquareIcon,
    iconSize: 18,
    key: "polygon",
    label: "Rectangle",
    shortcut: "R",
  },
  {
    icon: CircleIcon,
    iconSize: 18,
    key: "ellipse",
    label: "Ellipse",
    shortcut: "O",
  },
  { icon: StarIcon, iconSize: 18, key: "star", label: "Star", shortcut: "S" },
];

export const ShapeToolbarButton = () => {
  const editor = useEditor();
  const activeTool = useEditorValue((_, state) => state.activeTool);
  const nextShapeKind = useEditorValue((_, state) => state.nextShapeKind);
  const isActive = activeTool === "shape";
  const [open, setOpen] = useState(false);
  const closeTimeout = useRef<ReturnType<typeof setTimeout>>(null);
  const anchorRef = useRef<HTMLDivElement>(null);

  const activeOption =
    SHAPE_OPTIONS.find((o) => o.key === nextShapeKind) ?? SHAPE_OPTIONS[0];

  const handleEnter = () => {
    if (closeTimeout.current) {
      clearTimeout(closeTimeout.current);
      closeTimeout.current = null;
    }
    setOpen(true);
  };

  const handleLeave = () => {
    closeTimeout.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <Menu
      modal={false}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setOpen(false);
      }}
      open={open}
    >
      <div
        className={cn(
          "relative inline-flex h-9 shrink-0 cursor-pointer select-none items-center rounded-lg border border-transparent text-foreground outline-none transition-[border-color,background-color] hover:bg-accent sm:h-8",
          isActive && "bg-input/64 text-accent-foreground"
        )}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        ref={anchorRef}
      >
        <button
          aria-label={`${activeOption.label} (${activeOption.shortcut})`}
          className="inline-flex h-full items-center justify-center pl-2 pr-0.5 outline-none"
          onClick={() => editor.setActiveTool("shape")}
          title={`${activeOption.label} (${activeOption.shortcut})`}
          type="button"
        >
          <HugeiconsIcon
            className="opacity-80"
            color="currentColor"
            icon={activeOption.icon}
            size={activeOption.iconSize ?? 20}
            strokeWidth={1.6}
          />
        </button>
        <div className="inline-flex h-full items-center justify-center pr-1.5 pl-0.5">
          <ChevronUpIcon className="size-3 opacity-60" />
        </div>
      </div>

      <MenuPopup
        align="center"
        anchor={anchorRef}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        side="top"
        sideOffset={8}
      >
        {SHAPE_OPTIONS.map((option) => (
          <MenuItem
            key={option.key}
            onClick={() => {
              editor.setNextShapeKind(option.key);
              editor.setActiveTool("shape");
              setOpen(false);
            }}
          >
            <HugeiconsIcon
              color="currentColor"
              icon={option.icon}
              size={option.iconSize ? option.iconSize * 0.8 : 16}
              strokeWidth={1.6}
            />
            {option.label}
            <MenuShortcut>{option.shortcut}</MenuShortcut>
          </MenuItem>
        ))}
      </MenuPopup>
    </Menu>
  );
};
