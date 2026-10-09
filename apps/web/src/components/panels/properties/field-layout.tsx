import { createContext, useContext } from "react";

// Where a FieldRow draws its label: in the left column, or inside scrub and
// text fields. Rows label left; paired rows (X/Y, W/H) label inline under the
// pair's own left label.
export type FieldLabels = "left" | "inline";

const FieldLabelsContext = createContext<FieldLabels>("left");

export const useFieldLabels = () => useContext(FieldLabelsContext);

export const FieldLabelsProvider = ({
  children,
  labels,
}: {
  children: React.ReactNode;
  labels: FieldLabels;
}) => {
  return (
    <FieldLabelsContext.Provider value={labels}>
      {children}
    </FieldLabelsContext.Provider>
  );
};
