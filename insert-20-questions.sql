-- Clear existing questions if needed (optional)
-- DELETE FROM questions WHERE id != 0;

INSERT INTO questions (text, options, correct_index, order_index) VALUES
('What is the primary purpose of data ethics in Information Technology?', '["To increase internet speed", "To ensure responsible and moral use of data", "To reduce storage costs", "To improve hardware performance"]', 1, 0),
('Which of the following is NOT a part of the data lifecycle?', '["Collection", "Storage", "Analysis", "Manufacturing"]', 3, 1),
('Transparency in data ethics means:', '["Hiding data collection methods", "Making data practices open and understandable", "Selling user data to third parties", "Preventing users from accessing their data"]', 1, 2),
('What does a "black box" in AI and data ethics refer to?', '["A secure database", "A system whose internal workings are difficult to understand", "A data storage device", "A firewall"]', 1, 3),
('Which law protects personal data in India?', '["RTI Act", "GST Act", "DPDP Act, 2023", "Companies Act"]', 2, 4),
('Which of the following is a benefit of transparency?', '["Increased confusion", "Builds trust between organizations and users", "Encourages data misuse", "Reduces accountability"]', 1, 5),
('Which of the following is a risk of transparency?', '["Security exposure", "Increased trust", "Better compliance", "Fair decision-making"]', 0, 6),
('Fairness in data ethics means:', '["Giving preference to one group", "Treating all individuals equally without bias", "Collecting maximum personal data", "Ignoring discrimination"]', 1, 7),
('Which practice helps prevent bias in AI systems?', '["Bias prevention in datasets", "Ignoring data quality", "Using fewer datasets", "Sharing all personal data"]', 0, 8),
('Which of the following is NOT a benefit of fairness?', '["Equal opportunity", "Trust and credibility", "Increased discrimination", "Social justice"]', 2, 9),
('Security in data ethics mainly focuses on:', '["Protecting data from unauthorized access", "Improving software speed", "Increasing storage capacity", "Designing websites"]', 0, 10),
('Which is NOT a core aspect of security in data ethics?', '["Confidentiality", "Integrity", "Availability", "Advertisement"]', 3, 11),
('Why is encryption used in data ethics?', '["To delete unwanted data", "To protect data during storage and transfer", "To compress files", "To increase internet speed"]', 1, 12),
('Accountability in data ethics means:', '["Avoiding responsibility", "Taking responsibility for data handling", "Sharing passwords", "Ignoring complaints"]', 1, 13),
('Which of the following is a key aspect of accountability?', '["Oversight", "Piracy", "Hacking", "Data theft"]', 0, 14),
('According to Ahmedabad City Data Policy (CDP) 2024, CCTV footage is generally stored for:', '["7 days", "15 days", "30 days", "90 days"]', 2, 15),
('Under Ahmedabad CDP 2024, who is responsible for handling data-related grievances?', '["Police Officer", "City Data Officer (CDO) and City Data Protection Officers (CDPOs)", "School Principal", "Mayor"]', 1, 16),
('The "App Permissions Audit" activity mainly demonstrates the principle of:', '["Data Mining", "Data Minimization", "Data Duplication", "Data Compression"]', 1, 17),
('Data ethics became especially important during which period?', '["1950s", "1970s", "Early 2000s", "1940s"]', 2, 18),
('Which of the following is a global data protection regulation?', '["GDP", "GDPR", "GPS", "GATT"]', 1, 19);
