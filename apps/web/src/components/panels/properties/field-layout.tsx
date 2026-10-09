import { createContext, useContext } from "react";
import type { DensityLayout } from "../../density-preview/density-directions";
import { useDensityLayout } from "../../density-preview/density-store";

const FieldLabelsContext = createContext<DensityLayout["labels"] | null>(null);

// The panel's structural density choices. Label placement can be overridden
// for a subtree: paired rows label inline, settings popovers label left.
export const useFieldLayout = (): DensityLayout => {
  const layout = useDensityLayout();
  const labels = useContext(FieldLabelsContext);

  return labels ? { ...layout, labels } : layout;
};

export const FieldLabelsProvider = ({
  children,
  labels,
}: {
  children: React.ReactNode;
  labels: DensityLayout["labels"];
}) => {
  return (
    <FieldLabelsContext.Provider value={labels}>
      {children}
    </FieldLabelsContext.Provider>
  );
};
