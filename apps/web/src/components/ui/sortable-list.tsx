import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";

export const SortableList = ({
  activationDistance = 5,
  children,
  items,
  onReorder,
  onReorderEnd,
  onReorderStart,
  renderDragOverlay,
}) => {
  const [activeId, setActiveId] = useState(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: activationDistance,
      },
    })
  );

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragCancel={() => {
        setActiveId(null);
        onReorderEnd?.();
      }}
      onDragEnd={({ active, over }) => {
        if (over && active.id !== over.id) {
          const oldIndex = items.indexOf(active.id);
          const newIndex = items.indexOf(over.id);

          if (!(oldIndex < 0 || newIndex < 0)) {
            onReorder(arrayMove(items, oldIndex, newIndex));
          }
        }

        setActiveId(null);
        onReorderEnd?.(active.id);
      }}
      onDragStart={({ active }) => {
        setActiveId(active.id);
        onReorderStart?.(active.id);
      }}
      sensors={sensors}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
      <DragOverlay>
        {activeId && renderDragOverlay ? renderDragOverlay(activeId) : null}
      </DragOverlay>
    </DndContext>
  );
};

export const SortableItem = ({ children, id }) => {
  const { listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return children({
    dragHandleProps: {
      ...listeners,
    },
    isDragging,
    itemStyle: {
      transform: CSS.Translate.toString(transform),
      transition,
      zIndex: isDragging ? 20 : undefined,
    },
    setItemRef: setNodeRef,
  });
};
