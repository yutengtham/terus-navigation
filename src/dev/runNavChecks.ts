// Terminal runner for the nav + hazard checks: npx tsx src/dev/runNavChecks.ts
import { runAvatarChecks } from './avatarChecks';
import { runHazardChecks } from './hazardChecks';
import { runNavChecks } from './navChecks';
import { runVoiceChecks } from './voiceChecks';
import { runPosterChecks } from './posterChecks';

const results = [...runNavChecks(), ...(await runHazardChecks()), ...runAvatarChecks(), ...runVoiceChecks(), ...runPosterChecks()];
for (const r of results) console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.pass ? '' : `  -> ${r.detail}`}`);
const failed = results.filter((r) => !r.pass).length;
console.log(failed ? `\n${failed} of ${results.length} FAILED` : `\nAll ${results.length} checks passed`);
const proc = (globalThis as { process?: { exitCode?: number } }).process;
if (failed && proc) proc.exitCode = 1;
