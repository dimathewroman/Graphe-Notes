import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Apply saved theme before first render to avoid flash
const savedMode = localStorage.getItem("theme_mode") || "light";
const savedAccent = localStorage.getItem("theme_accent") || "";
if (savedMode === "light") document.documentElement.classList.add("light");
if (savedAccent) {
  document.documentElement.style.setProperty("--primary", savedAccent);
  document.documentElement.style.setProperty("--ring", savedAccent);
}

createRoot(document.getElementById("root")!).render(<App />);
