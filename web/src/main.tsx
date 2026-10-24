import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

// ?theme=royal|neon|classic picks a visual identity (default: lightning).
const theme = new URLSearchParams(location.search).get("theme");
if (theme) document.documentElement.dataset.theme = theme;
const font = new URLSearchParams(location.search).get("font");
if (font) document.documentElement.dataset.font = font;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
