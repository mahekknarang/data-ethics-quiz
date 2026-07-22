/**
 * Shared microcopy — pick a random variant every time (do not cache).
 */
const COPY = {
  join_headline: [
    "yo, tap in 👇", "you've been summoned 🔮", "step right up 🎪", "ready or not... 😈",
    "tap to enter the chat 💬", "loading main character energy ✨", "this is your sign 🚦",
    "hi. yes. you. 👋", "quiz mode: activated 🎮", "welcome to the trap (it's fun though) 🕸️"
  ],
  join_button: [
    "Let's gooo 🚀", "Accept & Continue (we know you won't read this) 👀", "In. No thoughts. 🧠❌",
    "count me in ✍️", "yes, sign me up 📝", "tap to seal the deal 🤝", "I consent (probably) ✅",
    "let's do this thing 🔥", "enter the arena ⚔️", "no more stalling, go 🏃"
  ],
  join_subtext_name: [
    "no cap, just your name 🧢", "first name energy only ✨", "who's playing? 🎮",
    "drop your name below 👇", "just a name, we're not that deep (yet) 😌",
    "tell us who's about to win 🏆", "name, please 🙏", "who's in the building 🏢",
    "quick, before you overthink it ⏱️", "your name here 📛"
  ],
  join_fineprint_teaser: [
    "the fine print nobody reads (couldn't be you... or could it 👀)", "terms and conditions, allegedly 📜",
    "skip this part, everyone does ⏭️", "legally we have to put this here 🫠",
    "the boring bit, we won't judge if you skip it 😴", "some rules exist, apparently 📋",
    "read it or don't, we already know 🔍", "fine print go brrr 🖨️",
    "the part between you and \"yes\" 🚪", "terms live here, curiosity optional 🐈"
  ],
  lobby_joined: [
    "you're in. now we wait 🍿", "locked in. hang tight. 🔒", "you made it. barely. 😮💨",
    "welcome aboard 🛳️", "you're officially a participant now 📛", "no turning back now 🚫↩️",
    "confirmed. proceed to vibe. 😎", "you're on the list ✅", "entry granted 🗝️", "and... you're in 🎬"
  ],
  lobby_loading_others: [
    "loading the rest of the squad... 👥", "waiting on stragglers... 🐌", "rounding everyone up... 🤠",
    "give it a sec, more incoming ⏳", "the gang's still assembling 🛠️", "hang on, more players loading 📶",
    "counting heads... 🔢", "patience, the room's filling up 🚪", "more legends arriving by the second 🌟",
    "almost everyone's here 🕰️"
  ],
  between_questions: [
    "cooking up the next one 👨🍳🔥", "plot twist loading... 🌀", "brb, consulting the data gods 🛐",
    "next one's spicier 🌶️", "reloading the chaos 🔄", "hold tight, round two incoming 🥊",
    "the next question is judging you already 👀", "buffering brilliance... 💭",
    "quick breather, then back in 😤", "new question, who dis 📲"
  ],
  answer_correct: [
    "ok that's giving informed citizen 💅", "big brain moment fr 🧠✨", "certified data-literate behavior ✅",
    "you read the terms once, didn't you 👁️", "look at you, actually paying attention 👏",
    "correct. suspiciously correct. 🕵️", "that's the smart answer fr fr 💯", "ding ding ding 🔔",
    "you get it. genuinely. 🙌", "nailed it, no notes 📌"
  ],
  answer_wrong: [
    "respectfully... no. ❌", "that's the Cambridge Analytica special 💀", "it's giving 'didn't read the terms' 📄🚫",
    "bold guess, wrong guess 🎲", "that's a hard no from the data gods ⚡", "close, but also very not close 😬",
    "nice try though 🫡", "the algorithm is disappointed 🤖💔", "that answer got flagged 🚩",
    "wrong, but confidently wrong, we respect it 😌"
  ],
  time_up: [
    'time\'s up — no answer locked in ⏰',
    'clock said no. moving on ⌛',
    'too slow bestie — time up 🐢',
    'silence is also data... time up 📵',
  ],
  timer_low: [
    "clock's ticking bestie ⏳", "decide like your data's on the line (it is) 🔥", "tick tock ⏰",
    "hurry, before it's too late 🏃💨", "time's almost up, no pressure (there's pressure) 😰",
    "last few seconds, choose wisely 🧐", "the timer doesn't care about your feelings ⏱️",
    "speed run this decision 🎮", "seconds left, go go go 🚨", "don't overthink it now ⚡"
  ],
  leaderboard: [
    "the tea has been spilled ☕", "current standings, no cap 📊", "who's winning, who's cooked 🍳",
    "the scoreboard doesn't lie 📈", "rankings, freshly updated 🔄", "see where you stand 👀",
    "the results are in 📥", "current vibes: competitive 😤", "sorted by who's actually paying attention 🧠",
    "the leaderboard has spoken 🗣️"
  ],
  end_screen: [
    "gg. thanks for playing 🎮", "you survived. but did your data? 👀", "stick around... something's about to get real 😬",
    "that's a wrap 🎬", "quiz over, plot still loading 🌀", "you made it to the end 🏁",
    "round complete. don't leave yet. ⏳", "that's all the questions... for now 👁️",
    "thanks for playing along 🙏", "quiz's done, but we're not 😏"
  ],
  reveal_transition: [
    "hold on, pulling up something you should see... 🔦", "plot twist incoming 🌪️", "wait for it... 👁️👄👁️",
    "okay so, funny story 😅", "this next part hits different 💥", "remember that fine print? 📜👀",
    "time to see what actually happened 🕵️", "brace yourselves 😬", "this is the part nobody expects 🎭",
    "let's talk about what we collected 📊"
  ]
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
