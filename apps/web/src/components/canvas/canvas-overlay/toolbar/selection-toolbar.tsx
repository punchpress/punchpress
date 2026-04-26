import { HugeiconsIcon } from "@hugeicons/react";
import { Fragment, memo } from "react";
import { Button } from "@/components/ui/button";
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/ui/toolbar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useEditor } from "../../../../editor-react/use-editor";
import { resolveSelectionToolbarActions } from "./actions";
import { useSelectionToolbarPresence } from "./use-toolbar-presence";
import { useSelectionToolbarState } from "./use-toolbar-state";

const getSelectionToolbarStyle = (editor) => {
  const host = editor.hostRef;
  const bottomToolbar = host?.querySelector(".canvas-bottom-toolbar");

  if (!host) {
    return null;
  }

  const hostRect = host.getBoundingClientRect();
  const anchorRect =
    bottomToolbar instanceof HTMLElement
      ? bottomToolbar.getBoundingClientRect()
      : null;

  if (!anchorRect) {
    return null;
  }

  return {
    left: `${anchorRect.left - hostRect.left + anchorRect.width / 2}px`,
    top: `${Math.max(16, anchorRect.top - hostRect.top - 12)}px`,
    transform: "translate(-50%, -100%)",
  };
};

export const getRenderedSelectionToolbarActions = (actions, presenceState) => {
  if (actions.length > 0) {
    return actions;
  }

  return presenceState?.actions || [];
};

export const CanvasSelectionToolbar = memo(function CanvasSelectionToolbar() {
  const editor = useEditor();
  const toolbarState = useSelectionToolbarState();
  const actions = resolveSelectionToolbarActions(editor, toolbarState);
  const presenceKey = `${toolbarState?.selectionKey || "hidden"}:${actions
    .map((action) => {
      return `${action.id}:${action.variant}:${action.isActive ? "active" : "idle"}`;
    })
    .join(",")}`;
  const presenceState = useSelectionToolbarPresence(actions, presenceKey);
  const renderedActions = getRenderedSelectionToolbarActions(
    actions,
    presenceState
  );
  const style = getSelectionToolbarStyle(editor);

  if (!(presenceState && style && renderedActions.length > 0)) {
    return null;
  }

  return (
    <div
      className="canvas-selection-toolbar pointer-events-none absolute z-30"
      data-phase={presenceState.phase}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      style={style}
    >
      <div
        className="canvas-selection-toolbar-shell"
        data-phase={presenceState.phase}
      >
        <Toolbar
          className={
            presenceState.phase === "closing"
              ? "pointer-events-none"
              : "pointer-events-auto"
          }
        >
          <ToolbarGroup>
            {renderedActions.map((action, index) => {
              return (
                <Fragment key={action.id}>
                  {index > 0 ? (
                    <ToolbarSeparator orientation="vertical" />
                  ) : null}
                  <SelectionToolbarActionButton action={action} />
                </Fragment>
              );
            })}
          </ToolbarGroup>
        </Toolbar>
      </div>
    </div>
  );
});

const SelectionToolbarActionButton = ({ action }) => {
  const button = (
    <Button
      aria-label={action.title}
      className={
        action.isIconOnly ? undefined : "font-normal text-foreground/84"
      }
      data-active={action.isActive ? "true" : "false"}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        action.onSelect();
      }}
      size={action.isIconOnly ? "icon-sm" : "sm"}
      title={action.title}
      variant={action.variant}
    >
      {action.icon && action.iconLibrary === "hugeicons" ? (
        <HugeiconsIcon
          color="currentColor"
          icon={action.icon}
          size={18}
          strokeWidth={1.6}
        />
      ) : (
        action.label
      )}
      {!action.isIconOnly && action.shortcutLabel ? (
        <span className="rounded bg-foreground/8 px-1.5 py-0.5 text-[11px] text-foreground/50 leading-none">
          {action.shortcutLabel}
        </span>
      ) : null}
    </Button>
  );

  if (!action.isIconOnly) {
    return button;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent>{action.title}</TooltipContent>
    </Tooltip>
  );
};
