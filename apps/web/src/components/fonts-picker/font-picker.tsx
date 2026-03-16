import {
  areLocalFontsEqual,
  createLocalFontOption,
  getLocalFontLabel,
  getLocalFontSearchText,
  type LocalFontCatalogState,
  type LocalFontOption,
} from "@punchpress/punch-schema";
import { ChevronDownIcon, SearchIcon } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { selectTriggerVariants } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useEditor } from "../../editor-react/use-editor";
import { useEditorValue } from "../../editor-react/use-editor-value";
import { FontPickerOptionList } from "./font-picker-option-list";

interface FontPickerProps {
  fonts: LocalFontOption[];
  onRequestFonts?: () => void;
  onValueChange: (font: LocalFontOption) => void;
  state: LocalFontCatalogState;
  stateMessage?: string;
  value: LocalFontOption | null;
}

const getEmptyStateCopy = (state: LocalFontCatalogState, stateMessage = "") => {
  if (state === "loading") {
    return "Loading local fonts…";
  }

  if (state === "action-required") {
    return "Enable local font access to browse installed fonts.";
  }

  if (state === "permission-denied") {
    return stateMessage || "Local font access was denied.";
  }

  if (state === "unsupported") {
    return stateMessage || "Local font access is not supported here.";
  }

  if (state === "error") {
    return stateMessage || "Unable to load local fonts.";
  }

  return "No fonts matched your search.";
};

export const FontPicker = ({
  fonts,
  onRequestFonts,
  onValueChange,
  state,
  stateMessage = "",
  value,
}: FontPickerProps) => {
  const editor = useEditor();
  useEditorValue((currentEditor) => currentEditor.fontRevision);

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dropdownPos, setDropdownPos] = useState<{
    right: number;
    top: number;
  } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const filteredFonts = useMemo(() => {
    return fonts.filter((font) => {
      return deferredQuery.length === 0
        ? true
        : getLocalFontSearchText(font).includes(deferredQuery);
    });
  }, [deferredQuery, fonts]);
  const selectedFont = useMemo(() => {
    return (
      fonts.find((font) => areLocalFontsEqual(font, value)) ||
      (value ? createLocalFontOption(value) : null)
    );
  }, [fonts, value]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setDropdownPos(null);
      return;
    }

    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }

    searchInputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !(
          rootRef.current?.contains(target) ||
          dropdownRef.current?.contains(target)
        )
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  const showActionButton =
    state === "action-required" && typeof onRequestFonts === "function";
  const emptyStateCopy = getEmptyStateCopy(
    filteredFonts.length === 0 ? state : "ready",
    stateMessage
  );
  const selectedFontIsReady = selectedFont
    ? editor.getFontPreviewState(selectedFont) === "ready"
    : false;

  return (
    <div className="relative" ref={rootRef}>
      <button
        className={cn(selectTriggerVariants(), "min-w-0")}
        onClick={() => setIsOpen((open) => !open)}
        ref={triggerRef}
        type="button"
      >
        <span
          className="flex-1 truncate"
          style={
            selectedFont && selectedFontIsReady
              ? {
                  fontFamily: editor.getFontPreviewFamily(selectedFont),
                }
              : undefined
          }
        >
          {selectedFont ? getLocalFontLabel(selectedFont) : "Choose a font"}
        </span>
        <ChevronDownIcon className="-me-1 size-4.5 opacity-80 sm:size-4" />
      </button>

      {isOpen ? (
        <div
          className="fixed z-50 w-[22rem] max-w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border bg-popover shadow-[0_10px_30px_rgba(0,0,0,0.12)]"
          ref={dropdownRef}
          style={
            dropdownPos
              ? { top: dropdownPos.top, right: dropdownPos.right }
              : undefined
          }
        >
          <div className="border-border border-b px-2 py-2">
            <div className="relative block">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground/80" />
              <Input
                aria-label="Search fonts"
                className="[&_input]:px-10"
                nativeInput
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setIsOpen(false);
                    return;
                  }

                  event.stopPropagation();
                }}
                placeholder="Search fonts"
                ref={searchInputRef}
                value={query}
              />
            </div>
          </div>

          <FontPickerOptionList
            emptyStateCopy={emptyStateCopy}
            fonts={filteredFonts}
            isOpen={isOpen}
            onSelect={(font) => {
              onValueChange(font);
              setIsOpen(false);
            }}
            selectedFont={selectedFont}
          />

          {showActionButton ? (
            <div className="border-border border-t p-2">
              <Button
                onClick={() => {
                  onRequestFonts();
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                Enable local fonts
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
