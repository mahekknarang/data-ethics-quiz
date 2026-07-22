/**
 * In-memory live quiz state (Socket.IO source of truth during a session).
 * Supabase is the durable log; this object drives the live UX.
 */

function createQuizState(questions) {
  return {
    phase: 'lobby', // lobby | question | between | ended
    questions: questions || [],
    questionIndex: -1,
    questionStartedAt: null,
    // Auto-paced: ~22s to answer, then 5s feedback + 5s between
    questionDurationMs: 22000,
    feedbackDurationMs: 5000,
    betweenDurationMs: 8000,
    players: new Map(), // socketId -> player
    answersThisRound: new Map(), // socketId -> answer payload
    joinOrder: 0,
    timers: {
      question: null,
      feedback: null,
      between: null,
    },
  };
}

function publicQuestion(q, index) {
  if (!q) return null;
  return {
    id: index,
    text: q.text,
    options: q.options,
    // correct index intentionally omitted for players
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
  }));
  rows.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (a.avgMs || 99999) - (b.avgMs || 99999);
  });
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

function answeredCount(state) {
  return state.answersThisRound.size;
}

function playerCount(state) {
  return state.players.size;
}

function clearQuizTimers(state) {
  if (!state.timers) return;
  for (const key of Object.keys(state.timers)) {
    if (state.timers[key]) {
      clearTimeout(state.timers[key]);
      state.timers[key] = null;
    }
  }
}

module.exports = {
  createQuizState,
  publicQuestion,
  scoreboard,
  answeredCount,
  playerCount,
  clearQuizTimers,
};
