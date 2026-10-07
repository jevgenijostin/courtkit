import { describe, expect, it } from 'vitest';
import { generateSchedule } from './scheduler';

export const makeTeams = (count: number) => Array.from({ length: count }, (_, i) => ({ id: `team-${i}`, name: `Team ${i + 1}` }));

describe('round-robin scheduler', () => {
  for (let count = 4; count <= 12; count++) {
    for (let courts = 1; courts <= 4; courts++) {
      it(`${count} teams on ${courts} courts: unique complete pairings, legal courts and explicit byes`, () => {
        const teams = makeTeams(count);
        const snapshot = structuredClone(teams);
        const schedule = generateSchedule(teams, courts);
        const pairs = new Set<string>();
        const ids = new Set<string>();
        const games = new Map(teams.map(team => [team.id, 0]));
        schedule.forEach((round, index) => {
          expect(round.number).toBe(index + 1);
          expect(round.matches.length).toBeGreaterThan(0);
          expect(round.matches.length).toBeLessThanOrEqual(courts);
          const active = round.matches.flatMap(match => [match.homeTeamId, match.awayTeamId]);
          expect(new Set(active).size).toBe(active.length);
          expect(new Set(round.matches.map(match => match.court)).size).toBe(round.matches.length);
          for (const match of round.matches) {
            expect(match.court).toBeGreaterThanOrEqual(1);
            expect(match.court).toBeLessThanOrEqual(courts);
            const pair = JSON.stringify([match.homeTeamId, match.awayTeamId].sort());
            expect(pairs.has(pair)).toBe(false);
            expect(ids.has(match.id)).toBe(false);
            pairs.add(pair);
            ids.add(match.id);
          }
          expect([...round.byes].sort()).toEqual(teams.map(team => team.id).filter(id => !active.includes(id)).sort());
          for (const id of active) games.set(id, games.get(id)! + 1);
        });
        expect(pairs.size).toBe(count * (count - 1) / 2);
        expect([...games.values()]).toEqual(Array(count).fill(count - 1));
        expect(generateSchedule(teams, courts)).toEqual(schedule);
        expect(teams).toEqual(snapshot);
      });
    }
  }

  it.each([5, 7])('gives each of %i odd teams one bye when all matches fit', count => {
    const teams = makeTeams(count);
    const schedule = generateSchedule(teams, 4);
    expect(schedule).toHaveLength(count);
    expect(schedule.every(round => round.byes.length === 1)).toBe(true);
    for (const team of teams) expect(schedule.filter(round => round.byes.includes(team.id))).toHaveLength(1);
  });

  it('adds capacity byes for even teams', () => {
    expect(generateSchedule(makeTeams(4), 1).every(round => round.byes.length === 2)).toBe(true);
  });

  it.each([0, 3, 13])('rejects %i teams', count => {
    expect(() => generateSchedule(makeTeams(count), 1)).toThrow(/4–12/);
  });
  it.each([0, 5, 1.5, NaN])('rejects invalid court count %s', courts => {
    expect(() => generateSchedule(makeTeams(4), courts)).toThrow(/1–4/);
  });
  it('rejects duplicate team IDs', () => {
    const teams = makeTeams(4);
    teams[1].id = teams[0].id;
    expect(() => generateSchedule(teams, 2)).toThrow(/unique/);
  });
});
