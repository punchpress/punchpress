import {
  Add01Icon,
  Cursor01Icon,
  Download04Icon,
  HandGrabIcon,
  Remove01Icon,
  TextFontIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";

const TOOL_CONFIG = [
  { id: "pointer", label: "Pointer", shortcut: "V", icon: Cursor01Icon },
  { id: "hand", label: "Hand", shortcut: "H", icon: HandGrabIcon },
  { id: "text", label: "Text", shortcut: "T", icon: TextFontIcon },
];

const ToolButton = ({ icon, active, label, onClick, shortcut }) => {
  return (
    <button
      aria-label={`${label} (${shortcut})`}
      className={`dock-tool-btn${active ? "active" : ""}`}
      onClick={onClick}
      title={`${label} (${shortcut})`}
      type="button"
    >
      <HugeiconsIcon
        color="currentColor"
        icon={icon}
        size={24}
        strokeWidth={1.6}
      />
    </button>
  );
};

const DockButton = ({ children, onClick, title }) => {
  return (
    <button
      className="dock-sm-btn"
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
};

export const EditorToolbar = ({
  activeTool,
  onExportSvg,
  onSelectTool,
  onZoomIn,
  onZoomOut,
  zoom,
}) => {
  return (
    <header className="tool-dock">
      <div className="tool-dock-group">
        {TOOL_CONFIG.map(({ id, label, shortcut, icon }) => {
          return (
            <ToolButton
              active={activeTool === id}
              icon={icon}
              key={id}
              label={label}
              onClick={() => onSelectTool(id)}
              shortcut={shortcut}
            />
          );
        })}
      </div>

      <div className="tool-dock-divider" />

      <div className="tool-dock-group">
        <DockButton onClick={onZoomOut} title="Zoom out">
          <HugeiconsIcon
            color="currentColor"
            icon={Remove01Icon}
            size={22}
            strokeWidth={1.8}
          />
        </DockButton>
        <div className="zoom-readout">{Math.round(zoom * 100)}%</div>
        <DockButton onClick={onZoomIn} title="Zoom in">
          <HugeiconsIcon
            color="currentColor"
            icon={Add01Icon}
            size={22}
            strokeWidth={1.8}
          />
        </DockButton>
      </div>

      <div className="tool-dock-divider" />

      <div className="tool-dock-group">
        <DockButton onClick={onExportSvg} title="Export SVG">
          <HugeiconsIcon
            color="currentColor"
            icon={Download04Icon}
            size={22}
            strokeWidth={1.6}
          />
        </DockButton>
      </div>
    </header>
  );
};
