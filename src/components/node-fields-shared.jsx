import { toSafeHex } from "../editor/math-utils";

export const Section = ({ children, title }) => {
  return (
    <section className="panel-section">
      <h3>{title}</h3>
      <div className="panel-fields">{children}</div>
    </section>
  );
};

export const FieldRow = ({ children, label }) => {
  return (
    <div className="field">
      <span>{label}</span>
      <div>{children}</div>
    </div>
  );
};

export const ColorField = ({ onChange, value }) => {
  return (
    <div className="color-field">
      <input
        onChange={(event) => onChange(event.target.value)}
        type="color"
        value={toSafeHex(value)}
      />
      <input
        onBlur={(event) => onChange(toSafeHex(event.target.value))}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </div>
  );
};
