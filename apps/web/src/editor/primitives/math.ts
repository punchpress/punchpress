const HEX6_REGEX = /^#([0-9a-fA-F]{6})$/;
const HEX3_REGEX = /^#([0-9a-fA-F]{3})$/;

export const clamp = (value, min, max) => {
  return Math.min(max, Math.max(min, value));
};

export const round = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export const format = (value) => {
  if (!Number.isFinite(value)) {
    return "0";
  }

  return Number.parseFloat(value.toFixed(2)).toString();
};

export const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const toSafeHex = (value) => {
  const normalized = typeof value === "string" ? value.trim() : "";

  if (HEX6_REGEX.test(normalized)) {
    return normalized;
  }

  if (HEX3_REGEX.test(normalized)) {
    return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
  }

  return "#ffffff";
};
