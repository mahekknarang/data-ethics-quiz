(() => {
  const gate = document.getElementById('gate');
  const shell = document.getElementById('shell');
  const gateForm = document.getElementById('gate-form');
  const gateError = document.getElementById('gate-error');

  let passcode = sessionStorage.getItem('deq_host_pass') || '';
  let socket = null;
  let displayedAnswered = 0;
  let tallyTimer = null;

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

  async function setup() {
    const cfg = await fetch('/api/config').then((r) => r.json());
    document.getElementById('join-url').textContent = cfg.publicUrl + '/';
    document.getElementById('qr').src = '/api/qr?size=400';
    document.getElementById('dash-link').href = '/dashboard';

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
      document.getElementById('live-count').innerHTML =
        `${count} <span>joined</span>`;
      document.getElementById('stat-players').textContent = String(count);
    });
    socket.on('quiz:ended', () => {
      document.getElementById('dash-link').classList.remove('hidden');
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
        : phase === 'running'
          ? 'Quiz in progress (self-paced)'
          : phase === 'ended'
            ? 'Final results'
            : phase.charAt(0).toUpperCase() + phase.slice(1);

    document.getElementById('btn-start').disabled = phase !== 'lobby';
    document.getElementById('btn-next').disabled = phase === 'lobby' || phase === 'ended';
    document.getElementById('btn-end').disabled = phase === 'lobby' || phase === 'ended';

    if (phase === 'ended') {
      document.getElementById('dash-link').classList.remove('hidden');
    }

    // Show how many players are done vs total
    const done = snap.doneCount || 0;
    document.getElementById('stat-q').textContent =
      phase === 'running'
        ? `${done}/${snap.playerCount} done`
        : phase === 'ended'
          ? `${snap.totalQuestions} Q\'s`
          : '—';

    document.getElementById('stat-answered').textContent =
      `${done}/${snap.playerCount}`;
    animateTally(done);
    document.getElementById('tally-total').textContent = String(snap.playerCount);

    const stageQ = document.getElementById('stage-q');
    const opts = document.getElementById('options-preview');
    opts.innerHTML = '';

    if (phase === 'running') {
      stageQ.textContent = `Self-paced: ${done} of ${snap.playerCount} players finished`;
      // Show per-player progress
      (snap.players || []).forEach((p) => {
        const d = document.createElement('div');
        const qNum = p.questionIndex >= 0 ? p.questionIndex + 1 : 0;
        d.textContent = `${p.name}: Q${qNum}/${snap.totalQuestions} (${p.playerPhase})`;
        if (p.done) d.style.opacity = '0.5';
        opts.appendChild(d);
      });
    } else if (phase === 'ended') {
      stageQ.textContent = 'Quiz complete — open the data dashboard for the reveal.';
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

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
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
      }
    };
  }
})();
