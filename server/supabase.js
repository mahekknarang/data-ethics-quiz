const { createClient } = require('@supabase/supabase-js');

let supabase = null;

function initSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key || url.includes('YOUR_PROJECT') || key.includes('your_service')) {
    console.warn('[supabase] Missing or placeholder credentials — DB writes will be skipped (in-memory only).');
    return null;
  }
  supabase = createClient(url, key);
  console.log('[supabase] Client ready');
  return supabase;
}

function getSupabase() {
  return supabase;
}

async function insertPlayer(row) {
  if (!supabase) return { data: null, error: null, skipped: true };
  const { data, error } = await supabase.from('players').insert(row).select('id').single();
  if (error) console.error('[supabase] insertPlayer:', error.message);
  return { data, error };
}

async function insertAnswer(row) {
  if (!supabase) return { data: null, error: null, skipped: true };
  const { data, error } = await supabase.from('answers').insert(row).select('id').single();
  if (error) console.error('[supabase] insertAnswer:', error.message);
  return { data, error };
}

function clusterScreen(w, h) {
  if (!w || !h) return 'unknown';
  const max = Math.max(w, h);
  if (max <= 430) return 'phone';
  if (max <= 1024) return 'tablet';
  return 'desktop';
}

async function fetchRevealStats() {
  if (!supabase) {
    return null;
  }

  const [{ data: players, error: pErr }, { data: answers, error: aErr }] = await Promise.all([
    supabase.from('players').select('*').order('join_order', { ascending: true }),
    supabase.from('answers').select('*'),
  ]);

  if (pErr) console.error('[supabase] players fetch:', pErr.message);
  if (aErr) console.error('[supabase] answers fetch:', aErr.message);

  return aggregateStats(players || [], answers || []);
}

function aggregateStats(players, answers) {
  const totalPlayers = players.length;

  const countBy = (arr, keyFn) => {
    const map = {};
    for (const item of arr) {
      const k = keyFn(item) || 'unknown';
      map[k] = (map[k] || 0) + 1;
    }
    return Object.entries(map)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  };

  const joinTimes = players
    .map((p) => p.time_on_join_screen_ms)
    .filter((n) => typeof n === 'number' && n >= 0);
  const avgJoinMs = joinTimes.length
    ? Math.round(joinTimes.reduce((a, b) => a + b, 0) / joinTimes.length)
    : 0;

  const fastestJoiners = [...players]
    .filter((p) => typeof p.time_on_join_screen_ms === 'number')
    .sort((a, b) => a.time_on_join_screen_ms - b.time_on_join_screen_ms)
    .slice(0, 5)
    .map((p) => ({
      name: p.name,
      ms: p.time_on_join_screen_ms,
    }));

  const answerTimes = answers
    .map((a) => a.answer_time_ms)
    .filter((n) => typeof n === 'number' && n >= 0);
  const avgAnswerMs = answerTimes.length
    ? Math.round(answerTimes.reduce((a, b) => a + b, 0) / answerTimes.length)
    : 0;

  const screenClusters = countBy(players, (p) =>
    clusterScreen(p.screen_w, p.screen_h)
  );

  const byPlayer = {};
  for (const a of answers) {
    if (!byPlayer[a.player_id]) {
      byPlayer[a.player_id] = { correct: 0, times: [] };
    }
    if (a.correct) byPlayer[a.player_id].correct += 1;
    if (typeof a.answer_time_ms === 'number') {
      byPlayer[a.player_id].times.push(a.answer_time_ms);
    }
  }

  const playerMap = Object.fromEntries(players.map((p) => [p.id, p]));
  const leaderboard = Object.entries(byPlayer)
    .map(([pid, stats]) => {
      const p = playerMap[pid];
      const avgSpeed = stats.times.length
        ? Math.round(stats.times.reduce((a, b) => a + b, 0) / stats.times.length)
        : null;
      return {
        name: p?.name || '?',
        correct: stats.correct,
        avgSpeedMs: avgSpeed,
      };
    })
    .sort((a, b) => {
      if (b.correct !== a.correct) return b.correct - a.correct;
      return (a.avgSpeedMs || 99999) - (b.avgSpeedMs || 99999);
    });

  const joinTimeline = players.map((p) => ({
    name: p.name,
    joinOrder: p.join_order,
    joinedAt: p.joined_at,
    timeOnJoinMs: p.time_on_join_screen_ms,
  }));

  return {
    totalPlayers,
    devices: countBy(players, (p) => p.device_type),
    os: countBy(players, (p) => p.os),
    browsers: countBy(players, (p) => p.browser),
    avgJoinMs,
    fastestJoiners,
    screenClusters,
    timezones: countBy(players, (p) => p.timezone),
    avgAnswerMs,
    totalAnswers: answers.length,
    joinTimeline,
    leaderboard,
  };
}

module.exports = {
  initSupabase,
  getSupabase,
  insertPlayer,
  insertAnswer,
  fetchRevealStats,
  aggregateStats,
};
