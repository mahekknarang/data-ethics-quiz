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

async function fetchQuestions() {
  if (!supabase) return [];
  const { data, error } = await supabase.from('questions').select('*').order('order_index', { ascending: true });
  if (error) {
    console.error('[supabase] fetchQuestions:', error.message);
    return [];
  }
  if (!data || data.length === 0) {
    return await seedQuestions();
  }
  return data;
}

async function insertQuestion(row) {
  if (!supabase) return { data: null, error: null };
  const { data, error } = await supabase.from('questions').insert(row).select('*').single();
  if (error) console.error('[supabase] insertQuestion:', error.message);
  return { data, error };
}

async function updateQuestion(id, row) {
  if (!supabase) return { data: null, error: null };
  const { data, error } = await supabase.from('questions').update(row).eq('id', id).select('*').single();
  if (error) console.error('[supabase] updateQuestion:', error.message);
  return { data, error };
}

async function deleteQuestion(id) {
  if (!supabase) return { error: null };
  const { error } = await supabase.from('questions').delete().eq('id', id);
  if (error) console.error('[supabase] deleteQuestion:', error.message);
  return { error };
}

async function reorderQuestions(updates) {
  if (!supabase) return { error: null };
  // updates is an array of { id, order_index }
  const { error } = await supabase.from('questions').upsert(updates);
  if (error) console.error('[supabase] reorderQuestions:', error.message);
  return { error };
}

async function seedQuestions() {
  if (!supabase) return [];
  const defaultQuestions = [
    { text: "What is the primary purpose of data ethics in Information Technology?", options: ["To increase internet speed", "To ensure responsible and moral use of data", "To reduce storage costs", "To improve hardware performance"], correct_index: 1 },
    { text: "Which of the following is NOT a part of the data lifecycle?", options: ["Collection", "Storage", "Analysis", "Manufacturing"], correct_index: 3 },
    { text: "Transparency in data ethics means:", options: ["Hiding data collection methods", "Making data practices open and understandable", "Selling user data to third parties", "Preventing users from accessing their data"], correct_index: 1 },
    { text: "What does a \"black box\" in AI and data ethics refer to?", options: ["A secure database", "A system whose internal workings are difficult to understand", "A data storage device", "A firewall"], correct_index: 1 },
    { text: "Which law protects personal data in India?", options: ["RTI Act", "GST Act", "DPDP Act, 2023", "Companies Act"], correct_index: 2 },
    { text: "Which of the following is a benefit of transparency?", options: ["Increased confusion", "Builds trust between organizations and users", "Encourages data misuse", "Reduces accountability"], correct_index: 1 },
    { text: "Which of the following is a risk of transparency?", options: ["Security exposure", "Increased trust", "Better compliance", "Fair decision-making"], correct_index: 0 },
    { text: "Fairness in data ethics means:", options: ["Giving preference to one group", "Treating all individuals equally without bias", "Collecting maximum personal data", "Ignoring discrimination"], correct_index: 1 },
    { text: "Which practice helps prevent bias in AI systems?", options: ["Bias prevention in datasets", "Ignoring data quality", "Using fewer datasets", "Sharing all personal data"], correct_index: 0 },
    { text: "Which of the following is NOT a benefit of fairness?", options: ["Equal opportunity", "Trust and credibility", "Increased discrimination", "Social justice"], correct_index: 2 },
    { text: "Security in data ethics mainly focuses on:", options: ["Protecting data from unauthorized access", "Improving software speed", "Increasing storage capacity", "Designing websites"], correct_index: 0 },
    { text: "Which is NOT a core aspect of security in data ethics?", options: ["Confidentiality", "Integrity", "Availability", "Advertisement"], correct_index: 3 },
    { text: "Why is encryption used in data ethics?", options: ["To delete unwanted data", "To protect data during storage and transfer", "To compress files", "To increase internet speed"], correct_index: 1 },
    { text: "Accountability in data ethics means:", options: ["Avoiding responsibility", "Taking responsibility for data handling", "Sharing passwords", "Ignoring complaints"], correct_index: 1 },
    { text: "Which of the following is a key aspect of accountability?", options: ["Oversight", "Piracy", "Hacking", "Data theft"], correct_index: 0 },
    { text: "According to Ahmedabad City Data Policy (CDP) 2024, CCTV footage is generally stored for:", options: ["7 days", "15 days", "30 days", "90 days"], correct_index: 2 },
    { text: "Under Ahmedabad CDP 2024, who is responsible for handling data-related grievances?", options: ["Police Officer", "City Data Officer (CDO) and City Data Protection Officers (CDPOs)", "School Principal", "Mayor"], correct_index: 1 },
    { text: "The \"App Permissions Audit\" activity mainly demonstrates the principle of:", options: ["Data Mining", "Data Minimization", "Data Duplication", "Data Compression"], correct_index: 1 },
    { text: "Data ethics became especially important during which period?", options: ["1950s", "1970s", "Early 2000s", "1940s"], correct_index: 2 },
    { text: "Which of the following is a global data protection regulation?", options: ["GDP", "GDPR", "GPS", "GATT"], correct_index: 1 }
  ];
  
  const toInsert = defaultQuestions.map((q, i) => ({
    text: q.text,
    options: JSON.stringify(q.options),
    correct_index: q.correct_index,
    order_index: i
  }));
  
  const { data, error } = await supabase.from('questions').insert(toInsert).select('*').order('order_index', { ascending: true });
  if (error) {
    console.error('[supabase] seedQuestions:', error.message);
    return [];
  }
  return data;
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
  fetchQuestions,
  insertQuestion,
  updateQuestion,
  deleteQuestion,
  reorderQuestions
};
