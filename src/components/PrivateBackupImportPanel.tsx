import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, FileJson, LockKeyhole, Loader2, Search, ShieldAlert, Upload, CheckCircle2, History, RotateCcw } from 'lucide-react';

type SessionState = 'locked' | 'ready' | 'analyzing' | 'dry_running' | 'applying' | 'verifying' | 'error';

type ImportResult = {
  importSessionId?: string;
  importId: string;
  sourceHash: string;
  sourceBackupVersion: string;
  sourceTimestamp: string;
  status: string;
  sourceCounts: Record<string, number>;
  expectedTargetCounts: Record<string, number>;
  warnings: string[];
  blockers: string[];
  plannedTables: string[];
  schemaVersion: number;
  importAllowed: boolean;
  error?: string;
};

type HistoryItem = {
  importId: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  lastCompletedPhase: string;
  sourceFilename: string;
  sourceSizeBytes: number;
  sourceBackupVersion: string;
  sourceSchemaVersion: number;
  snapshotReference: string | null;
  applyStatus: string;
  verifyStatus: string;
  analysisSummary: Record<string, unknown>;
  dryRunSummary: Record<string, unknown>;
  errorCategory: string | null;
  errorMessage: string | null;
};

type ImportReport = HistoryItem & {
  applySummary?: Record<string, unknown>;
  verifySummary?: Record<string, unknown>;
  sourceHash?: string;
};

type RestoreItem = {
  restoreId: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  lastCompletedPhase: string;
  sourceImportId: string;
  snapshotReference: string;
  snapshotSizeBytes: number;
  snapshotSha256: string;
  safetySnapshotReference: string | null;
  confirmed: boolean;
  confirmedAt: string | null;
  analysis: Record<string, unknown>;
  rollbackStatus: string;
  errorCategory: string | null;
  errorMessage: string | null;
};

type RestoreReport = RestoreItem & {
  restoreSummary?: Record<string, unknown>;
  verifySummary?: Record<string, unknown>;
  rollbackSummary?: Record<string, unknown>;
};

type PanelProps = { showToast: (msg: string) => void };

const ENABLED = import.meta.env.VITE_ENABLE_PRIVATE_BACKUP_IMPORT === 'true';
const SESSION_HEADER = 'x-symptochron-private-import-csrf';

export function isPrivateBackupImportPanelVisible(enabled: boolean): boolean {
  return enabled;
}

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function readMeta(file: File): Promise<{ version?: string; timestamp?: string }> {
  const parsed = JSON.parse(await file.text());
  return {
    version: typeof parsed.version === 'string' ? parsed.version : undefined,
    timestamp: typeof parsed.timestamp === 'string' ? parsed.timestamp : undefined,
  };
}

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

export default function PrivateBackupImportPanel({ showToast }: PanelProps) {
  const [status, setStatus] = useState<SessionState>('locked');
  const [token, setToken] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [sessionExpiresAt, setSessionExpiresAt] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileMeta, setFileMeta] = useState<{ name: string; size: number; sha256?: string; version?: string; timestamp?: string } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [confirmDryRun, setConfirmDryRun] = useState(false);
  const [confirmImport, setConfirmImport] = useState(false);
  const [confirmMedsTaken, setConfirmMedsTaken] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<ImportReport | null>(null);
  const [restoreHistory, setRestoreHistory] = useState<RestoreItem[]>([]);
  const [selectedRestoreId, setSelectedRestoreId] = useState<string | null>(null);
  const [selectedRestoreReport, setSelectedRestoreReport] = useState<RestoreReport | null>(null);
  const [restoreWarning, setRestoreWarning] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  if (!isPrivateBackupImportPanelVisible(ENABLED)) return null;

  const warnings = useMemo(() => result?.warnings ?? [], [result]);
  const blockers = useMemo(() => result?.blockers ?? [], [result]);
  const sessionReady = Boolean(sessionId && csrfToken && sessionExpiresAt && Date.parse(sessionExpiresAt) > Date.now());
  const canRunDryRun = sessionReady && Boolean(file) && status !== 'analyzing' && status !== 'dry_running';
  const canApply = sessionReady && Boolean(result?.importAllowed) && blockers.length === 0 && confirmDryRun && confirmImport && confirmMedsTaken;

  const authHeaders = (extra: Record<string, string> = {}) => ({
    credentials: 'include' as const,
    headers: {
      [SESSION_HEADER]: csrfToken,
      ...extra,
    },
  });

  async function loadHistory(selectedId?: string | null): Promise<void> {
    if (!sessionReady) return;
    const response = await fetch('/api/admin/backup-import/history', authHeaders());
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Importhistorie konnte nicht geladen werden.');
    const items = Array.isArray(data?.results) ? (data.results as HistoryItem[]) : [];
    setHistory(items);
    const nextSelected = selectedId ?? selectedImportId ?? items[0]?.importId ?? null;
    if (nextSelected) {
      setSelectedImportId(nextSelected);
      await loadReport(nextSelected);
    } else {
      setSelectedReport(null);
    }
  }

  async function loadReport(importId: string): Promise<void> {
    if (!sessionReady || !importId) return;
    const response = await fetch(`/api/admin/backup-import/history/${encodeURIComponent(importId)}`, authHeaders());
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Importbericht konnte nicht geladen werden.');
    setSelectedReport(data as ImportReport);
  }

  async function loadRestoreHistory(selectedId?: string | null): Promise<void> {
    if (!sessionReady) return;
    const response = await fetch('/api/admin/backup-import/restore/history', authHeaders());
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Restore-Historie konnte nicht geladen werden.');
    const items = Array.isArray(data?.results) ? (data.results as RestoreItem[]) : [];
    setRestoreHistory(items);
    const nextSelected = selectedId ?? selectedRestoreId ?? items[0]?.restoreId ?? null;
    if (nextSelected) {
      setSelectedRestoreId(nextSelected);
      await loadRestoreReport(nextSelected);
    } else {
      setSelectedRestoreReport(null);
    }
  }

  async function loadRestoreReport(restoreId: string): Promise<void> {
    if (!sessionReady || !restoreId) return;
    const response = await fetch(`/api/admin/backup-import/restore/${encodeURIComponent(restoreId)}`, authHeaders());
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Restore-Bericht konnte nicht geladen werden.');
    setSelectedRestoreReport(data as RestoreReport);
  }

  useEffect(() => {
    if (!sessionReady) return;
    void loadHistory().catch((error) => setFileError(error instanceof Error ? error.message : 'Importhistorie konnte nicht geladen werden.'));
    void loadRestoreHistory().catch((error) => setRestoreWarning(error instanceof Error ? error.message : 'Restore-Historie konnte nicht geladen werden.'));
  }, [sessionReady, csrfToken]); // eslint-disable-line react-hooks/exhaustive-deps

  async function login(): Promise<void> {
    setFileError(null);
    const response = await fetch('/api/admin/private-import/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Admin-Sitzung fehlgeschlagen.');
    setCsrfToken(data.csrfToken);
    setSessionExpiresAt(data.expiresAt ?? null);
    setStatus('ready');
    setToken('');
    showToast('✅ Admin-Sitzung aktiv.');
    void loadHistory().catch((error) => setFileError(error instanceof Error ? error.message : 'Importhistorie konnte nicht geladen werden.'));
    void loadRestoreHistory().catch((error) => setRestoreWarning(error instanceof Error ? error.message : 'Restore-Historie konnte nicht geladen werden.'));
  }

  async function sendAnalyze(): Promise<void> {
    if (!file) return;
    const form = new FormData();
    form.append('backup', file, file.name);
    const response = await fetch('/api/admin/backup-import/analyze', {
      method: 'POST',
      credentials: 'include',
      headers: { [SESSION_HEADER]: csrfToken },
      body: form,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Analyse fehlgeschlagen.');
    setResult(data as ImportResult);
    setSessionId((data as ImportResult).importSessionId ?? null);
    if ((data as ImportResult).importSessionId) {
      setSelectedImportId((data as ImportResult).importId ?? null);
      await loadHistory((data as ImportResult).importId ?? null);
    }
    setStatus('ready');
    showToast('✅ Backup analysiert.');
  }

  async function sendDryRun(): Promise<void> {
    if (!sessionId) throw new Error('Import-Sitzung fehlt.');
    setStatus('dry_running');
    const response = await fetch('/api/admin/backup-import/dry-run', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', [SESSION_HEADER]: csrfToken },
      body: JSON.stringify({ sessionId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Dry-Run fehlgeschlagen.');
    setResult(data as ImportResult);
    setStatus('ready');
    await loadHistory(result?.importId ?? selectedImportId ?? null);
    showToast('✅ Dry-Run erfolgreich.');
  }

  async function sendApply(): Promise<void> {
    if (!sessionId) throw new Error('Import-Sitzung fehlt.');
    setStatus('applying');
    const response = await fetch('/api/admin/backup-import/apply', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', [SESSION_HEADER]: csrfToken },
      body: JSON.stringify({
        sessionId,
        confirmDryRun,
        confirmImport,
        confirmMedsTaken,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Apply fehlgeschlagen.');
    showToast(`✅ Import abgeschlossen: ${(data as { status?: string }).status ?? 'verified'}.`);
    setStatus('ready');
    await loadHistory(result?.importId ?? selectedImportId ?? null);
  }

  async function sendVerify(): Promise<void> {
    if (!sessionId) throw new Error('Import-Sitzung fehlt.');
    setStatus('verifying');
    const response = await fetch('/api/admin/backup-import/verify', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', [SESSION_HEADER]: csrfToken },
      body: JSON.stringify({ sessionId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Verify fehlgeschlagen.');
    showToast(`✅ Verify ${String((data as { status?: string }).status ?? 'verified')}.`);
    setStatus('ready');
    await loadHistory(result?.importId ?? selectedImportId ?? null);
  }

  async function sendRestoreAnalyze(importId: string): Promise<void> {
    if (!sessionReady) throw new Error('Admin-Sitzung fehlt.');
    const response = await fetch('/api/admin/backup-import/restore/analyze', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', [SESSION_HEADER]: csrfToken },
      body: JSON.stringify({ importId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Restore-Analyse fehlgeschlagen.');
    setSelectedRestoreId((data as RestoreReport).restoreId);
    await loadRestoreHistory((data as RestoreReport).restoreId);
  }

  async function sendRestoreConfirm(restoreId: string): Promise<void> {
    const response = await fetch('/api/admin/backup-import/restore/confirm', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', [SESSION_HEADER]: csrfToken },
      body: JSON.stringify({ restoreId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Restore-Bestätigung fehlgeschlagen.');
    await loadRestoreHistory((data as RestoreReport).restoreId);
  }

  async function sendRestoreApply(restoreId: string): Promise<void> {
    const response = await fetch('/api/admin/backup-import/restore/apply', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', [SESSION_HEADER]: csrfToken },
      body: JSON.stringify({ restoreId }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Restore fehlgeschlagen.');
    showToast(`✅ Restore ${String((data as { status?: string }).status ?? 'ok')}.`);
    await loadRestoreHistory(restoreId);
  }

  return (
    <div className="space-y-4 rounded-3xl border border-cyan-500/20 bg-cyan-500/5 p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-2.5">
          <ShieldAlert className="h-5 w-5 text-cyan-400" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold uppercase tracking-widest text-slate-100">Private administrative Importfunktion</h4>
          <p className="text-xs text-slate-400">Analyse, Dry-Run, Apply und Verify laufen nur mit kurzer Admin-Sitzung und ohne Klartext-Inhalte.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-xs text-slate-300">
          <div className="mb-2 flex items-center gap-2 text-slate-200"><LockKeyhole className="h-4 w-4 text-emerald-400" /> Admin-Token</div>
          <input value={token} onChange={(e) => setToken(e.target.value)} type="password" className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500" placeholder="Nur manuell eingeben" />
          <button type="button" onClick={() => void login().catch((error) => setFileError(error instanceof Error ? error.message : 'Login fehlgeschlagen.'))} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950">
            Admin-Sitzung starten
          </button>
        </label>
        <label className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-xs text-slate-300">
          <div className="mb-2 flex items-center gap-2 text-slate-200"><FileJson className="h-4 w-4 text-cyan-400" /> Backupdatei</div>
          <input ref={inputRef} type="file" accept=".json,application/json" onChange={(e) => {
            const next = e.target.files?.[0] ?? null;
            setFile(next);
            setResult(null);
            setSessionId(null);
            setConfirmDryRun(false);
            setConfirmImport(false);
            setConfirmMedsTaken(false);
            if (!next) return;
            if (!next.name.toLowerCase().endsWith('.json')) {
              setFileError('Nur JSON-Dateien sind erlaubt.');
              return;
            }
            void Promise.all([sha256Hex(next), readMeta(next)]).then(([sha256, meta]) => {
              setFileMeta({ name: next.name, size: next.size, sha256, version: meta.version, timestamp: meta.timestamp });
            }).catch((error) => setFileError(error instanceof Error ? error.message : 'Datei konnte nicht analysiert werden.'));
          }} className="block w-full text-xs text-slate-300 file:mr-3 file:rounded-xl file:border-0 file:bg-cyan-500 file:px-3 file:py-2 file:text-xs file:font-bold file:text-slate-950" />
        </label>
      </div>

      {sessionExpiresAt && <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3 text-xs text-slate-300">Sitzung gültig bis: {new Date(sessionExpiresAt).toLocaleString()}</div>}

      {fileMeta && (
        <div className="grid gap-3 text-xs sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3"><div className="text-slate-500 uppercase tracking-wider">Dateiname</div><div className="mt-1 break-all font-semibold text-slate-100">{fileMeta.name}</div></div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3"><div className="text-slate-500 uppercase tracking-wider">Dateigröße</div><div className="mt-1 font-semibold text-slate-100">{sizeLabel(fileMeta.size)}</div></div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3"><div className="text-slate-500 uppercase tracking-wider">SHA-256</div><div className="mt-1 break-all font-mono text-[11px] text-slate-100">{fileMeta.sha256 ?? '-'}</div></div>
          <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3"><div className="text-slate-500 uppercase tracking-wider">Backup-Version</div><div className="mt-1 font-semibold text-slate-100">{fileMeta.version ?? '-'}</div></div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button type="button" disabled={!sessionReady || !file || status === 'analyzing'} onClick={() => void sendAnalyze().catch((error) => setFileError(error instanceof Error ? error.message : 'Analyse fehlgeschlagen.'))} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 px-4 py-3 text-xs font-bold text-slate-950 disabled:opacity-50">
          {status === 'analyzing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Analysieren
        </button>
        <button type="button" disabled={!canRunDryRun} onClick={() => void sendDryRun().catch((error) => setFileError(error instanceof Error ? error.message : 'Dry-Run fehlgeschlagen.'))} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-xs font-bold text-slate-950 disabled:opacity-50">
          {status === 'dry_running' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Dry-Run
        </button>
        <button type="button" disabled={!canApply || status === 'applying'} onClick={() => void sendApply().catch((error) => setFileError(error instanceof Error ? error.message : 'Apply fehlgeschlagen.'))} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-xs font-bold text-slate-950 disabled:opacity-50">
          {status === 'applying' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Apply
        </button>
        <button type="button" disabled={!sessionReady || status === 'verifying'} onClick={() => void sendVerify().catch((error) => setFileError(error instanceof Error ? error.message : 'Verify fehlgeschlagen.'))} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-3 text-xs font-bold text-slate-950 disabled:opacity-50">
          {status === 'verifying' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Verify
        </button>
      </div>

      <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={confirmDryRun} onChange={(e) => setConfirmDryRun(e.target.checked)} /> Ich habe den Dry-Run geprüft.</label>
      <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={confirmImport} onChange={(e) => setConfirmImport(e.target.checked)} /> Ich bestätige den Import in die zentrale SQLite-Datenbank.</label>
      <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={confirmMedsTaken} onChange={(e) => setConfirmMedsTaken(e.target.checked)} /> Ich habe verstanden, dass 119 Einnahmereferenzen ohne Uhrzeit nur im Tagebuch erhalten bleiben.</label>

      {result && (
        <div className="space-y-2 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-xs">
          <div className="grid gap-2 sm:grid-cols-2">
            <div><span className="text-slate-500 uppercase tracking-wider">Status</span><div className="mt-1 font-bold text-slate-100">{result.status}</div></div>
            <div><span className="text-slate-500 uppercase tracking-wider">Session</span><div className="mt-1 break-all font-mono text-[11px] text-slate-100">{result.importSessionId ?? sessionId ?? '-'}</div></div>
            <div><span className="text-slate-500 uppercase tracking-wider">Source Hash</span><div className="mt-1 break-all font-mono text-[11px] text-slate-100">{result.sourceHash}</div></div>
            <div><span className="text-slate-500 uppercase tracking-wider">Schema</span><div className="mt-1 font-bold text-slate-100">{result.schemaVersion}</div></div>
          </div>
          <div><div className="text-slate-500 uppercase tracking-wider">Quellmengen</div><pre className="mt-2 overflow-auto rounded-xl bg-slate-900 p-3 text-[11px] text-slate-200">{JSON.stringify(result.sourceCounts, null, 2)}</pre></div>
          <div><div className="text-slate-500 uppercase tracking-wider">Erwartete Zieldaten</div><pre className="mt-2 overflow-auto rounded-xl bg-slate-900 p-3 text-[11px] text-slate-200">{JSON.stringify(result.expectedTargetCounts, null, 2)}</pre></div>
        </div>
      )}

      <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-slate-200">
            <History className="h-4 w-4 text-cyan-400" />
            Importhistorie
          </div>
          <button
            type="button"
            onClick={() => void loadHistory(selectedImportId).catch((error) => setFileError(error instanceof Error ? error.message : 'Importhistorie konnte nicht geladen werden.'))}
            className="rounded-xl border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-300"
          >
            Aktualisieren
          </button>
        </div>

        <div className="space-y-2">
          {history.length === 0 && <div className="text-slate-500">Noch keine privaten Importprotokolle vorhanden.</div>}
          {history.map((item) => (
            <button
              key={item.importId}
              type="button"
              onClick={() => {
                setSelectedImportId(item.importId);
                void loadReport(item.importId).catch((error) => setFileError(error instanceof Error ? error.message : 'Importbericht konnte nicht geladen werden.'));
              }}
              className={`w-full rounded-2xl border p-3 text-left transition-colors ${selectedImportId === item.importId ? 'border-cyan-500/50 bg-cyan-500/10' : 'border-slate-800 bg-slate-900/40 hover:border-slate-700'}`}
            >
              <div className="grid gap-2 sm:grid-cols-3">
                <div>
                  <div className="text-slate-500 uppercase tracking-wider">Import-ID</div>
                  <div className="mt-1 break-all font-mono text-[11px] text-slate-100">{item.importId}</div>
                </div>
                <div>
                  <div className="text-slate-500 uppercase tracking-wider">Status</div>
                  <div className="mt-1 font-semibold text-slate-100">{item.status}</div>
                </div>
                <div>
                  <div className="text-slate-500 uppercase tracking-wider">Snapshot</div>
                  <div className="mt-1 font-semibold text-slate-100">{item.snapshotReference ? 'vorhanden' : 'nicht vorhanden'}</div>
                </div>
                <div>
                  <div className="text-slate-500 uppercase tracking-wider">Zeitpunkt</div>
                  <div className="mt-1 font-semibold text-slate-100">{new Date(item.createdAt).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-slate-500 uppercase tracking-wider">Apply / Verify</div>
                  <div className="mt-1 font-semibold text-slate-100">{item.applyStatus} / {item.verifyStatus}</div>
                </div>
                <div>
                  <div className="text-slate-500 uppercase tracking-wider">Fehler</div>
                  <div className="mt-1 font-semibold text-slate-100">{item.errorCategory ?? '-'}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {selectedReport && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-3">
            <div className="mb-2 font-bold uppercase tracking-wider text-slate-200">Technischer Abschlussbericht</div>
            <pre className="max-h-80 overflow-auto rounded-xl bg-slate-950 p-3 text-[11px] text-slate-200">{JSON.stringify(selectedReport, null, 2)}</pre>
          </div>
        )}
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-slate-200">
            <RotateCcw className="h-4 w-4 text-emerald-400" />
            Snapshot-Restore
          </div>
          <button type="button" onClick={() => void loadRestoreHistory(selectedRestoreId).catch((error) => setRestoreWarning(error instanceof Error ? error.message : 'Restore-Historie konnte nicht geladen werden.'))} className="rounded-xl border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-300">
            Aktualisieren
          </button>
        </div>
        <div className="space-y-2">
          {restoreHistory.length === 0 && <div className="text-slate-500">Noch keine Restore-Protokolle vorhanden.</div>}
          {restoreHistory.map((item) => (
            <div key={item.restoreId} className={`rounded-2xl border p-3 ${selectedRestoreId === item.restoreId ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-slate-800 bg-slate-900/40'}`}>
              <div className="grid gap-2 sm:grid-cols-3">
                <div><div className="text-slate-500 uppercase tracking-wider">Restore-ID</div><div className="mt-1 break-all font-mono text-[11px] text-slate-100">{item.restoreId}</div></div>
                <div><div className="text-slate-500 uppercase tracking-wider">Status</div><div className="mt-1 font-semibold text-slate-100">{item.status}</div></div>
                <div><div className="text-slate-500 uppercase tracking-wider">Snapshot</div><div className="mt-1 font-semibold text-slate-100">{item.snapshotReference}</div></div>
                <div><div className="text-slate-500 uppercase tracking-wider">Größe</div><div className="mt-1 font-semibold text-slate-100">{item.snapshotSizeBytes} B</div></div>
                <div><div className="text-slate-500 uppercase tracking-wider">Bestätigt</div><div className="mt-1 font-semibold text-slate-100">{item.confirmed ? 'ja' : 'nein'}</div></div>
                <div><div className="text-slate-500 uppercase tracking-wider">Rollback</div><div className="mt-1 font-semibold text-slate-100">{item.rollbackStatus}</div></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void sendRestoreAnalyze(item.sourceImportId).catch((error) => setRestoreWarning(error instanceof Error ? error.message : 'Restore-Analyse fehlgeschlagen.'))} className="rounded-xl bg-cyan-500 px-3 py-1.5 text-[11px] font-bold text-slate-950">Snapshot prüfen</button>
                <button type="button" onClick={() => void sendRestoreConfirm(item.restoreId).catch((error) => setRestoreWarning(error instanceof Error ? error.message : 'Restore-Bestätigung fehlgeschlagen.'))} className="rounded-xl bg-amber-500 px-3 py-1.5 text-[11px] font-bold text-slate-950">Bestätigen</button>
                <button type="button" onClick={() => void sendRestoreApply(item.restoreId).catch((error) => setRestoreWarning(error instanceof Error ? error.message : 'Restore fehlgeschlagen.'))} className="rounded-xl bg-emerald-500 px-3 py-1.5 text-[11px] font-bold text-slate-950">Restore starten</button>
                <button type="button" onClick={() => { setSelectedRestoreId(item.restoreId); void loadRestoreReport(item.restoreId).catch((error) => setRestoreWarning(error instanceof Error ? error.message : 'Restore-Bericht konnte nicht geladen werden.')); }} className="rounded-xl border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-300">Bericht</button>
              </div>
            </div>
          ))}
        </div>
        {selectedRestoreReport && <pre className="max-h-80 overflow-auto rounded-xl bg-slate-950 p-3 text-[11px] text-slate-200">{JSON.stringify(selectedRestoreReport, null, 2)}</pre>}
      </div>

      {warnings.length > 0 && <div className="space-y-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-100"><div className="font-bold uppercase tracking-wider">Warnungen</div><ul className="space-y-1">{warnings.map((warning, index) => <li key={index}>• {warning}</li>)}</ul></div>}
      {blockers.length > 0 && <div className="space-y-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-100"><div className="font-bold uppercase tracking-wider">Blocker</div><ul className="space-y-1">{blockers.map((blocker, index) => <li key={index}>• {blocker}</li>)}</ul></div>}
      {restoreWarning && <div className="space-y-2 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-xs text-emerald-100"><div className="font-bold uppercase tracking-wider">Restore-Hinweis</div><div>{restoreWarning}</div></div>}
      {fileError && <div className="flex items-start gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-100"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{fileError}</span></div>}
    </div>
  );
}
