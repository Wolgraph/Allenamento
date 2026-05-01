import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { getSessionSets } from '../database/sessionRepository';
import type { SessionRow } from '../database/sessionRepository';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function esc(v: string): string {
  return v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v;
}

export async function exportSessionsToCsv(sessions: SessionRow[]): Promise<void> {
  let csv = 'Data,Piano,Scheda,Durata,Esercizio,Serie,Reps,Peso (kg)\n';

  for (const session of sessions) {
    const sets = getSessionSets(session.id);
    const date = formatDate(session.started_at);
    const dur  = formatDuration(session.duration_s ?? 0);

    if (sets.length === 0) {
      csv += `${esc(date)},${esc(session.plan_name)},${esc(session.card_name)},${esc(dur)},,,\n`;
    } else {
      for (const set of sets) {
        csv += `${esc(date)},${esc(session.plan_name)},${esc(session.card_name)},${esc(dur)},${esc(set.exercise_name)},${set.set_number},${set.reps},${set.weight ?? ''}\n`;
      }
    }
  }

  const filename = `storico_${Date.now()}.csv`;
  const path = FileSystem.cacheDirectory! + filename;
  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
  await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Esporta storico CSV' });
}
