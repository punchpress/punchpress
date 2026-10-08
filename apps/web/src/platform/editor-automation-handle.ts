// `window.__PUNCHPRESS_EDITOR__` is the automation handle Playwright and the
// performance runner drive. It exists in dev and in production perf builds
// (`VITE_PUNCHPRESS_PERF_BUILD=1`), never in shipped builds.
export const exposesEditorAutomationHandle =
  import.meta.env.DEV || import.meta.env.VITE_PUNCHPRESS_PERF_BUILD === "1";
