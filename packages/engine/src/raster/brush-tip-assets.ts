export type SampledBrushTipAsset = {
  alpha: readonly string[];
  height: number;
  width: number;
};

const createAsset = (alpha: readonly string[]): SampledBrushTipAsset =>
  Object.freeze({
    alpha: Object.freeze([...alpha]),
    height: alpha.length,
    width: alpha[0]?.length ?? 0,
  });

const SAMPLED_BRUSH_TIP_ASSETS = Object.freeze({
  chalk: createAsset([
    "004607280360",
    "078369547083",
    "4598A7859250",
    "39A9C9B67384",
    "67BCFDCA9483",
    "29CFEEFBC752",
    "58BFEFD98472",
    "48ADDCB95631",
    "169CA9742084",
    "027845631040",
    "053260784020",
    "001304120000",
  ]),
  grain: createAsset([
    "001005000200",
    "020080004010",
    "300400600007",
    "006000030500",
    "080020700040",
    "500300080006",
    "030090004020",
    "004007000800",
    "060020500030",
    "200800010004",
    "010005007020",
    "003040200500",
  ]),
  pencil: createAsset([
    "00122100",
    "02466420",
    "14799741",
    "269CC962",
    "269CC962",
    "14799741",
    "02466420",
    "00122100",
  ]),
  pixel: createAsset(["F"]),
});

export const getSampledBrushTipAsset = (
  sampleId: string
): SampledBrushTipAsset | null =>
  SAMPLED_BRUSH_TIP_ASSETS[sampleId as keyof typeof SAMPLED_BRUSH_TIP_ASSETS] ??
  null;
