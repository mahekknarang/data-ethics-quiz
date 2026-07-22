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
    document.getElementById('panel-questions').classList.toggle('active', name === 'questions');
    document.body.classList.toggle('reveal-mode', name === 'reveal');

    if (name === 'reveal') {
      document.getElementById('tab-reveal').classList.remove('pulse');
      playRevealOnce();
    }
    if (name === 'questions') {
      loadSettings();
      loadQuestions();
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
        : phase === 'running'
          ? 'Quiz in progress (self-paced)'
          : phase === 'ended'
            ? 'Final results'
            : phase.charAt(0).toUpperCase() + phase.slice(1);

    document.getElementById('btn-start').disabled = phase !== 'lobby';
    document.getElementById('btn-next').disabled = phase === 'lobby' || phase === 'ended';
    document.getElementById('btn-end').disabled = phase === 'lobby' || phase === 'ended';

    const hint = document.getElementById('pace-hint');
    if (hint) {
      if (phase === 'lobby') {
        hint.textContent =
          'Auto-paced: ~22s per question · 5s feedback · 5s between · tap Start once';
      } else if (phase === 'running') {
        hint.textContent = `Self-paced flow running for ${snap.playerCount} players`;
      } else {
        hint.textContent = 'Quiz complete — open Data reveal';
      }
    }

    if (phase === 'ended') {
      document.getElementById('tab-reveal').classList.add('pulse');
    }

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

  // --- Questions Management ---
  let bankQuestions = [];

  async function loadSettings() {
    const res = await fetch(`/api/settings?passcode=${encodeURIComponent(passcode)}`);
    if (res.ok) {
      const data = await res.json();
      document.getElementById('setting-count').value = data.questionCount;
      document.getElementById('setting-shuffle').checked = data.shuffle;
    }
  }

  document.getElementById('btn-save-settings').addEventListener('click', async () => {
    const count = document.getElementById('setting-count').value;
    const shuffle = document.getElementById('setting-shuffle').checked;
    const res = await fetch(`/api/settings?passcode=${encodeURIComponent(passcode)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionCount: count, shuffle })
    });
    const statusEl = document.getElementById('settings-status');
    if (res.ok) {
      statusEl.textContent = 'Settings saved.';
      setTimeout(() => statusEl.textContent = '', 3000);
    } else {
      statusEl.textContent = 'Failed to save.';
      statusEl.style.color = '#ef4444';
    }
  });

  async function loadQuestions() {
    const res = await fetch(`/api/questions?passcode=${encodeURIComponent(passcode)}`);
    if (res.ok) {
      bankQuestions = await res.json();
      renderQuestions();
    }
  }

  function renderQuestions() {
    const list = document.getElementById('questions-list');
    list.innerHTML = '';
    bankQuestions.forEach((q, index) => {
      const li = document.createElement('li');
      li.style.cssText = 'background: #26292d; padding: 1rem; border-radius: 4px; display: flex; justify-content: space-between; align-items: flex-start;';
      
      const content = document.createElement('div');
      content.style.flex = '1';
      let optionsHtml = '';
      let opts = [];
      try { opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options; } catch(e){}
      opts.forEach((opt, i) => {
        optionsHtml += `<div style="${i === q.correct_index ? 'color: #10b981; font-weight: 600;' : 'color: #8b93a0;'}">${i === q.correct_index ? '✓ ' : '○ '}${escapeHtml(opt)}</div>`;
      });
      
      content.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 0.5rem; color: #fff;">${escapeHtml(q.text)}</div>
        <div style="font-size: 0.9rem;">${optionsHtml}</div>
      `;
      
      const actions = document.createElement('div');
      actions.style.cssText = 'display: flex; gap: 0.5rem; margin-left: 1rem;';
      
      const btnUp = document.createElement('button');
      btnUp.type = 'button';
      btnUp.textContent = '↑';
      btnUp.disabled = index === 0;
      btnUp.onclick = () => moveQuestion(index, -1);
      
      const btnDown = document.createElement('button');
      btnDown.type = 'button';
      btnDown.textContent = '↓';
      btnDown.disabled = index === bankQuestions.length - 1;
      btnDown.onclick = () => moveQuestion(index, 1);
      
      const btnEdit = document.createElement('button');
      btnEdit.type = 'button';
      btnEdit.textContent = 'Edit';
      btnEdit.onclick = () => openQuestionModal(q);
      
      const btnDelete = document.createElement('button');
      btnDelete.type = 'button';
      btnDelete.textContent = 'Delete';
      btnDelete.className = 'danger';
      btnDelete.onclick = () => deleteQuestion(q.id);
      
      actions.appendChild(btnUp);
      actions.appendChild(btnDown);
      actions.appendChild(btnEdit);
      actions.appendChild(btnDelete);
      
      li.appendChild(content);
      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  async function moveQuestion(index, dir) {
    if (index + dir < 0 || index + dir >= bankQuestions.length) return;
    const a = bankQuestions[index];
    const b = bankQuestions[index + dir];
    
    // Swap order_index
    const temp = a.order_index;
    a.order_index = b.order_index;
    b.order_index = temp;
    
    bankQuestions[index] = b;
    bankQuestions[index + dir] = a;
    
    renderQuestions();
    
    await fetch(`/api/questions/reorder?passcode=${encodeURIComponent(passcode)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { id: a.id, order_index: a.order_index },
        { id: b.id, order_index: b.order_index }
      ])
    });
  }

  async function deleteQuestion(id) {
    if (!confirm('Are you sure you want to delete this question?')) return;
    const res = await fetch(`/api/questions/${id}?passcode=${encodeURIComponent(passcode)}`, {
      method: 'DELETE'
    });
    if (res.ok) {
      bankQuestions = bankQuestions.filter(q => q.id !== id);
      renderQuestions();
    }
  }

  const modal = document.getElementById('question-modal');
  const qForm = document.getElementById('question-form');
  const optsContainer = document.getElementById('q-options');
  
  function createOptionRow(val = '', isCorrect = false) {
    const div = document.createElement('div');
    div.style.cssText = 'display: flex; gap: 0.5rem; align-items: center;';
    div.innerHTML = `
      <input type="radio" name="q-correct" required ${isCorrect ? 'checked' : ''}>
      <input type="text" class="q-opt-val" value="${escapeHtml(val)}" required style="flex: 1; padding: 0.5rem; background: #26292d; border: 1px solid #3c3f43; color: #fff; border-radius: 4px;">
      <button type="button" class="btn-rm-opt" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">×</button>
    `;
    div.querySelector('.btn-rm-opt').onclick = () => {
      if (optsContainer.children.length > 2) div.remove();
      else alert('Need at least 2 options.');
    };
    optsContainer.appendChild(div);
  }

  document.getElementById('btn-add-option').addEventListener('click', () => {
    if (optsContainer.children.length < 6) createOptionRow();
    else alert('Maximum 6 options allowed.');
  });

  document.getElementById('btn-new-question').addEventListener('click', () => {
    openQuestionModal();
  });

  document.getElementById('btn-cancel-question').addEventListener('click', () => {
    modal.classList.add('hidden');
  });

  function openQuestionModal(q = null) {
    qForm.reset();
    optsContainer.innerHTML = '';
    document.getElementById('question-error').textContent = '';
    
    if (q) {
      document.getElementById('question-modal-title').textContent = 'Edit Question';
      document.getElementById('q-id').value = q.id;
      document.getElementById('q-text').value = q.text;
      let opts = [];
      try { opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options; } catch(e){}
      opts.forEach((opt, i) => createOptionRow(opt, i === q.correct_index));
    } else {
      document.getElementById('question-modal-title').textContent = 'New Question';
      document.getElementById('q-id').value = '';
      createOptionRow('', true);
      createOptionRow('', false);
    }
    
    modal.classList.remove('hidden');
  }

  qForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('q-id').value;
    const text = document.getElementById('q-text').value;
    
    const rows = Array.from(optsContainer.children);
    const options = rows.map(r => r.querySelector('.q-opt-val').value);
    const correct_index = rows.findIndex(r => r.querySelector('input[type="radio"]').checked);
    
    const payload = { text, options: JSON.stringify(options), correct_index };
    
    let url = `/api/questions?passcode=${encodeURIComponent(passcode)}`;
    let method = 'POST';
    if (id) {
      url = `/api/questions/${id}?passcode=${encodeURIComponent(passcode)}`;
      method = 'PUT';
    } else {
      payload.order_index = bankQuestions.length > 0 ? Math.max(...bankQuestions.map(q => q.order_index)) + 1 : 0;
    }
    
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text());
      modal.classList.add('hidden');
      loadQuestions();
    } catch(err) {
      document.getElementById('question-error').textContent = err.message || 'Error saving question.';
    }
  });

})();
