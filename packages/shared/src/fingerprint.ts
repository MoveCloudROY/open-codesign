/**
 * Fingerprint — a short stable hash identifying "the same bug" across runs.
 *
 * Used by PR3's diagnostic_events store (and PR4's "You reported this
 * yesterday" dedup prompt) to group recurring errors without over-merging
 * superficially similar but genuinely distinct failures.
 *
 * Design:
 *   fingerprint = firstEight(sha1(errorCode + "|" + top-3-normalized-stack-frames))
 *
 * Normalized stack frame:
 *   - strip absolute paths (keep basename only)
 *   - strip line/column numbers
 *   - strip node_modules/.pnpm/PKG@VER noise
 *   - keep function/method name + short file name
 *   - ignore frames without identifiable code ("<anonymous>", "internal/")
 *
 * We hash the code + top-3 frames rather than the whole stack because
 *   - top-3 is where the bug actually lives; deeper frames are scaffolding
 *   - different message text for the same bug (user names, ids, etc.) shouldn't
 *     fork the fingerprint
 *   - short hash keeps it greppable in GitHub issue titles
 */

import { createHash } from 'node:crypto';

export interface FingerprintInput {
  errorCode: string;
  stack: string | undefined;
}

export function computeFingerprint(input: FingerprintInput): string {
  const frames = extractTopFrames(input.stack, 3).map(normalizeFrame);
  const basis = `${input.errorCode}|${frames.join('\n')}`;
  return createHash('sha1').update(basis).digest('hex').slice(0, 8);
}

function extractTopFrames(stack: string | undefined, limit: number): string[] {
  if (typeof stack !== 'string' || stack.length === 0) return [];
  const lines = stack.split('\n');
  const frames: string[] = [];
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('at ')) continue;
    if (isNoiseFrame(trimmed)) continue;
    frames.push(trimmed);
    if (frames.length >= limit) break;
  }
  return frames;
}

function isNoiseFrame(frame: string): boolean {
  return (
    frame.includes('<anonymous>') ||
    frame.includes('internal/') ||
    frame.includes('node:internal') ||
    /node_modules[\\/]\.pnpm[\\/]vitest/.test(frame) ||
    /node_modules[\\/]\.pnpm[\\/]@vitest/.test(frame)
  );
}

export function normalizeFrame(frame: string): string {
  // Drop trailing "(path:line:col)" — keep function name only when available.
  // Examples we want to normalize:
  //   at generate (/Users/x/code/pkg/src/index.ts:482:11)
  //     -> at generate (index.ts)
  //   at Object.<anonymous> (/Users/x/foo.js:1:1)
  //     -> at Object (foo.js)
  //   at /Users/x/foo.js:1:1
  //     -> at foo.js
  const withoutLineCol = frame.replace(/:\d+:\d+\)?$/, (m) => (m.endsWith(')') ? ')' : ''));
  return withoutLineCol.replace(/\(([^()]*[\\/])?([^()\\/:]+)(?::\d+(?::\d+)?)?\)/, '($2)');
}
