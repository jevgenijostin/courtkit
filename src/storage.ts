import { validateCourtCount, validateScore, validateTeams } from './domain';
import type { TournamentState } from './domain';

export const STORAGE_KEY = 'courtkit:tournament:v1';
export type StorageAdapter = Pick<Storage, 'getItem' | 'setItem'>;

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function object(value: unknown, keys: string[]): Record<string, unknown> {
  requireCondition(value !== null && typeof value === 'object' && !Array.isArray(value), 'Expected an object.');
  const record = value as Record<string, unknown>;
  requireCondition(Object.keys(record).length === keys.length && keys.every(key => Object.hasOwn(record, key)),
    `Expected fields: ${keys.join(', ')}.`);
  return record;
}

function array(value: unknown): unknown[] {
  requireCondition(Array.isArray(value), 'Expected an array.');
  return value;
}

/** Strict versioned schema, plus referential and round-robin integrity checks. */
export function validateTournament(value: unknown): asserts value is TournamentState {
  const state = object(value, ['version', 'teams', 'courtCount', 'schedule', 'results']);
  requireCondition(state.version === 1, 'Unsupported tournament version.');
  for (const team of array(state.teams)) object(team, ['id', 'name']);
  validateTeams(state.teams as TournamentState['teams']);
  validateCourtCount(state.courtCount as number);
  const teams = new Set((state.teams as TournamentState['teams']).map(team => team.id));
  const matchIds = new Set<string>();
  const pairs = new Set<string>();
  array(state.schedule).forEach((value, index) => {
    const round = object(value, ['number', 'matches', 'byes']);
    requireCondition(round.number === index + 1, 'Round numbers must be consecutive from 1.');
    const matches = array(round.matches);
    requireCondition(matches.length > 0 && matches.length <= (state.courtCount as number), 'Invalid round court capacity.');
    const occupied = new Set<number>();
    const active = new Set<string>();
    for (const value of matches) {
      const match = object(value, ['id', 'court', 'homeTeamId', 'awayTeamId']);
      requireCondition(typeof match.id === 'string' && match.id.trim() && !matchIds.has(match.id), 'Invalid or duplicate match ID.');
      matchIds.add(match.id);
      const court = match.court as number;
      requireCondition(Number.isInteger(court) && court >= 1 && court <= (state.courtCount as number) && !occupied.has(court), 'Invalid or double-booked court.');
      occupied.add(court);
      for (const id of [match.homeTeamId, match.awayTeamId]) {
        requireCondition(typeof id === 'string' && teams.has(id) && !active.has(id), 'Unknown or double-booked team.');
        active.add(id);
      }
      const pair = JSON.stringify([match.homeTeamId, match.awayTeamId].sort());
      requireCondition(!pairs.has(pair), 'Duplicate team pairing.');
      pairs.add(pair);
    }
    const byes = array(round.byes);
    const idle = new Set<string>();
    for (const id of byes) {
      requireCondition(typeof id === 'string' && teams.has(id) && !active.has(id) && !idle.has(id), 'Invalid or duplicate bye.');
      idle.add(id);
    }
    requireCondition(idle.size + active.size === teams.size, 'Every idle team must have a bye.');
  });
  requireCondition(pairs.size === teams.size * (teams.size - 1) / 2, 'Schedule must contain every team pairing exactly once.');
  const results = new Set<string>();
  for (const value of array(state.results)) {
    const result = object(value, ['matchId', 'homeScore', 'awayScore']);
    requireCondition(typeof result.matchId === 'string' && matchIds.has(result.matchId) && !results.has(result.matchId), 'Result has an unknown or duplicate match ID.');
    validateScore(result as unknown as TournamentState['results'][number]);
    results.add(result.matchId);
  }
}

export function exportToJson(state: TournamentState): string {
  validateTournament(state);
  return JSON.stringify(state, null, 2);
}

export function importFromJson(json: string): TournamentState {
  try {
    const value: unknown = JSON.parse(json);
    validateTournament(value);
    return value;
  } catch (error) {
    throw new Error(`Invalid tournament backup: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** Inject an adapter in tests; browser callers default to localStorage.
 * Storage errors propagate so callers can report quota/access failures.
 */
export function saveTournament(state: TournamentState, storage: StorageAdapter = localStorage): void {
  storage.setItem(STORAGE_KEY, exportToJson(state));
}

export function loadTournament(storage: StorageAdapter = localStorage): TournamentState | null {
  const json = storage.getItem(STORAGE_KEY);
  return json === null ? null : importFromJson(json);
}
