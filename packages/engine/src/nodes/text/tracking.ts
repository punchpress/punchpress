export const TEXT_TRACKING_RANGE = {
  min: -1000,
  max: 10000,
} as const;

export const resolveTrackingPx = (tracking, fontSize) => {
  return (tracking / 1000) * fontSize;
};
