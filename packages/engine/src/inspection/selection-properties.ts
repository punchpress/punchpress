import {
  getNodePropertyIds,
  supportsNodeProperty,
} from "../nodes/node-property-support";
import { getPropertyDescriptor } from "./property-descriptors";

const EMPTY_PROPERTIES = Object.freeze({});

const getSelectionKind = (selectedNodes) => {
  if (selectedNodes.length === 0) {
    return "none";
  }

  if (selectedNodes.length > 1) {
    return "multi";
  }

  return selectedNodes[0]?.type === "group" ? "group" : "single";
};

const getSharedPropertyIds = (selectedNodes, selectionKind) => {
  if (!(selectedNodes.length > 0 && selectionKind !== "group")) {
    return [];
  }

  const sharedPropertyIds = getNodePropertyIds(selectedNodes[0]).filter(
    (propertyId) => {
      const descriptor = getPropertyDescriptor(propertyId);

      return Boolean(descriptor && descriptor.scopes.includes(selectionKind));
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
  const selectedNodes = selectedNodeIds
    .map((nodeId) => editor.getNode(nodeId))
    .filter(Boolean);
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
      selectedNode?.type !== "group" &&
      !hasPathGuide,
    properties:
      Object.keys(properties).length > 0 ? properties : EMPTY_PROPERTIES,
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

  const targetNodeIds = nodeIds.filter((nodeId) => {
    return supportsNodeProperty(editor.getNode(nodeId), propertyId);
  });
  if (targetNodeIds.length === 0) {
    return false;
  }

  editor.updateNodes(targetNodeIds, (node) => {
    return descriptor.setValue(node, value);
  });

  return true;
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
