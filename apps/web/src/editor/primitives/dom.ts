export const isInputElement = (target) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tag = target.tagName;
  return (
    target.isContentEditable ||
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT"
  );
};

const GLOBAL_SHORTCUT_BLOCKING_SELECTOR = [
  "[data-slot='dialog-backdrop']",
  "[data-slot='dialog-popup']",
  "[data-slot='menu-popup']",
  "[data-slot='menu-positioner']",
].join(",");

const getElementFromTarget = (target) => {
  if (target instanceof Element) {
    return target;
  }

  if (target instanceof Node) {
    return target.parentElement;
  }

  return null;
};

export const shouldIgnoreGlobalShortcutTarget = (target) => {
  const element = getElementFromTarget(target);

  if (!element) {
    return false;
  }

  return (
    isInputElement(element) ||
    Boolean(element.closest(GLOBAL_SHORTCUT_BLOCKING_SELECTOR))
  );
};
