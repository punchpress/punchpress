import type { CDPSession, Page } from "@playwright/test";

const TRACE_CATEGORIES = [
  "blink",
  "blink.user_timing",
  "cc",
  "devtools.timeline",
  "disabled-by-default-devtools.timeline",
  "scheduler",
  "toplevel",
].join(",");

const readChromeTraceStream = async (
  cdpSession: CDPSession,
  stream: string
) => {
  let contents = "";

  while (true) {
    const chunk = await cdpSession.send("IO.read", { handle: stream });
    contents += chunk.base64Encoded
      ? Buffer.from(chunk.data, "base64").toString("utf8")
      : chunk.data;

    if (chunk.eof) {
      break;
    }
  }

  await cdpSession.send("IO.close", { handle: stream });

  return contents;
};

export const startChromeTraceCapture = async (page: Page) => {
  const cdpSession = await page.context().newCDPSession(page);

  await cdpSession.send("Tracing.start", {
    categories: TRACE_CATEGORIES,
    streamFormat: "json",
    transferMode: "ReturnAsStream",
  });

  return {
    stop: async () => {
      const traceCompletePromise = new Promise<{ stream: string }>(
        (resolve) => {
          cdpSession.once("Tracing.tracingComplete", resolve);
        }
      );

      await cdpSession.send("Tracing.end");
      const tracingComplete = await traceCompletePromise;
      const traceContents = await readChromeTraceStream(
        cdpSession,
        tracingComplete.stream
      );
      await cdpSession.detach();

      return traceContents;
    },
  };
};
