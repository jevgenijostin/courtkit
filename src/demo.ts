import type { TournamentState } from './domain';
import { generateSchedule } from './scheduler';

export function createSampleTournament(): TournamentState {
  const teams = [
    'Baseline Crew', 'Kitchen Kings', 'Court & Spark', 'The Spin Doctors',
    'Dink Dynasty', 'Lob Stars', 'Net Results', 'Rally Rebels',
  ].map((name, index) => ({ id: `team-${index + 1}`, name }));
  const schedule = generateSchedule(teams, 2);
  const scores = [[11, 7], [8, 11], [11, 5], [9, 11], [12, 10], [6, 11], [11, 8], [11, 4]];
  const results = schedule.slice(0, 4).flatMap(round => round.matches).map((match, index) => ({
    matchId: match.id, homeScore: scores[index][0], awayScore: scores[index][1],
  }));
  return { version: 1, teams, courtCount: 2, schedule, results };
}
