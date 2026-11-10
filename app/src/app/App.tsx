import { useI18n, useLib, useThemeEffect } from "./context";
import { useRoute } from "./route";
import { ToastProvider } from "./toast";
import { ExportDialog } from "../ui/ExportDialog";
import { NewDialog } from "../ui/NewDialog";
import { SettingsDialog } from "../ui/SettingsDialog";
import { Workspace } from "../ui/Workspace";

export function App() {
  useThemeEffect();
  const { t } = useI18n();
  const ready = useLib((s) => s.ready);
  const route = useRoute();

  if (!ready) return <div className="boot">{t("common.loading")}</div>;
  return (
    <ToastProvider>
      <Workspace />
      {route.name === "new" && <NewDialog folder={route.folder} />}
      {route.name === "export" && <ExportDialog />}
      {route.name === "settings" && <SettingsDialog section={route.section} />}
    </ToastProvider>
  );
}
