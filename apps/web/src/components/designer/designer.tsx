import { cn } from "@/lib/utils";

export const Designer = ({ children, className, ...props }) => {
  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden bg-[var(--designer-bg)] text-foreground",
        "[--designer-bg:var(--background)]",
        "[--designer-border:var(--border)]",
        "[--designer-border-strong:var(--input)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const DesignerContent = ({ children, className, ...props }) => {
  return (
    <main className={cn("relative z-[1] h-full w-full", className)} {...props}>
      {children}
    </main>
  );
};

// A Layers or Properties pane slot, floating over the canvas. Placement and
// size come from the pane tokens in styles/panel-container.css.
export const DesignerPanel = ({
  children,
  className,
  side = "left",
  ...props
}) => {
  return (
    <aside
      className={cn(
        "absolute top-(--pane-top) z-30 hidden max-h-[calc(100%-var(--pane-top)-var(--pane-bottom))] md:flex md:w-(--pane-width) md:flex-col",
        side === "left" ? "left-(--pane-inset)" : "right-(--pane-inset)",
        className
      )}
      data-side={side}
      {...props}
    >
      {children}
    </aside>
  );
};

// The pane card inside a slot: a flat card with a hairline border.
export const DesignerPane = ({ children, className, ...props }) => {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-(--pane-radius) border border-(--pane-border) bg-(--pane-surface) shadow-(--pane-shadow)",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// The canvas fills the window; panes float over it.
export const DesignerCanvas = ({ children, className, ...props }) => {
  return (
    <section className={cn("absolute inset-0", className)} {...props}>
      {children}
    </section>
  );
};

export const DesignerFrame = ({ children, className, ...props }) => {
  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 flex-col overflow-hidden bg-transparent",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const DesignerFloatingToolbar = ({ children, className, ...props }) => {
  return (
    <div
      className={cn(
        "absolute bottom-4 left-1/2 z-[25] -translate-x-1/2",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// The title bar: a full-width strip on the title bar surface with a bottom
// hairline. Its content starts after the desktop traffic-light inset, and
// empty bar space drags the desktop window (controls opt out with `no-drag`).
export const DesignerTitleBar = ({ children, className, style, ...props }) => {
  return (
    <header
      className={cn(
        "absolute top-0 right-0 left-0 z-20 flex h-(--desktop-chrome-height) bg-(--titlebar-bg) pl-(--desktop-drag-left-inset) shadow-(--titlebar-shadow)",
        className
      )}
      data-titlebar=""
      style={{
        WebkitAppRegion: "drag",
        ...style,
      }}
      {...props}
    >
      {children}
    </header>
  );
};
