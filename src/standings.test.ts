import { expect, it } from 'vitest';
import { computeStandings } from './standings';
import { generateSchedule } from './scheduler';
import type { MatchResult } from './domain';

const teams = ['a', 'b', 'c', 'd'].map(id => ({ id, name: id }));
const schedule = generateSchedule(teams, 2);
function result(home: string, away: string, homeScore: number, awayScore: number): MatchResult {
  const match = schedule.flatMap(round => round.matches).find(match =>
    [match.homeTeamId, match.awayTeamId].includes(home) && [match.homeTeamId, match.awayTeamId].includes(away))!;
  return match.homeTeamId === home ? { matchId: match.id, homeScore, awayScore }
    : { matchId: match.id, homeScore: awayScore, awayScore: homeScore };
}

it('sorts wins before differential and counts both sides of every result', () => {
  const results = [result('a', 'b', 11, 10), result('a', 'c', 11, 10), result('b', 'd', 11, 0)];
  const snapshot = structuredClone({ teams, schedule, results });
  expect(computeStandings(teams, schedule, results)).toEqual([
    { teamId: 'a', played: 2, wins: 2, losses: 0, pointsFor: 22, pointsAgainst: 20, pointDifferential: 2, rank: 1 },
    { teamId: 'b', played: 2, wins: 1, losses: 1, pointsFor: 21, pointsAgainst: 11, pointDifferential: 10, rank: 2 },
    { teamId: 'c', played: 1, wins: 0, losses: 1, pointsFor: 10, pointsAgainst: 11, pointDifferential: -1, rank: 3 },
    { teamId: 'd', played: 1, wins: 0, losses: 1, pointsFor: 0, pointsAgainst: 11, pointDifferential: -11, rank: 4 },
  ]);
  expect({ teams, schedule, results }).toEqual(snapshot);
});

it('uses differential to order teams with equal wins', () => {
  const table = computeStandings(teams, schedule, [result('a', 'b', 11, 10), result('c', 'd', 11, 0)]);
  expect(table.map(row => row.teamId)).toEqual(['c', 'a', 'b', 'd']);
});

it('leaves unresolved ties tied with competition ranks', () => {
  const table = computeStandings(teams, schedule, [result('a', 'b', 11, 5), result('c', 'd', 11, 5)]);
  expect(table.map(row => [row.teamId, row.rank])).toEqual([['a', 1], ['c', 1], ['b', 3], ['d', 3]]);
});

it('leaves unplayed teams at zero and tied', () => {
  expect(computeStandings(teams, schedule, []).every(row => row.rank === 1 && row.played === 0 && row.wins === 0)).toBe(true);
});

it.each([[0, 0], [-1, 11], [1.5, 11], [Infinity, 11]])('rejects invalid completed score %s–%s', (home, away) => {
  expect(() => computeStandings(teams, schedule, [result('a', 'b', home, away)])).toThrow(/scores/);
});

it('rejects unknown and duplicate results', () => {
  const score = result('a', 'b', 11, 5);
  expect(() => computeStandings(teams, schedule, [score, score])).toThrow(/duplicate/);
  expect(() => computeStandings(teams, schedule, [{ ...score, matchId: 'missing' }])).toThrow(/unknown/);
});
