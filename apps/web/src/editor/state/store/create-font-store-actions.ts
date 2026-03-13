export const createFontStoreActions = (set) => {
  return {
    bumpFontRevision: () => {
      set((state) => ({
        fontRevision: state.fontRevision + 1,
      }));
    },

    setFontCatalogState: (fontCatalogState, fontCatalogError = "") => {
      set(() => ({
        fontCatalogError,
        fontCatalogState,
      }));
    },
  };
};
