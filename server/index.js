require('dotenv').config();

const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const QRCode = require('qrcode');

const {
  initSupabase,
  insertPlayer,
  insertAnswer,
  fetchRevealStats,
  aggregateStats,
  fetchQuestions,
  insertQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions
} = require('./supabase');
const { parseUserAgent, getClientIp } = require('./ua-parse');
const {
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
} = require('./quiz-state');

const PORT = Number(process.env.PORT) || 3000;
const HOST_PASSCODE = process.env.HOST_PASSCODE || 'ethics2026';
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

function isLocalUrl(url) {
  return /localhost|127\.0\.0\.1/.test(url || '');
}

/** Prefer a real PUBLIC_URL; otherwise use the Host the browser hit (LAN IP / Render). */
function resolvePublicUrl(req) {
  if (PUBLIC_URL && !isLocalUrl(PUBLIC_URL)) {
    return PUBLIC_URL;
  }
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').toString().split(',')[0].trim();
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0].trim();
  if (host) return `${proto}://${host}`.replace(/\/$/, '');
  return PUBLIC_URL;
}

let questions = [];
// Removed local questions.json loading as we now use Supabase

initSupabase();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, methods: ['GET', 'POST'] },
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

let state = createQuizState(questions);

function requirePasscode(req, res, next) {
  const code = req.headers['x-host-passcode'] || req.query.passcode || req.body?.passcode;
  if (code !== HOST_PASSCODE) {
    return res.status(401).json({ error: 'Invalid passcode' });
  }
  next();
}

function hostSnapshot() {
  const board = scoreboard(state);
  return {
    phase: state.phase,
    playerCount: playerCount(state),
    totalQuestions: state.questions.length,
    doneCount: doneCount(state),
    leaderboard: board.slice(0, 10),
    players: [...state.players.values()].map((p) => ({
      name: p.name,
      score: p.score,
      joinOrder: p.joinOrder,
      questionIndex: p.questionIndex,
      playerPhase: p.phase,
      done: p.done,
    })),
  };
}

function playerSnapshot(player) {
  const board = scoreboard(state);
  const me = board.find((r) => r.id === player.id);
  const questionsList = player.shuffledQuestions || state.questions;
  const q = player.questionIndex >= 0 ? questionsList[player.questionIndex] : null;
  return {
    phase: player.phase,
    globalPhase: state.phase,
    playerCount: playerCount(state),
    questionIndex: player.questionIndex,
    totalQuestions: questionsList.length,
    question: publicQuestion(q, player.questionIndex),
    durationMs: QUESTION_DURATION_MS,
    startedAt: player.questionStartedAt,
    score: player.score,
    correctCount: player.correctCount,
    rank: me?.rank ?? null,
    answered: player.answered,
    leaderboard: board.slice(0, 5),
  };
}

function broadcastCounts() {
  io.emit('lobby:count', { count: playerCount(state) });
  io.to('hosts').emit('host:update', hostSnapshot());
}

function memoryStats() {
  const players = [...state.players.values()].map((p) => ({
    id: p.dbId || p.id,
    name: p.name,
    browser: p.browser,
    os: p.os,
    device_type: p.deviceType,
    screen_w: p.screenW,
    screen_h: p.screenH,
    language: p.language,
    timezone: p.timezone,
    join_order: p.joinOrder,
    time_on_join_screen_ms: p.timeOnJoinScreenMs,
    joined_at: p.joinedAt,
  }));

  const answers = [];
  for (const p of state.players.values()) {
    for (const a of p.answerLog || []) {
      answers.push({
        player_id: p.dbId || p.id,
        question_id: a.questionId,
        answer_index: a.answerIndex,
        correct: a.correct,
        answer_time_ms: a.answerTimeMs,
      });
    }
  }
  return aggregateStats(players, answers);
}

// ——— HTTP routes ———

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

// Old paths redirect into the all-in-one admin panel
app.get('/host', (_req, res) => res.redirect('/admin'));
app.get('/dashboard', (_req, res) => res.redirect('/admin'));

app.get('/terms', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'terms.html'));
});

app.get('/api/config', (req, res) => {
  res.json({
    publicUrl: resolvePublicUrl(req),
    configuredUrl: PUBLIC_URL,
    questionCount: questions.length,
  });
});

app.get('/api/qr', async (req, res) => {
  try {
    let url = typeof req.query.url === 'string' ? req.query.url.trim() : '';
    if (!url) {
      url = `${resolvePublicUrl(req)}/`;
    }
    if (!/^https?:\/\//i.test(url)) {
      return res.status(400).json({ error: 'Invalid url' });
    }
    const png = await QRCode.toBuffer(url, {
      type: 'png',
      width: Number(req.query.size) || 360,
      margin: 2,
      color: { dark: '#101214', light: '#ffffff' },
    });
    res.set('Content-Type', 'image/png');
    res.send(png);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/host/auth', (req, res) => {
  const { passcode } = req.body || {};
  if (passcode === HOST_PASSCODE) {
    return res.json({ ok: true });
  }
  return res.status(401).json({ error: 'Invalid passcode' });
});

app.get('/api/dashboard/stats', requirePasscode, async (_req, res) => {
  try {
    const fromDb = await fetchRevealStats();
    const stats = fromDb || memoryStats();
    res.json({ source: fromDb ? 'supabase' : 'memory', stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ——— Question Management Routes ———

let sessionSettings = { questionCount: 'all', shuffle: false };

app.get('/api/settings', requirePasscode, (req, res) => {
  res.json(sessionSettings);
});

app.post('/api/settings', requirePasscode, (req, res) => {
  if (req.body.questionCount !== undefined) sessionSettings.questionCount = req.body.questionCount;
  if (req.body.shuffle !== undefined) sessionSettings.shuffle = req.body.shuffle;
  res.json({ ok: true, settings: sessionSettings });
});

app.get('/api/questions', requirePasscode, async (req, res) => {
  const qs = await fetchQuestions();
  res.json(qs);
});

app.post('/api/questions', requirePasscode, async (req, res) => {
  const { data, error } = await insertQuestion(req.body);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.put('/api/questions/:id', requirePasscode, async (req, res) => {
  const { data, error } = await updateQuestion(req.params.id, req.body);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.delete('/api/questions/:id', requirePasscode, async (req, res) => {
  const { error } = await deleteQuestion(req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

app.post('/api/questions/reorder', requirePasscode, async (req, res) => {
  const { error } = await reorderQuestions(req.body);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// ——— Self-Paced Per-Player Quiz Functions ———

/** Start a single player on a specific question index. */
function startPlayerQuestion(player, index) {
  clearPlayerTimers(player);
  const questionsList = player.shuffledQuestions || state.questions;

  player.questionIndex = index;
  player.phase = 'question';
  player.answered = false;
  player.questionStartedAt = Date.now();

  const q = questionsList[index];
  const payload = {
    question: publicQuestion(q, index),
    questionIndex: index,
    totalQuestions: questionsList.length,
    durationMs: QUESTION_DURATION_MS,
    startedAt: player.questionStartedAt,
  };
  io.to(player.socketId).emit('quiz:question', payload);

  // Auto-timeout: if player doesn't answer within the duration, force timeout
  player.timers.question = setTimeout(() => {
    if (player.phase === 'question' && player.questionIndex === index && !player.answered) {
      finishPlayerQuestion(player);
    }
  }, QUESTION_DURATION_MS);

  io.to('hosts').emit('host:update', hostSnapshot());
}

/** Handle timeout for a single player (they didn't answer in time). */
function finishPlayerQuestion(player) {
  if (player.phase !== 'question') return;
  clearPlayerTimers(player);

  const questionsList = player.shuffledQuestions || state.questions;
  const q = questionsList[player.questionIndex];

  player.answered = true;
  player.phase = 'feedback';

  // Tell the player their time is up
  io.to(player.socketId).emit('quiz:timeout', {
    questionIndex: player.questionIndex,
    correctIndex: q ? q.correct_index : null,
  });

  // After 5s feedback, advance to between screen
  player.timers.feedback = setTimeout(() => {
    if (player.phase === 'feedback') {
      advancePlayerToBetween(player);
    }
  }, FEEDBACK_DURATION_MS);

  io.to('hosts').emit('host:update', hostSnapshot());
}

/** Transition a single player to the between-questions screen. */
function advancePlayerToBetween(player) {
  clearPlayerTimers(player);
  player.phase = 'between';

  const board = scoreboard(state);
  const questionsList = player.shuffledQuestions || state.questions;

  io.to(player.socketId).emit('quiz:between', {
    leaderboard: board.slice(0, 5),
    questionIndex: player.questionIndex,
    totalQuestions: questionsList.length,
    durationMs: BETWEEN_DURATION_MS,
  });

  // After 5s between, advance to next question (or finish)
  player.timers.between = setTimeout(() => {
    if (player.phase === 'between') {
      advancePlayerToNextQuestion(player);
    }
  }, BETWEEN_DURATION_MS);

  io.to('hosts').emit('host:update', hostSnapshot());
}

/** Move a single player to their next question, or to the waiting/done state. */
function advancePlayerToNextQuestion(player) {
  clearPlayerTimers(player);
  const questionsList = player.shuffledQuestions || state.questions;
  const next = player.questionIndex + 1;

  if (next >= questionsList.length) {
    // Player is done with all questions
    player.done = true;
    player.phase = 'waiting';

    io.to(player.socketId).emit('quiz:waiting', {
      score: player.score,
      rank: scoreboard(state).find((r) => r.id === player.id)?.rank ?? null,
    });

    io.to('hosts').emit('host:update', hostSnapshot());

    // Check if ALL players are now done
    if (allPlayersDone(state)) {
      endQuiz();
    }
  } else {
    startPlayerQuestion(player, next);
  }
}

/** Transition a single player to feedback after they answered. */
function showPlayerFeedback(player, feedbackData) {
  clearPlayerTimers(player);
  player.phase = 'feedback';

  io.to(player.socketId).emit('quiz:feedback', feedbackData);

  // After 5s, advance to between screen
  player.timers.feedback = setTimeout(() => {
    if (player.phase === 'feedback') {
      advancePlayerToBetween(player);
    }
  }, FEEDBACK_DURATION_MS);

  io.to('hosts').emit('host:update', hostSnapshot());
}

function endQuiz() {
  clearAllPlayerTimers(state);
  state.phase = 'ended';
  const board = scoreboard(state);

  for (const player of state.players.values()) {
    player.phase = 'done';
    player.done = true;
    const me = board.find((r) => r.id === player.id);
    io.to(player.socketId).emit('quiz:ended', {
      score: player.score,
      rank: me?.rank ?? null,
      totalPlayers: playerCount(state),
      leaderboard: board.slice(0, 10),
    });
  }

  io.to('hosts').emit('quiz:ended', {
    leaderboard: board,
    totalPlayers: playerCount(state),
  });
  io.to('hosts').emit('host:update', hostSnapshot());
  io.emit('dashboard:refresh', {});
}

// ——— Socket.IO ———

io.on('connection', (socket) => {
  socket.on('host:auth', (payload, ack) => {
    if (payload?.passcode === HOST_PASSCODE) {
      socket.join('hosts');
      socket.data.isHost = true;
      if (typeof ack === 'function') ack({ ok: true, snapshot: hostSnapshot() });
      socket.emit('host:update', hostSnapshot());
    } else if (typeof ack === 'function') {
      ack({ ok: false, error: 'Invalid passcode' });
    }
  });

  socket.on('player:join', async (payload, ack) => {
    try {
      const name = String(payload?.name || '').trim().slice(0, 24);
      if (!name) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Name required' });
        return;
      }
      if (state.phase === 'ended') {
        if (typeof ack === 'function') ack({ ok: false, error: 'Quiz already ended' });
        return;
      }

      const ua = payload.useragent_raw || socket.handshake.headers['user-agent'] || '';
      const { browser, os, deviceType } = parseUserAgent(ua);
      const joinedAt = Number(payload.joined_at) || Date.now();
      const pageLoadAt = Number(payload.page_load_at) || joinedAt;
      const timeOnJoin =
        typeof payload.time_on_join_screen_ms === 'number'
          ? Math.max(0, payload.time_on_join_screen_ms)
          : Math.max(0, joinedAt - pageLoadAt);

      state.joinOrder += 1;
      const joinOrder = state.joinOrder;

      const ip =
        socket.handshake.headers['x-forwarded-for']?.toString().split(',')[0].trim() ||
        socket.handshake.address ||
        null;

      const dbRow = {
        socket_id: socket.id,
        name,
        browser,
        os,
        device_type: deviceType,
        screen_w: Number(payload.screen_w) || null,
        screen_h: Number(payload.screen_h) || null,
        language: payload.language || null,
        timezone: payload.timezone || null,
        ip,
        page_load_at: pageLoadAt,
        joined_at: joinedAt,
        join_order: joinOrder,
        time_on_join_screen_ms: timeOnJoin,
        useragent_raw: ua.slice(0, 500),
      };

      const { data: inserted } = await insertPlayer(dbRow);

      const player = createPlayerState({
        id: inserted?.id || `local-${socket.id}`,
        dbId: inserted?.id || null,
        socketId: socket.id,
        name,
        browser,
        os,
        deviceType,
        screenW: dbRow.screen_w,
        screenH: dbRow.screen_h,
        language: dbRow.language,
        timezone: dbRow.timezone,
        pageLoadAt,
        joinedAt,
        joinOrder,
        timeOnJoinScreenMs: timeOnJoin,
        score: 0,
        correctCount: 0,
        answerTimes: [],
        answerLog: [],
        streak: 0,
        shuffledQuestions: state.questions.length > 0 
          ? (sessionSettings.shuffle ? [...state.questions].sort(() => Math.random() - 0.5) : [...state.questions])
          : [],
      });

      state.players.set(socket.id, player);
      socket.data.playerId = player.id;
      socket.join('players');

      if (typeof ack === 'function') {
        ack({
          ok: true,
          playerId: player.id,
          snapshot: playerSnapshot(player),
        });
      }

      broadcastCounts();
      io.to('hosts').emit('player:joined', {
        name: player.name,
        count: playerCount(state),
      });

      // If quiz is already running (late joiner), start them on question 0
      if (state.phase === 'running') {
        startPlayerQuestion(player, 0);
      }
    } catch (err) {
      console.error('player:join', err);
      if (typeof ack === 'function') ack({ ok: false, error: 'Join failed' });
    }
  });

  socket.on('answer:submit', async (payload, ack) => {
    const player = state.players.get(socket.id);
    if (!player) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Not joined' });
      return;
    }
    if (player.phase !== 'question') {
      if (typeof ack === 'function') ack({ ok: false, error: 'No active question' });
      return;
    }
    if (player.answered) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Already answered' });
      return;
    }

    const qIndex = player.questionIndex;
    const questionsList = player.shuffledQuestions || state.questions;
    const q = questionsList[qIndex];
    if (!q || Number(payload?.question_id) !== qIndex) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Wrong question' });
      return;
    }

    const answerIndex = Number(payload.answer_index);
    if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Invalid answer' });
      return;
    }

    const answerTimeMs = Math.max(
      0,
      Math.min(
        QUESTION_DURATION_MS + 2000,
        Number(payload.answer_time_ms) || Date.now() - (player.questionStartedAt || Date.now())
      )
    );
    const correct = answerIndex === q.correct_index;
    const speedBonus = correct
      ? Math.max(0, Math.round((1 - answerTimeMs / QUESTION_DURATION_MS) * 400))
      : 0;
    const points = correct ? 1000 + speedBonus : 0;

    if (correct) {
      player.correctCount += 1;
      player.streak += 1;
      player.score += points;
    } else {
      player.streak = 0;
    }
    player.answerTimes.push(answerTimeMs);
    player.answered = true;

    const answerPayload = {
      questionId: qIndex,
      answerIndex,
      correct,
      answerTimeMs,
      points,
      streak: player.streak,
    };
    player.answerLog.push(answerPayload);

    await insertAnswer({
      player_id: player.dbId || null,
      question_id: qIndex,
      answer_index: answerIndex,
      correct,
      answer_time_ms: answerTimeMs,
      submitted_at: Date.now(),
    });

    if (typeof ack === 'function') {
      ack({
        ok: true,
        correct,
        points,
        score: player.score,
        streak: player.streak,
        correctIndex: q.correct_index,
      });
    }

    // Transition this player to feedback (5s) independently
    showPlayerFeedback(player, {
      questionIndex: qIndex,
      correct,
      points,
      score: player.score,
      correctIndex: q.correct_index,
    });
  });

  socket.on('host:start', async (payload, ack) => {
    if (!socket.data.isHost && payload?.passcode !== HOST_PASSCODE) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Unauthorized' });
      return;
    }
    if (state.phase !== 'lobby') {
      if (typeof ack === 'function') ack({ ok: false, error: 'Already started — reset first' });
      return;
    }
    
    try {
      let dbQuestions = await fetchQuestions();
      if (sessionSettings.shuffle) {
        dbQuestions = dbQuestions.sort(() => Math.random() - 0.5);
      }
      if (sessionSettings.questionCount !== 'all') {
        const limit = parseInt(sessionSettings.questionCount, 10);
        if (!isNaN(limit) && limit > 0) {
          dbQuestions = dbQuestions.slice(0, limit);
        }
      }
      state.questions = dbQuestions;
      for (const player of state.players.values()) {
        player.shuffledQuestions = sessionSettings.shuffle
          ? [...dbQuestions].sort(() => Math.random() - 0.5)
          : [...dbQuestions];
      }
    } catch (err) {
      console.error('[quiz] host:start error fetching questions', err);
    }
    
    // Set global phase to running
    state.phase = 'running';

    // Start each player on their first question independently
    for (const player of state.players.values()) {
      startPlayerQuestion(player, 0);
    }

    if (typeof ack === 'function') ack({ ok: true });
  });

  // Manual next: host can force-end for all waiting players or skip phases
  socket.on('host:next', (payload, ack) => {
    if (!socket.data.isHost && payload?.passcode !== HOST_PASSCODE) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Unauthorized' });
      return;
    }
    // In self-paced mode, host:next forces end if quiz is running
    if (state.phase === 'running') {
      endQuiz();
    }
    if (typeof ack === 'function') ack({ ok: true, phase: state.phase });
  });

  socket.on('host:show-leaderboard', (payload, ack) => {
    if (!socket.data.isHost && payload?.passcode !== HOST_PASSCODE) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Unauthorized' });
      return;
    }
    const board = scoreboard(state);
    io.emit('quiz:leaderboard', { leaderboard: board.slice(0, 10) });
    if (typeof ack === 'function') ack({ ok: true });
  });

  socket.on('host:end', (payload, ack) => {
    if (!socket.data.isHost && payload?.passcode !== HOST_PASSCODE) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Unauthorized' });
      return;
    }
    endQuiz();
    if (typeof ack === 'function') ack({ ok: true });
  });

  socket.on('host:reset', async (payload, ack) => {
    if (!socket.data.isHost && payload?.passcode !== HOST_PASSCODE) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Unauthorized' });
      return;
    }
    clearAllPlayerTimers(state);
    state = createQuizState([]);
    io.emit('quiz:reset', {});
    broadcastCounts();
    if (typeof ack === 'function') ack({ ok: true });
  });

  socket.on('player:sync', (_payload, ack) => {
    const player = state.players.get(socket.id);
    if (player && typeof ack === 'function') {
      ack({ ok: true, snapshot: playerSnapshot(player) });
    } else if (typeof ack === 'function') {
      ack({
        ok: true,
        snapshot: {
          phase: 'lobby',
          globalPhase: state.phase,
          playerCount: playerCount(state),
          questionIndex: -1,
          totalQuestions: state.questions.length,
        },
      });
    }
  });

  socket.on('disconnect', () => {
    // Keep player data for scoring/reveal even if they disconnect mid-quiz.
    // Only remove from live map if still in lobby and never started.
    if (state.phase === 'lobby' && state.players.has(socket.id)) {
      state.players.delete(socket.id);
      broadcastCounts();
    } else if (state.players.has(socket.id)) {
      // Clear their timers but keep data
      const player = state.players.get(socket.id);
      clearPlayerTimers(player);
      // Mark disconnected players as done so they don't block others
      if (!player.done && state.phase === 'running') {
        player.done = true;
        player.phase = 'done';
        if (allPlayersDone(state)) {
          endQuiz();
        }
      }
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Data Ethics Quiz running on ${PUBLIC_URL}`);
  console.log(`  Players:  ${PUBLIC_URL}/`);
  console.log(`  Admin:    ${PUBLIC_URL}/admin   (run quiz + data reveal)`);
  console.log(`  Passcode: ${HOST_PASSCODE}\n`);
});
