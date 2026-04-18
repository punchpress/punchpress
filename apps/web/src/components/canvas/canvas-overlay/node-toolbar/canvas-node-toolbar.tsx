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
import { resolveNodeToolbarActions } from "./node-toolbar-actions";
import { useNodeToolbarPresence } from "./use-node-toolbar-presence";
import { useNodeToolbarState } from "./use-node-toolbar-state";

const getNodeToolbarStyle = (editor) => {
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

export const getRenderedNodeToolbarActions = (actions, presenceState) => {
  if (actions.length > 0) {
    return actions;
  }

  return presenceState?.actions || [];
};

export const CanvasNodeToolbar = memo(function CanvasNodeToolbar() {
  const editor = useEditor();
  const toolbarState = useNodeToolbarState();
  const actions = resolveNodeToolbarActions(editor, toolbarState);
  const presenceKey = `${toolbarState?.selectionKey || "hidden"}:${actions
    .map((action) => {
      return `${action.id}:${action.variant}:${action.isActive ? "active" : "idle"}`;
    })
    .join(",")}`;
  const presenceState = useNodeToolbarPresence(actions, presenceKey);
  const renderedActions = getRenderedNodeToolbarActions(actions, presenceState);
  const style = getNodeToolbarStyle(editor);

  if (!(presenceState && style && renderedActions.length > 0)) {
    return null;
  }

  return (
    <div
      className="canvas-node-toolbar pointer-events-none absolute z-30"
      data-phase={presenceState.phase}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      style={style}
    >
      <div
        className="canvas-node-toolbar-shell"
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
                  <NodeToolbarActionButton action={action} />
                </Fragment>
              );
            })}
          </ToolbarGroup>
        </Toolbar>
      </div>
    </div>
  );
});

const NodeToolbarActionButton = ({ action }) => {
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
