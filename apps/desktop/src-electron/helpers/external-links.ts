const ALLOWED_EXTERNAL_PROTOCOLS = new Set(["https:", "http:", "mailto:"]);

export const isAllowedExternalUrl = (url: string) => {
  try {
    return ALLOWED_EXTERNAL_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
};
