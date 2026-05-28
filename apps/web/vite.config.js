import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const MAGNIFIC_API_BASE_URL = "https://api.magnific.com";
const MAGNIFIC_IMPORT_ROUTE_REGEX =
  /^\/api\/assets\/magnific\/import\/([^/]+)\/([^/]+)$/;

const sendJson = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
};

const readJsonBody = async (response) => {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text || `Magnific returned HTTP ${response.status}` };
  }
};

const callMagnific = async (apiKey, route, searchParams = null) => {
  const url = new URL(route, MAGNIFIC_API_BASE_URL);

  if (searchParams) {
    url.search = searchParams.toString();
  }

  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "x-magnific-api-key": apiKey,
    },
  });
  const body = await readJsonBody(response);

  if (!response.ok) {
    const message = body.message || `Magnific returned HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
};

const getFirstDownload = (body) => {
  const data = Array.isArray(body.data) ? body.data[0] : body.data;

  if (!(data?.url || data?.signed_url)) {
    throw new Error("Magnific returned no download URL.");
  }

  return data;
};

const fetchSignedAsset = async (download, format) => {
  const response = await fetch(download.url || download.signed_url, {
    headers: { accept: "image/svg+xml,image/png,image/jpeg,text/xml,*/*" },
  });
  const contentType = response.headers.get("content-type") || "";
  const arrayBuffer = await response.arrayBuffer();

  if (!response.ok) {
    throw new Error(`Signed asset download returned HTTP ${response.status}`);
  }

  if (format === "svg") {
    const text = Buffer.from(arrayBuffer).toString("utf8");

    if (!text.trim().startsWith("<")) {
      throw new Error("Signed SVG download did not return SVG text.");
    }

    return { svg: text };
  }

  let mimeType = "image/jpeg";

  if (format === "png") {
    mimeType = "image/png";
  } else if (contentType.includes("png")) {
    mimeType = "image/png";
  }
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return { dataUrl: `data:${mimeType};base64,${base64}`, mimeType };
};

const handleMagnificSearch = async (apiKey, url, res) => {
  const params = new URLSearchParams();
  params.set("term", url.searchParams.get("term") || "");
  params.set("limit", url.searchParams.get("limit") || "48");
  params.set("page", url.searchParams.get("page") || "1");

  for (const key of ["orientation", "content-type", "license", "sort"]) {
    const value = url.searchParams.get(key);

    if (value) {
      params.set(key, value);
    }
  }

  for (const key of ["filters[formats][]"]) {
    for (const value of url.searchParams.getAll(key)) {
      params.append(key, value);
    }
  }

  sendJson(res, 200, await callMagnific(apiKey, "/v1/resources", params));
};

const handleMagnificImport = async (apiKey, importMatch, res) => {
  const resourceId = decodeURIComponent(importMatch[1]);
  const format = decodeURIComponent(importMatch[2]);
  const body = await callMagnific(
    apiKey,
    `/v1/resources/${encodeURIComponent(resourceId)}/download/${encodeURIComponent(format)}`
  );
  const asset = await fetchSignedAsset(getFirstDownload(body), format);

  sendJson(res, 200, { data: { format, resourceId, ...asset } });
};

const createMagnificAssetsMiddleware = (apiKey) => {
  return async (req, res, next) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");

    if (!url.pathname.startsWith("/api/assets/magnific/")) {
      next();
      return;
    }

    if (!apiKey) {
      sendJson(res, 501, {
        message: "Set MAGNIFIC_API_KEY before searching Magnific assets.",
      });
      return;
    }

    try {
      if (url.pathname === "/api/assets/magnific/search") {
        await handleMagnificSearch(apiKey, url, res);
        return;
      }

      const importMatch = url.pathname.match(MAGNIFIC_IMPORT_ROUTE_REGEX);

      if (importMatch) {
        await handleMagnificImport(apiKey, importMatch, res);
        return;
      }

      sendJson(res, 404, { message: "Unknown Magnific assets route." });
    } catch (error) {
      sendJson(
        res,
        error.status || 500,
        error.body || { message: error.message }
      );
    }
  };
};

const magnificAssetsPlugin = (apiKey) => ({
  configurePreviewServer(server) {
    server.middlewares.use(createMagnificAssetsMiddleware(apiKey));
  },
  configureServer(server) {
    server.middlewares.use(createMagnificAssetsMiddleware(apiKey));
  },
  name: "punchpress-magnific-assets",
});

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(import.meta.dirname, "../.."), "");
  const apiKey = process.env.MAGNIFIC_API_KEY || env.MAGNIFIC_API_KEY;

  return {
    plugins: [react(), tailwindcss(), magnificAssetsPlugin(apiKey)],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
    server: {
      host: "127.0.0.1",
      port: 5273,
      strictPort: true,
    },
  };
});
