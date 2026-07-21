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
        : phase === 'question'
          ? 'Live question'
          : phase === 'between'
            ? 'Between rounds'
            : 'Final results';

    document.getElementById('btn-start').disabled = phase !== 'lobby';
    document.getElementById('btn-next').disabled = phase === 'lobby' || phase === 'ended';
    document.getElementById('btn-end').disabled = phase === 'lobby' || phase === 'ended';

    if (phase === 'ended') {
      document.getElementById('dash-link').classList.remove('hidden');
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
