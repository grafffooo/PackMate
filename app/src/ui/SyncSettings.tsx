import { useRef, useState } from "react";
import {
  useI18n,
  useLibraryStore,
  useSync,
  useSyncActions,
} from "../app/context";
import { useToast } from "../app/toast";
import {
  createBackup,
  restoreAdd,
  restoreReplace,
  summarize,
  unzipLibrary,
  type Summary,
} from "../storage/backup";
import type { LibraryData } from "../storage/bundle";
import { saveFile } from "../save";
import { Dialog } from "./kit";
import { Row } from "./settingsRow";

function SyncFolder() {
  const { t } = useI18n();
  const status = useSync((s) => s.status);
  const supported = useSync((s) => s.supported);
  const actions = useSyncActions();
  const toast = useToast();
  const on = status.kind !== "off";
  const pick = () =>
    actions
      .choose()
      .catch((e) =>
        toast(
          t("sync.failed", { msg: e instanceof Error ? e.message : String(e) }),
        ),
      );

  if (!supported) {
    return (
      <Row label={t("sync.folder")} hint={t("sync.folder.hint")}>
        <p className="note" role="note">
          {t("sync.unsupported")}
        </p>
      </Row>
    );
  }
  return (
    <Row label={t("sync.folder")} hint={t("sync.folder.hint")}>
      <div className="inp-row">
        <input
          type="text"
          readOnly
          value={on ? status.name : ""}
          placeholder={t("sync.none")}
          aria-label={t("sync.folder")}
          className="txt mono"
        />
        <button type="button" className="btn flat" onClick={() => void pick()}>
          {on ? t("sync.change") : t("sync.choose")}
        </button>
      </div>
      {status.kind === "ok" && (
        <div className="status" role="status">
          <span className="dot" />
          <span style={{ flex: 1 }}>
            {t("sync.ok", {
              time: new Date(status.at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            })}
          </span>
          <button
            type="button"
            className="btn flat sm"
            onClick={() => void actions.syncNow()}
          >
            {t("sync.now")}
          </button>
          <button
            type="button"
            className="btn flat sm"
            onClick={() => void actions.stop()}
          >
            {t("sync.stop")}
          </button>
        </div>
      )}
      {status.kind === "syncing" && (
        <div className="status" role="status">
          <span className="dot" />
          <span style={{ flex: 1 }}>{t("sync.syncing")}</span>
        </div>
      )}
      {status.kind === "needs-permission" && (
        <div className="status" role="alert">
          <span className="dot warn" />
          <span style={{ flex: 1 }}>
            {t("sync.permission", { name: status.name })}
          </span>
          <button
            type="button"
            className="btn pri sm"
            onClick={() => void actions.reconnect()}
          >
            {t("sync.reconnect")}
          </button>
          <button
            type="button"
            className="btn flat sm"
            onClick={() => void actions.stop()}
          >
            {t("sync.stop")}
          </button>
        </div>
      )}
      {status.kind === "error" && (
        <div className="status" role="alert">
          <span className="dot warn" />
          <span style={{ flex: 1 }}>{t("sync.error")}</span>
          <button
            type="button"
            className="btn flat sm"
            onClick={() => void actions.syncNow()}
          >
            {t("sync.retry")}
          </button>
          <button
            type="button"
            className="btn flat sm"
            onClick={() => void actions.stop()}
          >
            {t("sync.stop")}
          </button>
        </div>
      )}
      <p className="note">{t("sync.note")}</p>
    </Row>
  );
}

function Backup() {
  const { t } = useI18n();
  const store = useLibraryStore();
  const toast = useToast();
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await store.getState().flush();
      const file = await createBackup(store.getState().repo);
      const out = await saveFile(file);
      if (out !== "cancelled") setDone(file.name);
    } catch (e) {
      toast(
        t("backup.failed", { msg: e instanceof Error ? e.message : String(e) }),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Row label={t("backup.title")} hint={t("backup.hint")}>
      <button
        type="button"
        className="btn pri"
        disabled={busy}
        onClick={() => void run()}
      >
        {t("backup.button")}
      </button>
      {done && (
        <p className="ok" role="status">
          {t("backup.done", { name: done })}
        </p>
      )}
      <p className="note">{t("backup.note")}</p>
    </Row>
  );
}

type Loaded = {
  name: string;
  data: LibraryData;
  summary: Summary;
  skipped: number;
};

function Restore() {
  const { t } = useI18n();
  const store = useLibraryStore();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [mode, setMode] = useState<"add" | "replace">("add");
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setOkMsg(null);
    try {
      const { data, skipped } = unzipLibrary(
        new Uint8Array(await file.arrayBuffer()),
      );
      setLoaded({ name: file.name, data, summary: summarize(data), skipped });
      setMode("add");
    } catch (e) {
      setLoaded(null);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const apply = async () => {
    if (!loaded) return;
    try {
      await store.getState().flush();
      const repo = store.getState().repo;
      if (mode === "replace") await restoreReplace(repo, loaded.data);
      else await restoreAdd(repo, loaded.data);
      await store.getState().reload();
      setOkMsg(t("restore.done"));
      setLoaded(null);
    } catch (e) {
      toast(
        t("restore.failed", {
          msg: e instanceof Error ? e.message : String(e),
        }),
      );
    }
  };

  return (
    <Row label={t("restore.title")} hint={t("restore.hint")}>
      <input
        ref={input}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={(e) => (
          void pick(e.target.files?.[0]),
          (e.target.value = "")
        )}
      />
      <button
        type="button"
        className="btn flat"
        onClick={() => input.current?.click()}
      >
        {t("restore.choose")}
      </button>
      {error && (
        <p className="note" role="alert" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
      {okMsg && (
        <p className="ok" role="status">
          {okMsg}
        </p>
      )}
      {loaded && (
        <div className="panel">
          <div className="file-h">
            <b>{loaded.name}</b>
            <span>{t("restore.summary", loaded.summary)}</span>
            {loaded.skipped > 0 && (
              <span> · {t("restore.skipped", { n: loaded.skipped })}</span>
            )}
          </div>
          <label className="rad">
            <input
              type="radio"
              name="rmode"
              checked={mode === "add"}
              onChange={() => setMode("add")}
            />
            <span>
              {t("restore.add")}
              <small>{t("restore.add.hint")}</small>
            </span>
          </label>
          <label className="rad">
            <input
              type="radio"
              name="rmode"
              checked={mode === "replace"}
              onChange={() => setMode("replace")}
            />
            <span>
              {t("restore.replace")}
              <small>{t("restore.replace.hint")}</small>
            </span>
          </label>
          <div className="panel-f">
            <button
              type="button"
              className="btn flat"
              onClick={() => setLoaded(null)}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              className="btn pri"
              onClick={() =>
                mode === "replace" ? setConfirm(true) : void apply()
              }
            >
              {t("restore.button")}
            </button>
          </div>
        </div>
      )}
      {confirm && (
        <Dialog
          title={t("restore.confirm.title")}
          onClose={() => setConfirm(false)}
          closeLabel={t("common.close")}
          width={460}
          footer={
            <div className="btns">
              <button
                type="button"
                className="btn flat"
                onClick={() => setConfirm(false)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="btn pri"
                data-autofocus
                onClick={() => {
                  setConfirm(false);
                  void apply();
                }}
              >
                {t("restore.replace.button")}
              </button>
            </div>
          }
        >
          <p className="lead" style={{ padding: "0 24px" }}>
            {t("restore.confirm.text")}
          </p>
        </Dialog>
      )}
    </Row>
  );
}

export function SyncSettings() {
  const { t } = useI18n();
  return (
    <>
      <h3>{t("settings.sync")}</h3>
      <p className="lead">{t("settings.sync.lead")}</p>
      <SyncFolder />
      <Backup />
      <Restore />
    </>
  );
}
