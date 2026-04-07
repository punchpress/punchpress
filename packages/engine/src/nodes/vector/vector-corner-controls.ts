import {
  getStableVectorCornerRadiusMax as getStableVectorCornerRadiusMaxInternal,
  setAllVectorPointCornerRadii as setAllVectorPointCornerRadiiInternal,
} from "./vector-corner-controls-max";
import { setVectorPointCornerRadius as setVectorPointCornerRadiusInternal } from "./vector-corner-controls-mutation";
import {
  canRoundVectorPoint as canRoundVectorPointInternal,
  canVectorSegmentHaveLiveCorner as canVectorSegmentHaveLiveCornerInternal,
  getEligibleVectorCornerPoints as getEligibleVectorCornerPointsInternal,
  getUniformVectorCornerRadius as getUniformVectorCornerRadiusInternal,
  getVectorCornerRadiusSummary as getVectorCornerRadiusSummaryInternal,
  getVectorPointCornerControl as getVectorPointCornerControlInternal,
  getVectorPointCornerRadius as getVectorPointCornerRadiusInternal,
  getVectorSegmentCornerControl as getVectorSegmentCornerControlInternal,
} from "./vector-corner-controls-query";

export const getStableVectorCornerRadiusMax =
  getStableVectorCornerRadiusMaxInternal;
export const setAllVectorPointCornerRadii =
  setAllVectorPointCornerRadiiInternal;
export const setVectorPointCornerRadius = setVectorPointCornerRadiusInternal;
export const canRoundVectorPoint = canRoundVectorPointInternal;
export const canVectorSegmentHaveLiveCorner =
  canVectorSegmentHaveLiveCornerInternal;
export const getEligibleVectorCornerPoints =
  getEligibleVectorCornerPointsInternal;
export const getUniformVectorCornerRadius =
  getUniformVectorCornerRadiusInternal;
export const getVectorCornerRadiusSummary =
  getVectorCornerRadiusSummaryInternal;
export const getVectorPointCornerControl = getVectorPointCornerControlInternal;
export const getVectorPointCornerRadius = getVectorPointCornerRadiusInternal;
export const getVectorSegmentCornerControl =
  getVectorSegmentCornerControlInternal;
