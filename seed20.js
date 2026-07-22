require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const newQuestions = [
  { text: 'What is the primary purpose of data ethics in Information Technology?', options: '["To increase internet speed", "To ensure responsible and moral use of data", "To reduce storage costs", "To improve hardware performance"]', correct_index: 1, order_index: 0 },
  { text: 'Which of the following is NOT a part of the data lifecycle?', options: '["Collection", "Storage", "Analysis", "Manufacturing"]', correct_index: 3, order_index: 1 },
  { text: 'Transparency in data ethics means:', options: '["Hiding data collection methods", "Making data practices open and understandable", "Selling user data to third parties", "Preventing users from accessing their data"]', correct_index: 1, order_index: 2 },
  { text: 'What does a "black box" in AI and data ethics refer to?', options: '["A secure database", "A system whose internal workings are difficult to understand", "A data storage device", "A firewall"]', correct_index: 1, order_index: 3 },
  { text: 'Which law protects personal data in India?', options: '["RTI Act", "GST Act", "DPDP Act, 2023", "Companies Act"]', correct_index: 2, order_index: 4 },
  { text: 'Which of the following is a benefit of transparency?', options: '["Increased confusion", "Builds trust between organizations and users", "Encourages data misuse", "Reduces accountability"]', correct_index: 1, order_index: 5 },
  { text: 'Which of the following is a risk of transparency?', options: '["Security exposure", "Increased trust", "Better compliance", "Fair decision-making"]', correct_index: 0, order_index: 6 },
  { text: 'Fairness in data ethics means:', options: '["Giving preference to one group", "Treating all individuals equally without bias", "Collecting maximum personal data", "Ignoring discrimination"]', correct_index: 1, order_index: 7 },
  { text: 'Which practice helps prevent bias in AI systems?', options: '["Bias prevention in datasets", "Ignoring data quality", "Using fewer datasets", "Sharing all personal data"]', correct_index: 0, order_index: 8 },
  { text: 'Which of the following is NOT a benefit of fairness?', options: '["Equal opportunity", "Trust and credibility", "Increased discrimination", "Social justice"]', correct_index: 2, order_index: 9 },
  { text: 'Security in data ethics mainly focuses on:', options: '["Protecting data from unauthorized access", "Improving software speed", "Increasing storage capacity", "Designing websites"]', correct_index: 0, order_index: 10 },
  { text: 'Which is NOT a core aspect of security in data ethics?', options: '["Confidentiality", "Integrity", "Availability", "Advertisement"]', correct_index: 3, order_index: 11 },
  { text: 'Why is encryption used in data ethics?', options: '["To delete unwanted data", "To protect data during storage and transfer", "To compress files", "To increase internet speed"]', correct_index: 1, order_index: 12 },
  { text: 'Accountability in data ethics means:', options: '["Avoiding responsibility", "Taking responsibility for data handling", "Sharing passwords", "Ignoring complaints"]', correct_index: 1, order_index: 13 },
  { text: 'Which of the following is a key aspect of accountability?', options: '["Oversight", "Piracy", "Hacking", "Data theft"]', correct_index: 0, order_index: 14 },
  { text: 'According to Ahmedabad City Data Policy (CDP) 2024, CCTV footage is generally stored for:', options: '["7 days", "15 days", "30 days", "90 days"]', correct_index: 2, order_index: 15 },
  { text: 'Under Ahmedabad CDP 2024, who is responsible for handling data-related grievances?', options: '["Police Officer", "City Data Officer (CDO) and City Data Protection Officers (CDPOs)", "School Principal", "Mayor"]', correct_index: 1, order_index: 16 },
  { text: 'The "App Permissions Audit" activity mainly demonstrates the principle of:', options: '["Data Mining", "Data Minimization", "Data Duplication", "Data Compression"]', correct_index: 1, order_index: 17 },
  { text: 'Data ethics became especially important during which period?', options: '["1950s", "1970s", "Early 2000s", "1940s"]', correct_index: 2, order_index: 18 },
  { text: 'Which of the following is a global data protection regulation?', options: '["GDP", "GDPR", "GPS", "GATT"]', correct_index: 1, order_index: 19 }
];

async function run() {
  console.log("Clearing questions table...");
  const { error: delErr } = await supabase.from('questions').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) {
    console.error("Delete error:", delErr);
    process.exit(1);
  }

  console.log("Inserting new questions...");
  const { error: insErr } = await supabase.from('questions').insert(newQuestions);
  if (insErr) {
    console.error("Insert error:", insErr);
    process.exit(1);
  }

  console.log("Success!");
  process.exit(0);
}

run();
