(() => {
  const gate = document.getElementById('gate');
  const shell = document.getElementById('shell');
  const curtain = document.getElementById('curtain');
  let passcode = sessionStorage.getItem('deq_host_pass') || '';

  document.getElementById('curtain-text').textContent = pickCopy('reveal_transition');

  async function auth(code) {
    const res = await fetch('/api/host/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: code }),
    });
    if (!res.ok) throw new Error('bad');
    passcode = code;
    sessionStorage.setItem('deq_host_pass', code);
    gate.classList.add('hidden');
    await reveal();
  }

  if (passcode) {
    auth(passcode).catch(() => {
      sessionStorage.removeItem('deq_host_pass');
      passcode = '';
    });
  }

  document.getElementById('gate-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    document.getElementById('gate-error').textContent = '';
    try {
      await auth(document.getElementById('passcode').value);
    } catch {
      document.getElementById('gate-error').textContent = 'Invalid passcode.';
    }
  });

  async function reveal() {
    curtain.classList.add('show');
    document.body.classList.add('revealed');

    await new Promise((r) => setTimeout(r, 1200));
    curtain.classList.remove('show');
    shell.classList.add('ready');

    await loadStats();

    const socket = io();
    socket.on('dashboard:refresh', () => loadStats());
  }

  async function loadStats() {
    const res = await fetch(`/api/dashboard/stats?passcode=${encodeURIComponent(passcode)}`);
    if (!res.ok) return;
    const { source, stats } = await res.json();
    document.getElementById('source').textContent = `source: ${source}`;
    render(stats);
  }

  function render(s) {
    if (!s) return;
    document.getElementById('headline-count').textContent = String(s.totalPlayers);
    document.getElementById('stat-total').textContent = String(s.totalPlayers);
    document.getElementById('stat-total-label').textContent =
      s.totalPlayers === 1
        ? 'person just handed over data without reading a single word.'
        : 'people just handed over data without reading a single word.';

    renderBars('bars-device', s.devices, s.totalPlayers);
    renderBars('bars-os', s.os, s.totalPlayers);
    renderBars('bars-browser', s.browsers, s.totalPlayers);
    renderBars('bars-screen', s.screenClusters, s.totalPlayers);
    renderBars('bars-tz', s.timezones, s.totalPlayers);

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

    // Trigger bar widths after paint
    requestAnimationFrame(() => {
      document.querySelectorAll('.bar-fill').forEach((el) => {
        el.style.width = el.dataset.w || '0%';
      });
    });
  }

  function renderBars(id, rows, total) {
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
