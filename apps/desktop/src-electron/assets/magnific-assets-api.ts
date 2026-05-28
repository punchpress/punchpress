const MAGNIFIC_API_BASE_URL = "https://api.magnific.com";
const MAGNIFIC_IMPORT_ROUTE_REGEX =
  /^\/api\/assets\/magnific\/import\/([^/]+)\/([^/]+)$/;

const jsonResponse = (status: number, body: unknown) => {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json; charset=utf-8" },
    status,
  });
};

const readJsonBody = async (response: Response) => {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text || `Magnific returned HTTP ${response.status}` };
  }
};

const callMagnific = async (
  apiKey: string,
  route: string,
  searchParams?: URLSearchParams
) => {
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
    const error = new Error(
      body.message || `Magnific returned HTTP ${response.status}`
    );
    Object.assign(error, { body, status: response.status });
    throw error;
  }

  return body;
};

const getFirstDownload = (body: { data?: unknown }) => {
  const data = Array.isArray(body.data) ? body.data[0] : body.data;

  if (!(data && typeof data === "object")) {
    throw new Error("Magnific returned no download URL.");
  }

  const download = data as { signed_url?: string; url?: string };

  if (!(download.url || download.signed_url)) {
    throw new Error("Magnific returned no download URL.");
  }

  return download;
};

const fetchSignedAsset = async (
  download: { signed_url?: string; url?: string },
  format: string
) => {
  const response = await fetch(download.url || download.signed_url || "", {
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

  const mimeType =
    format === "png" || contentType.includes("png")
      ? "image/png"
      : "image/jpeg";
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  return { dataUrl: `data:${mimeType};base64,${base64}`, mimeType };
};

const handleSearch = async (apiKey: string, url: URL) => {
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

  for (const value of url.searchParams.getAll("filters[formats][]")) {
    params.append("filters[formats][]", value);
  }

  return jsonResponse(200, await callMagnific(apiKey, "/v1/resources", params));
};

const handleImport = async (apiKey: string, importMatch: RegExpMatchArray) => {
  const resourceId = decodeURIComponent(importMatch[1]);
  const format = decodeURIComponent(importMatch[2]);
  const body = await callMagnific(
    apiKey,
    `/v1/resources/${encodeURIComponent(resourceId)}/download/${encodeURIComponent(format)}`
  );
  const asset = await fetchSignedAsset(getFirstDownload(body), format);

  return jsonResponse(200, { data: { format, resourceId, ...asset } });
};

export const createMagnificAssetsProtocolHandler = (apiKey?: string) => {
  return async (request: Request) => {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/assets/magnific/")) {
      return null;
    }

    if (!apiKey) {
      return jsonResponse(501, {
        message: "Set MAGNIFIC_API_KEY before searching assets.",
      });
    }

    try {
      if (url.pathname === "/api/assets/magnific/search") {
        return await handleSearch(apiKey, url);
      }

      const importMatch = url.pathname.match(MAGNIFIC_IMPORT_ROUTE_REGEX);

      if (importMatch) {
        return await handleImport(apiKey, importMatch);
      }

      return jsonResponse(404, { message: "Unknown assets route." });
    } catch (error) {
      return jsonResponse(
        typeof error === "object" && error && "status" in error
          ? Number(error.status)
          : 500,
        typeof error === "object" && error && "body" in error
          ? error.body
          : { message: error instanceof Error ? error.message : "Asset error." }
      );
    }
  };
};
