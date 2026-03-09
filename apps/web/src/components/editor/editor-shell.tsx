import { useEditor } from "../../editor/use-editor";
import { Canvas } from "../canvas/canvas";
import {
  Designer,
  DesignerCanvas,
  DesignerContent,
  DesignerPanel,
} from "../designer/designer";
import { LayersPanel } from "../panels/layers-panel";
import { PropertiesPanel } from "../panels/properties-panel";

export const EditorShell = () => {
  const editor = useEditor();

  return (
    <Designer style={{ "--editor-accent": editor.accent }}>
      <DesignerContent>
        <DesignerCanvas>
          <Canvas />
        </DesignerCanvas>

        <DesignerPanel side="left">
          <LayersPanel />
        </DesignerPanel>

        <DesignerPanel side="right">
          <PropertiesPanel />
        </DesignerPanel>
      </DesignerContent>
    </Designer>
  );
};
