/** Teams represent fixed doubles partnerships; IDs remain stable across renames. */
export interface Team {
  id: string;
  name: string;
}

export interface Match {
  id: string;
  court: number;
  homeTeamId: string;
  awayTeamId: string;
}

/** A round is one simultaneous time slot. Courts and round numbers are 1-based. */
export interface Round {
  number: number;
  matches: Match[];
  byes: string[];
}

export interface MatchResult {
  matchId: string;
  homeScore: number;
  awayScore: number;
}

export interface TournamentState {
  version: 1;
  teams: Team[];
  courtCount: number;
  schedule: Round[];
  results: MatchResult[];
}

export function validateTeams(teams: Team[]): void {
  if (!Array.isArray(teams) || teams.length < 4 || teams.length > 12) {
    throw new Error('Expected 4–12 teams.');
  }
  const ids = new Set<string>();
  for (const team of teams) {
    if (!team || typeof team.id !== 'string' || !team.id.trim() ||
        typeof team.name !== 'string' || !team.name.trim() || ids.has(team.id)) {
      throw new Error('Teams must have nonempty IDs and names, with unique IDs.');
    }
    ids.add(team.id);
  }
}

export function validateCourtCount(courtCount: number): void {
  if (!Number.isInteger(courtCount) || courtCount < 1 || courtCount > 4) {
    throw new Error('Expected 1–4 courts.');
  }
}

export function validateScore(result: MatchResult): void {
  if (!Number.isSafeInteger(result.homeScore) || result.homeScore < 0 || result.homeScore > 99 ||
      !Number.isSafeInteger(result.awayScore) || result.awayScore < 0 || result.awayScore > 99 ||
      result.homeScore === result.awayScore) {
    throw new Error('Completed matches require integer scores from 0–99 and a winner.');
  }
}
