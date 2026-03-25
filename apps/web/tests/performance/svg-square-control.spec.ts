import { expect, test } from "@playwright/test";
import { formatPerformanceSummary } from "./helpers/idle-slow-frame";

const CONTROL_HTML = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #f5f5f5;
      }

      #stage {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
      }

      .square {
        position: absolute;
        width: 28px;
        height: 28px;
        transform-origin: center center;
        will-change: transform;
      }

      .square svg {
        display: block;
        width: 100%;
        height: 100%;
      }
    </style>
  </head>
  <body>
    <div id="stage"></div>
    <script>
      const stage = document.getElementById("stage");
      const nodeCount = 500;
      const columns = 25;
      const spacingX = 34;
      const spacingY = 34;
      const offsetX = 40;
      const offsetY = 40;

      for (let index = 0; index < nodeCount; index += 1) {
        const square = document.createElement("div");
        square.className = "square";
        square.style.left = \`\${offsetX + (index % columns) * spacingX}px\`;
        square.style.top = \`\${offsetY + Math.floor(index / columns) * spacingY}px\`;
        square.innerHTML =
          '<svg viewBox="0 0 28 28" aria-hidden="true"><rect x="0" y="0" width="28" height="28" fill="#000" /></svg>';
        stage.appendChild(square);
      }
    </script>
  </body>
</html>
`;

test("500 plain SVG squares move near the browser ceiling on a blank page", async ({
  page,
}, testInfo) => {
  await page.setContent(CONTROL_HTML, { waitUntil: "load" });

  const summary = await page.evaluate(
    async ({ frames, stepX, stepY, warmupFrames }) => {
      const getDragPathPoint = (index, { frames, stepX, stepY }) => {
        const progress = Math.min(1, Math.max(0, index / Math.max(1, frames)));
        const loopCount = 1.15;
        const phase = progress * Math.PI * 2;
        const angle =
          progress * Math.PI * 2 * loopCount + Math.sin(phase * 1.3) * 0.18;
        const radiusScale = 1 + Math.sin(phase * 1.1 - Math.PI / 6) * 0.14;
        const radiusX = stepX * 16 * radiusScale;
        const radiusY = stepY * 26 * (0.92 + Math.cos(phase * 0.8) * 0.08);
        const driftX = Math.sin(phase * 0.7 + 0.3) * stepX * 3.4;
        const driftY = Math.sin(phase * 1.4 - 0.5) * stepY * 4.8;

        return {
          x: Math.cos(angle) * radiusX + driftX,
          y: Math.sin(angle) * radiusY + driftY,
        };
      };
      const squares = Array.from(
        document.querySelectorAll<HTMLElement>(".square")
      );
      const frameDurations: number[] = [];
      let previousTimestamp = 0;
      const getSummary = (frames: number[]) => {
        const sorted = [...frames].sort((left, right) => left - right);
        const total = sorted.reduce((sum, value) => sum + value, 0);
        const getPercentile = (percentile: number) => {
          const index = Math.min(
            sorted.length - 1,
            Math.floor((sorted.length - 1) * percentile)
          );

          return sorted[index] || 0;
        };
        const averageFrameMs = total / sorted.length;

        return {
          averageFrameMs,
          fps: averageFrameMs > 0 ? 1000 / averageFrameMs : 0,
          maxFrameMs: sorted.at(-1) || 0,
          p50FrameMs: getPercentile(0.5),
          p95FrameMs: getPercentile(0.95),
          slowFrameCount: sorted.filter((value) => value > 16.7).length,
        };
      };

      for (let index = 0; index < frames + warmupFrames; index += 1) {
        const previousPoint = getDragPathPoint(index, { frames, stepX, stepY });
        const nextPoint = getDragPathPoint(index + 1, { frames, stepX, stepY });
        const deltaX = nextPoint.x - previousPoint.x;
        const deltaY = nextPoint.y - previousPoint.y;
        const timestamp = await new Promise<number>((resolve) =>
          requestAnimationFrame(resolve)
        );

        for (const square of squares) {
          const currentX = Number(square.dataset.x || 0) + deltaX;
          const currentY = Number(square.dataset.y || 0) + deltaY;
          square.dataset.x = String(currentX);
          square.dataset.y = String(currentY);
          square.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
        }

        if (previousTimestamp && index >= warmupFrames) {
          frameDurations.push(timestamp - previousTimestamp);
        }

        previousTimestamp = timestamp;
      }

      return getSummary(frameDurations);
    },
    {
      frames: 180,
      stepX: 11,
      stepY: 3,
      warmupFrames: 18,
    }
  );

  expect(summary.fps).toBeGreaterThan(0);

  const summaryLine = `svg-square-control-500: ${formatPerformanceSummary(
    summary
  )}`;

  console.log(summaryLine);
  await testInfo.attach("svg-square-control-500-summary", {
    body: summaryLine,
    contentType: "text/plain",
  });
});
