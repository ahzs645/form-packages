import { initializeIcons } from "@fluentui/react/lib/Icons";
import { createRoot } from "react-dom/client";

import { App } from "./App";

initializeIcons();

// No StrictMode: the form runtime and Fluent 8's theme layer are the same
// stack the Next app runs without it, and double-invoking form compilation
// effects is wasted work in this shell.
const container = document.getElementById("root");
if (container) {
  createRoot(container).render(<App />);
}
