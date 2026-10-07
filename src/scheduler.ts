import { validateCourtCount, validateTeams } from './domain';
import type { Match, Round, Team } from './domain';

/** Deterministic circle method, splitting each pairing set to fit court capacity.
 * All idle teams receive an explicit bye in each time slot. This favors simple,
 * reproducible scheduling; it does not optimize rest spacing or court utilization.
 */
export function generateSchedule(teams: Team[], courtCount: number): Round[] {
  validateTeams(teams);
  validateCourtCount(courtCount);
  const rotation: (string | null)[] = teams.map(team => team.id);
  if (rotation.length % 2) rotation.push(null);
  const rounds: Round[] = [];
  let matchNumber = 1;

  for (let cycle = 0; cycle < rotation.length - 1; cycle++) {
    const pairings: [string, string][] = [];
    for (let i = 0; i < rotation.length / 2; i++) {
      const home = rotation[i];
      const away = rotation[rotation.length - 1 - i];
      if (home !== null && away !== null) pairings.push([home, away]);
    }
    for (let offset = 0; offset < pairings.length; offset += courtCount) {
      const matches: Match[] = pairings.slice(offset, offset + courtCount)
        .map(([homeTeamId, awayTeamId], index) => ({
          id: `match-${matchNumber++}`, court: index + 1, homeTeamId, awayTeamId,
        }));
      const active = new Set(matches.flatMap(match => [match.homeTeamId, match.awayTeamId]));
      rounds.push({
        number: rounds.length + 1,
        matches,
        byes: teams.filter(team => !active.has(team.id)).map(team => team.id),
      });
    }
    rotation.splice(1, 0, rotation.pop()!);
  }
  return rounds;
}
