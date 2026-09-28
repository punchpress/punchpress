import { DEFAULT_DOCUMENT_BASE_NAME } from "@punchpress/punch-schema";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createConfiguredEditor } from "@/editor-react/create-configured-editor";
import { EditorContext } from "@/editor-react/editor-context";
import { useEditorClipboardEvents } from "@/editor-react/use-editor-clipboard-events";
import { getDocumentBaseName } from "@/platform/web-document-files";
import { createScratchpadAutosave } from "./scratchpad-autosave";
import {
  loadScratchpadDocument,
  saveScratchpadDocument,
} from "./scratchpad-storage";
import { WorkspaceContext } from "./workspace-context";

const SCRATCHPAD_TAB_ID = "scratchpad";

const createTabId = () => {
  return `tab-${crypto.randomUUID()}`;
};

const getFileKey = (openedDocument) => {
  if (!openedDocument?.fileHandle) {
    return null;
  }

  return typeof openedDocument.fileHandle === "string"
    ? openedDocument.fileHandle
    : null;
};

const getTabTitle = (tab) => {
  if (tab.kind === "scratchpad") {
    return "Scratchpad";
  }

  return tab.baseName || DEFAULT_DOCUMENT_BASE_NAME;
};

const createScratchpadTab = () => ({
  baseName: "Scratchpad",
  editor: createConfiguredEditor(),
  fileHandle: null,
  fileKey: null,
  id: SCRATCHPAD_TAB_ID,
  kind: "scratchpad",
});

const createFileTab = ({ baseName = DEFAULT_DOCUMENT_BASE_NAME, editor }) => ({
  baseName,
  editor,
  fileHandle: null,
  fileKey: null,
  id: createTabId(),
  kind: "file",
});

const getTabIsDirty = (tab) => {
  if (tab.kind === "scratchpad") {
    return false;
  }

  return tab.editor.isDirty || !tab.fileHandle;
};

export const WorkspaceProvider = ({ children }) => {
  const [tabs, setTabs] = useState(() => [createScratchpadTab()]);
  const [activeTabId, setActiveTabId] = useState(SCRATCHPAD_TAB_ID);
  const mountedEditorRef = useRef(null);
  const scratchpadAutosaveRef = useRef(null);
  const tabSwitchRequestRef = useRef(0);

  const scratchpadEditor = tabs[0].editor;
  const activeTab = tabs.find((tab) => tab.id === activeTabId) || tabs[0];
  const activeEditor = activeTab.editor;

  useEditorClipboardEvents(activeEditor);

  useEffect(() => {
    let canceled = false;

    loadScratchpadDocument()
      .then((contents) => {
        if (canceled || !contents) {
          return;
        }

        scratchpadEditor.loadDocument(contents);
        scratchpadEditor.markDocumentSaved();
        setTabs((currentTabs) => [...currentTabs]);
      })
      .catch((error) => {
        console.error(error);
      });

    return () => {
      canceled = true;
    };
  }, [scratchpadEditor]);

  useEffect(() => {
    const previousEditor = mountedEditorRef.current;

    if (previousEditor && previousEditor !== activeEditor) {
      previousEditor.dispose();
    }

    activeEditor.mount();
    mountedEditorRef.current = activeEditor;

    if (import.meta.env.DEV && typeof window !== "undefined") {
      window.__PUNCHPRESS_EDITOR__ = activeEditor;
    }

    return () => {
      if (mountedEditorRef.current === activeEditor) {
        activeEditor.dispose();
        mountedEditorRef.current = null;
      }

      if (
        import.meta.env.DEV &&
        typeof window !== "undefined" &&
        window.__PUNCHPRESS_EDITOR__ === activeEditor
      ) {
        window.__PUNCHPRESS_EDITOR__ = undefined;
      }
    };
  }, [activeEditor]);

  useEffect(() => {
    const unsubscribe = activeEditor.store.subscribe(() => {
      setTabs((currentTabs) => [...currentTabs]);
    });

    return unsubscribe;
  }, [activeEditor]);

  useEffect(() => {
    const autosave = createScratchpadAutosave(
      scratchpadEditor,
      saveScratchpadDocument
    );
    scratchpadAutosaveRef.current = autosave;

    return () => {
      scratchpadAutosaveRef.current = null;
      autosave.dispose();
    };
  }, [scratchpadEditor]);

  useEffect(() => {
    if (activeTab.kind !== "scratchpad") {
      return;
    }

    return () => {
      scratchpadAutosaveRef.current?.flush();
    };
  }, [activeTab.kind]);

  const focusTab = useCallback(
    async (tabId) => {
      const requestId = ++tabSwitchRequestRef.current;
      if (activeTab.kind === "scratchpad" && tabId !== SCRATCHPAD_TAB_ID) {
        try {
          await scratchpadAutosaveRef.current?.flush();
        } catch (error) {
          console.error(error);
          return;
        }
      }

      if (requestId === tabSwitchRequestRef.current) {
        setActiveTabId(tabId);
      }
    },
    [activeTab.kind]
  );

  const openDocumentTab = useCallback(
    async (openedDocument) => {
      const fileKey = getFileKey(openedDocument);
      const existingTab = fileKey
        ? tabs.find((tab) => tab.fileKey === fileKey)
        : null;

      if (existingTab) {
        await focusTab(existingTab.id);
        return { missingFonts: [], replacementFont: null };
      }

      const editor = createConfiguredEditor();
      await editor.initializeLocalFonts().catch(() => undefined);
      const resolution = editor.loadDocument(openedDocument.contents);
      editor.markDocumentSaved();

      const nextTab = {
        baseName: getDocumentBaseName(openedDocument.fileName),
        editor,
        fileHandle: openedDocument.fileHandle,
        fileKey,
        id: createTabId(),
        kind: "file",
      };

      setTabs((currentTabs) => [...currentTabs, nextTab]);
      await focusTab(nextTab.id);

      return resolution;
    },
    [focusTab, tabs]
  );

  const createNewFileTab = useCallback(
    (request = {}) => {
      const editor = createConfiguredEditor();
      const nextTab = createFileTab({
        baseName: request.baseName || DEFAULT_DOCUMENT_BASE_NAME,
        editor,
      });

      if (request.artboard) {
        editor.run(() => {
          const nodeId = editor.getState().addArtboardNode(
            {
              x: 0,
              y: 0,
            },
            {
              patch: {
                height: request.artboard.height,
                name: request.artboard.name,
                width: request.artboard.width,
              },
            }
          );

          if (nodeId) {
            editor.scheduleViewportFocus([nodeId], {
              paddingX: request.artboard.width * 0.1,
              paddingY: request.artboard.height * 0.1,
            });
          }
        });
      }

      setTabs((currentTabs) => [...currentTabs, nextTab]);
      focusTab(nextTab.id);
    },
    [focusTab]
  );

  const updateTabFileIdentity = useCallback(
    (tabId, { baseName, fileHandle }) => {
      setTabs((currentTabs) =>
        currentTabs.map((tab) => {
          if (tab.id !== tabId || tab.kind !== "file") {
            return tab;
          }

          return {
            ...tab,
            baseName: baseName || tab.baseName,
            fileHandle: fileHandle || tab.fileHandle,
            fileKey: typeof fileHandle === "string" ? fileHandle : tab.fileKey,
          };
        })
      );
    },
    []
  );

  const updateActiveFileIdentity = useCallback(
    (identity) => {
      updateTabFileIdentity(activeTabId, identity);
    },
    [activeTabId, updateTabFileIdentity]
  );

  const closeTab = useCallback(
    (tabId) => {
      const tabIndex = tabs.findIndex((tab) => tab.id === tabId);
      const tab = tabs[tabIndex];

      if (!(tab && tab.kind !== "scratchpad")) {
        return;
      }

      const nextTabs = tabs.filter((entry) => entry.id !== tabId);
      const nextActiveTab =
        activeTabId === tabId
          ? nextTabs[Math.max(0, tabIndex - 1)] || nextTabs[0]
          : activeTab;

      tab.editor.dispose();
      setTabs(nextTabs);
      setActiveTabId(nextActiveTab.id);
    },
    [activeTab, activeTabId, tabs]
  );

  const tabSummaries = useMemo(
    () =>
      tabs.map((tab) => ({
        id: tab.id,
        isActive: tab.id === activeTabId,
        isClosable: tab.kind !== "scratchpad",
        isDirty: getTabIsDirty(tab),
        kind: tab.kind,
        title: getTabTitle(tab),
        baseName: tab.baseName,
        editor: tab.editor,
        fileHandle: tab.fileHandle,
      })),
    [activeTabId, tabs]
  );

  const value = useMemo(
    () => ({
      activeEditor,
      activeTab: {
        baseName: activeTab.baseName,
        editor: activeTab.editor,
        fileHandle: activeTab.fileHandle,
        id: activeTab.id,
        isDirty: getTabIsDirty(activeTab),
        kind: activeTab.kind,
        title: getTabTitle(activeTab),
      },
      closeTab,
      createNewFileTab,
      focusTab,
      openDocumentTab,
      tabs: tabSummaries,
      updateActiveFileIdentity,
      updateTabFileIdentity,
    }),
    [
      activeEditor,
      activeTab,
      closeTab,
      createNewFileTab,
      focusTab,
      openDocumentTab,
      tabSummaries,
      updateActiveFileIdentity,
      updateTabFileIdentity,
    ]
  );

  return (
    <WorkspaceContext.Provider value={value}>
      <EditorContext.Provider value={activeEditor}>
        {children}
      </EditorContext.Provider>
    </WorkspaceContext.Provider>
  );
};
