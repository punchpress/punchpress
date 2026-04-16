import {
  PathfinderExcludeIcon,
  PathfinderIntersectIcon,
  PathfinderMergeIcon,
  PathfinderMinusFrontIcon,
} from "@hugeicons-pro/core-stroke-rounded";

const getPathEditingToolbarActions = (editor, state) => {
  if (!(state.selectedNode && state.canEditPath && state.hasPathEditingMode)) {
    return [];
  }

  const selectedPathPoints = state.isPathEditing
    ? state.selectedPathPoints || editor.pathEditingPoints
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
    state.selectedNode?.type === "path" &&
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

  if (
    state.isPathEditing &&
    state.selectedNode &&
    selectedPathPoints.length > 0
  ) {
    const pointActions = [
      {
        id: "delete-point",
        isActive: false,
        label: "Delete point",
        shortcutLabel: "Del",
        title: "Delete point (Delete)",
        variant: "ghost",
        onSelect: () => {
          if (selectedPathPoints.length > 1) {
            editor.deletePathPoints(state.selectedNode.id, selectedPathPoints);
            return;
          }

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
          editor.setPathPointType("corner", state.selectedNode.id);
        },
      },
      {
        id: "set-point-smooth",
        isActive: false,
        label: "Smooth",
        title: "Convert point to smooth",
        variant: "ghost",
        onSelect: () => {
          editor.setPathPointType("smooth", state.selectedNode.id);
        },
      },
    ];

    if (
      state.selectedNode.type === "path" &&
      state.selectedPathPoint &&
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

const getBooleanToolbarActions = (editor, state) => {
  if (
    !state.canBoolean ||
    state.selectedPathPoint ||
    state.selectedPathPoints?.length > 0
  ) {
    return [];
  }

  const booleanActions = [
    {
      icon: PathfinderMergeIcon,
      id: "unite-selection",
      isVisible: state.selectionBooleanOperations.unite,
      onSelect: () => {
        editor.uniteSelection(state.visibleSelectedNodeIds);
      },
      title: "Unite selection",
    },
    {
      icon: PathfinderMinusFrontIcon,
      id: "subtract-selection",
      isVisible: state.selectionBooleanOperations.subtract,
      onSelect: () => {
        editor.subtractSelection(state.visibleSelectedNodeIds);
      },
      title: "Subtract selection",
    },
    {
      icon: PathfinderIntersectIcon,
      id: "intersect-selection",
      isVisible: state.selectionBooleanOperations.intersect,
      onSelect: () => {
        editor.intersectSelection(state.visibleSelectedNodeIds);
      },
      title: "Intersect selection",
    },
    {
      icon: PathfinderExcludeIcon,
      id: "exclude-selection",
      isVisible: state.selectionBooleanOperations.exclude,
      onSelect: () => {
        editor.excludeSelection(state.visibleSelectedNodeIds);
      },
      title: "Exclude selection",
    },
  ];

  return booleanActions
    .filter((action) => action.isVisible)
    .map(({ isVisible: _isVisible, ...action }) => {
      return {
        ...action,
        iconLibrary: "hugeicons",
        isActive: false,
        isIconOnly: true,
        label: action.title,
        variant: "ghost",
      };
    });
};

const getSharedToolbarActions = (editor, state) => {
  if (
    state.visibleSelectedNodeIds.length === 0 ||
    state.selectedPathPoint ||
    state.selectedPathPoints?.length > 0
  ) {
    return [];
  }

  return [
    ...getBooleanToolbarActions(editor, state),
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
