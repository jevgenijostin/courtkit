import { expect, it } from 'vitest';
import type { TournamentState } from './domain';
import { generateSchedule } from './scheduler';
import { exportToJson, importFromJson, loadTournament, saveTournament, STORAGE_KEY } from './storage';

function fixture(): TournamentState {
  const teams = Array.from({ length: 5 }, (_, i) => ({ id: `t${i}`, name: `Doubles ${i} 🎾` }));
  const schedule = generateSchedule(teams, 2);
  return { version: 1, teams, courtCount: 2, schedule,
    results: [{ matchId: schedule[0].matches[0].id, homeScore: 11, awayScore: 7 }] };
}

it('round-trips teams, schedule, byes and scores losslessly', () => {
  const state = fixture();
  const restored = importFromJson(exportToJson(state));
  expect(restored).toEqual(state);
  expect(restored).not.toBe(state);
});

it('persists and loads JSON through a localStorage-compatible adapter', () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value); } };
  expect(loadTournament(storage)).toBeNull();
  saveTournament(fixture(), storage);
  expect(data.get(STORAGE_KEY)).toBe(exportToJson(fixture()));
  expect(loadTournament(storage)).toEqual(fixture());
  data.set(STORAGE_KEY, '{broken');
  expect(() => loadTournament(storage)).toThrow(/Invalid tournament backup/);
});

it('propagates storage failures', () => {
  expect(() => saveTournament(fixture(), {
    getItem: () => null, setItem: () => { throw new Error('Quota exceeded'); },
  })).toThrow('Quota exceeded');
});

it.each(['', '{', 'null', '[]', '42', '{}', '{"teams":[]}'])('rejects malformed import %j', json => {
  expect(() => importFromJson(json)).toThrow(/Invalid tournament backup/);
});

const corruptions: [string, (state: TournamentState) => void][] = [
  ['version', state => { Object.assign(state, { version: 2 }); }],
  ['extra fields', state => { Object.assign(state, { surprise: true }); }],
  ['missing results', state => { Reflect.deleteProperty(state, 'results'); }],
  ['wrong array shape', state => { Object.assign(state, { schedule: {} }); }],
  ['null team', state => { Object.assign(state.teams, { 0: null }); }],
  ['duplicate team', state => { state.teams[1].id = state.teams[0].id; }],
  ['empty name', state => { state.teams[0].name = ' '; }],
  ['court count', state => { state.courtCount = 0; }],
  ['round number', state => { state.schedule[0].number = 2; }],
  ['missing pairing', state => { state.schedule.pop(); }],
  ['duplicate pairing', state => { state.schedule.push({ ...state.schedule[0], number: state.schedule.length + 1,
    matches: state.schedule[0].matches.map(match => ({ ...match, id: `copy-${match.id}` })) }); }],
  ['duplicate match ID', state => { state.schedule[1].matches[0].id = state.schedule[0].matches[0].id; }],
  ['double-booked court', state => { state.schedule[0].matches[1].court = 1; }],
  ['out of range court', state => { state.schedule[0].matches[0].court = 3; }],
  ['unknown team', state => { state.schedule[0].matches[0].homeTeamId = 'unknown'; }],
  ['double-booked team', state => { state.schedule[0].matches[1].homeTeamId = state.schedule[0].matches[0].homeTeamId; }],
  ['missing bye', state => { state.schedule[0].byes = []; }],
  ['duplicate bye', state => { state.schedule[0].byes.push(state.schedule[0].byes[0]); }],
  ['active bye', state => { state.schedule[0].byes = [state.schedule[0].matches[0].homeTeamId]; }],
  ['unknown result', state => { state.results[0].matchId = 'unknown'; }],
  ['duplicate result', state => { state.results.push(state.results[0]); }],
  ['negative score', state => { state.results[0].homeScore = -1; }],
  ['fractional score', state => { state.results[0].homeScore = 1.5; }],
  ['string score', state => { Object.assign(state.results[0], { homeScore: '11' }); }],
  ['drawn score', state => { state.results[0].homeScore = state.results[0].awayScore; }],
];
it.each(corruptions)('rejects invalid tournament: %s', (_, corrupt) => {
  const state = fixture();
  corrupt(state);
  expect(() => importFromJson(JSON.stringify(state))).toThrow(/Invalid tournament backup/);
});

it('validates before overwriting a saved tournament', () => {
  let written = false;
  const state = fixture();
  state.results[0].homeScore = -1;
  expect(() => saveTournament(state, { getItem: () => null, setItem: () => { written = true; } })).toThrow();
  expect(written).toBe(false);
});
