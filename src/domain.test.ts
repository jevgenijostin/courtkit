import { expect, it } from 'vitest';
import { validateScore } from './domain';

it.each([[99, 0], [0, 99]])('accepts boundary scores %s–%s', (homeScore, awayScore) => {
  expect(() => validateScore({ matchId: 'match', homeScore, awayScore })).not.toThrow();
});

it.each([[100, 11], [11, 100], [-1, 11], [11, -1], [1.5, 11], [11, NaN], [Infinity, 11], [99, 99]])(
  'rejects invalid scores %s–%s', (homeScore, awayScore) => {
    expect(() => validateScore({ matchId: 'match', homeScore, awayScore })).toThrow('integer scores from 0–99 and a winner');
  },
);
