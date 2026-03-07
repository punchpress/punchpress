import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "react-infinite-viewer/src/index.css";
import "react-selecto/src/index.css";
import { App } from "./app";
import { initializeTheme } from "./theme/theme-provider";
import "./styles/global.css";

initializeTheme();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
