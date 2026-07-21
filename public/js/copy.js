/**
 * Shared microcopy — pick a random variant every time (do not cache).
 */
const COPY = {
  join_headline: [
    'yo, tap in 👇',
    "you've been summoned 🔮",
    'step right up 🎪',
    'ready or not...',
  ],
  join_button: [
    "Let's gooo 🚀",
    "Accept & Continue (we know you won't read this) 👀",
    'In. No thoughts. 🧠❌',
    'count me in ✍️',
  ],
  join_subtext_name: [
    'no cap, just your name 🧢',
    'first name energy only ✨',
    "who's playing? 🎮",
  ],
  join_fineprint_teaser: [
    "the fine print nobody reads (couldn't be you... or could it 👀)",
    'terms and conditions, allegedly 📜',
    'skip this part, everyone does ⏭️',
  ],

  lobby_joined: [
    "you're in. now we wait 🍿",
    'locked in. hang tight. 🔒',
    'you made it. barely. 😮‍💨',
  ],
  lobby_loading_others: [
    'loading the rest of the squad... 👥',
    'waiting on stragglers... 🐌',
    'rounding everyone up... 🤠',
  ],

  between_questions: [
    'cooking up the next one 👨‍🍳🔥',
    'plot twist loading... 🌀',
    'brb, consulting the data gods 🛐',
    "next one's spicier 🌶️",
  ],

  answer_correct: [
    "ok that's giving informed citizen 💅",
    'big brain moment fr 🧠✨',
    'certified data-literate behavior ✅',
    'you read the terms once, didn\'t you 👁️',
  ],
  answer_wrong: [
    'respectfully... no. ❌',
    "that's the Cambridge Analytica special 💀",
    "it's giving 'didn't read the terms' 📄🚫",
    'bold guess, wrong guess 🎲',
  ],

  timer_low: [
    "clock's ticking bestie ⏳",
    "decide like your data's on the line (it is) 🔥",
    'tick tock ⏰',
  ],

  leaderboard: [
    'the tea has been spilled ☕',
    'current standings, no cap 📊',
    "who's winning, who's cooked 🍳",
  ],

  end_screen: [
    'gg. thanks for playing 🎮',
    'you survived. but did your data? 👀',
    "stick around... something's about to get real 😬",
  ],

  reveal_transition: [
    'hold on, pulling up something you should see... 🔦',
    'plot twist incoming 🌪️',
    'wait for it... 👁️👄👁️',
  ],
};

function pick(key) {
  const arr = COPY[key];
  if (!arr || !arr.length) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

if (typeof window !== 'undefined') {
  window.COPY = COPY;
  window.pickCopy = pick;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { COPY, pick };
}
