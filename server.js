require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const JWT_SECRET = process.env.JWT_SECRET || 'college_secret_key_123';

// Initialize Gemini AI
let genAI = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

// ── COLLEGE SYSTEM INSTRUCTIONS ──
const COLLEGE_SYSTEM_PROMPT = `
You are CampusBot, the official AI Campus Assistant for our polytechnic college.
Your primary role is to assist students, parents, and visitors with:
1. Polytechnic Departments (CSE, EEE, Civil, Mech, Papertech, ICE) with full explanations and contact details
2. Admissions, Eligibility Criteria, and Fees
3. Campus Facilities, Hostels, and Library
4. Placements, Recruiters, and Higher Studies (Lateral Entry)
Maintain a polite, informative, professional, and student-friendly tone.
`;

// ── EXPANDED COLLEGE & DEPARTMENT KNOWLEDGE BASE ──
function getCollegeOfflineAnswer(prompt) {
  const query = prompt.toLowerCase();

  if (query.includes('admission') || query.includes('eligibility') || query.includes('apply')) {
    return "🎓 **Admissions & Eligibility:**\n" +
           "• **Eligibility:** 10th Standard (SSLC) pass for 1st-year Diploma admissions. 12th Vocational/Academic or ITI pass for Direct 2nd Year (Lateral Entry).\n" +
           "• **Application Process:** Online applications open annually in May through the state technical education portal or college office.\n" +
           "• **Contact Admission Cell:** admissions@college.edu | Helpline: +91 98765 43210";
  }

  // Individual Department Explanations & Contacts
  if (query.includes('cse') || query.includes('computer science')) {
    return "💻 **Department of Computer Science & Engineering (CSE):**\n\n" +
           "• **Full Explanation:** Focuses on programming languages (C, C++, Python, Java), web development, database management, computer networks, and software engineering. Practical lab sessions are prioritized to build real-world applications.\n" +
           "• **Core Subjects:** Data Structures, Operating Systems, DBMS, Software Engineering.\n" +
           "• **Career Scope:** Software Developer, Junior Programmer, Web Designer, IT Support Specialist.\n" +
           "• **Higher Studies:** Direct 2nd Year B.E./B.Tech (CSE or IT) via Lateral Entry.\n" +
           "• **Department Contact & HOD:** Dr. K. Ramesh (HOD) | Email: cse@college.edu | Ph: +91 98765 43211";
  }

  if (query.includes('eee') || query.includes('electrical')) {
    return "⚡ **Department of Electrical & Electronics Engineering (EEE):**\n\n" +
           "• **Full Explanation:** Deals with power generation, transmission, electrical machines, transformers, circuit theory, and industrial control systems. Includes hands-on training in electrical wiring and maintenance.\n" +
           "• **Core Subjects:** Electrical Machines, Power Systems, Generation & Utilization, Control Systems.\n" +
           "• **Career Scope:** Substation Operator, Electrical Supervisor, TNEB/EB Technician, EV Maintenance Engineer.\n" +
           "• **Higher Studies:** Direct 2nd Year B.E./B.Tech (EEE) via Lateral Entry.\n" +
           "• **Department Contact & HOD:** Prof. S. Priya (HOD) | Email: eee@college.edu | Ph: +91 98765 43212";
  }

  if (query.includes('civil')) {
    return "🏗️ **Department of Civil Engineering:**\n\n" +
           "• **Full Explanation:** Covers building construction technology, surveying, structural design, AutoCAD drafting, estimation and costing, highway engineering, and environmental sanitation.\n" +
           "• **Core Subjects:** Surveying, Strength of Materials, Construction Materials, Concrete Technology.\n" +
           "• **Career Scope:** Site Supervisor, Junior Engineer, CAD Draftsman, Quality Control Assistant in Construction.\n" +
           "• **Higher Studies:** Direct 2nd Year B.E./B.Tech (Civil) via Lateral Entry.\n" +
           "• **Department Contact & HOD:** Prof. M. Anandan (HOD) | Email: civil@college.edu | Ph: +91 98765 43213";
  }

  if (query.includes('mech') || query.includes('mechanical')) {
    return "⚙️ **Department of Mechanical Engineering:**\n\n" +
           "• **Full Explanation:** Focuses on manufacturing processes, machine design, thermal engineering, automobile systems, fluid mechanics, CNC programming, and workshop practice.\n" +
           "• **Core Subjects:** Manufacturing Technology, Thermal Engineering, Strength of Materials, CAD/CAM.\n" +
           "• **Career Scope:** Production Supervisor, Quality Inspector, Maintenance Technician, Automobile Service Engineer.\n" +
           "• **Higher Studies:** Direct 2nd Year B.E./B.Tech (Mechanical / Mechatronics) via Lateral Entry.\n" +
           "• **Department Contact & HOD:** Dr. R. Murugan (HOD) | Email: mech@college.edu | Ph: +91 98765 43214";
  }

  if (query.includes('papertech') || query.includes('paper technology')) {
    return "📦 **Department of Paper Technology (Papertech):**\n\n" +
           "• **Full Explanation:** A specialized engineering branch covering pulp manufacturing, paper making chemistry, bleaching processes, packaging technology, and pollution control in paper mills.\n" +
           "• **Core Subjects:** Pulping Technology, Paper Manufacturing, Pollution Control, Packaging Science.\n" +
           "• **Career Scope:** Production Chemist, Mill Supervisor, Packaging Technologist, Quality Assurance Inspector in Paper & Packaging Industries.\n" +
           "• **Higher Studies:** B.Tech in Chemical Engineering / Pulp and Paper Technology via Lateral Entry.\n" +
           "• **Department Contact & HOD:** Prof. V. Senthil (HOD) | Email: papertech@college.edu | Ph: +91 98765 43215";
  }

  if (query.includes('ice') || query.includes('instrumentation')) {
    return "🎛️ **Department of Instrumentation & Control Engineering (ICE):**\n\n" +
           "• **Full Explanation:** Deals with industrial automation, electronic sensors, measurement transducers, process control loops, PLC, and SCADA systems used in modern process plants.\n" +
           "• **Core Subjects:** Transducers, Industrial Instrumentation, Process Control, PLC & Automation.\n" +
           "• **Career Scope:** Instrumentation Technician, Automation Engineer, Calibration Assistant in Refineries & Chemical Plants.\n" +
           "• **Higher Studies:** Direct 2nd Year B.E./B.Tech (ICE / EIE) via Lateral Entry.\n" +
           "• **Department Contact & HOD:** Dr. S. Lakshmi (HOD) | Email: ice@college.edu | Ph: +91 98765 43216";
  }

  if (query.includes('department') || query.includes('courses') || query.includes('branch')) {
    return "📚 **Available Polytechnic Departments:**\n" +
           "1. **CSE** (Computer Science & Engineering)\n" +
           "2. **EEE** (Electrical & Electronics Engineering)\n" +
           "3. **Civil** Engineering\n" +
           "4. **Mech** (Mechanical Engineering)\n" +
           "5. **Papertech** (Paper Technology)\n" +
           "6. **ICE** (Instrumentation & Control Engineering)\n\n" +
           "*(Type or click any department name above to get full explanation and contact details!)*";
  }

  if (query.includes('fee') || query.includes('scholarship') || query.includes('cost')) {
    return "💳 **Tuition & Scholarships:**\n• Government quota fees: Approx. ₹15,000 to ₹25,000 per year.\n• Management quota: Varies by department.\n• First-generation graduate tuition fee waivers and SC/ST/BC scholarships are fully accepted.";
  }

  if (query.includes('hostel') || query.includes('room') || query.includes('mess') || query.includes('stay')) {
    return "🏡 **Hostel & Residential Facilities:**\n• Separate secure hostels for boys and girls.\n• 24/7 Wi-Fi, reading room, indoor games, and hygienic mess facility (Veg & Non-Veg).\n• Warden Contact: hostel@college.edu | Ph: +91 98765 43219";
  }

  if (query.includes('placement') || query.includes('job') || query.includes('company') || query.includes('salary') || query.includes('package')) {
    return "💼 **Placements & Career Support:**\n• Dedicated Training & Placement Cell providing aptitude training and mock interviews.\n• Average starting package: ₹2.2 LPA to ₹3.6 LPA.\n• Placement Officer: placement@college.edu | Ph: +91 98765 43218";
  }

  if (query.includes('hi') || query.includes('hello') || query.includes('help')) {
    return "Hello! I am your **Campus AI Assistant**. How can I help you today? You can explore our departments, check admissions, or look up contact details!";
  }

  return "I'm here to assist with all polytechnic queries. You can ask about specific departments (CSE, EEE, Civil, Mech, Papertech, ICE), admissions, hostel, or placements. Contact Main Office: **admin@college.edu** | Ph: +91 98765 43200";
}

// ── AUTH MIDDLEWARE ──
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token missing' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// ── AUTH ROUTES ──
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Valid email and min 6-character password required.' });
  }

  const hashed = await bcrypt.hash(password, 10);
  db.run(`INSERT INTO users (email, password) VALUES (?, ?)`, [email, hashed], function(err) {
    if (err) return res.status(400).json({ error: 'Account already registered.' });
    const token = jwt.sign({ id: this.lastID, email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, email });
  });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (err || !user) return res.status(400).json({ error: 'Account not found.' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: 'Incorrect password.' });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, email: user.email });
  });
});

// ── CHAT LIST & SESSIONS ──
app.get('/api/chats', authenticateToken, (req, res) => {
  db.all(`SELECT * FROM chats WHERE userId = ? ORDER BY id DESC`, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/chats', authenticateToken, (req, res) => {
  const { title } = req.body;
  db.run(`INSERT INTO chats (userId, title) VALUES (?, ?)`, [req.user.id, title || 'New Polytechnic Query'], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ id: this.lastID, title: title || 'New Polytechnic Query' });
  });
});

app.delete('/api/chats/:id', authenticateToken, (req, res) => {
  db.run(`DELETE FROM chats WHERE id = ? AND userId = ?`, [req.params.id, req.user.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// ── MESSAGES ENDPOINTS ──
app.get('/api/chats/:id/messages', authenticateToken, (req, res) => {
  db.all(`SELECT * FROM messages WHERE chatId = ? ORDER BY id ASC`, [req.params.id], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/chats/:id/messages', authenticateToken, async (req, res) => {
  const chatId = req.params.id;
  const { text, time } = req.body;

  db.run(`INSERT INTO messages (chatId, role, text, time) VALUES (?, 'user', ?, ?)`, [chatId, text, time]);

  db.all(`SELECT count(*) as count FROM messages WHERE chatId = ?`, [chatId], (err, row) => {
    if (!err && row[0].count <= 1) {
      const title = text.length > 28 ? text.slice(0, 28) + '…' : text;
      db.run(`UPDATE chats SET title = ? WHERE id = ?`, [title, chatId]);
    }
  });

  const aiTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  let aiText = '';

  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-3.8-flash' });
      const prompt = `${COLLEGE_SYSTEM_PROMPT}\nUser Query: ${text}`;
      const result = await model.generateContent(prompt);
      aiText = result.response.text();
    } catch (e) {
      aiText = getCollegeOfflineAnswer(text);
    }
  } else {
    aiText = getCollegeOfflineAnswer(text);
  }

  db.run(`INSERT INTO messages (chatId, role, text, time) VALUES (?, 'ai', ?, ?)`, [chatId, aiText, aiTime], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ role: 'ai', text: aiText, time: aiTime });
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🎓 Campus AI Assistant running at http://localhost:${PORT}`));