import type { Editor } from "@punchpress/engine";
import { createContext } from "react";

export const EditorContext = createContext<Editor | null>(null);
