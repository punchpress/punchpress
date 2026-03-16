import {
  areLocalFontsEqual,
  type LocalFontOption,
} from "@punchpress/punch-schema";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useEditor } from "../../editor-react/use-editor";
import { useEditorValue } from "../../editor-react/use-editor-value";

const LIST_PADDING = 6;
const MAX_LIST_HEIGHT = 384;
const OVERSCAN_COUNT = 6;
const ROW_HEIGHT = 32;

interface FontPickerOptionListProps {
  emptyStateCopy: string;
  fonts: LocalFontOption[];
  isOpen: boolean;
  onSelect: (font: LocalFontOption) => void;
  selectedFont: LocalFontOption | null;
}

export const FontPickerOptionList = ({
  emptyStateCopy,
  fonts,
  isOpen,
  onSelect,
  selectedFont,
}: FontPickerOptionListProps) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = fonts.length * ROW_HEIGHT + LIST_PADDING * 2;
  const viewportHeight = Math.min(totalHeight, MAX_LIST_HEIGHT);

  const { endIndex, startIndex } = useMemo(() => {
    if (fonts.length === 0) {
      return { endIndex: 0, startIndex: 0 };
    }

    const visibleStartIndex = Math.max(
      0,
      Math.floor((scrollTop - LIST_PADDING) / ROW_HEIGHT)
    );
    const visibleEndIndex = Math.min(
      fonts.length,
      Math.ceil((scrollTop + viewportHeight - LIST_PADDING) / ROW_HEIGHT)
    );

    return {
      endIndex: Math.min(fonts.length, visibleEndIndex + OVERSCAN_COUNT),
      startIndex: Math.max(0, visibleStartIndex - OVERSCAN_COUNT),
    };
  }, [fonts.length, scrollTop, viewportHeight]);

  useEffect(() => {
    if (!isOpen) {
      setScrollTop(0);
      return;
    }

    const container = scrollRef.current;

    if (!container) {
      return;
    }

    const selectedIndex = selectedFont
      ? fonts.findIndex((font) => areLocalFontsEqual(font, selectedFont))
      : -1;

    if (selectedIndex < 0) {
      container.scrollTop = 0;
      setScrollTop(0);
      return;
    }

    const rowTop = selectedIndex * ROW_HEIGHT;
    const rowBottom = rowTop + ROW_HEIGHT;
    const visibleTop = Math.max(0, container.scrollTop - LIST_PADDING);
    const visibleBottom =
      visibleTop + container.clientHeight - LIST_PADDING * 2;

    if (rowTop >= visibleTop && rowBottom <= visibleBottom) {
      return;
    }

    const nextScrollTop = Math.max(
      0,
      rowTop - container.clientHeight / 2 + ROW_HEIGHT / 2 + LIST_PADDING
    );

    container.scrollTop = nextScrollTop;
    setScrollTop(nextScrollTop);
  }, [fonts, isOpen, selectedFont]);

  if (fonts.length === 0) {
    return (
      <div className="px-3 py-2 text-muted-foreground text-sm">
        {emptyStateCopy}
      </div>
    );
  }

  return (
    <div
      className="max-h-96 overflow-y-auto"
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      ref={scrollRef}
      style={{ height: viewportHeight }}
    >
      <div className="relative" style={{ height: totalHeight }}>
        {fonts.slice(startIndex, endIndex).map((font, offset) => {
          const index = startIndex + offset;
          const isSelected = selectedFont
            ? areLocalFontsEqual(font, selectedFont)
            : false;

          return (
            <div
              className="absolute inset-x-1.5"
              key={font.id}
              style={{ top: LIST_PADDING + index * ROW_HEIGHT }}
            >
              <FontPickerOptionRow
                font={font}
                isSelected={isSelected}
                onSelect={onSelect}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface FontPickerOptionRowProps {
  font: LocalFontOption;
  isSelected: boolean;
  onSelect: (font: LocalFontOption) => void;
}

const FontPickerOptionRow = ({
  font,
  isSelected,
  onSelect,
}: FontPickerOptionRowProps) => {
  const editor = useEditor();

  useEditorValue((currentEditor) => currentEditor.fontRevision);

  useEffect(() => {
    editor.preloadFontOptions([font]);
  }, [editor, font]);

  const previewState = editor.getFontPreviewState(font);
  const isLoading = previewState === "idle" || previewState === "loading";

  return (
    <button
      className={cn(
        "flex h-7 max-h-7 w-full items-center overflow-hidden rounded-md px-3 text-left text-sm leading-none outline-none",
        isSelected
          ? "bg-accent text-accent-foreground"
          : "text-foreground hover:bg-accent hover:text-accent-foreground"
      )}
      onClick={() => onSelect(font)}
      type="button"
    >
      {isLoading ? (
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <span className="truncate text-muted-foreground">
            {font.fullName}
          </span>
          <span
            aria-hidden="true"
            className="h-3 w-14 shrink-0 animate-[var(--animate-skeleton)] rounded-full bg-[length:200%_100%] bg-[linear-gradient(90deg,var(--color-muted),color-mix(in_srgb,var(--color-muted)_70%,white),var(--color-muted))]"
          />
        </span>
      ) : (
        <span
          className="truncate"
          style={{
            fontFamily: editor.getFontPreviewFamily(font),
            lineHeight: 1,
          }}
        >
          {font.fullName}
        </span>
      )}
    </button>
  );
};
