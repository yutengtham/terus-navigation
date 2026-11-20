import { useEffect, useState } from 'react';
import type { RoadReport } from '../models/report';
import { reportsRepository } from '../services/reportsRepository';

/** The user's reports (newest first), kept up to date when one is added or deleted. */
export function useReports(): RoadReport[] {
  const [reports, setReports] = useState<RoadReport[]>([]);
  useEffect(() => {
    let alive = true;
    const load = () => void reportsRepository.list().then((r) => alive && setReports(r));
    load();
    const off = reportsRepository.subscribe(load);
    return () => {
      alive = false;
      off();
    };
  }, []);
  return reports;
}
