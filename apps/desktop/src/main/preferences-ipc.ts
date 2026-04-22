/**
 * User preferences IPC handlers (main process).
 *
 * Persists non-provider, non-locale preferences to
 * `~/.config/open-codesign/preferences.json`.  Kept separate from config.toml
 * so it can be read quickly at boot before the TOML loader finishes.
 *
 * Schema: { schemaVersion: 1, updateChannel: 'stable'|'beta', generationTimeoutSec: number }
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { CodesignError, ERROR_CODES } from '@open-codesign/shared';
import { ipcMain } from 'electron';
import { configDir } from './config';
import { getLogger } from './logger';

const logger = getLogger('preferences-ipc');

const SCHEMA_VERSION = 5;
// v1 → v2: raise the abandoned 120s timeout default (which aborted real
// agentic runs mid-loop) to 600s. Values that happen to equal the old
// default are treated as unmigrated defaults, not user intent.
const V1_DEFAULT_TIMEOUT_SEC = 120;
// v2 -> v3: 600s still clips slower long-form multi-turn runs, so the default
// moves to 1200s.
const V2_DEFAULT_TIMEOUT_SEC = 600;

function prefsFile(): string {
  return join(configDir(), 'preferences.json');
}

export type UpdateChannel = 'stable' | 'beta';

export interface Preferences {
  updateChannel: UpdateChannel;
  generationTimeoutSec: number;
  checkForUpdatesOnStartup: boolean;
  dismissedUpdateVersion: string;
  /** Epoch ms of the last time the user opened the Diagnostics panel.
   *  Persisted so the unread-error badge doesn't flash every historical
   *  error after a restart. */
  diagnosticsLastReadTs: number;
}

interface PreferencesFile extends Preferences {
  schemaVersion: number;
}

const DEFAULTS: Preferences = {
  updateChannel: 'stable',
  // Agentic runs do multiple LLM turns + tool executions + file writes, so
  // 120s was too tight and 600s still clips slower long-form runs. Default to
  // 1200s (20 min); users on fast endpoints can lower this
  // in Settings → Advanced.
  generationTimeoutSec: 1200,
  checkForUpdatesOnStartup: true,
  dismissedUpdateVersion: '',
  diagnosticsLastReadTs: 0,
};

export async function readPersisted(): Promise<Preferences> {
  const file = prefsFile();
  try {
    const raw = await readFile(file, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PreferencesFile>;
    const persistedSchema = typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : 1;
    const rawTimeout =
      typeof parsed.generationTimeoutSec === 'number' && parsed.generationTimeoutSec > 0
        ? parsed.generationTimeoutSec
        : DEFAULTS.generationTimeoutSec;
    const migratedTimeout =
      persistedSchema < 2 && rawTimeout === V1_DEFAULT_TIMEOUT_SEC
        ? DEFAULTS.generationTimeoutSec
        : persistedSchema < 3 && rawTimeout === V2_DEFAULT_TIMEOUT_SEC
          ? DEFAULTS.generationTimeoutSec
          : rawTimeout;
    return {
      updateChannel:
        parsed.updateChannel === 'stable' || parsed.updateChannel === 'beta'
          ? parsed.updateChannel
          : DEFAULTS.updateChannel,
      generationTimeoutSec: migratedTimeout,
      checkForUpdatesOnStartup:
        typeof parsed.checkForUpdatesOnStartup === 'boolean'
          ? parsed.checkForUpdatesOnStartup
          : DEFAULTS.checkForUpdatesOnStartup,
      dismissedUpdateVersion:
        typeof parsed.dismissedUpdateVersion === 'string'
          ? parsed.dismissedUpdateVersion
          : DEFAULTS.dismissedUpdateVersion,
      diagnosticsLastReadTs:
        typeof parsed.diagnosticsLastReadTs === 'number' && parsed.diagnosticsLastReadTs >= 0
          ? parsed.diagnosticsLastReadTs
          : persistedSchema < SCHEMA_VERSION
            ? // One-time migration seed: users upgrading from a schema < 5 prefs
              // file have no record of when they last read the Diagnostics panel,
              // so counting every historical error row as unread would flash a
              // "99+" badge on first launch. Seed to "now" so only errors that
              // happen after the upgrade count as unread. Fresh installs miss
              // this branch (ENOENT path above returns DEFAULTS) and stay at 0,
              // which is fine because their diagnostics DB is empty anyway.
              Date.now()
            : DEFAULTS.diagnosticsLastReadTs,
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return { ...DEFAULTS };
    throw new CodesignError(
      `Failed to read preferences at ${file}: ${err instanceof Error ? err.message : String(err)}`,
      'PREFERENCES_READ_FAILED',
    );
  }
}

async function writePersisted(prefs: Preferences): Promise<void> {
  const file = prefsFile();
  await mkdir(dirname(file), { recursive: true });
  const payload: PreferencesFile = { schemaVersion: SCHEMA_VERSION, ...prefs };
  await writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function parsePreferences(raw: unknown): Partial<Preferences> {
  if (typeof raw !== 'object' || raw === null) {
    throw new CodesignError('preferences:update expects an object', ERROR_CODES.IPC_BAD_INPUT);
  }
  const r = raw as Record<string, unknown>;
  const out: Partial<Preferences> = {};
  if (r['updateChannel'] !== undefined) {
    if (r['updateChannel'] !== 'stable' && r['updateChannel'] !== 'beta') {
      throw new CodesignError(
        'updateChannel must be "stable" or "beta"',
        ERROR_CODES.IPC_BAD_INPUT,
      );
    }
    out.updateChannel = r['updateChannel'] as UpdateChannel;
  }
  if (r['generationTimeoutSec'] !== undefined) {
    if (typeof r['generationTimeoutSec'] !== 'number' || r['generationTimeoutSec'] <= 0) {
      throw new CodesignError(
        'generationTimeoutSec must be a positive number',
        ERROR_CODES.IPC_BAD_INPUT,
      );
    }
    out.generationTimeoutSec = r['generationTimeoutSec'];
  }
  if (r['checkForUpdatesOnStartup'] !== undefined) {
    if (typeof r['checkForUpdatesOnStartup'] !== 'boolean') {
      throw new CodesignError(
        'checkForUpdatesOnStartup must be a boolean',
        ERROR_CODES.IPC_BAD_INPUT,
      );
    }
    out.checkForUpdatesOnStartup = r['checkForUpdatesOnStartup'];
  }
  if (r['dismissedUpdateVersion'] !== undefined) {
    if (typeof r['dismissedUpdateVersion'] !== 'string') {
      throw new CodesignError('dismissedUpdateVersion must be a string', ERROR_CODES.IPC_BAD_INPUT);
    }
    out.dismissedUpdateVersion = r['dismissedUpdateVersion'];
  }
  if (r['diagnosticsLastReadTs'] !== undefined) {
    if (typeof r['diagnosticsLastReadTs'] !== 'number' || r['diagnosticsLastReadTs'] < 0) {
      throw new CodesignError(
        'diagnosticsLastReadTs must be a non-negative number',
        ERROR_CODES.IPC_BAD_INPUT,
      );
    }
    out.diagnosticsLastReadTs = r['diagnosticsLastReadTs'];
  }
  return out;
}

export function registerPreferencesIpc(): void {
  // ── Preferences v1 channels ─────────────────────────────────────────────────

  ipcMain.handle('preferences:v1:get', async (): Promise<Preferences> => {
    return readPersisted();
  });

  ipcMain.handle('preferences:v1:update', async (_e, raw: unknown): Promise<Preferences> => {
    const patch = parsePreferences(raw);
    const current = await readPersisted();
    const next: Preferences = { ...current, ...patch };
    await writePersisted(next);
    return next;
  });

  // ── Preferences legacy shims (schedule removal next minor) ──────────────────

  ipcMain.handle('preferences:get', async (): Promise<Preferences> => {
    logger.warn('legacy preferences:get channel used, schedule removal next minor');
    return readPersisted();
  });

  ipcMain.handle('preferences:update', async (_e, raw: unknown): Promise<Preferences> => {
    logger.warn('legacy preferences:update channel used, schedule removal next minor');
    const patch = parsePreferences(raw);
    const current = await readPersisted();
    const next: Preferences = { ...current, ...patch };
    await writePersisted(next);
    return next;
  });
}
