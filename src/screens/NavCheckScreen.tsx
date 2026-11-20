import { useEffect, useState } from 'react';
import { runAvatarChecks } from '../dev/avatarChecks';
import { runHazardChecks } from '../dev/hazardChecks';
import { runNavChecks, type CheckResult } from '../dev/navChecks';
import { runVoiceChecks } from '../dev/voiceChecks';
import { runPosterChecks } from '../dev/posterChecks';

/**
 * Dev check page (open the app with ?navcheck=1): runs the lane parser and toll-distance
 * checks against a saved real Mapbox response and lists PASS / FAIL. No map, no API calls.
 */
export function NavCheckScreen() {
  const [results, setResults] = useState<CheckResult[]>(runNavChecks);
  useEffect(() => {
    let alive = true;
    void runHazardChecks().then((h) => alive && setResults([...runNavChecks(), ...h, ...runAvatarChecks(), ...runVoiceChecks(), ...runPosterChecks()]));
    return () => {
      alive = false;
    };
  }, []);
  const failed = results.filter((r) => !r.pass).length;
  return (
    <main className="nn-navcheck">
      <h1>Terus nav checks</h1>
      <p className={failed ? 'is-fail' : 'is-pass'}>
        {failed ? `${failed} of ${results.length} failed` : `All ${results.length} checks passed`}
      </p>
      <ul>
        {results.map((r) => (
          <li key={r.name} className={r.pass ? 'is-pass' : 'is-fail'}>
            <strong>{r.pass ? 'PASS' : 'FAIL'}</strong> {r.name}
            {!r.pass && <code>{r.detail}</code>}
          </li>
        ))}
      </ul>
      <p className="nn-navcheck__note">
        Data: excerpt of a real Mapbox Directions response (Bangsar → Damansara Utama, Kerinchi Link) and real data.gov.my warning / river station responses (20 Nov 2026). Remove ?navcheck=1 from the
        address to return to the app.
      </p>
    </main>
  );
}
