import express, { Request, Response } from 'express';
import { createServer as createHttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createHttpServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const port = process.env.PORT || 3000;

// Middleware for body parsing (allowing up to 50MB for image data and uploads)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Initialize GoogleGenAI SDK with server-side API key
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// ==========================================
// REAL-TIME IN-MEMORY & FILE PERSISTENT DB
// ==========================================
interface HackathonContest {
  id: string;
  title: string;
  tagline: string;
  prizePool: string;
  location: string;
  track: string;
  capacity: string;
  passwords: {
    head: string;
    member: string;
    judge: string;
  };
  createdAt: string;
  status: 'LIVE' | 'UPCOMING' | 'CONCLUDED';
  organizerEmail: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'Leader' | 'Member';
}

interface TeamRecord {
  id: string;
  hackathonId: string;
  teamName: string;
  leaderName: string;
  leaderEmail: string;
  leaderPhone: string;
  totalMembers: number;
  track: string;
  notes: string;
  assignedPanel?: string;
  members: TeamMember[];
  pptStatus: 'submitted' | 'not_submitted';
  pptFile?: {
    fileName: string;
    uploadedAt: string;
    fileSize: string;
    pdfUrl?: string;
  };
  registeredAt: string;
}

export interface JudgeScore {
  id: string;
  hackathonId: string;
  teamId: string;
  teamName: string;
  judgeName: string;
  judgeEmail: string;
  technical: number;
  innovation: number;
  presentation: number;
  feasibility: number;
  totalScore: number;
  feedback: string;
  submittedAt: string;
}

interface Announcement {
  id: string;
  hackathonId: string;
  title: string;
  message: string;
  timestamp: string;
  author: string;
}

const DB_FILE = path.resolve(__dirname, 'realtime_db.json');

// Initial Seed Data
const defaultHackathons: HackathonContest[] = [
  {
    id: 'hack-voice-2026',
    title: 'Global Autonomous Voice Hackathon',
    tagline: 'Synthesizing next-gen acoustic neural models, low-latency audio pipelines, and edge-native voice intelligence.',
    prizePool: '$75,000 Prize Pool',
    location: 'San Francisco, CA & Global Stream (Moscone West)',
    track: 'Voice AI & Autonomous Systems',
    capacity: '450 In-Person',
    passwords: {
      head: 'HEAD-8841',
      member: 'TEAM-5519',
      judge: 'JUDGE-3108',
    },
    createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    status: 'LIVE',
    organizerEmail: 'jhapremkumar30nov@gmail.com',
  },
  {
    id: 'hack-agent-matrix',
    title: 'Autonomous Multi-Agent Matrix',
    tagline: 'Deploying coordinated swarms for financial settlement, robotic orchestration, and decentralized consensus.',
    prizePool: '$50,000 Prize Pool',
    location: 'Bengaluru / Hybrid Tech Hub',
    track: 'Autonomous Agents',
    capacity: '300 In-Person',
    passwords: {
      head: 'HEAD-4421',
      member: 'TEAM-7723',
      judge: 'JUDGE-9912',
    },
    createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    status: 'LIVE',
    organizerEmail: 'coordinator@mango-os.ai',
  },
];

const defaultTeams: TeamRecord[] = [
  {
    id: 'team-1',
    hackathonId: 'hack-voice-2026',
    teamName: 'Team NeuroFlow',
    leaderName: 'Aarav Sharma',
    leaderEmail: 'aarav.sharma@neuroflow.ai',
    leaderPhone: '+91 98765 43210',
    totalMembers: 4,
    track: 'Voice AI & Autonomous Systems',
    notes: 'Table #A-14 • High deliberation readiness',
    assignedPanel: 'Alpha Nexus Chamber',
    pptStatus: 'submitted',
    pptFile: {
      fileName: 'NeuroFlow_PitchDeck_Final.pdf',
      uploadedAt: 'Today, 10:15 AM',
      fileSize: '4.2 MB',
    },
    registeredAt: new Date().toISOString(),
    members: [
      { id: 'm-1', name: 'Aarav Sharma', email: 'aarav.sharma@neuroflow.ai', phone: '+91 98765 43210', role: 'Leader' },
      { id: 'm-2', name: 'Rohan Verma', email: 'rohan.v@gmail.com', phone: '+91 98111 22334', role: 'Member' },
      { id: 'm-3', name: 'Priya Patel', email: 'priya.p@gmail.com', phone: '+91 98222 33445', role: 'Member' },
      { id: 'm-4', name: 'Sneha Rao', email: 'sneha.r@gmail.com', phone: '+91 98333 44556', role: 'Member' },
    ],
  },
  {
    id: 'team-2',
    hackathonId: 'hack-voice-2026',
    teamName: 'Team Cortex Agents',
    leaderName: 'Elena Vance',
    leaderEmail: 'elena.vance@stanford.edu',
    leaderPhone: '+1 (415) 555-0199',
    totalMembers: 3,
    track: 'Autonomous Agents',
    notes: 'Table #B-04 • Leader phone missing on desk sheet',
    assignedPanel: 'Quantum Core Grid',
    pptStatus: 'not_submitted',
    registeredAt: new Date().toISOString(),
    members: [
      { id: 'm-5', name: 'Elena Vance', email: 'elena.vance@stanford.edu', phone: '', role: 'Leader' },
      { id: 'm-6', name: 'David Kim', email: '', phone: '', role: 'Member' },
      { id: 'm-7', name: 'Maya Lin', email: 'maya.lin@tech.org', phone: '+1 (415) 555-0199', role: 'Member' },
    ],
  },
  {
    id: 'team-3',
    hackathonId: 'hack-voice-2026',
    teamName: 'Team VisionCraft',
    leaderName: 'Marcus Lin',
    leaderEmail: 'marcus.lin@visioncraft.ai',
    leaderPhone: '+1 (650) 443-8890',
    totalMembers: 3,
    track: 'Vision AI',
    notes: 'Table #C-08 • Verified entrant',
    assignedPanel: 'Hyperion Matrix Room',
    pptStatus: 'submitted',
    pptFile: {
      fileName: 'VisionCraft_Deck.pdf',
      uploadedAt: 'Today, 11:40 AM',
      fileSize: '6.8 MB',
    },
    registeredAt: new Date().toISOString(),
    members: [
      { id: 'm-8', name: 'Marcus Lin', email: 'marcus.lin@visioncraft.ai', phone: '+1 (650) 443-8890', role: 'Leader' },
      { id: 'm-9', name: 'Aisha Siddiqui', email: 'aisha.s@gmail.com', phone: '+91 97123 45678', role: 'Member' },
      { id: 'm-10', name: 'Kevin Zhao', email: 'kevin.z@mit.edu', phone: '', role: 'Member' },
    ],
  },
  {
    id: 'team-4',
    hackathonId: 'hack-voice-2026',
    teamName: 'Team Synthetix',
    leaderName: 'Sophia Chen',
    leaderEmail: 'sophia@synthetix.io',
    leaderPhone: '+1 (415) 772-9901',
    totalMembers: 4,
    track: 'Infra & Latency',
    notes: 'Table #C-12 • Sub-20ms engine',
    assignedPanel: 'Alpha Nexus Chamber',
    pptStatus: 'not_submitted',
    registeredAt: new Date().toISOString(),
    members: [
      { id: 'm-11', name: 'Sophia Chen', email: 'sophia@synthetix.io', phone: '+1 (415) 772-9901', role: 'Leader' },
      { id: 'm-12', name: 'Liam O\'Connor', email: 'liam@synthetix.io', phone: '+1 (415) 772-9902', role: 'Member' },
      { id: 'm-13', name: 'Pooja Iyer', email: 'pooja.i@gmail.com', phone: '+91 98450 11223', role: 'Member' },
      { id: 'm-14', name: 'Tariq Al-Mansoor', email: '', phone: '', role: 'Member' },
    ],
  },
];

const defaultScores: JudgeScore[] = [
  {
    id: 'score-1',
    hackathonId: 'hack-voice-2026',
    teamId: 'team-1',
    teamName: 'Team NeuroFlow',
    judgeName: 'Dr. Elena Vance (Lead Judge)',
    judgeEmail: 'elena.vance@stanford.edu',
    technical: 9.6,
    innovation: 9.4,
    presentation: 9.1,
    feasibility: 9.3,
    totalScore: 9.35,
    feedback: 'Exceptional sub-40ms acoustic model inference on edge hardware. Great presentation deck and live demo execution.',
    submittedAt: 'Just Now',
  },
  {
    id: 'score-2',
    hackathonId: 'hack-voice-2026',
    teamId: 'team-3',
    teamName: 'Team VisionCraft',
    judgeName: 'Alex Mercer',
    judgeEmail: 'alex.mercer@mit.edu',
    technical: 9.2,
    innovation: 9.5,
    presentation: 8.8,
    feasibility: 8.9,
    totalScore: 9.1,
    feedback: 'Innovative neural segmentation approach with real-time video streaming pipeline.',
    submittedAt: '12m ago',
  },
];

const defaultAnnouncements: Announcement[] = [
  {
    id: 'ann-1',
    hackathonId: 'hack-voice-2026',
    title: 'Live Evaluation Deliberation Active',
    message: 'Judges are actively scoring pitches across all panels. Scores stream in real-time to team consoles.',
    timestamp: '10:00 AM',
    author: 'Head Coordinator',
  },
];

// Persistent Store State
let db = {
  hackathons: defaultHackathons,
  teams: defaultTeams,
  scores: defaultScores,
  announcements: defaultAnnouncements,
};

// Load saved data if file exists
function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (parsed.hackathons && Array.isArray(parsed.hackathons)) {
        db.hackathons = parsed.hackathons;
      }
      if (parsed.teams && Array.isArray(parsed.teams)) {
        db.teams = parsed.teams;
      }
      if (parsed.scores && Array.isArray(parsed.scores)) {
        db.scores = parsed.scores;
      }
      if (parsed.announcements && Array.isArray(parsed.announcements)) {
        db.announcements = parsed.announcements;
      }
      console.log(`[Database] Loaded ${db.hackathons.length} hackathons, ${db.teams.length} teams, ${db.scores.length} scores from file.`);
    }
  } catch (err) {
    console.warn('[Database] Error loading database file:', err);
  }
}

function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Database] Error persisting database file:', err);
  }
}

loadDatabase();

// ==========================================
// SOCKET.IO REAL-TIME EVENT ENGINE
// ==========================================
io.on('connection', (socket) => {
  console.log(`[WebSocket] Client connected: ${socket.id}`);

  // Send current authoritative state immediately on connection
  socket.emit('init_state', {
    hackathons: db.hackathons,
    teams: db.teams,
    scores: db.scores,
    announcements: db.announcements,
  });

  // Client joining room for specific hackathon
  socket.on('join_hackathon_room', (hackathonId: string) => {
    socket.join(`hackathon:${hackathonId}`);
    console.log(`[WebSocket] ${socket.id} joined hackathon:${hackathonId}`);
  });

  // Real-time score submission via socket
  socket.on('submit_judge_score', (scoreData: Omit<JudgeScore, 'id' | 'submittedAt'>) => {
    const totalScore = Number(
      ((scoreData.technical + scoreData.innovation + scoreData.presentation + scoreData.feasibility) / 4).toFixed(2)
    );

    const newScore: JudgeScore = {
      ...scoreData,
      id: `score-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      totalScore,
      submittedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Remove old score for same judge and team if updating
    db.scores = db.scores.filter(
      (s) => !(s.teamId === newScore.teamId && s.judgeEmail === newScore.judgeEmail)
    );
    db.scores.unshift(newScore);
    saveDatabase();

    // Broadcast to EVERY connected client in real-time
    io.emit('score_updated', {
      score: newScore,
      allScores: db.scores,
      teamId: newScore.teamId,
      hackathonId: newScore.hackathonId,
    });

    console.log(`[WebSocket] Broadcasted new judge score for team ${newScore.teamName}: ${newScore.totalScore}/10`);
  });

  // Real-time team joining via socket
  socket.on('team_joined', (teamData: TeamRecord) => {
    const existingIdx = db.teams.findIndex((t) => t.id === teamData.id || t.teamName.toLowerCase() === teamData.teamName.toLowerCase());
    if (existingIdx >= 0) {
      db.teams[existingIdx] = teamData;
    } else {
      db.teams.unshift(teamData);
    }
    saveDatabase();

    io.emit('teams_updated', {
      teams: db.teams,
      newTeam: teamData,
      hackathonId: teamData.hackathonId,
    });
  });

  // Real-time contest creation via socket
  socket.on('hackathon_created', (hackathon: HackathonContest) => {
    const existingIdx = db.hackathons.findIndex((h) => h.id === hackathon.id);
    if (existingIdx >= 0) {
      db.hackathons[existingIdx] = hackathon;
    } else {
      db.hackathons.unshift(hackathon);
    }
    saveDatabase();

    io.emit('hackathons_updated', {
      hackathons: db.hackathons,
      newHackathon: hackathon,
    });
  });

  socket.on('disconnect', () => {
    console.log(`[WebSocket] Client disconnected: ${socket.id}`);
  });
});

// ==========================================
// REST API ENDPOINTS
// ==========================================

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    connectedClients: io.engine.clientsCount,
    hackathonsCount: db.hackathons.length,
    teamsCount: db.teams.length,
    scoresCount: db.scores.length,
    timestamp: new Date().toISOString(),
  });
});

// Full state endpoint for initial load & refresh
app.get('/api/realtime-state', (req: Request, res: Response) => {
  res.json({
    success: true,
    hackathons: db.hackathons,
    teams: db.teams,
    scores: db.scores,
    announcements: db.announcements,
  });
});

// Public Hackathons endpoint
app.get('/api/hackathons', (req: Request, res: Response) => {
  res.json({
    success: true,
    hackathons: db.hackathons,
  });
});

// Create Hackathon endpoint (Coordinator)
app.post('/api/hackathons', (req: Request, res: Response) => {
  try {
    const { title, tagline, prizePool, location, track, capacity, passwords, organizerEmail } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, error: 'Hackathon title is required' });
    }

    const randHead = passwords?.head || 'HEAD-' + Math.floor(1000 + Math.random() * 9000);
    const randTeam = passwords?.member || 'TEAM-' + Math.floor(1000 + Math.random() * 9000);
    const randJudge = passwords?.judge || 'JUDGE-' + Math.floor(1000 + Math.random() * 9000);

    const newHackathon: HackathonContest = {
      id: 'hack-' + Date.now(),
      title: title.trim(),
      tagline: tagline?.trim() || 'Next-generation collaborative intelligence contest.',
      prizePool: prizePool?.trim() || '$50,000 Prize Pool',
      location: location?.trim() || 'Global Virtual & Campus Stage',
      track: track?.trim() || 'AI & Full Stack Innovation',
      capacity: capacity?.trim() || '500 Participants',
      passwords: {
        head: randHead,
        member: randTeam,
        judge: randJudge,
      },
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      status: 'LIVE',
      organizerEmail: organizerEmail || 'coordinator@mango-os.ai',
    };

    db.hackathons.unshift(newHackathon);
    saveDatabase();

    // Broadcast in real-time via Socket.IO
    io.emit('hackathons_updated', {
      hackathons: db.hackathons,
      newHackathon,
    });

    console.log(`[API] Created hackathon "${newHackathon.title}" and broadcasted via WebSockets.`);

    return res.status(201).json({
      success: true,
      hackathon: newHackathon,
    });
  } catch (err: any) {
    console.error('Create hackathon error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Teams endpoint
app.get('/api/teams', (req: Request, res: Response) => {
  const { hackathonId } = req.query;
  const filtered = hackathonId ? db.teams.filter((t) => t.hackathonId === hackathonId) : db.teams;
  res.json({
    success: true,
    teams: filtered,
  });
});

// Team Registration / Join endpoint (Students/Teams)
app.post('/api/teams/join', (req: Request, res: Response) => {
  try {
    const { hackathonId, teamName, leaderName, leaderEmail, leaderPhone, track, totalMembers, members, notes, accessCode } = req.body;

    if (!teamName || !leaderName) {
      return res.status(400).json({ success: false, error: 'Team name and leader name are required' });
    }

    // Verify hackathon existence
    const targetHackathon = db.hackathons.find((h) => h.id === hackathonId) || db.hackathons[0];

    // Check access code if required
    if (accessCode && targetHackathon.passwords.member && accessCode !== targetHackathon.passwords.member) {
      return res.status(403).json({ success: false, error: 'Invalid Team Access Key for this contest.' });
    }

    const teamMembers: TeamMember[] = Array.isArray(members) && members.length > 0
      ? members
      : [
          {
            id: `mem-${Date.now()}-lead`,
            name: leaderName,
            email: leaderEmail || '',
            phone: leaderPhone || '',
            role: 'Leader',
          },
        ];

    const newTeam: TeamRecord = {
      id: `team-${Date.now()}`,
      hackathonId: targetHackathon.id,
      teamName: teamName.trim(),
      leaderName: leaderName.trim(),
      leaderEmail: leaderEmail?.trim() || '',
      leaderPhone: leaderPhone?.trim() || '',
      totalMembers: totalMembers || teamMembers.length || 4,
      track: track || targetHackathon.track,
      notes: notes || 'Registered via Public Portal',
      pptStatus: 'not_submitted',
      registeredAt: new Date().toISOString(),
      members: teamMembers,
    };

    db.teams.unshift(newTeam);
    saveDatabase();

    // Broadcast to everyone via WebSockets
    io.emit('teams_updated', {
      teams: db.teams,
      newTeam,
      hackathonId: newTeam.hackathonId,
    });

    console.log(`[API] Team "${newTeam.teamName}" joined hackathon "${targetHackathon.title}" in real-time.`);

    return res.status(201).json({
      success: true,
      team: newTeam,
      hackathon: targetHackathon,
    });
  } catch (err: any) {
    console.error('Team join error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Judge Score Submission endpoint
app.post('/api/scores', (req: Request, res: Response) => {
  try {
    const { hackathonId, teamId, judgeName, judgeEmail, technical, innovation, presentation, feasibility, feedback } = req.body;

    if (!teamId || !judgeName) {
      return res.status(400).json({ success: false, error: 'Team ID and judge name are required' });
    }

    const targetTeam = db.teams.find((t) => t.id === teamId);
    const teamName = targetTeam ? targetTeam.teamName : 'Assigned Team';

    const t = Number(technical) || 0;
    const inn = Number(innovation) || 0;
    const p = Number(presentation) || 0;
    const f = Number(feasibility) || 0;
    const totalScore = Number(((t + inn + p + f) / 4).toFixed(2));

    const newScore: JudgeScore = {
      id: `score-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      hackathonId: hackathonId || db.hackathons[0]?.id || 'hack-voice-2026',
      teamId,
      teamName,
      judgeName: judgeName.trim(),
      judgeEmail: judgeEmail?.trim() || 'judge@mango-os.ai',
      technical: t,
      innovation: inn,
      presentation: p,
      feasibility: f,
      totalScore,
      feedback: feedback?.trim() || 'No qualitative feedback provided.',
      submittedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    // Replace if same judge scored this team already
    db.scores = db.scores.filter(
      (s) => !(s.teamId === newScore.teamId && s.judgeEmail === newScore.judgeEmail)
    );
    db.scores.unshift(newScore);
    saveDatabase();

    // Broadcast to ALL via Socket.IO so teams and coordinators see scores instantly!
    io.emit('score_updated', {
      score: newScore,
      allScores: db.scores,
      teamId: newScore.teamId,
      hackathonId: newScore.hackathonId,
    });

    console.log(`[API] Score recorded for ${teamName}: ${totalScore}/10 by ${judgeName}. Broadcasted to WebSockets.`);

    return res.status(201).json({
      success: true,
      score: newScore,
      allScores: db.scores,
    });
  } catch (err: any) {
    console.error('Submit score error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Update PPT Submission for a team
app.post('/api/teams/ppt', (req: Request, res: Response) => {
  try {
    const { teamId, fileName, fileSize, pdfUrl } = req.body;
    const team = db.teams.find((t) => t.id === teamId);
    if (!team) {
      return res.status(404).json({ success: false, error: 'Team not found' });
    }

    team.pptStatus = 'submitted';
    team.pptFile = {
      fileName: fileName || 'PitchDeck.pdf',
      uploadedAt: 'Uploaded Just Now',
      fileSize: fileSize || '3.5 MB',
      pdfUrl: pdfUrl || '',
    };
    saveDatabase();

    io.emit('teams_updated', {
      teams: db.teams,
      updatedTeam: team,
      hackathonId: team.hackathonId,
    });

    return res.json({ success: true, team });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Authentication endpoint for Coordinator, Judge, and Team
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { role, email, password, hackathonId, accessCode } = req.body;

  // Find target hackathon
  const hackathon = db.hackathons.find((h) => h.id === hackathonId) || db.hackathons[0];

  if (role === 'coordinator') {
    // Check if coordinator password matches or default demo
    const valid = !password || password === hackathon.passwords.head || password === 'demo-mango-2026' || password.startsWith('HEAD-');
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid Coordinator Access Key.' });
    }
    return res.json({
      success: true,
      user: {
        role: 'coordinator',
        email: email || 'jhapremkumar30nov@gmail.com',
        name: 'Head Coordinator',
        hackathonId: hackathon.id,
      },
    });
  }

  if (role === 'judge') {
    const valid = !accessCode || accessCode === hackathon.passwords.judge || accessCode === 'demo-judge' || accessCode.startsWith('JUDGE-');
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid Judge Deliberation Access Key.' });
    }
    return res.json({
      success: true,
      user: {
        role: 'judge',
        email: email || 'judge.evaluator@mango-os.ai',
        name: 'Deliberation Judge',
        hackathonId: hackathon.id,
      },
    });
  }

  if (role === 'student' || role === 'team') {
    const valid = !accessCode || accessCode === hackathon.passwords.member || accessCode === 'demo-team' || accessCode.startsWith('TEAM-');
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid Team Participant Access Key.' });
    }
    return res.json({
      success: true,
      user: {
        role: 'team',
        email: email || 'student.lead@hackathon.edu',
        name: 'Team Entrant',
        hackathonId: hackathon.id,
      },
    });
  }

  return res.status(400).json({ success: false, error: 'Unknown role specified' });
});

// Endpoint: AI Vision parsing of hackathon teams registration sheet / image
app.post('/api/gemini/parse-teams-image', async (req: Request, res: Response) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', userPrompt } = req.body;

    if (!imageBase64) {
      return res.status(400).json({
        success: false,
        error: 'Missing imageBase64 in request body',
      });
    }

    // Strip data URL header if included
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

    // Detect MIME type from base64 header if present
    let detectedMime = mimeType || 'image/jpeg';
    const headerMatch = imageBase64.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,/);
    if (headerMatch && headerMatch[1]) {
      detectedMime = headerMatch[1];
    }

    const systemInstruction = `You are an expert AI vision assistant specialized in analyzing offline hackathon team registration sheets, photos of attendee rosters, badge lists, spreadsheet screenshots, whiteboard team lists, sign-in sheets, and check-in desk documents.
Your goal is to visually inspect and comprehend all teams and participants shown in the image.
Do NOT fabricate or hallucinate dummy data. Extract only what is actually depicted or written in the image.
Understand the layout: identify team names, leader names, member names, emails, mobile/phone numbers, table numbers, tracks, and notes.
Do NOT just perform simple raw OCR. Understand the semantic groupings of teams and their members.
If information like phone number or email is missing or unreadable in the image for a team or member, leave those fields as empty string "" so the hackathon coordinator can easily fill them in manually.
If only team names and leader names are visible, output each team with totalMembers estimated from the roster.
If the image does NOT contain any hackathon teams or participant roster (e.g. random image or blank image), return an empty teams array [] and explain what the image actually depicts in analysisSummary.`;

    const promptText = userPrompt || `Carefully analyze this hackathon team document / image.
Examine all text, handwriting, columns, and rows.
Extract every team present in the image:
- teamName: Name of the team
- leaderName: Name of the team leader (or empty string if not indicated)
- leaderEmail: Email of leader (or empty string if not indicated)
- leaderPhone: Phone/mobile of leader (or empty string if not indicated)
- totalMembers: Total count of members in the team including leader
- track: Hackathon track or theme if detected (or empty string)
- notes: Any table number, college, project topic, or extra details found (or empty string)
- members: Array of members with name, email, phone, role ('Leader' or 'Member')
Also provide a concise analysisSummary explaining exactly what was found in the image and which teams were extracted.`;

    const imagePart = {
      inlineData: {
        mimeType: detectedMime,
        data: cleanBase64,
      },
    };

    const textPart = {
      text: promptText,
    };

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        analysisSummary: {
          type: Type.STRING,
          description: 'Human-friendly summary of what was detected from the image, what kind of document it was, and which fields were found or need manual entry',
        },
        teams: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              teamName: {
                type: Type.STRING,
                description: 'Name of the team',
              },
              leaderName: {
                type: Type.STRING,
                description: 'Name of the team leader (or empty if unknown)',
              },
              leaderEmail: {
                type: Type.STRING,
                description: 'Leader email address if visible',
              },
              leaderPhone: {
                type: Type.STRING,
                description: 'Leader mobile/phone number if visible',
              },
              totalMembers: {
                type: Type.INTEGER,
                description: 'Total number of members in this team (including leader)',
              },
              track: {
                type: Type.STRING,
                description: 'Hackathon track or theme if detected (e.g. AI, Web3, FinTech, Open)',
              },
              notes: {
                type: Type.STRING,
                description: 'Any table number, college, project topic, or extra details found',
              },
              members: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    email: { type: Type.STRING },
                    phone: { type: Type.STRING },
                    role: { type: Type.STRING, description: 'Leader or Member' },
                  },
                  required: ['name'],
                },
              },
            },
            required: ['teamName'],
          },
        },
      },
      required: ['analysisSummary', 'teams'],
    };

    // Resilient fallback order for active Gemini models
    const modelsToTry = [
      'gemini-3-flash-preview',
      'gemini-3.5-flash',
      'gemini-flash-latest',
      'gemini-3.8-flash',
    ];

    let lastError: any = null;
    let responseText: string | undefined;
    let successfulModel = '';

    for (const modelName of modelsToTry) {
      try {
        console.log(`[Gemini Vision] Trying model: ${modelName}...`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [imagePart, textPart],
          },
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema,
          },
        });

        if (response.text) {
          responseText = response.text;
          successfulModel = modelName;
          console.log(`[Gemini Vision] Success with model: ${modelName}`);
          break;
        }
      } catch (err: any) {
        console.warn(`[Gemini Vision] Model ${modelName} failed:`, err?.status || err?.message || err);
        lastError = err;
      }
    }

    if (!responseText) {
      throw lastError || new Error('All Gemini Vision models failed to generate response');
    }

    const parsedData = JSON.parse(responseText);

    return res.json({
      success: true,
      modelUsed: successfulModel,
      analysisSummary: parsedData.analysisSummary,
      teams: parsedData.teams || [],
    });
  } catch (error: any) {
    console.error('Gemini Vision Parse Error:', error);
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to analyze team image with Gemini Vision',
    });
  }
});

// Vite middleware in development or static serve in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  httpServer.listen(Number(port), '0.0.0.0', () => {
    console.log(`[Server] Real-time HTTP & WebSocket Server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
