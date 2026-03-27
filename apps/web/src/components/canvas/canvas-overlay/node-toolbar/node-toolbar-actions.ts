const getPathEditingToolbarActions = (editor, state) => {
  if (!(state.selectedNode && state.canEditPath && state.hasPathEditingMode)) {
    return [];
  }

  const actions = [
    {
      id: "toggle-path-editing",
      isActive: false,
      label: state.isPathEditing ? "Done" : "Edit path",
      shortcutLabel: "E",
      title: state.isPathEditing ? "Done path editing (E)" : "Edit path (E)",
      variant: "ghost",
      onSelect: () => {
        editor.togglePathEditing(state.selectedNode.id);
      },
    },
  ];

  if (
    state.isPathEditing &&
    state.selectedNode.type === "vector" &&
    state.selectedPathPoint
  ) {
    actions.unshift(
      {
        id: "set-point-corner",
        isActive: state.selectedPointType === "corner",
        label: "Corner",
        title: "Convert point to corner",
        variant: state.selectedPointType === "corner" ? "secondary" : "ghost",
        onSelect: () => {
          editor.setVectorPointType("corner", state.selectedNode.id, state.selectedPathPoint);
        },
      },
      {
        id: "set-point-smooth",
        isActive: state.selectedPointType === "smooth",
        label: "Smooth",
        title: "Convert point to smooth",
        variant: state.selectedPointType === "smooth" ? "secondary" : "ghost",
        onSelect: () => {
          editor.setVectorPointType("smooth", state.selectedNode.id, state.selectedPathPoint);
        },
      }
    );
  }

  return actions;
};

const getSharedToolbarActions = (editor, state) => {
  if (state.visibleSelectedNodeIds.length === 0) {
    return [];
  }

  return [
    {
      id: "delete-selection",
      isActive: false,
      label: "Delete",
      shortcutLabel: "Del",
      title: "Delete (Delete)",
      variant: "ghost",
      onSelect: () => {
        editor.deleteSelected();
      },
    },
  ];
};

export const resolveNodeToolbarActions = (editor, state) => {
  if (!state) {
    return [];
  }

  const nodeActions = getPathEditingToolbarActions(editor, state);

  return [...nodeActions, ...getSharedToolbarActions(editor, state)];
};
