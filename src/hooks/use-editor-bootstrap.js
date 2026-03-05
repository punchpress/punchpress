import { FALLBACK_FONTS, UI_ACCENT } from "../editor/constants";
import { trpc } from "../trpc";

export const useEditorBootstrap = () => {
  const bootstrapQuery = trpc.editor.bootstrap.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const hasRemoteFonts = Array.isArray(bootstrapQuery.data?.fonts);
  const fonts = hasRemoteFonts ? bootstrapQuery.data.fonts : FALLBACK_FONTS;

  const accent =
    typeof bootstrapQuery.data?.accent === "string"
      ? bootstrapQuery.data.accent
      : UI_ACCENT;

  let bootstrapState = "ready";
  if (bootstrapQuery.isError) {
    bootstrapState = "error";
  } else if (bootstrapQuery.isPending) {
    bootstrapState = "loading";
  }

  const bootstrapError = bootstrapQuery.error
    ? bootstrapQuery.error.message
    : "";

  return {
    fonts,
    accent,
    bootstrapState,
    bootstrapError,
  };
};
