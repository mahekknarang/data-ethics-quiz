/**
 * In-memory live quiz state (Socket.IO source of truth during a session).
 * Supabase is the durable log; this object drives the live UX.
 *
 * v2: Self-paced mode — each player has their own independent state machine.
 * The global `state.phase` tracks host-level state (lobby | running | ended).
 * Per-player timing is driven by individual timers, not a global clock.
 */

const QUESTION_DURATION_MS = 22000;
const FEEDBACK_DURATION_MS = 5000;
const BETWEEN_DURATION_MS = 5000;

function createQuizState(questions) {
  return {
    phase: 'lobby', // lobby | running | ended
    questions: questions || [],
    players: new Map(), // socketId -> player
    joinOrder: 0,
  };
}

/**
 * Creates a fresh per-player state object with self-paced fields.
 */
function createPlayerState(base) {
  return {
    ...base,
    questionIndex: -1,       // which question they are currently on
    phase: 'lobby',          // lobby | question | feedback | between | waiting | done
    answered: false,         // has answered the current question
    done: false,             // finished all questions
    questionStartedAt: null, // timestamp when current question started for this player
    timers: {
      question: null,        // 22s auto-advance if no answer
      feedback: null,        // 5s feedback → between
      between: null,         // 5s between → next question
    },
  };
}

/** Strip answer from question object before sending to players. */
function publicQuestion(q, index) {
  if (!q) return null;
  return {
    id: index,
    text: q.text,
    options: q.options,
    // correct_index intentionally omitted for players
  };
}

function scoreboard(state) {
  const rows = [...state.players.values()].map((p) => ({
    id: p.id,
    name: p.name,
    score: p.score,
    correct: p.correctCount,
    avgMs: p.answerTimes.length
      ? Math.round(p.answerTimes.reduce((a, b) => a + b, 0) / p.answerTimes.length)
      : null,
    questionIndex: p.questionIndex,
    phase: p.phase,
    done: p.done,
  }));
  rows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.avgMs || 99999) - (b.avgMs || 99999);
  });
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

function playerCount(state) {
  return state.players.size;
}

/** How many players have finished all questions. */
function doneCount(state) {
  let n = 0;
  for (const p of state.players.values()) {
    if (p.done) n++;
  }
  return n;
}

/** Check if ALL players have finished all questions. */
function allPlayersDone(state) {
  if (state.players.size === 0) return false;
  for (const p of state.players.values()) {
    if (!p.done) return false;
  }
  return true;
}

/** Clear all timers for a single player. */
function clearPlayerTimers(player) {
  if (!player?.timers) return;
  for (const key of Object.keys(player.timers)) {
    if (player.timers[key]) {
      clearTimeout(player.timers[key]);
      player.timers[key] = null;
    }
  }
}

/** Clear timers for ALL players (used on reset). */
function clearAllPlayerTimers(state) {
  for (const player of state.players.values()) {
    clearPlayerTimers(player);
  }
}

module.exports = {
  QUESTION_DURATION_MS,
  FEEDBACK_DURATION_MS,
  BETWEEN_DURATION_MS,
  createQuizState,
  createPlayerState,
  publicQuestion,
  scoreboard,
  playerCount,
  doneCount,
  allPlayersDone,
  clearPlayerTimers,
  clearAllPlayerTimers,
};
