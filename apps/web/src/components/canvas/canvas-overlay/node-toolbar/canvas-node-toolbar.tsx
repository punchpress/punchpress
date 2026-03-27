import { Fragment, memo } from "react";
import { Button } from "@/components/ui/button";
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/ui/toolbar";
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
  const style = getNodeToolbarStyle(editor);

  if (!(presenceState && style)) {
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
            {presenceState.actions.map((action, index) => {
              return (
                <Fragment key={action.id}>
                  {index > 0 ? (
                    <ToolbarSeparator orientation="vertical" />
                  ) : null}
                  <Button
                    aria-label={action.title}
                    data-active={action.isActive ? "true" : "false"}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      action.onSelect();
                    }}
                    size="sm"
                    title={action.title}
                    variant={action.variant}
                  >
                    {action.label}
                    {action.shortcutLabel ? (
                      <span className="rounded bg-foreground/8 px-1.5 py-0.5 text-[11px] text-foreground/50 leading-none">
                        {action.shortcutLabel}
                      </span>
                    ) : null}
                  </Button>
                </Fragment>
              );
            })}
          </ToolbarGroup>
        </Toolbar>
      </div>
    </div>
  );
});
