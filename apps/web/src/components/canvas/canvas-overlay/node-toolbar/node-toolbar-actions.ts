const getPathEditingToolbarActions = (editor, state) => {
  if (!(state.selectedNode && state.canEditPath && state.hasPathEditingMode)) {
    return [];
  }

  const selectedPathPoints = state.isPathEditing
    ? editor.pathEditingPoints
    : [];
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
    state.selectedNode?.type === "vector" &&
    selectedPathPoints.length === 2 &&
    editor.canJoinPathEndpoints(state.selectedNode.id, selectedPathPoints)
  ) {
    actions.unshift({
      id: "join-path-endpoints",
      isActive: false,
      label: "Join endpoints",
      title: "Join selected path endpoints",
      variant: "ghost",
      onSelect: () => {
        editor.joinPathEndpoints(state.selectedNode.id, selectedPathPoints);
      },
    });
  }

  if (state.isPathEditing && state.selectedNode && state.selectedPathPoint) {
    const pointActions = [
      {
        id: "delete-point",
        isActive: false,
        label: "Delete point",
        shortcutLabel: "Del",
        title: "Delete point (Delete)",
        variant: "ghost",
        onSelect: () => {
          editor.deletePathPoint(
            state.selectedNode.id,
            state.selectedPathPoint
          );
        },
      },
      {
        id: "set-point-corner",
        isActive: false,
        label: "Corner",
        title: "Convert point to corner",
        variant: "ghost",
        onSelect: () => {
          editor.setPathPointType(
            "corner",
            state.selectedNode.id,
            state.selectedPathPoint
          );
        },
      },
      {
        id: "set-point-smooth",
        isActive: false,
        label: "Smooth",
        title: "Convert point to smooth",
        variant: "ghost",
        onSelect: () => {
          editor.setPathPointType(
            "smooth",
            state.selectedNode.id,
            state.selectedPathPoint
          );
        },
      },
    ];

    if (
      state.selectedNode.type === "vector" &&
      editor.canSplitPath(state.selectedNode.id, state.selectedPathPoint)
    ) {
      pointActions.unshift({
        id: "split-path",
        isActive: false,
        label: "Split path",
        title: "Split path at the selected point",
        variant: "ghost",
        onSelect: () => {
          editor.splitPath(state.selectedNode.id, state.selectedPathPoint);
        },
      });
    }

    actions.unshift(...pointActions);
  }

  return actions;
};

const getSharedToolbarActions = (editor, state) => {
  if (state.visibleSelectedNodeIds.length === 0 || state.selectedPathPoint) {
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
