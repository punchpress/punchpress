import { cn } from "@/lib/utils";

export const Designer = ({ children, className, ...props }) => {
  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden bg-(--shell-bg) text-foreground",
        "[--designer-bg:var(--background)] [--designer-surface:var(--card)]",
        "[--designer-border:var(--border)]",
        "[--designer-border-strong:var(--input)]",
        "[--designer-hover:var(--surface-hover)]",
        "[--designer-text-muted:var(--muted-foreground)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const DesignerHeader = ({ children, className, ...props }) => {
  return (
    <header className={cn("hidden", className)} {...props}>
      {children}
    </header>
  );
};

export const DesignerHeaderGroup = ({ children, className, ...props }) => {
  return (
    <div
      className={cn("flex items-center justify-between gap-3", className)}
      {...props}
    >
      {children}
    </div>
  );
};

export const DesignerHeaderEyebrow = ({ children, className, ...props }) => {
  return (
    <p
      className={cn(
        "m-0 font-semibold text-[11px] text-[var(--designer-text-muted)] uppercase tracking-[0.04em]",
        className
      )}
      {...props}
    >
      {children}
    </p>
  );
};

export const DesignerHeaderTitle = ({ children, className, ...props }) => {
  return (
    <h1
      className={cn(
        "m-0 font-semibold text-foreground text-lg tracking-[-0.01em]",
        className
      )}
      {...props}
    >
      {children}
    </h1>
  );
};

export const DesignerHeaderMeta = ({ children, className, ...props }) => {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
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

// A Layers or Properties sidebar slot. Its placement, size, and the column
// behind it come from the pane container tokens in styles/panel-container.css.
export const DesignerPanel = ({
  children,
  className,
  side = "left",
  ...props
}) => {
  return (
    <aside
      className={cn(
        "absolute top-(--pane-top) z-30 hidden h-(--pane-height) max-h-[calc(100%-var(--pane-top)-var(--pane-bottom))] bg-(--dock-bg) md:flex md:w-(--pane-width) md:flex-col",
        "border-t-(length:--dock-divider-width) border-(--dock-divider)",
        side === "left"
          ? "border-e-(length:--dock-divider-width) left-(--pane-inset)"
          : "border-s-(length:--dock-divider-width) right-(--pane-inset)",
        className
      )}
      data-side={side}
      {...props}
    >
      {children}
    </aside>
  );
};

// The pane card inside a sidebar slot: floating card, flat card, or a
// full-height docked surface, by container tokens.
export const DesignerPane = ({ children, className, ...props }) => {
  return (
    <section
      className={cn(
        "border-(length:--pane-border-width) flex min-h-0 grow-(--pane-grow) flex-col overflow-hidden rounded-(--pane-radius) border-(--pane-border) bg-(--pane-surface) shadow-(--pane-shadow)",
        className
      )}
      {...props}
    >
      {children}
    </section>
  );
};

// The canvas viewport. Container directions only move its edges (and may
// round it), so the camera keeps its coordinates and only the visible
// viewport size changes.
export const DesignerCanvas = ({ children, className, ...props }) => {
  return (
    <section
      className={cn(
        "border-t-(length:--canvas-border-top) absolute top-(--canvas-inset-top) right-(--canvas-inset-side) bottom-(--canvas-inset-bottom) left-(--canvas-inset-side) overflow-hidden rounded-(--canvas-radius) border-(--dock-divider) shadow-(--canvas-ring)",
        className
      )}
      data-designer-canvas=""
      {...props}
    >
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

export const DesignerWindowDragRegion = ({
  children,
  className,
  style,
  ...props
}) => {
  return (
    <div
      aria-hidden={children ? undefined : true}
      className={cn(
        "pointer-events-none absolute top-0 right-0 z-20",
        className
      )}
      style={{
        WebkitAppRegion: "drag",
        height: "var(--desktop-chrome-height, 0px)",
        left: "var(--desktop-drag-left-inset, 0px)",
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};
