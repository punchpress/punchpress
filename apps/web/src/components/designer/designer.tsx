import { cn } from "@/lib/utils";

export const Designer = ({ children, className, ...props }) => {
  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden bg-[var(--designer-bg)] text-foreground",
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

export const DesignerPanel = ({
  children,
  className,
  side = "left",
  style,
  ...props
}) => {
  return (
    <aside
      className={cn(
        "absolute z-10 hidden md:block md:w-[240px] lg:w-[280px]",
        side === "left" ? "left-4" : "right-4",
        className
      )}
      style={{
        maxHeight:
          "calc(100% - var(--desktop-chrome-height, 0px) - var(--desktop-panel-top-gap, 16px) - 16px)",
        top: "calc(var(--desktop-chrome-height, 0px) + var(--desktop-panel-top-gap, 16px))",
        ...style,
      }}
      {...props}
    >
      {children}
    </aside>
  );
};

export const DesignerPane = ({ children, className, ...props }) => {
  return (
    <section
      className={cn(
        "flex min-h-0 flex-col rounded-xl border border-[var(--designer-border)] bg-[var(--designer-surface)]",
        "shadow-[0_1px_3px_rgba(0,0,0,0.04),0_8px_24px_rgba(0,0,0,0.06)]",
        className
      )}
      {...props}
    >
      {children}
    </section>
  );
};

export const DesignerPaneHeader = ({ children, className, ...props }) => {
  return (
    <div className={cn("px-3.5 pt-3.5", className)} {...props}>
      {children}
    </div>
  );
};

export const DesignerPaneTitle = ({ children, className, ...props }) => {
  return (
    <h2
      className={cn(
        "m-0 font-semibold text-[13px] text-foreground tracking-[-0.01em]",
        className
      )}
      {...props}
    >
      {children}
    </h2>
  );
};

export const DesignerPaneDescription = ({ children, className, ...props }) => {
  return (
    <p className={cn("hidden", className)} {...props}>
      {children}
    </p>
  );
};

export const DesignerPaneBody = ({ children, className, ...props }) => {
  return (
    <div
      className={cn("flex min-h-0 flex-1 flex-col p-3.5", className)}
      {...props}
    >
      {children}
    </div>
  );
};

export const DesignerCanvas = ({ children, className, style, ...props }) => {
  return (
    <section
      className={cn("absolute right-0 bottom-0 left-0", className)}
      style={{
        top: "var(--desktop-chrome-height, 0px)",
        ...style,
      }}
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
      className={cn("absolute top-0 right-0 z-20", className)}
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
