import { HugeiconsIcon } from "@hugeicons/react";
import {
  CircleIcon,
  SquareIcon,
  StarIcon,
} from "@hugeicons-pro/core-stroke-rounded";
import { ChevronUpIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Menu, MenuItem, MenuPopup, MenuShortcut } from "@/components/ui/menu";
import { Toggle } from "@/components/ui/toggle";
import { ToolbarButton } from "@/components/ui/toolbar";
import { useEditor } from "../../editor-react/use-editor";
import { useEditorValue } from "../../editor-react/use-editor-value";

const SHAPE_OPTIONS = [
  {
    icon: SquareIcon,
    key: "polygon",
    label: "Rectangle",
    shortcut: "R",
  },
  {
    icon: CircleIcon,
    key: "ellipse",
    label: "Ellipse",
    shortcut: "O",
  },
  { icon: StarIcon, key: "star", label: "Star", shortcut: "S" },
];

export const ShapeToolbarButton = () => {
  const editor = useEditor();
  const activeTool = useEditorValue((_, state) => state.activeTool);
  const nextShapeKind = useEditorValue((_, state) => state.nextShapeKind);
  const isActive = activeTool === "shape";
  const [open, setOpen] = useState(false);
  const closeTimeout = useRef<ReturnType<typeof setTimeout>>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);

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
        if (!nextOpen) {
          setOpen(false);
        }
      }}
      open={open}
    >
      <ToolbarButton
        aria-label={`${activeOption.label} (${activeOption.shortcut})`}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        ref={anchorRef}
        render={
          <Toggle
            onPressedChange={(pressed) => {
              if (pressed) {
                editor.setActiveTool("shape");
              }
            }}
            pressed={isActive}
            size="icon-toolbar"
          />
        }
        title={`${activeOption.label} (${activeOption.shortcut})`}
      >
        <HugeiconsIcon
          color="currentColor"
          icon={activeOption.icon}
          strokeWidth={1.6}
        />
        {/* Corner flyout mark; right-1 absorbs the toggle's -mx-0.5 svg margin. */}
        <ChevronUpIcon className="absolute right-1 bottom-0.5 size-2 opacity-60" />
      </ToolbarButton>

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
