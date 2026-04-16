import {
  getNodePropertyIds,
  supportsNodeProperty,
} from "../nodes/node-property-support";
import { isContainerNode } from "../nodes/node-tree";
import { getPropertyDescriptor } from "./property-descriptors";
import {
  getSelectionColors,
  setSelectionColor as setSelectionColorInternal,
} from "./selection-colors";

const EMPTY_PROPERTIES = Object.freeze({});

const getPropertyTargetNodeIds = (editor, nodeIds) => {
  return nodeIds
    .map((nodeId) => editor.getPathEditingTargetNodeId(nodeId) || nodeId)
    .filter(Boolean)
    .filter((nodeId, index, values) => values.indexOf(nodeId) === index);
};

const getSelectionKind = (selectedNodes) => {
  if (selectedNodes.length === 0) {
    return "none";
  }

  if (selectedNodes.length > 1) {
    return "multi";
  }

  return isContainerNode(selectedNodes[0]) ? "group" : "single";
};

const getSharedPropertyIds = (selectedNodes, selectionKind) => {
  if (!(selectedNodes.length > 0 && selectionKind !== "group")) {
    return [];
  }

  const sharedPropertyIds = getNodePropertyIds(selectedNodes[0]).filter(
    (propertyId) => {
      const descriptor = getPropertyDescriptor(propertyId);

      return Boolean(descriptor?.scopes.includes(selectionKind));
    }
  );

  return sharedPropertyIds.filter((propertyId) => {
    return selectedNodes.every((node) => {
      return supportsNodeProperty(node, propertyId);
    });
  });
};

const arePropertyValuesEqual = (left, right) => {
  return JSON.stringify(left) === JSON.stringify(right);
};

const getPropertyState = (selectedNodes, propertyId) => {
  const descriptor = getPropertyDescriptor(propertyId);
  if (!descriptor) {
    return null;
  }

  const values = selectedNodes.map((node) => descriptor.getValue(node));
  const firstValue = values[0];
  const isMixed = values.some((value) => {
    return !(
      descriptor.isEqual?.(value, firstValue) ??
      arePropertyValuesEqual(value, firstValue)
    );
  });

  return {
    id: propertyId,
    isMixed,
    value: isMixed ? null : firstValue,
  };
};

const buildSelectionProperties = (editor, nodeIds) => {
  const selectedNodeIds = [...nodeIds];
  const propertyTargetNodeIds = getPropertyTargetNodeIds(
    editor,
    selectedNodeIds
  );
  const selectedNodes = propertyTargetNodeIds
    .map((nodeId) => editor.getNode(nodeId))
    .filter(Boolean);
  const selectionColors = getSelectionColors(editor, selectedNodeIds);
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null;
  const selectionKind = getSelectionKind(selectedNodes);
  const propertyIds = getSharedPropertyIds(selectedNodes, selectionKind);
  const properties = propertyIds.reduce((nextProperties, propertyId) => {
    const propertyState = getPropertyState(selectedNodes, propertyId);

    if (!propertyState) {
      return nextProperties;
    }

    nextProperties[propertyId] = propertyState;
    return nextProperties;
  }, {});
  const hasPathGuide = Boolean(
    selectedNode?.id && editor.getNodeEditCapabilities(selectedNode.id)?.guide
  );

  return {
    canDelete:
      selectionKind === "single" &&
      !isContainerNode(selectedNode) &&
      !hasPathGuide,
    properties:
      Object.keys(properties).length > 0 ? properties : EMPTY_PROPERTIES,
    selectionColors,
    selectedCount: selectedNodes.length,
    selectedNode,
    selectedNodeIds,
    selectionKind,
  };
};

const getSelectionPropertiesKeyFromState = (selectionProperties) => {
  const keyedProperties = Object.fromEntries(
    Object.entries(selectionProperties.properties).map(
      ([propertyId, property]) => {
        return [propertyId, property.isMixed ? "mixed" : property.value];
      }
    )
  );

  return JSON.stringify({
    canDelete: selectionProperties.canDelete,
    properties: keyedProperties,
    selectionColors: selectionProperties.selectionColors.map(
      (selectionColor) => {
        return [selectionColor.id, selectionColor.usageCount];
      }
    ),
    selectedNodeId: selectionProperties.selectedNode?.id || null,
    selectionKind: selectionProperties.selectionKind,
  });
};

export const getNodePropertySupport = (node) => {
  const propertyIds = getNodePropertyIds(node);

  return {
    propertyIds,
    supports: (propertyId) => supportsNodeProperty(node, propertyId),
  };
};

export const setSelectionProperty = (
  editor,
  propertyId,
  value,
  nodeIds = editor.selectedNodeIds
) => {
  const descriptor = getPropertyDescriptor(propertyId);
  if (!descriptor) {
    return false;
  }

  const targetNodeIds = getPropertyTargetNodeIds(editor, nodeIds).filter(
    (nodeId) => {
      return supportsNodeProperty(editor.getNode(nodeId), propertyId);
    }
  );
  if (targetNodeIds.length === 0) {
    return false;
  }

  editor.updateNodes(targetNodeIds, (node) => {
    return descriptor.setValue(node, value);
  });

  return true;
};

export const setSelectionColor = (
  editor,
  selectionColorId,
  value,
  nodeIds = editor.selectedNodeIds
) => {
  return setSelectionColorInternal(editor, selectionColorId, value, nodeIds);
};

export const getSelectionProperties = (
  editor,
  nodeIds = editor.selectedNodeIds
) => {
  return buildSelectionProperties(editor, nodeIds);
};

export const getSelectionPropertiesKey = (
  editor,
  nodeIds = editor.selectedNodeIds
) => {
  return getSelectionPropertiesKeyFromState(
    buildSelectionProperties(editor, nodeIds)
  );
};

export const getSelectionPropertiesSnapshot = (
  editor,
  nodeIds = editor.selectedNodeIds
) => {
  const selectionProperties = buildSelectionProperties(editor, nodeIds);

  return {
    key: getSelectionPropertiesKeyFromState(selectionProperties),
    selectionProperties,
  };
};
