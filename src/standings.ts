import { validateScore, validateTeams } from './domain';
import type { MatchResult, Round, Team } from './domain';

export interface Standing {
  teamId: string;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDifferential: number;
  rank: number;
}

/** Only recorded results count. Equal wins and differential share competition
 * ranks (1, 1, 3). Input team order is retained within an unresolved tie.
 */
export function computeStandings(teams: Team[], schedule: Round[], results: MatchResult[]): Standing[] {
  validateTeams(teams);
  const rows = new Map<string, Standing>(teams.map(team => [team.id, {
    teamId: team.id, played: 0, wins: 0, losses: 0, pointsFor: 0,
    pointsAgainst: 0, pointDifferential: 0, rank: 0,
  }]));
  const matches = new Map(schedule.flatMap(round => round.matches).map(match => [match.id, match]));
  const recorded = new Set<string>();
  for (const result of results) {
    validateScore(result);
    const match = matches.get(result.matchId);
    if (!match || recorded.has(result.matchId)) throw new Error('Result has an unknown or duplicate match ID.');
    recorded.add(result.matchId);
    const home = rows.get(match.homeTeamId);
    const away = rows.get(match.awayTeamId);
    if (!home || !away || home === away) throw new Error('Match has invalid team IDs.');
    for (const [row, pointsFor, pointsAgainst] of [
      [home, result.homeScore, result.awayScore],
      [away, result.awayScore, result.homeScore],
    ] as const) {
      row.played++;
      row.pointsFor += pointsFor;
      row.pointsAgainst += pointsAgainst;
      row.pointDifferential = row.pointsFor - row.pointsAgainst;
      if (pointsFor > pointsAgainst) row.wins++;
      else row.losses++;
    }
  }
  const table = [...rows.values()].sort((a, b) => b.wins - a.wins || b.pointDifferential - a.pointDifferential);
  table.forEach((row, index) => {
    const previous = table[index - 1];
    row.rank = previous && row.wins === previous.wins && row.pointDifferential === previous.pointDifferential
      ? previous.rank : index + 1;
  });
  return table;
}
