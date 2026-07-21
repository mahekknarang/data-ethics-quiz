require('dotenv').config();

const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const QRCode = require('qrcode');

const { initSupabase, insertPlayer, insertAnswer, fetchRevealStats, aggregateStats } = require('./supabase');
const { parseUserAgent, getClientIp } = require('./ua-parse');
const {
  createQuizState,
  publicQuestion,
  scoreboard,
  answeredCount,
  playerCount,
} = require('./quiz-state');

const PORT = Number(process.env.PORT) || 3000;
const HOST_PASSCODE = process.env.HOST_PASSCODE || 'ethics2026';
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

const questionsPath = process.env.QUESTIONS_PATH
  ? path.resolve(process.env.QUESTIONS_PATH)
  : path.join(__dirname, '..', 'questions.json');

let questions = [];
try {
  questions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));
  console.log(`[quiz] Loaded ${questions.length} questions from ${questionsPath}`);
} catch (err) {
  console.error('[quiz] Failed to load questions.json:', err.message);
  process.exit(1);
}

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
  const q = state.questions[state.questionIndex];
  return {
    phase: state.phase,
    playerCount: playerCount(state),
    questionIndex: state.questionIndex,
    totalQuestions: state.questions.length,
    question: q
      ? { ...publicQuestion(q, state.questionIndex), correct: q.correct }
      : null,
    answered: answeredCount(state),
    durationMs: state.questionDurationMs,
    startedAt: state.questionStartedAt,
    leaderboard: scoreboard(state).slice(0, 10),
    players: [...state.players.values()].map((p) => ({
      name: p.name,
      score: p.score,
      joinOrder: p.joinOrder,
    })),
  };
}

function playerSnapshot(player) {
  const board = scoreboard(state);
  const me = board.find((r) => r.id === player.id);
  const q = state.questions[state.questionIndex];
  return {
    phase: state.phase,
    playerCount: playerCount(state),
    questionIndex: state.questionIndex,
    totalQuestions: state.questions.length,
    question: publicQuestion(q, state.questionIndex),
    durationMs: state.questionDurationMs,
    startedAt: state.questionStartedAt,
    score: player.score,
    correctCount: player.correctCount,
    rank: me?.rank ?? null,
    answeredThisRound: state.answersThisRound.has(player.socketId),
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

app.get('/api/config', (_req, res) => {
  res.json({
    publicUrl: PUBLIC_URL,
    questionCount: questions.length,
  });
});

app.get('/api/qr', async (req, res) => {
  try {
    const url = `${PUBLIC_URL}/`;
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

      const player = {
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
      };

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
    if (state.phase !== 'question') {
      if (typeof ack === 'function') ack({ ok: false, error: 'No active question' });
      return;
    }
    if (state.answersThisRound.has(socket.id)) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Already answered' });
      return;
    }

    const qIndex = state.questionIndex;
    const q = state.questions[qIndex];
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
        state.questionDurationMs + 2000,
        Number(payload.answer_time_ms) || Date.now() - (state.questionStartedAt || Date.now())
      )
    );
    const correct = answerIndex === q.correct;
    const speedBonus = correct
      ? Math.max(0, Math.round((1 - answerTimeMs / state.questionDurationMs) * 400))
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

    const answerPayload = {
      questionId: qIndex,
      answerIndex,
      correct,
      answerTimeMs,
      points,
      streak: player.streak,
    };
    player.answerLog.push(answerPayload);
    state.answersThisRound.set(socket.id, answerPayload);

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
        correctIndex: q.correct,
      });
    }

    io.to('hosts').emit('answer:tally', {
      answered: answeredCount(state),
      total: playerCount(state),
    });
    io.to('hosts').emit('host:update', hostSnapshot());
  });

  socket.on('host:start', (payload, ack) => {
    if (!socket.data.isHost && payload?.passcode !== HOST_PASSCODE) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Unauthorized' });
      return;
    }
    if (state.phase !== 'lobby' && state.phase !== 'between') {
      // allow restart from lobby only via reset
    }
    advanceToQuestion(0);
    if (typeof ack === 'function') ack({ ok: true });
  });

  socket.on('host:next', (payload, ack) => {
    if (!socket.data.isHost && payload?.passcode !== HOST_PASSCODE) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Unauthorized' });
      return;
    }
    const next = state.questionIndex + 1;
    if (next >= state.questions.length) {
      endQuiz();
    } else if (state.phase === 'question') {
      // show between / leaderboard first
      state.phase = 'between';
      const board = scoreboard(state);
      io.emit('quiz:between', {
        leaderboard: board.slice(0, 5),
        questionIndex: state.questionIndex,
        totalQuestions: state.questions.length,
      });
      io.to('hosts').emit('host:update', hostSnapshot());
    } else {
      advanceToQuestion(next);
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

  socket.on('host:reset', (payload, ack) => {
    if (!socket.data.isHost && payload?.passcode !== HOST_PASSCODE) {
      if (typeof ack === 'function') ack({ ok: false, error: 'Unauthorized' });
      return;
    }
    state = createQuizState(questions);
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
          phase: state.phase,
          playerCount: playerCount(state),
          questionIndex: state.questionIndex,
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
    }
  });
});

function advanceToQuestion(index) {
  state.questionIndex = index;
  state.phase = 'question';
  state.questionStartedAt = Date.now();
  state.answersThisRound = new Map();

  const q = state.questions[index];
  const payload = {
    question: publicQuestion(q, index),
    questionIndex: index,
    totalQuestions: state.questions.length,
    durationMs: state.questionDurationMs,
    startedAt: state.questionStartedAt,
  };

  io.emit('quiz:question', payload);
  io.to('hosts').emit('host:update', hostSnapshot());
}

function endQuiz() {
  state.phase = 'ended';
  const board = scoreboard(state);

  for (const player of state.players.values()) {
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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Data Ethics Quiz running on ${PUBLIC_URL}`);
  console.log(`  Players:  ${PUBLIC_URL}/`);
  console.log(`  Admin:    ${PUBLIC_URL}/admin   (run quiz + data reveal)`);
  console.log(`  Passcode: ${HOST_PASSCODE}\n`);
});
