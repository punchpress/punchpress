import { spawn } from "node:child_process";
import { expect, type Page, test } from "@playwright/test";
import { gotoEditor, loadDocument } from "../e2e/helpers/editor";

const FRAME_HEIGHT = 5400;
const FRAME_ID = "edge-spatial-frame";
const FRAME_WIDTH = 4500;
const FRAME_SCREEN_ORIGIN = { x: 91, y: 126 };
const INPUT_INTERVAL_MS = 8;
const NATIVE_INPUT_INTERVAL_MS = 8;
const SMALL_PLANE_REENTRY =
  process.env.PUNCHPRESS_FRAME_EDGE_SCENARIO !== "dense";
const PATH_MODE =
  process.env.PUNCHPRESS_FRAME_EDGE_PATH === "center" ? "center" : "edge";
const USE_NATIVE_POINTER =
  process.env.PUNCHPRESS_NATIVE_POINTER === "1" &&
  process.platform === "darwin";
const PROBE_KEY = "__PUNCHPRESS_FRAME_EDGE_SPATIAL_PROBE__";
const VIEWPORT = { height: 916, width: 768 };
const ZOOM = SMALL_PLANE_REENTRY ? 0.17 : 0.15;

test("held Frame-edge input keeps ink near the trusted pointer", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize(VIEWPORT);
  await loadFreshFrame(page);

  const path = await createGesturePath(page);
  const client = await page.context().newCDPSession(page);

  if (!SMALL_PLANE_REENTRY) {
    await page.mouse.move(path.start.clientX, path.start.clientY);
    await page.mouse.down();
    await sendPrecondition(client, page, path.dense);
    await client.send("Input.dispatchMouseEvent", {
      button: "left",
      buttons: 0,
      pointerType: "mouse",
      type: "mouseReleased",
      x: path.dense.at(-1)?.clientX ?? path.start.clientX,
      y: path.dense.at(-1)?.clientY ?? path.start.clientY,
    });
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              window.__PUNCHPRESS_EDITOR__
                ?.getRasterWorkingPresentations?.()
                .flatMap((presentation) => presentation.groups).length ??
              window.__PUNCHPRESS_EDITOR__?.getBrushWorkingSurfaceStates?.()
                .length ??
              0
          ),
        { timeout: 15_000 }
      )
      .toBe(0);
  }

  const nativeGesture = USE_NATIVE_POINTER
    ? await startNativeGesture(page, path)
    : null;
  if (nativeGesture) {
    await expect
      .poll(
        () =>
          page.evaluate(() =>
            Boolean(
              window.__PUNCHPRESS_EDITOR__?.tools.get("brush")?.activeSession
                ?.delegate
            )
          ),
        { timeout: 15_000 }
      )
      .toBe(true);
  } else {
    await page.mouse.move(path.start.clientX, path.start.clientY);
    await page.mouse.down();
    if (!SMALL_PLANE_REENTRY) {
      await sendPrecondition(client, page, path.dense);
    }
  }
  await installProbe(page, path.measured);
  const screencast = await startScreencast(page);
  const delivery = nativeGesture
    ? await nativeGesture.completion
    : await sendAtHumanCadence(client, path.measured);
  if (!nativeGesture) {
    await client.send("Input.dispatchMouseEvent", {
      button: "left",
      buttons: 0,
      pointerType: "mouse",
      type: "mouseReleased",
      x: path.measured.at(-1)?.clientX ?? path.start.clientX,
      y: path.measured.at(-1)?.clientY ?? path.start.clientY,
    });
  }

  await page.evaluate(
    async ({ probeKey, sampleCount }) => {
      const probe = Reflect.get(window, probeKey);

      if (!probe) {
        throw new Error("Expected Frame-edge spatial probe");
      }
      probe.inputComplete = true;
      for (let frame = 0; frame < 45; frame += 1) {
        if (probe.latestDeliveredIndex >= sampleCount - 1 && frame >= 12) {
          break;
        }
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve())
        );
      }
    },
    {
      probeKey: PROBE_KEY,
      sampleCount: path.measured.length,
    }
  );
  const screencastFrames = await screencast.stop();
  const deliveredTimeline = await readDeliveredTimeline(page);
  const probe = {
    ...(await readProbe(page)),
    visibleInk: await getScreencastInkFrontier(
      page,
      screencastFrames,
      deliveredTimeline,
      path.measured
    ),
  };
  const result = {
    delivery,
    path: {
      denseSamples: path.dense.length,
      measuredSamples: path.measured.length,
      mode: PATH_MODE,
      nativePointer: USE_NATIVE_POINTER,
      scenario: SMALL_PLANE_REENTRY ? "small-plane-reentry" : "dense",
    },
    probe,
  };

  await testInfo.attach("frame-edge-spatial-lag", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  await page.screenshot({
    path: testInfo.outputPath("frame-edge-spatial-lag.png"),
  });
  console.log(`frame-edge-spatial-lag ${JSON.stringify(result)}`);

  expect(probe.deliveredEventCount, JSON.stringify(result)).toBeGreaterThan(
    path.measured.length * 0.9
  );
  expect(
    probe.visibleInk.trackedFrameCount,
    JSON.stringify(result)
  ).toBeGreaterThan(SMALL_PLANE_REENTRY ? 8 : 30);
  if (SMALL_PLANE_REENTRY) {
    expect(
      probe.firstActiveWorkingPresentation?.contentKind,
      JSON.stringify(result)
    ).toBe("tiles");
    expect(probe.maxWorkingTileCount, JSON.stringify(result)).toBeGreaterThan(
      0
    );
    expect(
      probe.maxWorkingTileCount,
      JSON.stringify(result)
    ).toBeLessThanOrEqual(32);
    expect(
      probe.spanSummary["brush.canvas.expand"]?.count ?? 0,
      JSON.stringify(result)
    ).toBe(0);
    expect(probe.workingCanvasReplacementCount, JSON.stringify(result)).toBe(0);
    expect(
      probe.spanSummary["brush.nativeBoundary.apply"]?.max ?? 0,
      JSON.stringify(result)
    ).toBeLessThan(16.7);
    expect(
      probe.visibleInk.reentryFrontierJump.max,
      JSON.stringify(result)
    ).toBeLessThanOrEqual(30);
    expect(
      probe.visibleInk.finalReentryCatchupPx,
      JSON.stringify(result)
    ).toBeLessThanOrEqual(30);
    expect(
      probe.durableRaster?.tileSourceCount ?? 0,
      JSON.stringify(result)
    ).toBeGreaterThan(0);
    expect(probe.durableRaster?.containedByFrame, JSON.stringify(result)).toBe(
      true
    );
    expect(
      probe.durableRaster?.width ?? FRAME_WIDTH,
      JSON.stringify(result)
    ).toBeLessThan(FRAME_WIDTH);
    expect(
      probe.durableRaster?.height ?? FRAME_HEIGHT,
      JSON.stringify(result)
    ).toBeLessThan(FRAME_HEIGHT);
  }

  await page.evaluate((probeKey) => {
    const probe = Reflect.get(window, probeKey);

    probe?.cleanup();
    Reflect.deleteProperty(window, probeKey);
  }, PROBE_KEY);
  await client.detach();
});

const loadFreshFrame = async (page: Page) => {
  await gotoEditor(page);
  await loadDocument(
    page,
    JSON.stringify({
      nodes: [
        {
          background: "#ffffff",
          height: FRAME_HEIGHT,
          id: FRAME_ID,
          locked: false,
          name: "Frame Edge Spatial Lag",
          parentId: "root",
          transform: {
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            x: 0,
            y: 0,
          },
          type: "artboard",
          visible: true,
          width: FRAME_WIDTH,
        },
      ],
      version: "1.8",
    })
  );
  await page.evaluate(
    async ({ createSeed, frameId, origin, zoom }) => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const hostRect = editor?.hostRef?.getBoundingClientRect();

      if (!(editor && hostRect)) {
        throw new Error("Expected browser Editor viewport");
      }

      const viewport = {
        x: (hostRect.left - origin.x) / zoom,
        y: (hostRect.top - origin.y) / zoom,
        zoom,
      };

      editor.select(frameId);
      editor.setActiveTool("brush");
      editor.setBrushSettings(
        {
          color: "#111111",
          flow: 1,
          hardness: 1,
          opacity: 1,
          size: createSeed ? 24 : 204,
          smoothing: 0.1,
          spacing: 0,
        },
        "brush"
      );
      editor.viewerRef?.setTo?.(viewport);
      editor.setViewport(viewport);
      editor.getState().setViewport(viewport);
      editor.onViewportChange?.();
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
      if (!createSeed) {
        return;
      }
      const seed = editor.dispatchCanvasPointerDown({
        point: { x: 2230, y: 2680 },
      });

      if (!seed) {
        throw new Error("Expected seed Frame Raster stroke");
      }
      seed.update({ point: { x: 2270, y: 2720 } });
      await seed.complete({ point: { x: 2300, y: 2740 } });
    },
    {
      createSeed: !SMALL_PLANE_REENTRY,
      frameId: FRAME_ID,
      origin: FRAME_SCREEN_ORIGIN,
      zoom: ZOOM,
    }
  );
  if (SMALL_PLANE_REENTRY) {
    return;
  }
  await expect
    .poll(() =>
      page.evaluate(() => {
        const editor = window.__PUNCHPRESS_EDITOR__;
        const pendingCount =
          editor
            ?.getRasterWorkingPresentations?.()
            .flatMap((presentation) => presentation.groups).length ??
          editor?.getBrushWorkingSurfaceStates?.().length ??
          0;
        const raster = editor?.nodes.find((node) => node.type === "image");

        return {
          pendingCount,
          rasterId: raster?.id ?? null,
        };
      })
    )
    .toEqual({
      pendingCount: 0,
      rasterId: expect.any(String),
    });
  await page.evaluate(() => {
    const editor = window.__PUNCHPRESS_EDITOR__;
    const raster = editor?.nodes.find((node) => node.type === "image");

    if (!(editor && raster?.type === "image")) {
      throw new Error("Expected seeded Frame Raster");
    }

    editor.select(raster.id);
    editor.setBrushSettings(
      {
        color: "#111111",
        flow: 1,
        hardness: 1,
        opacity: 1,
        size: 149,
        smoothing: 0.1,
        spacing: 0,
      },
      "brush"
    );
  });
};

const createGesturePath = (page: Page) =>
  page.evaluate(
    ({ frameId, pathMode, scenario }) => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const frameBounds = editor?.getNodeRenderFrame(frameId)?.bounds;
      const frameElement = document.querySelector(
        `[data-artboard-body="${frameId}"]`
      );

      if (!(frameBounds && frameElement instanceof HTMLElement)) {
        throw new Error("Expected Frame geometry");
      }

      const frameRect = frameElement.getBoundingClientRect();
      const start =
        scenario === "small-plane-reentry"
          ? { x: 800, y: 1100 }
          : { x: 2250, y: 2700 };
      const dense =
        scenario === "small-plane-reentry"
          ? []
          : Array.from({ length: 360 }, (_, index) => {
              const angle = (index / 359) * Math.PI * 32;

              return {
                x: start.x + Math.sin(angle) * 1050,
                y: start.y + Math.sin(angle * 1.43 + 0.3) * 1050,
              };
            });
      const lanes = [
        { inboundY: 900, outboundY: 700 },
        { inboundY: 1250, outboundY: 1050 },
        { inboundY: 1600, outboundY: 1400 },
        { inboundY: 4050, outboundY: 3850 },
        { inboundY: 4350, outboundY: 4200 },
        { inboundY: 4550, outboundY: 4450 },
      ];
      const measured: Array<{
        kind: "connector" | "exit" | "initial" | "reentry";
        lane: number;
        track: boolean;
        x: number;
        y: number;
      }> = [];
      let previous = start;
      const appendSegment = ({
        end,
        kind,
        lane,
        steps,
        track,
      }: {
        end: { x: number; y: number };
        kind: "connector" | "exit" | "initial" | "reentry";
        lane: number;
        steps: number;
        track: boolean;
      }) => {
        for (let step = 1; step <= steps; step += 1) {
          const progress = step / steps;

          measured.push({
            kind,
            lane,
            track,
            x: previous.x + (end.x - previous.x) * progress,
            y: previous.y + (end.y - previous.y) * progress,
          });
        }
        previous = end;
      };

      if (scenario === "small-plane-reentry") {
        appendSegment({
          end: { x: 190, y: 1710 },
          kind: "initial",
          lane: 0,
          steps: 72,
          track: false,
        });
        appendSegment({
          end: { x: -350, y: 1710 },
          kind: "exit",
          lane: 0,
          steps: 36,
          track: false,
        });
        appendSegment({
          end: { x: -350, y: 3035 },
          kind: "connector",
          lane: 0,
          steps: 72,
          track: false,
        });
        appendSegment({
          end: { x: 3319, y: 3035 },
          kind: "reentry",
          lane: 0,
          steps: 184,
          track: true,
        });
      } else {
        const leftX = pathMode === "center" ? 1200 : -350;
        const rightX = pathMode === "center" ? 3300 : 2600;

        for (const [lane, { inboundY, outboundY }] of lanes.entries()) {
          appendSegment({
            end: { x: rightX, y: outboundY },
            kind: "connector",
            lane,
            steps: 16,
            track: false,
          });
          appendSegment({
            end: { x: leftX, y: outboundY },
            kind: "exit",
            lane,
            steps: 64,
            track: true,
          });
          appendSegment({
            end: { x: leftX, y: inboundY },
            kind: "connector",
            lane,
            steps: 8,
            track: false,
          });
          appendSegment({
            end: { x: rightX, y: inboundY },
            kind: "reentry",
            lane,
            steps: 64,
            track: true,
          });
        }
      }

      const toClientPoint = (point) => {
        const clientX =
          frameRect.left +
          ((point.x - frameBounds.minX) / frameBounds.width) * frameRect.width;
        const clientY =
          frameRect.top +
          ((point.y - frameBounds.minY) / frameBounds.height) *
            frameRect.height;
        const occludedByPanel = [...document.querySelectorAll("aside")].some(
          (panel) => {
            const rect = panel.getBoundingClientRect();

            return (
              clientX >= rect.left &&
              clientX <= rect.right &&
              clientY >= rect.top &&
              clientY <= rect.bottom
            );
          }
        );

        return {
          ...point,
          clientX,
          clientY,
          inside:
            point.x >= frameBounds.minX &&
            point.x <= frameBounds.maxX &&
            point.y >= frameBounds.minY &&
            point.y <= frameBounds.maxY,
          oracleVisible: !occludedByPanel,
          worldX: point.x,
          worldY: point.y,
        };
      };

      return {
        dense: dense.map(toClientPoint),
        measured: measured.map(toClientPoint),
        start: toClientPoint(start),
      };
    },
    {
      frameId: FRAME_ID,
      pathMode: PATH_MODE,
      scenario: SMALL_PLANE_REENTRY ? "small-plane-reentry" : "dense",
    }
  );

const sendPrecondition = async (client, page: Page, path) => {
  for (let index = 0; index < path.length; index += 4) {
    await Promise.all(
      path.slice(index, index + 4).map((point) =>
        client.send("Input.dispatchMouseEvent", {
          button: "left",
          buttons: 1,
          pointerType: "mouse",
          type: "mouseMoved",
          x: point.clientX,
          y: point.clientY,
        })
      )
    );
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    );
  }
};

const sendAtHumanCadence = async (client, path) => {
  const completionMs: number[] = [];
  const startedAt = performance.now();

  for (const [index, point] of path.entries()) {
    const targetTime = startedAt + index * INPUT_INTERVAL_MS;
    const delay = targetTime - performance.now();

    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
    const issuedAt = performance.now();

    await client.send("Input.dispatchMouseEvent", {
      button: "left",
      buttons: 1,
      pointerType: "mouse",
      type: "mouseMoved",
      x: point.clientX,
      y: point.clientY,
    });
    completionMs.push(performance.now() - issuedAt);
  }

  return {
    completion: summarize(completionMs),
    durationMs: performance.now() - startedAt,
    maxInFlight: 1,
  };
};

const startNativeGesture = async (page: Page, path) => {
  await page.bringToFront();
  const windowGeometry = await page.evaluate(() => ({
    contentLeft: window.screenX + (window.outerWidth - window.innerWidth) / 2,
    contentTop: window.screenY + window.outerHeight - window.innerHeight,
  }));
  const points = path.measured.map((point) => [
    windowGeometry.contentLeft + point.clientX,
    windowGeometry.contentTop + point.clientY,
  ]);
  const start = [
    windowGeometry.contentLeft + path.start.clientX,
    windowGeometry.contentTop + path.start.clientY,
  ];
  const source = `
import CoreGraphics
import Foundation

let payload = CommandLine.arguments[1].data(using: .utf8)!
var points = try! JSONSerialization.jsonObject(with: payload) as! [[Double]]
let start = points.removeFirst()

func post(_ type: CGEventType, _ point: [Double]) {
  CGEvent(
    mouseEventSource: nil,
    mouseType: type,
    mouseCursorPosition: CGPoint(x: point[0], y: point[1]),
    mouseButton: .left
  )?.post(tap: .cghidEventTap)
}

post(.mouseMoved, start)
post(.leftMouseDown, start)
usleep(1_500_000)
for point in points {
  post(.leftMouseDragged, point)
  usleep(${NATIVE_INPUT_INTERVAL_MS * 1000})
}
post(.leftMouseUp, points.last ?? start)
`;
  const startedAt = performance.now();
  const child = spawn("swift", [
    "-e",
    source,
    JSON.stringify([start, ...points]),
  ]);
  let standardError = "";

  child.stderr.on("data", (chunk) => {
    standardError += chunk.toString();
  });

  return {
    completion: new Promise<{
      completion: ReturnType<typeof summarize>;
      durationMs: number;
      maxInFlight: number;
    }>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", (code) => {
        if (code !== 0) {
          reject(
            new Error(
              `Native pointer gesture failed (${code}): ${standardError}`
            )
          );
          return;
        }
        resolve({
          completion: summarize([]),
          durationMs: performance.now() - startedAt,
          maxInFlight: 0,
        });
      });
    }),
  };
};

const startScreencast = async (page: Page) => {
  const client = await page.context().newCDPSession(page);
  const timeOrigin = await page.evaluate(() => performance.timeOrigin);
  const frames: {
    data: string;
    timestamp: number;
  }[] = [];
  const acknowledgements = new Set<Promise<void>>();

  client.on("Page.screencastFrame", (event) => {
    frames.push({
      data: event.data,
      timestamp: event.metadata?.timestamp ?? 0,
    });
    const acknowledgement = client
      .send("Page.screencastFrameAck", {
        sessionId: event.sessionId,
      })
      .finally(() => {
        acknowledgements.delete(acknowledgement);
      });

    acknowledgements.add(acknowledgement);
  });
  await client.send("Page.startScreencast", {
    everyNthFrame: 1,
    format: "jpeg",
    maxHeight: Math.round(VIEWPORT.height / 2),
    maxWidth: Math.round(VIEWPORT.width / 2),
    quality: 60,
  });

  return {
    async stop() {
      await Promise.all([...acknowledgements]);
      await client.send("Page.stopScreencast");
      await client.detach();
      return { frames, timeOrigin };
    },
  };
};

const getScreencastInkFrontier = async (
  page: Page,
  capture,
  deliveredTimeline,
  samples
) =>
  page.evaluate(
    async ({
      frames: capturedFrames,
      samples: expectedSamples,
      timeOrigin,
      timeline,
      viewport,
    }) => {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      const cursorToInkPx: number[] = [];
      const exitCursorToInkPx: number[] = [];
      const frameIntervalsMs: number[] = [];
      const lagRecords: {
        kind: "connector" | "exit" | "reentry";
        lag: number;
        lane: number;
      }[] = [];
      const reentryFrontierFrames: {
        deliveredIndex: number;
        frameTimeStamp: number;
        frontierIndex: number;
        jumpPx: number;
        visible: boolean;
      }[] = [];
      const reentryFrontierJumpPx: number[] = [];
      const reentryCursorToInkPx: number[] = [];
      const firstReentryInsideIndex = expectedSamples.findIndex(
        (sample) => sample.kind === "reentry" && sample.inside
      );
      let previousReentryFrontierIndex = firstReentryInsideIndex;
      let previousTimestamp = 0;
      let timelineIndex = -1;

      if (!(context && firstReentryInsideIndex >= 0)) {
        throw new Error("Expected screencast analysis canvas");
      }
      const summarizeValues = (values: number[]) => {
        const sorted = [...values].sort((left, right) => left - right);
        const percentile = (ratio: number) =>
          sorted[
            Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))
          ] ?? 0;

        return {
          count: values.length,
          max: sorted.at(-1) ?? 0,
          mean:
            values.length > 0
              ? values.reduce((total, value) => total + value, 0) /
                values.length
              : 0,
          p50: percentile(0.5),
          p95: percentile(0.95),
          p99: percentile(0.99),
        };
      };

      for (const frame of capturedFrames) {
        const image = new Image();

        image.src = `data:image/jpeg;base64,${frame.data}`;
        await image.decode();
        canvas.width = image.width;
        canvas.height = image.height;
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height
        ).data;
        if (previousTimestamp > 0 && frame.timestamp > 0) {
          frameIntervalsMs.push((frame.timestamp - previousTimestamp) * 1000);
        }
        previousTimestamp = frame.timestamp;

        const frameTimeStamp = frame.timestamp * 1000 - timeOrigin;

        while (
          timelineIndex + 1 < timeline.length &&
          timeline[timelineIndex + 1].timeStamp <= frameTimeStamp
        ) {
          timelineIndex += 1;
        }
        let latestTrackedIndex =
          timelineIndex >= 0 ? timeline[timelineIndex].sampleIndex : -1;

        while (
          latestTrackedIndex >= 0 &&
          !(
            expectedSamples[latestTrackedIndex].track &&
            expectedSamples[latestTrackedIndex].inside &&
            expectedSamples[latestTrackedIndex].oracleVisible
          )
        ) {
          latestTrackedIndex -= 1;
        }
        if (latestTrackedIndex < 0) {
          continue;
        }

        const latest = expectedSamples[latestTrackedIndex];
        let visibleIndex = latestTrackedIndex;
        const scaleX = canvas.width / viewport.width;
        const scaleY = canvas.height / viewport.height;
        const hasInkAt = (sample) => {
          const x = Math.round(sample.clientX * scaleX);
          const y = Math.round(sample.clientY * scaleY);

          if (x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
            return false;
          }
          const pixelIndex = (y * canvas.width + x) * 4;
          const luminance =
            0.2126 * pixels[pixelIndex] +
            0.7152 * pixels[pixelIndex + 1] +
            0.0722 * pixels[pixelIndex + 2];

          return pixels[pixelIndex + 3] > 200 && luminance < 100;
        };

        while (
          visibleIndex >= 0 &&
          expectedSamples[visibleIndex].lane === latest.lane &&
          expectedSamples[visibleIndex].kind === latest.kind &&
          !(
            expectedSamples[visibleIndex].oracleVisible &&
            hasInkAt(expectedSamples[visibleIndex])
          )
        ) {
          visibleIndex -= 1;
        }
        const hasVisibleInk =
          visibleIndex >= 0 &&
          expectedSamples[visibleIndex].lane === latest.lane &&
          expectedSamples[visibleIndex].kind === latest.kind &&
          expectedSamples[visibleIndex].oracleVisible;

        if (latest.kind === "reentry") {
          const frontierIndex = hasVisibleInk
            ? Math.max(firstReentryInsideIndex, visibleIndex)
            : previousReentryFrontierIndex;
          const previousFrontier =
            expectedSamples[previousReentryFrontierIndex];
          const frontier = expectedSamples[frontierIndex];
          const jumpPx = Math.hypot(
            frontier.clientX - previousFrontier.clientX,
            frontier.clientY - previousFrontier.clientY
          );

          reentryFrontierJumpPx.push(jumpPx);
          reentryFrontierFrames.push({
            deliveredIndex: latestTrackedIndex,
            frameTimeStamp,
            frontierIndex,
            jumpPx,
            visible: hasVisibleInk,
          });
          previousReentryFrontierIndex = Math.max(
            previousReentryFrontierIndex,
            frontierIndex
          );
        }
        if (!hasVisibleInk) {
          continue;
        }

        const visible = expectedSamples[visibleIndex];
        const lag = Math.hypot(
          latest.clientX - visible.clientX,
          latest.clientY - visible.clientY
        );

        cursorToInkPx.push(lag);
        lagRecords.push({ kind: latest.kind, lag, lane: latest.lane });
        if (latest.kind === "exit") {
          exitCursorToInkPx.push(lag);
        } else {
          reentryCursorToInkPx.push(lag);
        }
      }

      const worstReentryFrontierFrame =
        [...reentryFrontierFrames].sort(
          (left, right) => right.jumpPx - left.jumpPx
        )[0] ?? null;
      let finalDeliveredReentryIndex = -1;

      for (let index = timeline.length - 1; index >= 0; index -= 1) {
        const sampleIndex = timeline[index].sampleIndex;
        const sample = expectedSamples[sampleIndex];

        if (
          sample?.kind === "reentry" &&
          sample.inside &&
          sample.oracleVisible &&
          sample.track
        ) {
          finalDeliveredReentryIndex = sampleIndex;
          break;
        }
      }
      const finalDeliveredReentry = expectedSamples[finalDeliveredReentryIndex];
      const finalReentryFrontier =
        expectedSamples[previousReentryFrontierIndex];
      const finalReentryCatchupPx =
        finalDeliveredReentry && finalReentryFrontier
          ? Math.hypot(
              finalDeliveredReentry.clientX - finalReentryFrontier.clientX,
              finalDeliveredReentry.clientY - finalReentryFrontier.clientY
            )
          : Number.POSITIVE_INFINITY;

      return {
        alignment: {
          firstFrameTimeStamp:
            capturedFrames.length > 0
              ? capturedFrames[0].timestamp * 1000 - timeOrigin
              : 0,
          firstPointerTimeStamp: timeline[0]?.timeStamp ?? 0,
          lastFrameTimeStamp:
            capturedFrames.length > 0
              ? capturedFrames.at(-1).timestamp * 1000 - timeOrigin
              : 0,
          lastPointerTimeStamp: timeline.at(-1)?.timeStamp ?? 0,
        },
        byLane: Object.fromEntries(
          [...new Set(lagRecords.map((record) => record.lane))].map((lane) => [
            lane,
            {
              exit: summarizeValues(
                lagRecords
                  .filter(
                    (record) => record.lane === lane && record.kind === "exit"
                  )
                  .map((record) => record.lag)
              ),
              reentry: summarizeValues(
                lagRecords
                  .filter(
                    (record) =>
                      record.lane === lane && record.kind === "reentry"
                  )
                  .map((record) => record.lag)
              ),
            },
          ])
        ),
        cursorToInk: summarizeValues(cursorToInkPx),
        exitCursorToInk: summarizeValues(exitCursorToInkPx),
        frameCount: capturedFrames.length,
        frameIntervals: summarizeValues(frameIntervalsMs),
        finalDeliveredReentryIndex,
        finalReentryCatchupPx,
        finalReentryFrontierIndex: previousReentryFrontierIndex,
        reentryCursorToInk: summarizeValues(reentryCursorToInkPx),
        reentryFrontierJump: summarizeValues(reentryFrontierJumpPx),
        trackedFrameCount: cursorToInkPx.length,
        worstReentryFrontierFrame,
      };
    },
    {
      frames: capture.frames,
      samples,
      timeOrigin: capture.timeOrigin,
      timeline: deliveredTimeline,
      viewport: VIEWPORT,
    }
  );

const installProbe = async (page: Page, samples) => {
  await page.evaluate(
    ({ probeKey, samples: expectedSamples }) => {
      const editor = window.__PUNCHPRESS_EDITOR__;
      const brush = editor?.tools.get("brush");

      if (!(editor && brush)) {
        throw new Error("Expected Brush probe state");
      }

      const coalescedCounts: number[] = [];
      const deliveredTimeline: {
        sampleIndex: number;
        timeStamp: number;
      }[] = [];
      const eventIntervalsMs: number[] = [];
      const flushDurationsMs: number[] = [];
      const flushQueuedPoints: number[] = [];
      const frameDeltasMs: number[] = [];
      const notifyTimes: number[] = [];
      const presentationFrames: {
        bounds: { height: number; width: number } | null;
        canvasHeight: number | null;
        canvasId: number | null;
        canvasWidth: number | null;
        contentKind: string | null;
        mountedCanvasHeight: number | null;
        mountedCanvasId: number | null;
        mountedCanvasWidth: number | null;
        mountedWorkingSurfaceCount: number;
        nodeHeight: number | null;
        nodeWidth: number | null;
        phase: string | null;
        tileCount: number;
        time: number;
      }[] = [];
      const publicationTimes: number[] = [];
      const spans: Record<string, number[]> = {};
      const canvasIds = new WeakMap<object, number>();
      let animationFrameId = 0;
      let canvasIdentity = 0;
      let deliveredEventCount = 0;
      let flushCallCount = 0;
      let lastEventAt = 0;
      let lastFrameAt = 0;
      let latestDeliveredIndex = -1;
      let queuedFlushScheduleCount = 0;
      let workingCanvasReplacementCount = 0;
      let previousWorkingCanvasId: number | null = null;
      const originalNotify = editor.notifyInteractionPreviewChanged;
      const delegate = brush.activeSession?.delegate;
      const originalFlushPoints = delegate?.flushPoints;
      const originalScheduleQueuedPointFlush =
        delegate?.scheduleQueuedPointFlush;
      const unsubscribe = editor.store.subscribe(() => {
        publicationTimes.push(performance.now());
      });

      editor.notifyInteractionPreviewChanged = (...args) => {
        notifyTimes.push(performance.now());
        return originalNotify.apply(editor, args);
      };
      if (delegate && originalFlushPoints) {
        delegate.flushPoints = (...args) => {
          const queuedBefore = Math.max(
            0,
            delegate.points.length - delegate.pointReadIndex
          );
          const startedAt = performance.now();

          try {
            return originalFlushPoints.apply(delegate, args);
          } finally {
            flushCallCount += 1;
            flushQueuedPoints.push(queuedBefore);
            flushDurationsMs.push(performance.now() - startedAt);
          }
        };
      }
      if (delegate && originalScheduleQueuedPointFlush) {
        delegate.scheduleQueuedPointFlush = (...args) => {
          queuedFlushScheduleCount += 1;
          return originalScheduleQueuedPointFlush.apply(delegate, args);
        };
      }
      window.__PUNCHPRESS_PERF_SINK__ = {
        incrementCounter() {
          // The probe records durations and direct session call counts.
        },
        recordDuration(label, durationMs) {
          spans[label] ||= [];
          spans[label].push(durationMs);
        },
      };
      const getPresentationDiagnostics = () =>
        Array.from(
          document.querySelectorAll<HTMLElement>(
            "[data-raster-working-surface], canvas[data-raster-source-canvas='true'], canvas[data-raster-exact-backing='true']"
          )
        ).map((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          const sampledAlpha =
            element instanceof HTMLCanvasElement
              ? expectedSamples
                  .filter((_, index) => index % 32 === 0)
                  .map((sample) => {
                    if (
                      sample.clientX < rect.left ||
                      sample.clientX >= rect.right ||
                      sample.clientY < rect.top ||
                      sample.clientY >= rect.bottom
                    ) {
                      return 0;
                    }
                    const x = Math.floor(
                      ((sample.clientX - rect.left) / rect.width) *
                        element.width
                    );
                    const y = Math.floor(
                      ((sample.clientY - rect.top) / rect.height) *
                        element.height
                    );

                    return (
                      element.getContext("2d")?.getImageData(x, y, 1, 1)
                        .data[3] ?? 0
                    );
                  })
              : [];

          return {
            completed:
              element.getAttribute("data-raster-working-completed") ??
              element
                .closest("[data-raster-working-surface]")
                ?.getAttribute("data-raster-working-completed") ??
              null,
            display: style.display,
            height:
              element instanceof HTMLCanvasElement ? element.height : null,
            opacity: style.opacity,
            rect: {
              bottom: rect.bottom,
              height: rect.height,
              left: rect.left,
              right: rect.right,
              top: rect.top,
              width: rect.width,
            },
            sampledAlphaMax: Math.max(0, ...sampledAlpha),
            sampledAlphaNonzero: sampledAlpha.filter((alpha) => alpha > 0)
              .length,
            sourceCanvas: element.getAttribute("data-raster-source-canvas"),
            surface:
              element.getAttribute("data-raster-working-surface") ??
              element
                .closest("[data-raster-working-surface]")
                ?.getAttribute("data-raster-working-surface") ??
              null,
            tag: element.tagName,
            visibility: style.visibility,
            width: element instanceof HTMLCanvasElement ? element.width : null,
          };
        });
      const matchSample = (clientX, clientY) => {
        let bestIndex = Math.max(0, latestDeliveredIndex);
        let bestDistance = Number.POSITIVE_INFINITY;
        const end = Math.min(expectedSamples.length, latestDeliveredIndex + 65);

        for (
          let index = Math.max(0, latestDeliveredIndex - 4);
          index < end;
          index += 1
        ) {
          const sample = expectedSamples[index];
          const distance =
            (sample.clientX - clientX) ** 2 + (sample.clientY - clientY) ** 2;

          if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = index;
          }
        }
        if (bestDistance <= 100) {
          latestDeliveredIndex = Math.max(latestDeliveredIndex, bestIndex);
        }
        return latestDeliveredIndex;
      };
      const handlePointerMove = (event) => {
        const now = performance.now();
        const coalesced = event.getCoalescedEvents?.() ?? [];
        const delivered = coalesced.length > 0 ? coalesced : [event];

        if (lastEventAt > 0) {
          eventIntervalsMs.push(now - lastEventAt);
        }
        lastEventAt = now;
        coalescedCounts.push(coalesced.length);
        deliveredEventCount += delivered.length;
        for (const deliveredEvent of delivered) {
          deliveredTimeline.push({
            sampleIndex: matchSample(
              deliveredEvent.clientX,
              deliveredEvent.clientY
            ),
            timeStamp: deliveredEvent.timeStamp,
          });
        }
      };
      const getCanvasId = (canvas: object | null) => {
        if (!canvas) {
          return null;
        }
        const existing = canvasIds.get(canvas);

        if (existing) {
          return existing;
        }
        canvasIdentity += 1;
        canvasIds.set(canvas, canvasIdentity);
        return canvasIdentity;
      };
      const samplePresentationFrame = (time: number) => {
        const group = editor
          .getRasterWorkingPresentations?.()
          .flatMap((presentation) => presentation.groups)
          .at(-1);
        const sourceCanvas =
          group?.content.kind === "canvas" ? group.content.canvas : null;
        const sourceCanvasId = getCanvasId(sourceCanvas);
        const mountedWorkingSurfaces = Array.from(
          document.querySelectorAll<HTMLElement>(
            "[data-raster-working-surface]"
          )
        );
        const mountedCanvas =
          mountedWorkingSurfaces
            .at(-1)
            ?.querySelector<HTMLCanvasElement>("canvas") ?? null;
        const node = group ? editor.getNode(group.nodeId) : null;

        if (
          previousWorkingCanvasId !== null &&
          sourceCanvasId !== null &&
          sourceCanvasId !== previousWorkingCanvasId
        ) {
          workingCanvasReplacementCount += 1;
        }
        if (sourceCanvasId !== null) {
          previousWorkingCanvasId = sourceCanvasId;
        }
        presentationFrames.push({
          bounds: group
            ? {
                height: group.bounds.height,
                width: group.bounds.width,
              }
            : null,
          canvasHeight: sourceCanvas?.height ?? null,
          canvasId: sourceCanvasId,
          canvasWidth: sourceCanvas?.width ?? null,
          contentKind: group?.content.kind ?? null,
          mountedCanvasHeight: mountedCanvas?.height ?? null,
          mountedCanvasId: getCanvasId(mountedCanvas),
          mountedCanvasWidth: mountedCanvas?.width ?? null,
          mountedWorkingSurfaceCount: mountedWorkingSurfaces.length,
          nodeHeight: node?.height ?? null,
          nodeWidth: node?.width ?? null,
          phase: group?.phase ?? null,
          tileCount:
            group?.content.kind === "tiles" ? group.content.tiles.length : 0,
          time,
        });
      };
      const sampleFrame = (now) => {
        if (lastFrameAt > 0) {
          frameDeltasMs.push(now - lastFrameAt);
        }
        lastFrameAt = now;
        samplePresentationFrame(now);
        animationFrameId = requestAnimationFrame(sampleFrame);
      };

      window.addEventListener("pointermove", handlePointerMove, true);
      animationFrameId = requestAnimationFrame(sampleFrame);
      Reflect.set(window, probeKey, {
        cleanup() {
          cancelAnimationFrame(animationFrameId);
          unsubscribe();
          editor.notifyInteractionPreviewChanged = originalNotify;
          if (delegate && originalFlushPoints) {
            delegate.flushPoints = originalFlushPoints;
          }
          if (delegate && originalScheduleQueuedPointFlush) {
            delegate.scheduleQueuedPointFlush =
              originalScheduleQueuedPointFlush;
          }
          window.__PUNCHPRESS_PERF_SINK__ = undefined;
          window.removeEventListener("pointermove", handlePointerMove, true);
        },
        coalescedCounts,
        deliveredTimeline,
        deliveredEventCount: () => deliveredEventCount,
        eventIntervalsMs,
        flushCallCount: () => flushCallCount,
        flushDurationsMs,
        flushQueuedPoints,
        frameDeltasMs,
        get latestDeliveredIndex() {
          return latestDeliveredIndex;
        },
        inputComplete: false,
        getPresentationDiagnostics,
        notifyTimes,
        presentationFrames,
        publicationTimes,
        queuedFlushScheduleCount: () => queuedFlushScheduleCount,
        spans,
        workingCanvasReplacementCount: () => workingCanvasReplacementCount,
      });
    },
    { probeKey: PROBE_KEY, samples }
  );
};

const readDeliveredTimeline = (page: Page) =>
  page.evaluate((probeKey) => {
    const probe = Reflect.get(window, probeKey);

    if (!probe) {
      throw new Error("Expected active Frame-edge spatial probe");
    }

    return probe.deliveredTimeline;
  }, PROBE_KEY);

const readProbe = (page: Page) =>
  page.evaluate(
    ({ frameId, probeKey }) => {
      const probe = Reflect.get(window, probeKey);

      if (!probe) {
        throw new Error("Expected completed Frame-edge spatial probe");
      }

      const summarizeValues = (values: number[]) => {
        const sorted = [...values].sort((left, right) => left - right);
        const percentile = (ratio: number) =>
          sorted[
            Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))
          ] ?? 0;

        return {
          count: values.length,
          max: sorted.at(-1) ?? 0,
          mean:
            values.length > 0
              ? values.reduce((total, value) => total + value, 0) /
                values.length
              : 0,
          p50: percentile(0.5),
          p95: percentile(0.95),
          p99: percentile(0.99),
        };
      };
      const intervals = (times) =>
        times.slice(1).map((time, index) => time - times[index]);
      const editor = window.__PUNCHPRESS_EDITOR__;
      const durableRaster = editor?.nodes.find((node) => node.type === "image");
      const durableRasterFrame = durableRaster
        ? editor.getNodeRenderFrame(durableRaster.id)?.bounds
        : null;
      const parentFrame = editor?.getNode(frameId);
      const parentFrameBounds = parentFrame
        ? editor.getNodeRenderFrame(parentFrame.id)?.bounds
        : null;
      const containmentTolerance = 0.5;
      const presentationTransitions = probe.presentationFrames.filter(
        (frame, index, frames) => {
          const previous = frames[index - 1];

          return (
            !previous ||
            frame.canvasId !== previous.canvasId ||
            frame.canvasHeight !== previous.canvasHeight ||
            frame.canvasWidth !== previous.canvasWidth ||
            frame.contentKind !== previous.contentKind ||
            frame.mountedCanvasId !== previous.mountedCanvasId ||
            frame.mountedWorkingSurfaceCount !==
              previous.mountedWorkingSurfaceCount ||
            frame.nodeHeight !== previous.nodeHeight ||
            frame.nodeWidth !== previous.nodeWidth ||
            frame.phase !== previous.phase ||
            frame.tileCount !== previous.tileCount
          );
        }
      );
      const activeWorkingPresentations = probe.presentationFrames.filter(
        (frame) => frame.phase === "active"
      );

      return {
        coalescedEventCount: probe.coalescedCounts.reduce(
          (total, count) => total + count,
          0
        ),
        deliveredEventCount: probe.deliveredEventCount(),
        durableRaster:
          durableRaster?.type === "image"
            ? {
                containedByFrame: Boolean(
                  durableRasterFrame &&
                    parentFrameBounds &&
                    durableRasterFrame.minX >=
                      parentFrameBounds.minX - containmentTolerance &&
                    durableRasterFrame.minY >=
                      parentFrameBounds.minY - containmentTolerance &&
                    durableRasterFrame.maxX <=
                      parentFrameBounds.maxX + containmentTolerance &&
                    durableRasterFrame.maxY <=
                      parentFrameBounds.maxY + containmentTolerance
                ),
                frameBounds: parentFrameBounds,
                height: durableRaster.height,
                parentId: durableRaster.parentId,
                renderBounds: durableRasterFrame,
                tileSourceCount: durableRaster.tileSources?.length ?? 0,
                width: durableRaster.width,
              }
            : null,
        eventIntervals: summarizeValues(probe.eventIntervalsMs),
        firstActiveWorkingPresentation: activeWorkingPresentations[0] ?? null,
        flushCallCount: probe.flushCallCount(),
        flushDurations: summarizeValues(probe.flushDurationsMs),
        flushQueuedPoints: summarizeValues(probe.flushQueuedPoints),
        frameDeltas: summarizeValues(probe.frameDeltasMs),
        latestDeliveredIndex: probe.latestDeliveredIndex,
        maxWorkingTileCount: Math.max(
          0,
          ...probe.presentationFrames.map((frame) => frame.tileCount)
        ),
        notifyCount: probe.notifyTimes.length,
        notifyIntervals: summarizeValues(intervals(probe.notifyTimes)),
        presentationFrameCount: probe.presentationFrames.length,
        presentationTransitions,
        publicationCount: probe.publicationTimes.length,
        publicationIntervals: summarizeValues(
          intervals(probe.publicationTimes)
        ),
        presentationDiagnostics: probe.getPresentationDiagnostics(),
        queuedFlushScheduleCount: probe.queuedFlushScheduleCount(),
        spanSummary: Object.fromEntries(
          Object.entries(probe.spans).map(([label, values]) => [
            label,
            summarizeValues(values as number[]),
          ])
        ),
        workingCanvasReplacementCount: probe.workingCanvasReplacementCount(),
      };
    },
    { frameId: FRAME_ID, probeKey: PROBE_KEY }
  );

const summarize = (values: number[]) => {
  const sorted = [...values].sort((left, right) => left - right);
  const percentile = (ratio: number) =>
    sorted[
      Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio))
    ] ?? 0;

  return {
    count: values.length,
    max: sorted.at(-1) ?? 0,
    mean:
      values.length > 0
        ? values.reduce((total, value) => total + value, 0) / values.length
        : 0,
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
  };
};
