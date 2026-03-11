import {
  closestCenter,
  DndContext,
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

export const SortableList = ({
  activationDistance = 5,
  children,
  items,
  onReorder,
  onReorderEnd,
  onReorderStart,
}) => {
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

        onReorderEnd?.(active.id);
      }}
      onDragStart={({ active }) => {
        onReorderStart?.(active.id);
      }}
      sensors={sensors}
    >
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
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
      transform: CSS.Transform.toString(transform),
      transition,
      zIndex: isDragging ? 20 : undefined,
    },
    setItemRef: setNodeRef,
  });
};
