import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { initFwHarness } from "./fireweave/fw-harness";
import App from "./App";
import "./styles.css";
import "./games/outcome.css";

await initFwHarness();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
