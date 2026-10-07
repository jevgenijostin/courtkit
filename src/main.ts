import './style.css';

// Production only: keep Vite's development server and HMR uncached.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    }).then(registration => {
      const trackUpdate = (worker: ServiceWorker | null) => {
        if (!worker) return;
        let notified = false;
        const checkState = () => {
          if (!notified && worker.state === 'installed' && navigator.serviceWorker.controller) {
            notified = true;
            showUpdatePrompt(worker);
          }
        };
        worker.addEventListener('statechange', checkState);
        checkState();
      };
      registration.addEventListener('updatefound', () => trackUpdate(registration.installing));
      trackUpdate(registration.installing ?? registration.waiting);
    }).catch(error => console.warn('Offline app cache could not be installed:', error));
  });
}

function showUpdatePrompt(worker: ServiceWorker) {
  document.querySelector('#app-update')?.remove();
  const prompt = document.createElement('aside');
  prompt.id = 'app-update';
  prompt.className = 'update-prompt backup-reminder screen-only';
  prompt.setAttribute('aria-label', 'App update');
  prompt.innerHTML = `<p role="status">Update available. Save any unfinished scores or setup before reloading.</p>
    <button type="button" data-reload disabled>Reload</button>
    <button type="button" data-dismiss aria-label="Dismiss update notification">Dismiss</button>`;
  const reload = prompt.querySelector<HTMLButtonElement>('[data-reload]')!;
  // Wait for the new worker to control this tab so reload uses its new shell.
  const checkController = () => {
    if (navigator.serviceWorker.controller === worker && worker.state === 'activated') {
      reload.disabled = false;
      navigator.serviceWorker.removeEventListener('controllerchange', checkController);
      worker.removeEventListener('statechange', checkController);
    }
  };
  navigator.serviceWorker.addEventListener('controllerchange', checkController);
  worker.addEventListener('statechange', checkController);
  checkController();
  reload.addEventListener('click', () => {
    reload.disabled = true;
    window.location.reload();
  });
  prompt.querySelector('[data-dismiss]')!.addEventListener('click', () => prompt.remove());
  // Keep the notification outside app renders to preserve unfinished form input.
  document.body.prepend(prompt);
}
import { createSampleTournament } from './demo';
import { validateScore } from './domain';
import type { TournamentState } from './domain';
import { generateSchedule } from './scheduler';
import { computeStandings } from './standings';
import { exportToJson, importFromJson, loadTournament, saveTournament, STORAGE_KEY } from './storage';

const app = document.querySelector<HTMLDivElement>('#app')!;
let state: TournamentState | null = null;
let roundIndex = 0;
let backupReminderVisible = false;
let savesSinceReminder = 0;

function clearBackupReminder() {
  backupReminderVisible = false;
  savesSinceReminder = 0;
  document.querySelector('#backup-reminder')?.remove();
}
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]!);
const name = (id: string) => escape(state!.teams.find(team => team.id === id)!.name);

function notice(message: string, error = false) {
  const target = document.querySelector<HTMLElement>(error ? '#error' : '#status')!;
  target.textContent = message;
}

function attempt(action: () => void) {
  document.querySelector('#error')!.textContent = '';
  try { action(); } catch (error) {
    notice(error instanceof Error ? error.message : String(error), true);
  }
}

function persist(next: TournamentState) {
  saveTournament(next);
  state = next;
}

function render(focusHeading = false) {
  app.innerHTML = `<header class="screen-only"><a class="brand" href="./">CourtKit<span>THE CLUB TOURNAMENT DESK</span></a></header>
    <main><div id="error" role="alert" class="screen-only"></div>
    <div id="status" role="status" class="screen-only"></div>
    ${state ? tournament() : setup()}
    <div class="toolbar screen-only"><button id="import" type="button">Import backup</button>
    <input id="backup" type="file" accept="application/json,.json" hidden></div></main>`;
  document.querySelector('#import')!.addEventListener('click', () => document.querySelector<HTMLInputElement>('#backup')!.click());
  document.querySelector('#backup')!.addEventListener('change', async event => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const next = importFromJson(await file.text());
      if (state && !window.confirm('Replace the current tournament with this backup?')) return;
      persist(next);
      clearBackupReminder();
      roundIndex = 0;
      render(true);
      notice('Backup restored.');
    } catch (error) {
      notice(error instanceof Error ? error.message : String(error), true);
    } finally { input.value = ''; }
  });
  if (state) wireTournament();
  else document.querySelector('#setup')!.addEventListener('submit', event => {
    event.preventDefault();
    attempt(() => {
      const data = new FormData(event.target as HTMLFormElement);
      const teams = String(data.get('teams')).split(/\r?\n/).map(n => n.trim()).filter(Boolean)
        .map((teamName, index) => ({ id: `team-${index + 1}`, name: teamName }));
      const courtCount = Number(data.get('courts'));
      persist({ version: 1, teams, courtCount, schedule: generateSchedule(teams, courtCount), results: [] });
      backupReminderVisible = true;
      savesSinceReminder = 0;
      roundIndex = 0;
      render(true);
    });
  });
  document.querySelector('#demo')?.addEventListener('click', () => attempt(() => {
    persist(createSampleTournament());
    roundIndex = 4;
    render(true);
    notice('Sample tournament loaded: four rounds scored. Use New tournament when you are ready to start your own.');
  }));
  if (focusHeading) document.querySelector<HTMLElement>('h1')!.focus();
}

function setup() {
  return `<section class="setup panel"><p class="eyebrow">LESS ADMIN. MORE PLAY.</p>
    <h1 tabindex="-1">Get your club on court.</h1>
    <p>Set up a doubles round robin. Every team plays every other team once.</p>
    <form id="setup"><label for="teams">Team names</label>
    <p id="team-help" class="hint">Enter 4–12 teams, one name per line. Each team is a fixed partnership.</p>
    <textarea id="teams" name="teams" rows="8" required aria-describedby="team-help" placeholder="Baseline crew&#10;Kitchen kings&#10;Court &amp; spark&#10;The spin doctors"></textarea>
    <label for="courts">Number of courts</label>
    <input id="courts" name="courts" type="number" min="1" max="4" step="1" value="1" required>
    <button class="primary" type="submit">Create tournament</button></form>
    <p class="hint">Saved automatically in this browser. Export a backup to keep a portable copy.</p>
    <button id="demo" type="button" aria-describedby="demo-help">Load sample tournament</button>
    <p id="demo-help" class="hint">Explore 8 teams on 2 courts with four rounds already scored. The sample saves in this browser; use New tournament to clear it and start your own.</p></section>`;
}

function tournament() {
  const current = state!;
  const round = current.schedule[roundIndex];
  return `<section class="screen-only"><p class="eyebrow">READY, SET, PLAY</p>
    <h1 tabindex="-1">Your tournament</h1>
    <p>${current.teams.length} teams · ${current.courtCount} court${current.courtCount === 1 ? '' : 's'} · ${current.results.length} / ${current.schedule.flatMap(r => r.matches).length} matches recorded</p>
    <div class="toolbar"><button id="print">Print scorecards</button><button id="export">Export backup</button><button id="reset" class="danger">New tournament</button></div>
    ${backupReminderVisible ? `<aside id="backup-reminder" class="backup-reminder" aria-label="Backup reminder"><p class="hint">Your tournament is saved only in this browser. Click <strong>Export backup</strong> to keep a copy in case browser data is cleared.</p><button id="dismiss-backup" type="button" aria-label="Dismiss backup reminder">Dismiss</button></aside>` : ''}
    <section class="panel"><nav aria-label="Round navigation"><button id="prev" ${roundIndex === 0 ? 'disabled' : ''}>Previous round</button>
    <h2>Round ${round.number} <span class="hint">of ${current.schedule.length}</span></h2>
    <button id="next" ${roundIndex === current.schedule.length - 1 ? 'disabled' : ''}>Next round</button></nav>
    <p class="hint">Use whole-number scores from 0–99. Completed matches must have a winner.</p>
    <div class="matches">${round.matches.map((match, index) => {
      const result = current.results.find(r => r.matchId === match.id);
      return `<form class="match" data-match-index="${index}" aria-label="Court ${match.court} result">
        <h3>Court ${match.court}</h3><p class="saved">${result ? `Saved: ${result.homeScore} – ${result.awayScore}` : 'Awaiting result'}</p>
        <label for="home-${index}">${name(match.homeTeamId)} <span class="hint">(home)</span></label>
        <input id="home-${index}" name="home" aria-label="${name(match.homeTeamId)} home score" type="number" min="0" max="99" step="1" required value="${result?.homeScore ?? ''}">
        <label for="away-${index}">${name(match.awayTeamId)} <span class="hint">(away)</span></label>
        <input id="away-${index}" name="away" aria-label="${name(match.awayTeamId)} away score" type="number" min="0" max="99" step="1" required value="${result?.awayScore ?? ''}">
        <button class="primary" type="submit">Save result</button></form>`;
    }).join('')}</div><p class="byes"><strong>Byes this round:</strong> ${round.byes.length ? round.byes.map(name).join(', ') : 'None — everyone plays.'}</p></section></section>
    <section class="print-only"><h1>CourtKit · Match scorecards</h1>
    ${current.schedule.map(r => `<section class="print-round"><h2>Round ${r.number}</h2><div class="scorecards">${r.matches.map(m => `<article class="scorecard"><h3>Round ${r.number} · Court ${m.court}</h3><p>${name(m.homeTeamId)} <span class="score-line"></span></p><p>${name(m.awayTeamId)} <span class="score-line"></span></p></article>`).join('')}</div><p>Byes: ${r.byes.length ? r.byes.map(name).join(', ') : 'None'}</p></section>`).join('')}</section>
    <section class="panel standings"><h2>Standings</h2><p class="hint">Ranked by wins, then point difference. Equal records share a rank.</p>
    <div class="table-scroll"><table><caption class="sr-only">Tournament standings</caption><thead><tr><th scope="col">Rank</th><th scope="col">Team</th><th scope="col">Wins</th><th scope="col">Points for</th><th scope="col">Points against</th><th scope="col">Point diff</th></tr></thead>
    <tbody>${computeStandings(current.teams, current.schedule, current.results).map(row => `<tr><td>${row.rank}</td><th scope="row">${name(row.teamId)}</th><td>${row.wins}</td><td>${row.pointsFor}</td><td>${row.pointsAgainst}</td><td>${row.pointDifferential > 0 ? '+' : ''}${row.pointDifferential}</td></tr>`).join('')}</tbody></table></div></section>`;
}

function wireTournament() {
  document.querySelector('#dismiss-backup')?.addEventListener('click', () => {
    clearBackupReminder();
    document.querySelector<HTMLButtonElement>('#export')!.focus();
  });
  for (const [selector, delta] of [['#prev', -1], ['#next', 1]] as const) {
    document.querySelector(selector)!.addEventListener('click', () => {
      roundIndex += delta;
      render();
      document.querySelector<HTMLButtonElement>(selector)!.focus();
    });
  }
  document.querySelectorAll<HTMLFormElement>('[data-match-index]').forEach(form => {
    form.addEventListener('submit', event => {
      event.preventDefault();
      attempt(() => {
        const match = state!.schedule[roundIndex].matches[Number(form.dataset.matchIndex)];
        const data = new FormData(form);
        const result = { matchId: match.id, homeScore: Number(data.get('home')), awayScore: Number(data.get('away')) };
        validateScore(result);
        persist({ ...state!, results: [...state!.results.filter(r => r.matchId !== match.id), result] });
        savesSinceReminder += 1;
        if (savesSinceReminder >= 5) backupReminderVisible = true;
        render();
        document.querySelector<HTMLButtonElement>(`[data-match-index="${form.dataset.matchIndex}"] button`)!.focus();
        notice(`Court ${match.court} result saved. Standings updated.`);
      });
    });
  });
  document.querySelector('#print')!.addEventListener('click', () => window.print());
  document.querySelector('#reset')!.addEventListener('click', () => {
    if (!window.confirm('Delete this tournament and all saved results? Export a backup first if you want to keep them.')) return;
    attempt(() => { localStorage.removeItem(STORAGE_KEY); clearBackupReminder(); state = null; roundIndex = 0; render(true); });
  });
  document.querySelector('#export')!.addEventListener('click', () => attempt(() => {
    const url = URL.createObjectURL(new Blob([exportToJson(state!)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'courtkit-backup.json';
    link.click();
    clearBackupReminder();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }));
}

let loadError = '';
try {
  state = loadTournament();
  if (state) {
    const pending = state.schedule.findIndex(round => round.matches.some(match => !state!.results.some(r => r.matchId === match.id)));
    roundIndex = pending < 0 ? 0 : pending;
  }
} catch (error) {
  loadError = `Could not restore the saved tournament. ${error instanceof Error ? error.message : String(error)}`;
}
render();
if (loadError) notice(loadError, true);
