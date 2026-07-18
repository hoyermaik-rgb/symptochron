import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileKey, LockKeyhole, Play, ShieldAlert } from 'lucide-react';
import { secureStore } from '../db/secureStore';
import {
  finalizeMigration,
  isMigrationStatusComplete,
  isPrivateMigrationEnabled,
  type PrivateMigrationVerificationStatus,
  readMigrationStatus,
  setMigrationConflict,
  setMigrationFailed,
  setMigrationStarted,
  writeMigrationStatus,
} from '../migration/privateMigration';

type PanelProps = {
  showToast: (msg: string) => void;
};

export function isPrivateMigrationPanelVisible(enabled: boolean): boolean {
  return enabled;
}

export function canStartPrivateMigration(snapshotConfirmed: boolean, running: boolean, complete: boolean): boolean {
  return snapshotConfirmed && !running && !complete;
}

export default function PrivateMigrationPanel({ showToast }: PanelProps) {
  const [status, setStatus] = useState(() => readMigrationStatus());
  const [running, setRunning] = useState(false);
  const [snapshotConfirmed, setSnapshotConfirmed] = useState(false);

  const enabled = isPrivateMigrationEnabled();
  const keys = useMemo(() => secureStore.getMigrationRecordKeys(), []);

  if (!isPrivateMigrationPanelVisible(enabled)) return null;

  const updateStatus = (next: typeof status) => {
    setStatus(next);
    writeMigrationStatus(next);
  };

  const handleStart = async () => {
    if (!canStartPrivateMigration(snapshotConfirmed, running, complete)) {
      showToast('⚠️ Bitte den administrativen Snapshot vor dem Start bestätigen.');
      return;
    }
    setRunning(true);
    try {
      if (!window.confirm('Bitte bestätige, dass ein administrativer Snapshot von data/symptochron.db erstellt wurde. Ohne diesen Snapshot nicht fortfahren.')) {
        return;
      }

      let next = setMigrationStarted(status);
      next = {
        ...next,
        pendingRecordKeys: [...keys],
        migratedRecordKeys: [],
        verifiedRecordKeys: [],
        records: {},
      };
      updateStatus(next);

      const sourceSnapshotHash = await secureStore.calculateRecordHash({
        keys,
        startedAt: next.migrationStartedAt,
        deviceId: next.deviceId,
      });
      updateStatus({ ...next, sourceSnapshotHash });

      for (const recordKey of keys) {
        const result = await secureStore.migrateRecord(recordKey);
        const prev = readMigrationStatus();
        const records = { ...prev.records, [recordKey]: result };
        const migratedRecordKeys = result.status === 'failed' ? prev.migratedRecordKeys : Array.from(new Set([...prev.migratedRecordKeys, recordKey]));
        const verifiedRecordKeys = result.status === 'verified' ? Array.from(new Set([...prev.verifiedRecordKeys, recordKey])) : prev.verifiedRecordKeys;
        const pendingRecordKeys = prev.pendingRecordKeys.filter((key) => key !== recordKey);
        const targetSnapshotHash = await secureStore.calculateRecordHash({ records, verifiedRecordKeys, migratedRecordKeys });

        const verificationStatus: PrivateMigrationVerificationStatus =
          result.status === 'conflict' ? 'conflict' :
          result.status === 'failed' ? 'failed' :
          'in_progress';

        const nextStatus = {
          ...prev,
          records,
          migratedRecordKeys,
          verifiedRecordKeys,
          pendingRecordKeys,
          targetSnapshotHash,
          lastError: result.error ?? null,
          verificationStatus,
        };
        updateStatus(nextStatus);

        if (result.status === 'conflict') {
          updateStatus(setMigrationConflict(nextStatus, result.error || 'Konflikt erkannt.'));
          showToast('⚠️ Konflikt erkannt. Migration angehalten.');
          return;
        }

        if (result.status === 'failed') {
          updateStatus(setMigrationFailed(nextStatus, result.error || 'Migration fehlgeschlagen.'));
          showToast('❌ Migration fehlgeschlagen.');
          return;
        }
      }

      const completed = finalizeMigration({
        ...readMigrationStatus(),
        migrationCompletedAt: readMigrationStatus().migrationCompletedAt,
      });
      updateStatus({
        ...completed,
        migrationCompletedAt: completed.migrationCompletedAt,
        verificationStatus: 'matched',
        pendingRecordKeys: [],
        lastError: null,
      });
      showToast('✅ Erstübernahme erfolgreich verifiziert.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unbekannter Migrationsfehler.';
      updateStatus(setMigrationFailed(readMigrationStatus(), message));
      showToast(`❌ ${message}`);
    } finally {
      setRunning(false);
    }
  };

  const complete = isMigrationStatusComplete(status);
  const startAllowed = canStartPrivateMigration(snapshotConfirmed, running, complete);

  return (
    <div className="space-y-4 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-2.5">
          <ShieldAlert className="h-5 w-5 text-emerald-400" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold uppercase tracking-widest text-slate-100">Private Erstübernahme</h4>
          <p className="text-xs text-slate-400">Nur für dich sichtbar. Handydaten werden lokal gelesen, hochgeladen und verifiziert. Kein Delete, kein Auto-Start.</p>
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-xs text-slate-300">
        <input
          type="checkbox"
          checked={snapshotConfirmed}
          onChange={(e) => setSnapshotConfirmed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500"
        />
        <span>Ich bestätige, dass ein Snapshot von <code>data/symptochron.db</code> erstellt wurde.</span>
      </label>

      <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-xs text-slate-300 space-y-2">
        <div className="flex items-center gap-2 text-slate-200"><Download className="h-4 w-4 text-emerald-400" /> Vorhandenes Handy-Backup ist Voraussetzung.</div>
        <div className="flex items-center gap-2 text-slate-200"><LockKeyhole className="h-4 w-4 text-blue-400" /> `data/symptochron.db` muss zuvor snapshot-gesichert sein.</div>
        <div className="flex items-center gap-2 text-slate-200"><FileKey className="h-4 w-4 text-violet-400" /> RecordKeys: {keys.join(', ')}</div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
          <div className="text-slate-500 uppercase tracking-wider">Status</div>
          <div className="mt-1 font-bold text-slate-100">{status.verificationStatus}</div>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/50 p-3">
          <div className="text-slate-500 uppercase tracking-wider">Komplett</div>
          <div className="mt-1 font-bold text-slate-100">{complete ? 'ja' : 'nein'}</div>
        </div>
      </div>

      <div className="space-y-2">
        {keys.map((key) => {
          const record = status.records[key];
          return (
            <div key={key} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/40 px-3 py-2 text-xs">
              <span className="font-semibold text-slate-200">{key}</span>
              <span className={`font-bold ${record?.status === 'verified' ? 'text-emerald-400' : record?.status === 'conflict' ? 'text-rose-400' : record?.status === 'failed' ? 'text-amber-400' : 'text-slate-400'}`}>
                {record?.status || 'pending'}
              </span>
            </div>
          );
        })}
      </div>

      {status.lastError && (
        <div className="flex items-start gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{status.lastError}</span>
        </div>
      )}

      <button
        type="button"
        disabled={!startAllowed}
        onClick={handleStart}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-xs font-bold text-slate-950 transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Play className="h-4 w-4" />
        {complete ? 'Bereits abgeschlossen' : running ? 'Läuft...' : 'Erstübernahme starten'}
      </button>
    </div>
  );
}
