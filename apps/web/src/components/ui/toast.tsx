"use client";

import { Toast as BaseToast } from "@base-ui/react/toast";
import {
  Alert01Icon,
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Loading03Icon,
} from "@hugeicons-pro/core-stroke-rounded";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReactElement, ReactNode } from "react";

import { cn } from "@/lib/utils";

import { buttonVariants } from "./button";

const TOAST_ICONS = {
  error: AlertCircleIcon,
  info: InformationCircleIcon,
  loading: Loading03Icon,
  success: CheckmarkCircle02Icon,
  warning: Alert01Icon,
} as const;

export const toastManager = BaseToast.createToastManager();

export type ToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

type ToastProviderProps = BaseToast.Provider.Props & {
  position?: ToastPosition;
};

interface ShowToastOptions {
  message: ReactNode;
  priority?: "high" | "low";
  timeout?: number;
  type?: keyof typeof TOAST_ICONS;
}

export const showToast = ({ message, ...options }: ShowToastOptions) => {
  return toastManager.add({
    priority: options.priority,
    timeout: options.timeout ?? 4000,
    title: message,
    type: options.type,
  });
};

export const ToastProvider = ({
  children,
  position = "bottom-right",
  ...props
}: ToastProviderProps): ReactElement => {
  return (
    <BaseToast.Provider toastManager={toastManager} {...props}>
      {children}
      <Toasts position={position} />
    </BaseToast.Provider>
  );
};

const Toasts = ({ position }: { position: ToastPosition }): ReactElement => {
  const { toasts } = BaseToast.useToastManager();

  return (
    <BaseToast.Portal data-slot="toast-portal">
      <BaseToast.Viewport
        className={cn(
          "fixed z-60 mx-auto flex w-[calc(100%-var(--toast-inset)*2)] max-w-90 [--toast-inset:--spacing(4)] sm:[--toast-inset:--spacing(8)]",
          "data-[position*=top]:top-(--toast-inset)",
          "data-[position*=bottom]:bottom-(--toast-inset)",
          "data-[position*=left]:left-(--toast-inset)",
          "data-[position*=right]:right-(--toast-inset)",
          "data-[position*=center]:left-1/2 data-[position*=center]:-translate-x-1/2"
        )}
        data-position={position}
        data-slot="toast-viewport"
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} position={position} toast={toast} />
        ))}
      </BaseToast.Viewport>
    </BaseToast.Portal>
  );
};

const ToastCard = ({
  position,
  toast,
}: {
  position: ToastPosition;
  toast: ReturnType<typeof BaseToast.useToastManager>["toasts"][number];
}): ReactElement => {
  const Icon = toast.type
    ? TOAST_ICONS[toast.type as keyof typeof TOAST_ICONS]
    : null;
  const message = toast.title || toast.description || null;

  return (
    <BaseToast.Root
      className={cn(
        "absolute z-[calc(9999-var(--toast-index))] h-(--toast-calc-height) w-full select-none rounded-lg border bg-popover not-dark:bg-clip-padding text-popover-foreground shadow-lg/5 [transition:transform_.5s_cubic-bezier(.22,1,.36,1),opacity_.5s,height_.15s] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
        "data-[position*=right]:right-0 data-[position*=right]:left-auto",
        "data-[position*=left]:right-auto data-[position*=left]:left-0",
        "data-[position*=center]:right-0 data-[position*=center]:left-0",
        "data-[position*=top]:top-0 data-[position*=top]:bottom-auto data-[position*=top]:origin-top",
        "data-[position*=bottom]:top-auto data-[position*=bottom]:bottom-0 data-[position*=bottom]:origin-bottom",
        "after:absolute after:left-0 after:h-[calc(var(--toast-gap)+1px)] after:w-full",
        "data-[position*=top]:after:top-full",
        "data-[position*=bottom]:after:bottom-full",
        "[--toast-calc-height:var(--toast-frontmost-height,var(--toast-height))] [--toast-gap:--spacing(3)] [--toast-peek:--spacing(3)] [--toast-scale:calc(max(0,1-(var(--toast-index)*.1)))] [--toast-shrink:calc(1-var(--toast-scale))]",
        "data-[position*=top]:[--toast-calc-offset-y:calc(var(--toast-offset-y)+var(--toast-index)*var(--toast-gap)+var(--toast-swipe-movement-y))]",
        "data-[position*=bottom]:[--toast-calc-offset-y:calc(var(--toast-offset-y)*-1+var(--toast-index)*var(--toast-gap)*-1+var(--toast-swipe-movement-y))]",
        "data-[position*=top]:transform-[translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)+(var(--toast-index)*var(--toast-peek))+(var(--toast-shrink)*var(--toast-calc-height))))_scale(var(--toast-scale))]",
        "data-[position*=bottom]:transform-[translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--toast-peek))-(var(--toast-shrink)*var(--toast-calc-height))))_scale(var(--toast-scale))]",
        "data-limited:opacity-0",
        "data-expanded:h-(--toast-height)",
        "data-position:data-expanded:transform-[translateX(var(--toast-swipe-movement-x))_translateY(var(--toast-calc-offset-y))]",
        "data-[position*=top]:data-starting-style:transform-[translateY(calc(-100%-var(--toast-inset)))]",
        "data-[position*=bottom]:data-starting-style:transform-[translateY(calc(100%+var(--toast-inset)))]",
        "data-ending-style:opacity-0",
        "data-ending-style:not-data-limited:not-data-swipe-direction:transform-[translateY(calc(100%+var(--toast-inset)))]",
        "data-ending-style:data-[swipe-direction=left]:transform-[translateX(calc(var(--toast-swipe-movement-x)-100%-var(--toast-inset)))_translateY(var(--toast-calc-offset-y))]",
        "data-ending-style:data-[swipe-direction=right]:transform-[translateX(calc(var(--toast-swipe-movement-x)+100%+var(--toast-inset)))_translateY(var(--toast-calc-offset-y))]",
        "data-ending-style:data-[swipe-direction=up]:transform-[translateY(calc(var(--toast-swipe-movement-y)-100%-var(--toast-inset)))]",
        "data-ending-style:data-[swipe-direction=down]:transform-[translateY(calc(var(--toast-swipe-movement-y)+100%+var(--toast-inset)))]",
        "data-expanded:data-ending-style:data-[swipe-direction=left]:transform-[translateX(calc(var(--toast-swipe-movement-x)-100%-var(--toast-inset)))_translateY(var(--toast-calc-offset-y))]",
        "data-expanded:data-ending-style:data-[swipe-direction=right]:transform-[translateX(calc(var(--toast-swipe-movement-x)+100%+var(--toast-inset)))_translateY(var(--toast-calc-offset-y))]",
        "data-expanded:data-ending-style:data-[swipe-direction=up]:transform-[translateY(calc(var(--toast-swipe-movement-y)-100%-var(--toast-inset)))]",
        "data-expanded:data-ending-style:data-[swipe-direction=down]:transform-[translateY(calc(var(--toast-swipe-movement-y)+100%+var(--toast-inset)))]"
      )}
      data-position={position}
      swipeDirection={getToastSwipeDirection(position)}
      toast={toast}
    >
      <BaseToast.Content className="pointer-events-auto flex items-center justify-between gap-1.5 overflow-hidden px-3.5 py-3 text-sm transition-opacity duration-250 data-behind:not-data-expanded:pointer-events-none data-behind:opacity-0 data-expanded:opacity-100">
        <div className="flex gap-2">
          {Icon ? (
            <div
              className="[&>svg]:h-lh [&>svg]:w-4 [&_svg]:pointer-events-none [&_svg]:shrink-0"
              data-slot="toast-icon"
            >
              <HugeiconsIcon
                className={getToastIconClassName(toast.type)}
                color="currentColor"
                icon={Icon}
                size={16}
                strokeWidth={1.9}
              />
            </div>
          ) : null}

          <div
            className="truncate font-medium"
            data-slot="toast-message"
            title={typeof message === "string" ? message : undefined}
          >
            {message}
          </div>
        </div>

        {toast.actionProps ? (
          <BaseToast.Action
            className={buttonVariants({ size: "xs" })}
            data-slot="toast-action"
          >
            {toast.actionProps.children}
          </BaseToast.Action>
        ) : null}
      </BaseToast.Content>
    </BaseToast.Root>
  );
};

const getToastSwipeDirection = (position: ToastPosition) => {
  const verticalDirection = position.startsWith("top") ? "up" : "down";

  if (position.includes("center")) {
    return [verticalDirection];
  }

  if (position.includes("left")) {
    return ["left", verticalDirection];
  }

  return ["right", verticalDirection];
};

const getToastIconClassName = (type?: string) => {
  if (type === "error") {
    return "text-destructive";
  }

  if (type === "info") {
    return "text-info";
  }

  if (type === "success") {
    return "text-success";
  }

  if (type === "warning") {
    return "text-warning";
  }

  if (type === "loading") {
    return "animate-spin opacity-80";
  }

  return "";
};
