import { expect, test } from "@playwright/test";
import { gotoEditor } from "./helpers/editor";

const createFixtureAsset = (query: string, index: number) => ({
  id: `${query}-${index}`,
  image: {
    source: {
      url: `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect fill="${query === "A" ? "#f97316" : "#2563eb"}" width="160" height="160"/><text x="80" y="88" fill="white" font-size="32" text-anchor="middle">${query}-${index}</text></svg>`
      )}`,
    },
  },
  meta: { available_formats: { svg: {} } },
  title: `${query} fixture ${index}`,
});

const createFixtureResponse = (query: string, page: number) => {
  const data =
    query === "A" && page === 1
      ? Array.from({ length: 30 }, (_, index) =>
          createFixtureAsset(query, index + 1)
        )
      : Array.from({ length: 2 }, (_, index) =>
          createFixtureAsset(query, page * 10 + index + 1)
        );

  return {
    data,
    meta: {
      current_page: page,
      last_page: query === "A" ? 2 : 1,
    },
  };
};

test("paginates the submitted query and ignores stale fixture responses", async ({
  page,
}) => {
  test.info().annotations.push({
    type: "fixture",
    description: "Deterministic intercepted asset API; no external service.",
  });

  const requests: string[] = [];
  let releasePageTwo: (() => void) | undefined;
  const pageTwo = new Promise<void>((resolve) => {
    releasePageTwo = resolve;
  });

  await page.route("**/api/assets/magnific/search**", async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get("term") || "";
    const pageNumber = Number(url.searchParams.get("page") || "1");

    requests.push(`${query}:${pageNumber}`);

    if (pageNumber === 2) {
      await pageTwo;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(createFixtureResponse(query, pageNumber)),
    });
  });

  await gotoEditor(page);
  await page.keyboard.press("Control+k");
  await page.getByText("Assets", { exact: true }).click();

  const searchInput = page.getByRole("searchbox", { name: "Search assets" });
  const assetCards = page.locator('button[title="Add to canvas"]');

  await searchInput.fill("A");
  await searchInput.press("Enter");
  await expect.poll(() => requests).toContain("A:1");
  await expect(assetCards).toHaveCount(30);

  await searchInput.fill("B");
  await expect(assetCards).toHaveCount(30);

  const resultsViewport = page
    .locator('[data-slot="scroll-area-viewport"]')
    .last();
  const pageTwoResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());

    return (
      url.pathname === "/api/assets/magnific/search" &&
      url.searchParams.get("term") === "A" &&
      url.searchParams.get("page") === "2"
    );
  });
  await resultsViewport.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await expect.poll(() => requests).toContain("A:2");

  await page.locator("form").evaluate((form) => form.requestSubmit());
  await expect.poll(() => requests).toContain("B:1");
  await expect(assetCards).toHaveCount(2);

  releasePageTwo?.();
  await pageTwoResponse;
  await expect(assetCards).toHaveCount(2);
  await expect.poll(() => requests).toEqual(["A:1", "A:2", "B:1"]);

  await page.evaluate(() => {
    const label = document.createElement("div");
    label.textContent = "DETERMINISTIC FIXTURE · submitted-query pagination";
    label.style.cssText =
      "position:fixed;top:12px;left:50%;z-index:9999;transform:translateX(-50%);border-radius:9999px;background:#111827;color:white;padding:6px 12px;font:600 12px/1.2 ui-monospace,monospace;letter-spacing:.02em";
    document.body.append(label);
  });
  await page.screenshot({
    fullPage: true,
    path: test.info().outputPath("asset-search-pagination-fixture.png"),
  });
});
