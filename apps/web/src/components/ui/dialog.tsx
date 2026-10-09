"use client";

import { Dialog as BaseDialogPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { createContext, useContext, useEffect, useMemo, useRef } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const DialogPrimitive = BaseDialogPrimitive;

const DialogCreateHandle = BaseDialogPrimitive.createHandle;

const DialogContext = createContext({
  close: () => {
    // Default no-op for consumers rendered outside Dialog.
  },
  disablePointerDismissal: false,
});

const Dialog = ({
  actionsRef,
  children,
  disablePointerDismissal,
  onOpenChange,
  open,
  ...props
}) => {
  const internalActionsRef = useRef(null);
  const contextValue = useMemo(
    () => ({
      close: () => {
        if (open !== undefined) {
          onOpenChange?.(false);
          return;
        }

        internalActionsRef.current?.close();
      },
      disablePointerDismissal: disablePointerDismissal ?? false,
    }),
    [disablePointerDismissal, onOpenChange, open]
  );

  useEffect(() => {
    if (!actionsRef) {
      return;
    }

    actionsRef.current = internalActionsRef.current;

    return () => {
      actionsRef.current = null;
    };
  }, [actionsRef]);

  return (
    <DialogContext.Provider value={contextValue}>
      <BaseDialogPrimitive.Root
        actionsRef={internalActionsRef}
        disablePointerDismissal={disablePointerDismissal}
        onOpenChange={onOpenChange}
        open={open}
        {...props}
      >
        {children}
      </BaseDialogPrimitive.Root>
    </DialogContext.Provider>
  );
};

const DialogPortal = BaseDialogPrimitive.Portal;

function DialogTrigger(props) {
  return <BaseDialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogClose(props) {
  return <BaseDialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogBackdrop({ className, onPointerDown, ...props }) {
  const { close, disablePointerDismissal } = useContext(DialogContext);

  return (
    <BaseDialogPrimitive.Backdrop
      className={cn(
        "fixed inset-0 z-50 bg-black/32 backdrop-blur-sm transition-all duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0",
        className
      )}
      data-slot="dialog-backdrop"
      onPointerDown={(event) => {
        onPointerDown?.(event);

        if (
          event.defaultPrevented ||
          disablePointerDismissal ||
          event.target !== event.currentTarget
        ) {
          return;
        }

        event.preventDefault();
        close();
      }}
      {...props}
    />
  );
}

function DialogViewport({ className, ...props }) {
  return (
    <BaseDialogPrimitive.Viewport
      className={cn(
        "pointer-events-none fixed inset-0 z-50 grid grid-rows-[1fr_auto_3fr] justify-items-center p-4",
        className
      )}
      data-slot="dialog-viewport"
      {...props}
    />
  );
}

function DialogPopup({
  blockOutsidePointerEvents = false,
  className,
  children,
  showCloseButton = true,
  bottomStickOnMobile = true,
  closeProps,
  onClick,
  onMouseDown,
  onPointerDown,
  ...props
}) {
  return (
    <DialogPortal>
      <DialogBackdrop />
      <DialogViewport
        className={cn(
          bottomStickOnMobile &&
            "max-sm:grid-rows-[1fr_auto] max-sm:p-0 max-sm:pt-12"
        )}
      >
        {blockOutsidePointerEvents ? (
          <div
            aria-hidden="true"
            className="pointer-events-auto absolute inset-0"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
            }}
          />
        ) : null}
        <BaseDialogPrimitive.Popup
          className={cn(
            "text-(length:--chrome-text) pointer-events-auto relative row-start-2 flex max-h-full min-h-0 w-full min-w-0 max-w-md origin-center flex-col rounded-(--dialog-radius) border bg-popover not-dark:bg-clip-padding text-popover-foreground opacity-[calc(1-var(--nested-dialogs))] shadow-lg/5 transition-[scale,opacity,translate] duration-200 ease-in-out will-change-transform before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--dialog-radius)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] data-ending-style:opacity-0 data-starting-style:opacity-0 sm:scale-[calc(1-0.1*var(--nested-dialogs))] sm:data-ending-style:scale-98 sm:data-starting-style:scale-98 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
            bottomStickOnMobile &&
              "max-sm:max-w-none max-sm:origin-bottom max-sm:rounded-none max-sm:border-x-0 max-sm:border-t max-sm:border-b-0 max-sm:data-ending-style:translate-y-4 max-sm:data-starting-style:translate-y-4 max-sm:before:hidden max-sm:before:rounded-none",
            className
          )}
          data-slot="dialog-popup"
          onClick={(event) => {
            event.stopPropagation();
            onClick?.(event);
          }}
          onMouseDown={(event) => {
            event.stopPropagation();
            onMouseDown?.(event);
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
            onPointerDown?.(event);
          }}
          {...props}
        >
          {children}
          {showCloseButton && (
            <BaseDialogPrimitive.Close
              aria-label="Close"
              className="absolute end-[calc(var(--dialog-pad)/2)] top-[calc(var(--dialog-pad)/2)] text-muted-foreground"
              render={<Button size="icon-chrome" variant="ghost" />}
              {...closeProps}
            >
              <XIcon />
            </BaseDialogPrimitive.Close>
          )}
        </BaseDialogPrimitive.Popup>
      </DialogViewport>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 p-(--dialog-pad) in-[[data-slot=dialog-popup]:has([data-slot=dialog-panel])]:pb-[calc(var(--dialog-pad)/2)]",
        className
      )}
      data-slot="dialog-header"
      {...props}
    />
  );
}

function DialogFooter({ className, variant = "default", ...props }) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 px-(--dialog-pad) sm:flex-row sm:justify-end sm:rounded-b-[calc(var(--dialog-radius)-1px)]",
        variant === "default" &&
          "border-t bg-muted/72 py-[calc(var(--dialog-pad)*0.75)]",
        variant === "bare" &&
          "in-[[data-slot=dialog-popup]:has([data-slot=dialog-panel])]:pt-[calc(var(--dialog-pad)/2)] pt-(--dialog-pad) pb-(--dialog-pad)",
        className
      )}
      data-slot="dialog-footer"
      {...props}
    />
  );
}

function DialogTitle({ className, ...props }) {
  return (
    <BaseDialogPrimitive.Title
      className={cn(
        "text-(length:--dialog-title-text) font-heading font-semibold leading-snug",
        className
      )}
      data-slot="dialog-title"
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }) {
  return (
    <BaseDialogPrimitive.Description
      className={cn(
        "text-(length:--chrome-text) text-muted-foreground leading-normal",
        className
      )}
      data-slot="dialog-description"
      {...props}
    />
  );
}

function DialogPanel({ className, scrollFade = true, ...props }) {
  return (
    <ScrollArea scrollFade={scrollFade}>
      <div
        className={cn(
          "p-(--dialog-pad) in-[[data-slot=dialog-popup]:has([data-slot=dialog-header])]:pt-1 in-[[data-slot=dialog-popup]:has([data-slot=dialog-footer]:not(.border-t))]:pb-1",
          className
        )}
        data-slot="dialog-panel"
        {...props}
      />
    </ScrollArea>
  );
}

export {
  Dialog,
  DialogBackdrop,
  DialogBackdrop as DialogOverlay,
  DialogClose,
  DialogCreateHandle,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogPopup as DialogContent,
  DialogPortal,
  DialogPrimitive,
  DialogTitle,
  DialogTrigger,
  DialogViewport,
};
