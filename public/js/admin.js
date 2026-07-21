(() => {
  const gate = document.getElementById('gate');
  const shell = document.getElementById('shell');
  const curtain = document.getElementById('curtain');
  const gateForm = document.getElementById('gate-form');
  const gateError = document.getElementById('gate-error');

  document.getElementById('curtain-text').textContent = pickCopy('reveal_transition');

  let passcode = sessionStorage.getItem('deq_host_pass') || '';
  let socket = null;
  let displayedAnswered = 0;
  let tallyTimer = null;
  let revealPlayed = false;

  async function unlock(code) {
    const res = await fetch('/api/host/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: code }),
    });
    if (!res.ok) throw new Error('Invalid passcode');
    passcode = code;
    sessionStorage.setItem('deq_host_pass', code);
    gate.classList.add('hidden');
    shell.classList.add('ready');
    await setup();
  }

  if (passcode) {
    unlock(passcode).catch(() => {
      sessionStorage.removeItem('deq_host_pass');
      passcode = '';
    });
  }

  gateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    gateError.textContent = '';
    try {
      await unlock(document.getElementById('passcode').value);
    } catch {
      gateError.textContent = 'Nope — try again.';
    }
  });

  function switchTab(name) {
    document.querySelectorAll('.admin-tab').forEach((t) => {
      t.classList.toggle('active', t.dataset.tab === name);
    });
    document.getElementById('panel-run').classList.toggle('active', name === 'run');
    document.getElementById('panel-reveal').classList.toggle('active', name === 'reveal');
    document.body.classList.toggle('reveal-mode', name === 'reveal');

    if (name === 'reveal') {
      document.getElementById('tab-reveal').classList.remove('pulse');
      playRevealOnce();
    }
  }

  async function playRevealOnce() {
    if (!revealPlayed) {
      revealPlayed = true;
      curtain.classList.add('show');
      await new Promise((r) => setTimeout(r, 1100));
      curtain.classList.remove('show');
    }
    await loadStats();
  }

  document.querySelectorAll('.admin-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
  document.getElementById('btn-goto-reveal').addEventListener('click', () => switchTab('reveal'));
  document.getElementById('btn-back-run').addEventListener('click', () => switchTab('run'));
  document.getElementById('btn-refresh-stats').addEventListener('click', () => loadStats());

  function resolveJoinUrl(cfg) {
    const configured = (cfg.configuredUrl || cfg.publicUrl || '').replace(/\/$/, '');
    const looksLocal = !configured || /localhost|127\.0\.0\.1/.test(configured);
    // If PUBLIC_URL is still localhost, use whatever host you opened admin on
    // (your Mac's Wi‑Fi IP, or the live Render URL).
    if (looksLocal) return window.location.origin;
    return configured;
  }

  async function setup() {
    const cfg = await fetch('/api/config').then((r) => r.json());
    const joinUrl = resolveJoinUrl(cfg).replace(/\/$/, '') + '/';
    document.getElementById('join-url').textContent = joinUrl;
    document.getElementById('qr').src =
      `/api/qr?size=400&url=${encodeURIComponent(joinUrl)}`;

    socket = io();
    socket.emit('host:auth', { passcode }, (res) => {
      if (res?.ok) applyHost(res.snapshot);
    });

    socket.on('host:update', applyHost);
    socket.on('answer:tally', ({ answered, total }) => {
      animateTally(answered);
      document.getElementById('tally-total').textContent = String(total);
      document.getElementById('stat-answered').textContent = `${answered}/${total}`;
    });
    socket.on('lobby:count', ({ count }) => {
      document.getElementById('live-count').innerHTML = `${count} <span>joined</span>`;
      document.getElementById('stat-players').textContent = String(count);
    });
    socket.on('quiz:ended', () => {
      document.getElementById('tab-reveal').classList.add('pulse');
    });
    socket.on('dashboard:refresh', () => {
      if (document.getElementById('panel-reveal').classList.contains('active')) {
        loadStats();
      }
    });

    wireControls();
  }

  function animateTally(target) {
    if (tallyTimer) clearInterval(tallyTimer);
    const el = document.getElementById('tally-num');
    if (target <= displayedAnswered) {
      displayedAnswered = target;
      el.textContent = String(target);
      return;
    }
    tallyTimer = setInterval(() => {
      if (displayedAnswered >= target) {
        clearInterval(tallyTimer);
        return;
      }
      displayedAnswered += 1;
      el.textContent = String(displayedAnswered);
    }, 40);
  }

  function applyHost(snap) {
    if (!snap) return;
    document.getElementById('stat-players').textContent = String(snap.playerCount);
    document.getElementById('live-count').innerHTML =
      `${snap.playerCount} <span>joined</span>`;

    const phase = snap.phase;
    document.getElementById('phase-label').textContent = phase.toUpperCase();
    document.getElementById('host-title').textContent =
      phase === 'lobby'
        ? 'Lobby'
        : phase === 'question'
          ? 'Live question'
          : phase === 'between'
            ? 'Between rounds'
            : 'Final results';

    document.getElementById('btn-start').disabled = phase !== 'lobby';
    document.getElementById('btn-next').disabled = phase === 'lobby' || phase === 'ended';
    document.getElementById('btn-end').disabled = phase === 'lobby' || phase === 'ended';

    if (phase === 'ended') {
      document.getElementById('tab-reveal').classList.add('pulse');
    }

    if (snap.questionIndex >= 0) {
      document.getElementById('stat-q').textContent =
        `${snap.questionIndex + 1}/${snap.totalQuestions}`;
    } else {
      document.getElementById('stat-q').textContent = '—';
    }

    document.getElementById('stat-answered').textContent =
      `${snap.answered}/${snap.playerCount}`;
    animateTally(snap.answered);
    document.getElementById('tally-total').textContent = String(snap.playerCount);

    const stageQ = document.getElementById('stage-q');
    const opts = document.getElementById('options-preview');
    opts.innerHTML = '';

    if (snap.question) {
      stageQ.textContent = snap.question.text;
      (snap.question.options || []).forEach((o, i) => {
        const d = document.createElement('div');
        d.textContent = o;
        if (typeof snap.question.correct === 'number' && i === snap.question.correct) {
          d.classList.add('correct');
        }
        opts.appendChild(d);
      });
    } else if (phase === 'ended') {
      stageQ.textContent = 'Quiz complete — switch to the Data reveal tab.';
    } else {
      stageQ.textContent = 'Waiting for players…';
    }

    const lb = document.getElementById('host-lb');
    lb.innerHTML = '';
    (snap.leaderboard || []).slice(0, 5).forEach((row) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="r mono">#${row.rank}</span><span>${escapeHtml(
        row.name
      )}</span><span class="s mono">${row.score}</span>`;
      lb.appendChild(li);
    });
  }

  function wireControls() {
    document.getElementById('btn-start').onclick = () => {
      socket.emit('host:start', { passcode });
    };
    document.getElementById('btn-next').onclick = () => {
      socket.emit('host:next', { passcode });
    };
    document.getElementById('btn-end').onclick = () => {
      if (confirm('End the quiz now?')) socket.emit('host:end', { passcode });
    };
    document.getElementById('btn-reset').onclick = () => {
      if (confirm('Reset the whole session? Players will need to rejoin.')) {
        socket.emit('host:reset', { passcode });
        displayedAnswered = 0;
        revealPlayed = false;
      }
    };
  }

  async function loadStats() {
    const res = await fetch(`/api/dashboard/stats?passcode=${encodeURIComponent(passcode)}`);
    if (!res.ok) return;
    const { source, stats } = await res.json();
    document.getElementById('source').textContent = `source: ${source}`;
    renderStats(stats);
  }

  function renderStats(s) {
    if (!s) return;
    document.getElementById('headline-count').textContent = String(s.totalPlayers);
    document.getElementById('stat-total').textContent = String(s.totalPlayers);
    document.getElementById('stat-total-label').textContent =
      s.totalPlayers === 1
        ? 'person just handed over data without reading a single word.'
        : 'people just handed over data without reading a single word.';

    renderBars('bars-device', s.devices);
    renderBars('bars-os', s.os);
    renderBars('bars-browser', s.browsers);
    renderBars('bars-screen', s.screenClusters);
    renderBars('bars-tz', s.timezones);

    document.getElementById('avg-join').textContent = formatMs(s.avgJoinMs);
    const fame = document.getElementById('fame');
    fame.innerHTML = '';
    (s.fastestJoiners || []).forEach((row, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>#${i + 1} ${escapeHtml(row.name)}</span><span class="ms mono">${formatMs(
        row.ms
      )}</span>`;
      fame.appendChild(li);
    });

    document.getElementById('avg-answer').textContent = formatMs(s.avgAnswerMs);
    document.getElementById('answer-count').textContent = String(s.totalAnswers || 0);

    requestAnimationFrame(() => {
      document.querySelectorAll('.bar-fill').forEach((el) => {
        el.style.width = el.dataset.w || '0%';
      });
    });
  }

  function renderBars(id, rows) {
    const root = document.getElementById(id);
    root.innerHTML = '';
    const list = (rows || []).slice(0, 6);
    const max = Math.max(1, ...list.map((r) => r.count));
    list.forEach((row) => {
      const pct = Math.round((row.count / max) * 100);
      const div = document.createElement('div');
      div.className = 'bar-row';
      div.innerHTML = `
        <span class="name" title="${escapeHtml(row.label)}">${escapeHtml(shortLabel(row.label))}</span>
        <div class="bar-track"><div class="bar-fill" data-w="${pct}%"></div></div>
        <span class="count">${row.count}</span>`;
      root.appendChild(div);
    });
    if (!list.length) {
      root.innerHTML = '<p class="join-stat-note">No data yet</p>';
    }
  }

  function shortLabel(s) {
    const t = String(s || 'unknown');
    return t.length > 14 ? t.slice(0, 13) + '…' : t;
  }

  function formatMs(ms) {
    if (ms == null || Number.isNaN(ms)) return '—';
    if (ms < 1000) return `${Math.round(ms)} ms`;
    return `${(ms / 1000).toFixed(1)} s`;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
})();
