import "@fontsource/outfit/400.css";
import "@fontsource/outfit/500.css";
import "@fontsource/outfit/600.css";
import "@fontsource/outfit/700.css";
import "./styles/app.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { LibraryProvider } from "./app/context";
import { loadCore } from "./core";
import { createLibrary } from "./state/library";
import { openRepo } from "./storage/repo";

async function boot() {
  const root = createRoot(document.getElementById("root")!);
  try {
    const [repo] = await Promise.all([openRepo(), loadCore()]);
    const store = createLibrary(repo);
    await store.getState().init();
    window.addEventListener("pagehide", () => void store.getState().flush());
    document.addEventListener(
      "visibilitychange",
      () =>
        document.visibilityState === "hidden" && void store.getState().flush(),
    );
    root.render(
      <StrictMode>
        <LibraryProvider store={store}>
          <App />
        </LibraryProvider>
      </StrictMode>,
    );
  } catch (e) {
    root.render(
      <div className="boot" role="alert">
        PackMate could not start: {e instanceof Error ? e.message : String(e)}
      </div>,
    );
  }
  if ("serviceWorker" in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register("./sw.js").catch(() => undefined);
  }
}

void boot();
