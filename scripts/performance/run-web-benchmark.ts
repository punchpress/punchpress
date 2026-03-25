import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import {
  findPerformanceBenchmark,
  performanceBenchmarks,
} from "../../apps/web/src/performance/performance-benchmarks";

const listBenchmarks = () => {
  console.log("Available web performance benchmarks:");
  for (const benchmark of performanceBenchmarks) {
    console.log(`  ${benchmark.id}`);
  }
};

const printUsage = () => {
  console.log(
    "Usage: bun run test:performance:benchmark [--headed] [--json] [--timeout-ms <ms>] <benchmark-id>"
  );
  console.log(
    "Usage: bun run test:performance:benchmark:headed [--json] [--timeout-ms <ms>] <benchmark-id>"
  );
  console.log("Use --list to show available benchmarks.");
};

const formatSummary = (summary: {
  fps: number;
  maxFrameMs: number;
  p50FrameMs: number;
  p95FrameMs: number;
  slowFrameCount: number;
}) => {
  return [
    `fps=${Math.round(summary.fps)}`,
    `p50=${summary.p50FrameMs.toFixed(1)}ms`,
    `p95=${summary.p95FrameMs.toFixed(1)}ms`,
    `max=${summary.maxFrameMs.toFixed(1)}ms`,
    `slow=${summary.slowFrameCount}`,
  ].join(" ");
};

const toCliResult = (
  result: Record<string, unknown>,
  resultArtifactPath: string,
  snapshotArtifactPath: string
) => {
  return {
    benchmarkId: result.benchmarkId,
    label: result.label,
    description: result.description,
    startedAt: result.startedAt,
    endedAt: result.endedAt,
    durationMs: result.durationMs,
    error: result.error,
    counters: result.counters,
    nodeStats: result.nodeStats,
    options: result.options,
    spans: result.spans,
    summary: result.summary,
    resultArtifactPath,
    snapshotArtifactPath,
  };
};

const parseArgs = (args: string[]) => {
  let benchmarkId = "";
  let headed = false;
  let json = false;
  let list = false;
  let timeoutMs = 300_000;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--headed") {
      headed = true;
      continue;
    }

    if (arg === "--json") {
      json = true;
      continue;
    }

    if (arg === "--list") {
      list = true;
      continue;
    }

    if (arg === "--timeout-ms") {
      const value = args[index + 1];

      if (!value) {
        throw new Error("Missing value for --timeout-ms");
      }

      timeoutMs = Number(value);

      if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new Error(`Invalid --timeout-ms value: ${value}`);
      }

      index += 1;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (benchmarkId) {
      throw new Error(`Unexpected extra argument: ${arg}`);
    }

    benchmarkId = arg;
  }

  return {
    benchmarkId,
    headed,
    json,
    list,
    timeoutMs,
  };
};

const run = async () => {
  const options = parseArgs(process.argv.slice(2));

  if (options.list) {
    listBenchmarks();
    return;
  }

  if (!options.benchmarkId) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const benchmark = findPerformanceBenchmark(options.benchmarkId);

  if (!benchmark) {
    console.error(`Unknown benchmark: ${options.benchmarkId}`);
    listBenchmarks();
    process.exitCode = 1;
    return;
  }

  const artifactDirectory = path.join(process.cwd(), ".context", "performance");
  const snapshotArtifactPath = path.join(
    artifactDirectory,
    `${benchmark.id}-snapshot.json`
  );
  const resultArtifactPath = path.join(
    artifactDirectory,
    `${benchmark.id}-result.json`
  );
  const args = [
    "x",
    "playwright",
    "test",
    "--config",
    "playwright.performance.config.ts",
    "apps/web/tests/performance/benchmark-runner.spec.ts",
  ];

  if (options.headed) {
    args.push("--headed");
  }

  const exitCode = await new Promise<number>((resolve, reject) => {
    const child = spawn("bun", args, {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PUNCHPRESS_BENCHMARK_ID: benchmark.id,
        PUNCHPRESS_PERFORMANCE_RESULT_PATH: resultArtifactPath,
        PUNCHPRESS_PERFORMANCE_SNAPSHOT_PATH: snapshotArtifactPath,
        PUNCHPRESS_PERFORMANCE_TIMEOUT_MS: String(options.timeoutMs),
      },
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => resolve(code ?? 1));
  });

  if (exitCode !== 0) {
    process.exitCode = exitCode;
    return;
  }

  if (!existsSync(resultArtifactPath)) {
    console.error(`Missing benchmark result artifact: ${resultArtifactPath}`);
    process.exitCode = 1;
    return;
  }

  const result = JSON.parse(readFileSync(resultArtifactPath, "utf8"));

  if (options.json) {
    console.log(
      JSON.stringify(
        toCliResult(result, resultArtifactPath, snapshotArtifactPath),
        null,
        2
      )
    );
    return;
  }

  console.log("");
  console.log(`${benchmark.label}`);
  console.log(formatSummary(result.summary));
  console.log(`result: ${path.relative(process.cwd(), resultArtifactPath)}`);
  console.log(`snapshot: ${path.relative(process.cwd(), snapshotArtifactPath)}`);
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
