import { useEditorSessionContext } from "../../editor/state/editor-session-provider";
import { Canvas } from "../canvas";
import { CanvasTextEditor } from "../canvas-text-editor";
import {
  Designer,
  DesignerCanvas,
  DesignerContent,
  DesignerPanel,
} from "../designer/designer";
import { LayersPanel } from "../layers-panel";
import { PropertiesPanel } from "../properties-panel";

const EditorLayersSidebar = () => {
  const { addTextNode, nodes, selectNode, selectedNodeId, startEditing } =
    useEditorSessionContext();

  return (
    <LayersPanel
      nodes={nodes}
      onAddText={() => addTextNode()}
      onSelectNode={selectNode}
      onStartEditing={startEditing}
      selectedNodeId={selectedNodeId}
    />
  );
};

const EditorInlineTextOverlay = () => {
  const {
    cancelEditing,
    commitEditing,
    editingFontFamily,
    editingGeometry,
    editingMetrics,
    editingNode,
    editingText,
    setActiveTool,
    setEditingText,
  } = useEditorSessionContext();

  if (!editingNode) {
    return null;
  }

  const finalizeEditing = () => {
    commitEditing();
    setActiveTool("pointer");
  };

  const cancelAndResetTool = () => {
    cancelEditing();
    setActiveTool("pointer");
  };

  return (
    <CanvasTextEditor
      editingText={editingText}
      fontFamily={editingFontFamily}
      geometry={editingGeometry}
      metrics={editingMetrics}
      node={editingNode}
      onCancel={cancelAndResetTool}
      onChange={setEditingText}
      onCommit={commitEditing}
      onFinalize={finalizeEditing}
    />
  );
};

const EditorCanvasPane = () => {
  const {
    activeTool,
    addTextNode,
    clearSelection,
    commitEditing,
    editingNodeId,
    geometryById,
    nodes,
    setActiveTool,
    selectNode,
    selectedNodeId,
    startEditing,
    updateNodeById,
  } = useEditorSessionContext();

  const finalizeEditing = () => {
    commitEditing();
    setActiveTool("pointer");
  };

  return (
    <Canvas
      activeTool={activeTool}
      editingNodeId={editingNodeId}
      geometryById={geometryById}
      inlineEditor={<EditorInlineTextOverlay />}
      nodes={nodes}
      onAddText={addTextNode}
      onClearSelection={clearSelection}
      onFinalizeEditing={finalizeEditing}
      onSelectNode={selectNode}
      onSelectTool={setActiveTool}
      onStartEditing={startEditing}
      onUpdateNode={updateNodeById}
      selectedNodeId={selectedNodeId}
    />
  );
};

const EditorPropertiesSidebar = () => {
  const {
    bootstrapError,
    bootstrapState,
    deleteSelected,
    fonts,
    selectedNode,
    updateSelectedNode,
  } = useEditorSessionContext();

  return (
    <PropertiesPanel
      bootstrapError={bootstrapError}
      bootstrapState={bootstrapState}
      deleteSelected={deleteSelected}
      fonts={fonts}
      selectedNode={selectedNode}
      updateSelectedNode={updateSelectedNode}
    />
  );
};

export const EditorShell = () => {
  const { accent } = useEditorSessionContext();

  return (
    <Designer style={{ "--editor-accent": accent }}>
      <DesignerContent>
        <DesignerCanvas>
          <EditorCanvasPane />
        </DesignerCanvas>

        <DesignerPanel side="left">
          <EditorLayersSidebar />
        </DesignerPanel>

        <DesignerPanel side="right">
          <EditorPropertiesSidebar />
        </DesignerPanel>
      </DesignerContent>
    </Designer>
  );
};
