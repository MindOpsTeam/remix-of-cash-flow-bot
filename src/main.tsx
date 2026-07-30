import { createRoot } from "react-dom/client";
import { ThemeProvider } from "@viverdeia/design-system";
import "@viverdeia/design-system/tokens.css";
import "@viverdeia/design-system/style.css";
import App from "./App.tsx";
import "./index.css";
import "./styles/via-theme.css";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultMode="light">
    <App />
  </ThemeProvider>,
);
