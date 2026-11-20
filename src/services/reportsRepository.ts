// Where reports live. Today: this device only (IndexedDB, photos included).
// A server version can implement the same interface later and be swapped in at `reportsRepository`.

import type { RoadReport } from '../models/report';
import { idbDelete, idbGet, idbKeys, idbSet } from '../utils/idb';

export interface ReportsRepository {
  list(): Promise<RoadReport[]>;
  get(id: string): Promise<RoadReport | undefined>;
  save(report: RoadReport): Promise<boolean>;
  remove(id: string): Promise<void>;
  /** Called after any change; returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;
}

const PREFIX = 'report.';

class LocalReportsRepository implements ReportsRepository {
  private listeners = new Set<() => void>();

  async list(): Promise<RoadReport[]> {
    const keys = await idbKeys(PREFIX);
    const all = await Promise.all(keys.map((k) => idbGet<RoadReport>(k)));
    return all.filter((r): r is RoadReport => !!r && typeof r.id === 'string').sort((a, b) => b.createdAt - a.createdAt);
  }
  get(id: string): Promise<RoadReport | undefined> {
    return idbGet<RoadReport>(PREFIX + id);
  }
  async save(report: RoadReport): Promise<boolean> {
    const ok = await idbSet(PREFIX + report.id, report);
    this.emit();
    return ok;
  }
  async remove(id: string): Promise<void> {
    await idbDelete(PREFIX + id);
    this.emit();
  }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  private emit(): void {
    for (const l of this.listeners) l();
  }
}

export const reportsRepository: ReportsRepository = new LocalReportsRepository();

export function newReportId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
