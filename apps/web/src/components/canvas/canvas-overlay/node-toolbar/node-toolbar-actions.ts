const getPathEditingToolbarActions = (editor, state) => {
  if (!(state.selectedNode && state.canEditPath && state.hasPathEditingMode)) {
    return [];
  }

  return [
    {
      id: "toggle-path-editing",
      label: state.isPathEditing ? "Done" : "Edit path",
      shortcutLabel: "E",
      title: state.isPathEditing ? "Done path editing (E)" : "Edit path (E)",
      variant: "ghost",
      onSelect: () => {
        editor.togglePathEditing(state.selectedNode.id);
      },
    },
  ];
};

const getSharedToolbarActions = (editor, state) => {
  if (state.visibleSelectedNodeIds.length === 0) {
    return [];
  }

  return [
    {
      id: "delete-selection",
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
