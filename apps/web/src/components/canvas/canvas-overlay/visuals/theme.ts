export const CANVAS_THEME_VARS = {
  anchorSelectedWidth: "--canvas-anchor-selected-width",
  anchorWidth: "--canvas-anchor-width",
  handleLineWidth: "--canvas-handle-line-width",
  indicatorWidth: "--canvas-indicator-width",
  selected: "--canvas-selected",
  selectedStrong: "--canvas-selected-strong",
  surface: "--canvas-surface",
  warning: "--canvas-warning",
  warningSoft: "--canvas-warning-soft",
  warningStrong: "--canvas-warning-strong",
} as const;

export const resolveCanvasThemeColor = (
  element: HTMLElement,
  token: string,
  fallback: string
) => {
  return resolveCanvasThemeCssProperty(
    element,
    "color",
    getCanvasThemeVar(token),
    fallback
  );
};

export const resolveCanvasThemeLengthPx = (
  element: HTMLElement,
  token: string,
  fallback: number
) => {
  const resolved = resolveCanvasThemeCssProperty(
    element,
    "border-top-width",
    getCanvasThemeVar(token),
    `${fallback}px`
  );
  const parsed = Number.parseFloat(resolved);

  return Number.isFinite(parsed) ? parsed : fallback;
};

const resolveCanvasThemeCssProperty = (
  element: HTMLElement,
  property: string,
  value: string,
  fallback: string
) => {
  const documentRoot = element.ownerDocument;
  const host =
    documentRoot?.body ||
    documentRoot?.documentElement ||
    element.parentElement;
  const probe = documentRoot?.createElement("div");

  if (!(host && probe)) {
    return fallback;
  }

  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.setProperty(property, value);
  host.appendChild(probe);

  const resolved =
    documentRoot.defaultView
      ?.getComputedStyle(probe)
      .getPropertyValue(property)
      .trim() || fallback;

  probe.remove();
  return resolved;
};

const getCanvasThemeVar = (token: string) => `var(${token})`;
