(() => {
  const pageLoadAt = Date.now();
  const socket = io();

  const screens = {
    join: document.getElementById('screen-join'),
    lobby: document.getElementById('screen-lobby'),
    question: document.getElementById('screen-question'),
    feedback: document.getElementById('screen-feedback'),
    between: document.getElementById('screen-between'),
    end: document.getElementById('screen-end'),
  };

  let playerId = null;
  let totalQuestions = 10;
  let questionIndex = -1;
  let durationMs = 22000;
  let betweenDurationMs = 17000;
  let startedAt = null;
  let timerRaf = null;
  let answered = false;
  let score = 0;
  let lowNudgeShown = false;
  let betweenTick = null;

  const CIRC = 2 * Math.PI * 22;
  const WIN_EMOJIS = ['🎉', '🎊', '✨', '🥳', '👏', '🔥', '💯', '🌟', '🎈', '💖'];
  const LOSE_EMOJIS = ['❌', '💀', '😵', '😭', '👎', '😬', '🚫', '💔', '🥀', '😮‍💨'];

  document.getElementById('join-headline').textContent = pickCopy('join_headline');
  document.getElementById('join-sub').textContent = pickCopy('join_subtext_name');
  document.getElementById('join-btn').textContent = pickCopy('join_button');
  document.getElementById('fineprint-teaser').textContent =
    ' — ' + pickCopy('join_fineprint_teaser');

  function showScreen(name) {
    Object.values(screens).forEach((el) => el.classList.remove('active'));
    screens[name].classList.add('active');
    document.body.classList.toggle('quiz-mode', name !== 'join');
  }

  function renderDots(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';
    for (let i = 0; i < totalQuestions; i++) {
      const s = document.createElement('span');
      if (i < questionIndex) s.classList.add('done');
      if (i === questionIndex) s.classList.add('current');
      el.appendChild(s);
    }
  }

  function formatLb(list, targetId) {
    const ol = document.getElementById(targetId);
    ol.innerHTML = '';
    (list || []).forEach((row) => {
      const li = document.createElement('li');
      li.innerHTML = `<span><span class="rank mono">#${row.rank}</span>${escapeHtml(
        row.name
      )}</span><span class="pts mono">${row.score}</span>`;
      ol.appendChild(li);
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function stopTimer() {
    if (timerRaf) cancelAnimationFrame(timerRaf);
    timerRaf = null;
  }

  function clearBetweenTick() {
    if (betweenTick) clearInterval(betweenTick);
    betweenTick = null;
  }

  function startTimer() {
    stopTimer();
    lowNudgeShown = false;
    const ring = document.getElementById('timer-ring');
    ring.style.strokeDasharray = String(CIRC);
    ring.classList.remove('urgent');
    document.getElementById('timer-nudge').textContent = '';

    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const left = Math.max(0, durationMs - elapsed);
      const secs = Math.ceil(left / 1000);
      document.getElementById('timer-num').textContent = String(secs);
      const pct = left / durationMs;
      ring.style.strokeDashoffset = String(CIRC * (1 - pct));
      if (pct < 0.3) {
        ring.classList.add('urgent');
        if (!lowNudgeShown) {
          lowNudgeShown = true;
          document.getElementById('timer-nudge').textContent = pickCopy('timer_low');
        }
      }
      if (left > 0 && !answered) {
        timerRaf = requestAnimationFrame(tick);
      }
    };
    tick();
  }

  function rainEmojis(emojis, count = 42) {
    const root = document.getElementById('confetti');
    root.classList.remove('hidden');
    root.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const span = document.createElement('span');
      span.className = 'emoji-fall';
      span.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      span.style.left = Math.random() * 100 + '%';
      span.style.animationDuration = 1.4 + Math.random() * 1.6 + 's';
      span.style.animationDelay = Math.random() * 0.45 + 's';
      span.style.fontSize = 1.2 + Math.random() * 1.4 + 'rem';
      root.appendChild(span);
    }
    setTimeout(() => {
      root.classList.add('hidden');
      root.innerHTML = '';
    }, 3200);
  }

  function showFeedback({ correct, timedOut, points }) {
    const card = document.getElementById('feedback-card');
    card.classList.remove('ok', 'bad');
    if (timedOut) {
      card.classList.add('bad');
      document.getElementById('feedback-line').textContent = pickCopy('time_up');
      document.getElementById('feedback-score').textContent = `${score} pts`;
      rainEmojis(LOSE_EMOJIS, 36);
    } else if (correct) {
      card.classList.add('ok');
      document.getElementById('feedback-line').textContent = pickCopy('answer_correct');
      document.getElementById('feedback-score').textContent =
        points != null ? `+${points} · ${score} pts` : `${score} pts`;
      rainEmojis(WIN_EMOJIS, 48);
    } else {
      card.classList.add('bad');
      document.getElementById('feedback-line').textContent = pickCopy('answer_wrong');
      document.getElementById('feedback-score').textContent = `${score} pts`;
      rainEmojis(LOSE_EMOJIS, 40);
    }
    showScreen('feedback');
  }

  document.getElementById('join-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    if (!name) return;

    const joinedAt = Date.now();
    const payload = {
      name,
      page_load_at: pageLoadAt,
      joined_at: joinedAt,
      time_on_join_screen_ms: joinedAt - pageLoadAt,
      screen_w: window.screen?.width || window.innerWidth,
      screen_h: window.screen?.height || window.innerHeight,
      language: navigator.language || null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      useragent_raw: navigator.userAgent,
    };

    socket.emit('player:join', payload, (res) => {
      if (!res?.ok) {
        alert(res?.error || 'Could not join');
        return;
      }
      playerId = res.playerId;
      localStorage.setItem('deq_player', String(playerId));
      applySnapshot(res.snapshot);
      document.getElementById('lobby-title').textContent = pickCopy('lobby_joined');
      document.getElementById('lobby-hint').textContent = pickCopy('lobby_loading_others');
      showScreen('lobby');
    });
  });

  function applySnapshot(snap) {
    if (!snap) return;
    if (snap.totalQuestions) totalQuestions = snap.totalQuestions;
    if (typeof snap.playerCount === 'number') {
      document.getElementById('lobby-count').textContent = String(snap.playerCount);
    }
    if (typeof snap.score === 'number') {
      score = snap.score;
      document.getElementById('score-pill').textContent = `${score} pts`;
    }
  }

  socket.on('lobby:count', ({ count }) => {
    document.getElementById('lobby-count').textContent = String(count);
  });

  socket.on('quiz:question', (payload) => {
    answered = false;
    clearBetweenTick();
    questionIndex = payload.questionIndex;
    totalQuestions = payload.totalQuestions;
    durationMs = payload.durationMs || 22000;
    betweenDurationMs = payload.betweenDurationMs || betweenDurationMs;
    startedAt = payload.startedAt;
    renderDots('dots-q');
    renderDots('dots-fb');
    renderDots('dots-lobby');

    const body = document.getElementById('q-body');
    body.classList.remove('q-slide-out');
    body.classList.add('q-slide-in');

    document.getElementById('q-text').textContent = payload.question.text;
    const box = document.getElementById('answers');
    box.innerHTML = '';
    payload.question.options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'answer-btn';
      btn.textContent = opt;
      btn.addEventListener('click', () => submitAnswer(idx, btn));
      box.appendChild(btn);
    });

    showScreen('question');
    startTimer();
  });

  function submitAnswer(answerIndex, btn) {
    if (answered) return;
    answered = true;
    stopTimer();

    document.querySelectorAll('.answer-btn').forEach((b) => {
      b.disabled = true;
    });
    btn.classList.add('selected');

    const answerTimeMs = Date.now() - startedAt;
    socket.emit(
      'answer:submit',
      {
        question_id: questionIndex,
        answer_index: answerIndex,
        answer_time_ms: answerTimeMs,
      },
      (res) => {
        if (!res?.ok) {
          answered = false;
          return;
        }
        score = res.score;
        document.getElementById('score-pill').textContent = `${score} pts`;

        document.querySelectorAll('.answer-btn').forEach((b, i) => {
          if (i === res.correctIndex) b.classList.add('reveal-correct');
          else if (i === answerIndex && !res.correct) b.classList.add('reveal-wrong');
        });

        if (res.correct && res.streak >= 2) {
          document.getElementById('score-pill').classList.add('streak');
          setTimeout(
            () => document.getElementById('score-pill').classList.remove('streak'),
            600
          );
        }

        setTimeout(() => {
          showFeedback({ correct: res.correct, timedOut: false, points: res.points });
        }, 350);
      }
    );
  }

  socket.on('quiz:timeout', (payload) => {
    if (payload.questionIndex !== questionIndex) return;
    stopTimer();
    if (answered) return;

    answered = true;
    document.querySelectorAll('.answer-btn').forEach((b, i) => {
      b.disabled = true;
      if (typeof payload.correctIndex === 'number' && i === payload.correctIndex) {
        b.classList.add('reveal-correct');
      }
    });
    showFeedback({ correct: false, timedOut: true });
  });

  socket.on('quiz:between', (payload) => {
    clearBetweenTick();
    document.getElementById('between-title').textContent = pickCopy('between_questions');
    document.getElementById('lb-title').textContent = pickCopy('leaderboard');
    formatLb(payload.leaderboard, 'between-lb');

    const dwell = payload.durationMs || betweenDurationMs;
    const endsAt = Date.now() + dwell;
    const timerEl = document.getElementById('between-timer');
    const tick = () => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      timerEl.textContent = left > 0 ? `next question in ${left}s` : 'loading…';
    };
    tick();
    betweenTick = setInterval(tick, 250);

    showScreen('between');
  });

  socket.on('quiz:leaderboard', (payload) => {
    formatLb(payload.leaderboard, 'between-lb');
    document.getElementById('lb-title').textContent = pickCopy('leaderboard');
    showScreen('between');
  });

  socket.on('quiz:ended', (payload) => {
    stopTimer();
    clearBetweenTick();
    document.getElementById('end-title').textContent = pickCopy('end_screen');
    document.getElementById('end-score').textContent = String(payload.score ?? score);
    document.getElementById('end-rank').textContent =
      payload.rank != null
        ? `rank #${payload.rank} of ${payload.totalPlayers}`
        : '';
    formatLb(payload.leaderboard, 'end-lb');
    showScreen('end');
  });

  socket.on('quiz:reset', () => {
    location.reload();
  });
})();
