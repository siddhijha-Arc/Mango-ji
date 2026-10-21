import React, { useState, useEffect } from 'react';
import TeamsHub, { HackathonTeam } from './TeamsHub';
import { socket } from './socket';
import JudgeScoringPortal, { JudgeScore } from './JudgeScoringPortal';
import TeamScorecard from './TeamScorecard';
import {
  auth,
  db,
  signInWithGoogle,
  logOutFirebase,
  saveHackathonToFirestore,
  saveTeamToFirestore,
  handleFirestoreError,
  OperationType,
} from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';

export default function App() {
  const [currentView, setCurrentView] = useState<'landing' | 'login' | 'explore' | 'register' | 'create-hackathon' | 'tracks-rubrics' | 'reviewers' | 'schedule' | 'dashboard' | 'judge-scoring' | 'team-scorecard'>('landing');
  const [dashboardTab, setDashboardTab] = useState<'overview' | 'teams' | 'judges' | 'manage'>('overview');
  const [activeRole, setActiveRole] = useState<'coordinators' | 'judges' | 'trackleads' | 'mentors' | 'hardware' | 'volunteers'>('coordinators');
  const [selectedPortalRole, setSelectedPortalRole] = useState<'coord' | 'judge'>('coord');
  const [selectedBlueprint, setSelectedBlueprint] = useState('Autonomous Agents');
  const [isRecording, setIsRecording] = useState(false);
  const [voiceText, setVoiceText] = useState('Assign Judge Elena to Track 02 — Edge AI rubric. Mark technical feasibility at 9.4 and dispatch automated feedback to team.');
  const [commitSuccess, setCommitSuccess] = useState(false);
  const [email, setEmail] = useState('jhapremkumar30nov@gmail.com');
  const [password, setPassword] = useState('demo-mango-2026');
  const [loginRole, setLoginRole] = useState<'coordinator' | 'judge' | 'student'>('coordinator');
  const [expandedJudgePanels, setExpandedJudgePanels] = useState<Record<string, boolean>>({});

  // Firebase Authentication State
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Real-time WebSocket connection status & live score alert banner
  const [wsConnected, setWsConnected] = useState(false);
  const [liveScoreAlert, setLiveScoreAlert] = useState<{ message: string; score: JudgeScore } | null>(null);

  // Active contest and active team scorecard tracking
  const [activeScoringHackathonId, setActiveScoringHackathonId] = useState<string>('hack-live-01');
  const [activeTeamScorecardId, setActiveTeamScorecardId] = useState<string>('team-1');

  // Real-time Scores Store
  const [scores, setScores] = useState<JudgeScore[]>(() => {
    try {
      const saved = localStorage.getItem('mango_judge_scores');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [
      {
        id: 'score-1',
        hackathonId: 'hack-live-01',
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
        submittedAt: 'Today, 10:15 AM',
      },
      {
        id: 'score-2',
        hackathonId: 'hack-live-01',
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
        submittedAt: 'Today, 11:42 AM',
      },
    ];
  });

  // Teams Roster State (managed in Teams tab, accessible across dashboard)
  const [teams, setTeams] = useState<HackathonTeam[]>(() => {
    try {
      const saved = localStorage.getItem('mango_hackathon_teams');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [
      {
        id: 'team-1',
        teamName: 'Team NeuroFlow',
        leaderName: 'Aarav Sharma',
        leaderEmail: 'aarav.sharma@neuroflow.ai',
        leaderPhone: '+91 98765 43210',
        totalMembers: 4,
        track: 'Voice AI & Autonomous Systems',
        notes: 'Table #A-14 • High deliberation readiness',
        pptStatus: 'submitted',
        pptFile: {
          fileName: 'NeuroFlow_PitchDeck_Final.pdf',
          uploadedAt: 'Today, 10:15 AM',
          fileSize: '4.2 MB',
        },
        members: [
          { id: 'm-1', name: 'Aarav Sharma', email: 'aarav.sharma@neuroflow.ai', phone: '+91 98765 43210', role: 'Leader' },
          { id: 'm-2', name: 'Rohan Verma', email: 'rohan.v@gmail.com', phone: '+91 98111 22334', role: 'Member' },
          { id: 'm-3', name: 'Priya Patel', email: 'priya.p@gmail.com', phone: '+91 98222 33445', role: 'Member' },
          { id: 'm-4', name: 'Sneha Rao', email: 'sneha.r@gmail.com', phone: '+91 98333 44556', role: 'Member' },
        ],
      },
      {
        id: 'team-2',
        teamName: 'Team Cortex Agents',
        leaderName: 'Elena Vance',
        leaderEmail: 'elena.vance@stanford.edu',
        leaderPhone: '',
        totalMembers: 3,
        track: 'Autonomous Agents',
        notes: 'Table #B-04 • Leader phone missing on desk sheet',
        pptStatus: 'not_submitted',
        members: [
          { id: 'm-5', name: 'Elena Vance', email: 'elena.vance@stanford.edu', phone: '', role: 'Leader' },
          { id: 'm-6', name: 'David Kim', email: '', phone: '', role: 'Member' },
          { id: 'm-7', name: 'Maya Lin', email: 'maya.lin@tech.org', phone: '+1 (415) 555-0199', role: 'Member' },
        ],
      },
      {
        id: 'team-3',
        teamName: 'Team VisionCraft',
        leaderName: 'Marcus Lin',
        leaderEmail: 'marcus.lin@visioncraft.ai',
        leaderPhone: '+1 (650) 443-8890',
        totalMembers: 3,
        track: 'Vision AI',
        notes: 'Table #C-08 • Verified entrant',
        pptStatus: 'submitted',
        pptFile: {
          fileName: 'VisionCraft_Deck.pdf',
          uploadedAt: 'Today, 11:40 AM',
          fileSize: '6.8 MB',
        },
        members: [
          { id: 'm-8', name: 'Marcus Lin', email: 'marcus.lin@visioncraft.ai', phone: '+1 (650) 443-8890', role: 'Leader' },
          { id: 'm-9', name: 'Aisha Siddiqui', email: 'aisha.s@gmail.com', phone: '+91 97123 45678', role: 'Member' },
          { id: 'm-10', name: 'Kevin Zhao', email: 'kevin.z@mit.edu', phone: '', role: 'Member' },
        ],
      },
      {
        id: 'team-4',
        teamName: 'Team Synthetix',
        leaderName: 'Sophia Chen',
        leaderEmail: 'sophia@synthetix.io',
        leaderPhone: '+1 (415) 772-9901',
        totalMembers: 4,
        track: 'Infra & Latency',
        notes: 'Table #C-12 • Sub-20ms engine',
        pptStatus: 'not_submitted',
        members: [
          { id: 'm-11', name: 'Sophia Chen', email: 'sophia@synthetix.io', phone: '+1 (415) 772-9901', role: 'Leader' },
          { id: 'm-12', name: 'Liam O\'Connor', email: 'liam@synthetix.io', phone: '+1 (415) 772-9902', role: 'Member' },
          { id: 'm-13', name: 'Pooja Iyer', email: 'pooja.i@gmail.com', phone: '+91 98450 11223', role: 'Member' },
          { id: 'm-14', name: 'Tariq Al-Mansoor', email: '', phone: '', role: 'Member' },
        ],
      },
    ];
  });

  const handleUpdateTeams = (updatedTeams: HackathonTeam[]) => {
    setTeams(updatedTeams);
    try {
      localStorage.setItem('mango_hackathon_teams', JSON.stringify(updatedTeams));
    } catch (e) {}
  };

  // Create Hackathon form state (accessible to launch and cards)
  const [createRole, setCreateRole] = useState<'head' | 'core'>('head');
  const [eventTitle, setEventTitle] = useState('Global Autonomous Voice Hackathon');
  const [eventTagline, setEventTagline] = useState('Synthesizing next-gen acoustic neural models, low-latency audio pipelines, and edge-native voice intelligence.');
  const [eventLocation, setEventLocation] = useState('San Francisco, CA & Global Stream (Moscone West)');
  const [eventCapacity, setEventCapacity] = useState('450 In-Person');

  // Launch credentials & Hackathon Created state
  const [isHackathonCreated, setIsHackathonCreated] = useState(true);
  const [passwords, setPasswords] = useState({
    head: 'HEAD-8841',
    member: 'TEAM-5519',
    judge: 'JUDGE-3108'
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Persistent list of Created Hackathon Cards
  const [createdHackathons, setCreatedHackathons] = useState<Array<{
    id: string;
    title: string;
    tagline: string;
    prizePool: string;
    passwords: { head: string; member: string; judge: string };
    createdAt: string;
    track: string;
  }>>(() => {
    try {
      const saved = localStorage.getItem('mango_created_hackathons');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [
      {
        id: 'hack-live-01',
        title: 'Global Autonomous Voice Hackathon',
        tagline: 'Synthesizing next-gen acoustic neural models, low-latency audio pipelines, and edge-native voice intelligence. Real-time voice rubric consensus active.',
        prizePool: '$75,000 Prize Pool',
        passwords: {
          head: 'HEAD-8841',
          member: 'TEAM-5519',
          judge: 'JUDGE-3108'
        },
        createdAt: 'LIVE • Deployed',
        track: 'Voice AI & Autonomous Systems'
      }
    ];
  });

  // Join Hackathon modal state (on home/explore screen)
  // Real-time synchronization via WebSocket & Firebase Firestore
  useEffect(() => {
    // 1. Firebase Authentication Listener
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setIsAuthLoading(false);
      if (user?.email) {
        setEmail(user.email);
      }
    });

    // 2. Fetch initial local server state as base
    fetch('/api/realtime-state')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          if (Array.isArray(data.hackathons) && data.hackathons.length > 0) {
            setCreatedHackathons(data.hackathons);
          }
          if (Array.isArray(data.teams) && data.teams.length > 0) {
            setTeams(data.teams);
          }
          if (Array.isArray(data.scores) && data.scores.length > 0) {
            setScores(data.scores);
          }
        }
      })
      .catch((e) => console.warn('Realtime state fetch error:', e));

    // 3. Real-time Firebase Firestore Listeners
    const unsubFirestoreHackathons = onSnapshot(
      collection(db, 'hackathons'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: any[] = [];
          snapshot.forEach((docSnap) => list.push(docSnap.data()));
          if (list.length > 0) {
            setCreatedHackathons((prev) => {
              const ids = new Set(list.map((l) => l.id));
              return [...list, ...prev.filter((p) => !ids.has(p.id))];
            });
          }
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'hackathons')
    );

    const unsubFirestoreTeams = onSnapshot(
      collection(db, 'teams'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: any[] = [];
          snapshot.forEach((docSnap) => list.push(docSnap.data()));
          if (list.length > 0) {
            setTeams((prev) => {
              const ids = new Set(list.map((l) => l.id));
              return [...list, ...prev.filter((p) => !ids.has(p.id))];
            });
          }
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'teams')
    );

    const unsubFirestoreScores = onSnapshot(
      collection(db, 'scores'),
      (snapshot) => {
        if (!snapshot.empty) {
          const list: any[] = [];
          snapshot.forEach((docSnap) => list.push(docSnap.data()));
          if (list.length > 0) {
            setScores((prev) => {
              const ids = new Set(list.map((l) => l.id));
              return [...list, ...prev.filter((p) => !ids.has(p.id))];
            });
          }
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'scores')
    );

    // 4. WebSocket Event Handlers
    const onConnect = () => setWsConnected(true);
    const onDisconnect = () => setWsConnected(false);

    const onHackathonsUpdated = (payload: any) => {
      if (payload.hackathons && Array.isArray(payload.hackathons)) {
        setCreatedHackathons(payload.hackathons);
      }
    };

    const onTeamsUpdated = (payload: any) => {
      if (payload.teams && Array.isArray(payload.teams)) {
        setTeams(payload.teams);
      }
    };

    const onScoreUpdated = (payload: any) => {
      if (payload.allScores && Array.isArray(payload.allScores)) {
        setScores(payload.allScores);
      } else if (payload.score) {
        setScores((prev) => [payload.score, ...prev.filter((s) => s.id !== payload.score.id)]);
      }
      if (payload.score) {
        setLiveScoreAlert({
          message: `📢 Live Score: Judge ${payload.score.judgeName} awarded ${payload.score.totalScore}/100 to ${payload.score.teamName}!`,
          score: payload.score,
        });
        setTimeout(() => setLiveScoreAlert(null), 6000);
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('hackathons_updated', onHackathonsUpdated);
    socket.on('teams_updated', onTeamsUpdated);
    socket.on('score_updated', onScoreUpdated);

    if (socket.connected) setWsConnected(true);

    return () => {
      unsubAuth();
      unsubFirestoreHackathons();
      unsubFirestoreTeams();
      unsubFirestoreScores();
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('hackathons_updated', onHackathonsUpdated);
      socket.off('teams_updated', onTeamsUpdated);
      socket.off('score_updated', onScoreUpdated);
    };
  }, []);

  // Join Hackathon modal state (on home/explore screen)
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinStep, setJoinStep] = useState<'role-select' | 'coord-password' | 'judge-password' | 'team-join'>('role-select');
  const [enteredCoordPassword, setEnteredCoordPassword] = useState('');
  const [coordPasswordError, setCoordPasswordError] = useState('');
  const [enteredJudgePassword, setEnteredJudgePassword] = useState('');
  const [judgePasswordError, setJudgePasswordError] = useState('');

  // Team Registration Form State
  const [teamFormName, setTeamFormName] = useState('Team CyberAcoustics');
  const [teamFormLeader, setTeamFormLeader] = useState('Aakash Patel');
  const [teamFormEmail, setTeamFormEmail] = useState('aakash.patel@acoustics.ai');
  const [teamFormPhone, setTeamFormPhone] = useState('+91 99887 76655');
  const [teamFormTrack, setTeamFormTrack] = useState('Voice AI & Autonomous Systems');
  const [teamFormMembersCount, setTeamFormMembersCount] = useState(4);
  const [teamFormNotes, setTeamFormNotes] = useState('Table #D-05 • Audio neural speech demo ready');
  const [teamFormCode, setTeamFormCode] = useState('');
  const [teamFormError, setTeamFormError] = useState('');

  // Schedule view state
  const [autoLockRepos, setAutoLockRepos] = useState(true);
  const [openWebRtcRooms, setOpenWebRtcRooms] = useState(true);
  const [portalVisibility, setPortalVisibility] = useState<'public' | 'private'>('public');
  const [isDeploying, setIsDeploying] = useState(false);
  const [isDeployed, setIsDeployed] = useState(false);

  const handleLaunchHackathon = () => {
    setIsDeploying(true);
    setTimeout(() => {
      setIsDeploying(false);
      setIsDeployed(true);
      setIsHackathonCreated(true);
      const randHead = 'HEAD-' + Math.floor(1000 + Math.random() * 9000);
      const randTeam = 'TEAM-' + Math.floor(1000 + Math.random() * 9000);
      const randJudge = 'JUDGE-' + Math.floor(1000 + Math.random() * 9000);
      const newPasswords = {
        head: randHead,
        member: randTeam,
        judge: randJudge
      };
      setPasswords(newPasswords);

      const newHack = {
        id: 'hack-' + Date.now(),
        title: eventTitle.trim() || 'Global Autonomous Voice Hackathon',
        tagline: eventTagline.trim() || 'Synthesizing next-gen acoustic neural models, low-latency audio pipelines, and edge-native voice intelligence.',
        prizePool: '$75,000 Prize Pool',
        location: eventLocation.trim() || 'San Francisco, CA & Global Stream (Moscone West)',
        passwords: newPasswords,
        createdAt: 'LIVE • Deployed',
        status: 'LIVE' as const,
        track: 'Autonomous Agents & Live Deliberation',
        organizerEmail: email || 'coordinator@mango-os.ai'
      };

      // 1. Post to backend persistent database
      fetch('/api/hackathons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newHack),
      }).catch((err) => console.warn('POST /api/hackathons err', err));

      // 2. Persist to real Firebase Firestore database
      saveHackathonToFirestore(newHack);

      // 3. Broadcast immediately over WebSockets
      socket.emit('hackathon_created', newHack);

      setCreatedHackathons(prev => {
        const updated = [newHack, ...prev.filter(h => h.id !== newHack.id)];
        try {
          localStorage.setItem('mango_created_hackathons', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });

      setShowPasswordModal(true);
    }, 1200);
  };

  const handleCopyKey = (type: 'head' | 'member' | 'judge', keyVal: string) => {
    navigator.clipboard?.writeText(keyVal);
    setCopiedKey(type);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleJoinCoordinator = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enteredCoordPassword.trim()) {
      setCoordPasswordError('Please enter the Coordinator password');
      return;
    }
    if (enteredCoordPassword.trim().toUpperCase() === passwords.head.toUpperCase() || enteredCoordPassword.trim() === 'HEAD-8841') {
      setCoordPasswordError('');
      setShowJoinModal(false);
      setCurrentView('dashboard');
    } else {
      setCoordPasswordError(`Invalid password. Correct Coordinator Key: ${passwords.head}`);
    }
  };

  const handleJoinJudge = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !enteredJudgePassword.trim() ||
      enteredJudgePassword.trim().toUpperCase() === passwords.judge.toUpperCase() ||
      enteredJudgePassword.trim() === 'JUDGE-3108' ||
      enteredJudgePassword.trim().startsWith('JUDGE-')
    ) {
      setJudgePasswordError('');
      setShowJoinModal(false);
      setCurrentView('judge-scoring');
    } else {
      setJudgePasswordError(`Invalid Judge key. Expected key: ${passwords.judge}`);
    }
  };

  const handleJoinTeamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamFormName.trim() || !teamFormLeader.trim()) {
      setTeamFormError('Team Name and Leader Name are required.');
      return;
    }

    const newTeamRecord: HackathonTeam = {
      id: `team-${Date.now()}`,
      teamName: teamFormName.trim(),
      leaderName: teamFormLeader.trim(),
      leaderEmail: teamFormEmail.trim(),
      leaderPhone: teamFormPhone.trim(),
      totalMembers: Math.max(1, teamFormMembersCount),
      track: teamFormTrack,
      notes: teamFormNotes.trim() || 'Registered via Live Portal',
      pptStatus: 'not_submitted',
      members: [
        {
          id: `mem-${Date.now()}-lead`,
          name: teamFormLeader.trim(),
          email: teamFormEmail.trim(),
          phone: teamFormPhone.trim(),
          role: 'Leader',
        },
      ],
    };

    // Add remaining members
    for (let i = 2; i <= teamFormMembersCount; i++) {
      newTeamRecord.members.push({
        id: `mem-${Date.now()}-${i}`,
        name: `Member ${i}`,
        email: '',
        phone: '',
        role: 'Member',
      });
    }

    // 1. Send via WebSocket for instant push
    socket.emit('team_joined', {
      ...newTeamRecord,
      hackathonId: activeScoringHackathonId,
    });

    // 2. Send via REST API
    fetch('/api/teams/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        hackathonId: activeScoringHackathonId,
        ...newTeamRecord,
      }),
    }).catch((err) => console.warn('POST /api/teams/join err:', err));

    // 3. Persist to real Firebase Firestore database
    saveTeamToFirestore({
      ...newTeamRecord,
      hackathonId: activeScoringHackathonId,
    });

    const updated = [newTeamRecord, ...teams];
    setTeams(updated);
    try {
      localStorage.setItem('mango_hackathon_teams', JSON.stringify(updated));
    } catch (e) {}

    setActiveTeamScorecardId(newTeamRecord.id);
    setShowJoinModal(false);
    setJoinStep('role-select');
    setCurrentView('team-scorecard');
  };

  const renderJoinModal = () => {
    if (!showJoinModal) return null;
    return (
      <div className="fixed inset-0 z-50 bg-charcoal/70 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-surface rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border-2 border-charcoal flex flex-col gap-5 relative max-h-[90vh] overflow-y-auto">
          <button
            onClick={() => {
              setShowJoinModal(false);
              setJoinStep('role-select');
              setEnteredCoordPassword('');
              setCoordPasswordError('');
              setEnteredJudgePassword('');
              setJudgePasswordError('');
            }}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-surface-container-low text-on-surface hover:bg-surface-container flex items-center justify-center text-sm font-bold transition cursor-pointer"
            type="button"
          >
            ✕
          </button>

          {joinStep === 'role-select' && (
            <>
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-secondary-container border border-charcoal/10 flex items-center justify-center overflow-hidden shrink-0">
                  <img
                    alt="Mascot Avatar"
                    className="w-full h-full object-cover"
                    src="https://lh3.googleusercontent.com/aida-public/AB6AXuAZOcs5DUmombeuOGsoxqh8VSfRDikLG9XxXoGT9LJazZoomml38OJqya8f0KrWvwIFXqOU5rmaONRngFYnLnvVL1MaPF7mDmnYoiQpp038ULDrkFg1_7A0zmMnObvN0NaJMSSKLS1gL876UDe05y3ypb-_G7C-pvVyZX2MyNju08UYlqh3a5y_3hR7Luqoq2ws4BuXTcMNsARO7bHWXinpjbHjy-smagYg8CBcyQHq6k2ZFMNJP_vpklpcgwY90VB4LmQ"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-secondary bg-secondary-container/50 px-2.5 py-0.5 rounded-full">
                      Global AI 2026 • LIVE
                    </span>
                  </div>
                  <h3 className="font-headline-sm text-2xl text-charcoal font-bold mt-1">Join Hackathon</h3>
                </div>
              </div>

              <p className="text-sm text-fog leading-relaxed">
                Select your designated role to enter the hackathon environment and deliberation rooms.
              </p>

              <div className="flex flex-col gap-3">
                {/* 1. Join as Team (WORKING LIVE) */}
                <button
                  type="button"
                  onClick={() => {
                    setJoinStep('team-join');
                    setTeamFormError('');
                  }}
                  className="p-4 rounded-2xl bg-secondary-container/40 border-2 border-secondary hover:bg-secondary-container/70 transition text-left flex items-center justify-between group cursor-pointer shadow-sm"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-secondary text-white flex items-center justify-center">
                      <span className="material-symbols-outlined text-xl">group</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-charcoal">Join as Team / Student</span>
                        <span className="px-2 py-0.2 rounded bg-secondary text-white text-[10px] font-bold">WORKING</span>
                      </div>
                      <p className="text-xs text-on-surface-variant mt-0.5">Register team, view live scores &amp; critique from judges</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-secondary font-bold text-xs">
                    <span>Register</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </div>
                </button>

                {/* 2. Join as Judge (WORKING LIVE) */}
                <button
                  type="button"
                  onClick={() => {
                    setJoinStep('judge-password');
                    setEnteredJudgePassword(passwords.judge);
                    setJudgePasswordError('');
                  }}
                  className="p-4 rounded-2xl bg-tertiary-container/40 border-2 border-tertiary hover:bg-tertiary-container/70 transition text-left flex items-center justify-between group cursor-pointer shadow-sm"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-tertiary text-white flex items-center justify-center">
                      <span className="material-symbols-outlined text-xl">gavel</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-charcoal">Join as Judge</span>
                        <span className="px-2 py-0.2 rounded bg-tertiary text-white text-[10px] font-bold">WORKING</span>
                      </div>
                      <p className="text-xs text-on-surface-variant mt-0.5">Score teams across rubrics &amp; broadcast marks via WebSockets</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-tertiary font-bold text-xs">
                    <span>Grade</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </div>
                </button>

                {/* 3. Join as Coordinator (WORKING LIVE) */}
                <button
                  type="button"
                  onClick={() => {
                    setJoinStep('coord-password');
                    setEnteredCoordPassword('');
                    setCoordPasswordError('');
                  }}
                  className="p-4 rounded-2xl bg-primary-container/40 border-2 border-primary hover:bg-primary-container/70 transition text-left flex items-center justify-between group cursor-pointer shadow-sm"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center">
                      <span className="material-symbols-outlined text-xl">admin_panel_settings</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-charcoal">Join as Coordinator</span>
                        <span className="px-2 py-0.2 rounded bg-primary text-white text-[10px] font-bold">WORKING</span>
                      </div>
                      <p className="text-xs text-on-surface-variant mt-0.5">Live panel oversight, team call queue &amp; deliberations</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-primary font-bold text-xs">
                    <span>Enter</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </div>
                </button>
              </div>

              <div className="pt-2 text-center text-xs text-fog flex items-center justify-between">
                <span>Passcodes: Head: <strong className="font-mono text-charcoal">{passwords.head}</strong></span>
                <span>Judge: <strong className="font-mono text-charcoal">{passwords.judge}</strong></span>
              </div>
            </>
          )}

          {/* STEP: TEAM REGISTRATION FORM */}
          {joinStep === 'team-join' && (
            <form onSubmit={handleJoinTeamSubmit} className="flex flex-col gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-secondary-container text-secondary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">group_add</span>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-secondary bg-secondary-container/50 px-2.5 py-0.5 rounded-full">
                    Student Team Registration
                  </span>
                  <h3 className="font-headline-sm text-2xl text-charcoal font-bold mt-1">Register for Contest</h3>
                </div>
              </div>

              <div className="flex flex-col gap-3 text-xs">
                <div>
                  <label className="block font-bold uppercase text-fog tracking-wider mb-1">Team Name</label>
                  <input
                    type="text"
                    required
                    value={teamFormName}
                    onChange={(e) => setTeamFormName(e.target.value)}
                    placeholder="e.g. Team NeuralSurge"
                    className="w-full bg-surface-container-low border border-charcoal/20 focus:border-secondary rounded-xl px-3.5 py-2.5 font-bold outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold uppercase text-fog tracking-wider mb-1">Leader Name</label>
                    <input
                      type="text"
                      required
                      value={teamFormLeader}
                      onChange={(e) => setTeamFormLeader(e.target.value)}
                      placeholder="e.g. Aakash Patel"
                      className="w-full bg-surface-container-low border border-charcoal/20 focus:border-secondary rounded-xl px-3.5 py-2.5 outline-none font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-bold uppercase text-fog tracking-wider mb-1">Total Members</label>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={teamFormMembersCount}
                      onChange={(e) => setTeamFormMembersCount(parseInt(e.target.value) || 1)}
                      className="w-full bg-surface-container-low border border-charcoal/20 focus:border-secondary rounded-xl px-3.5 py-2.5 outline-none font-medium"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold uppercase text-fog tracking-wider mb-1">Leader Email</label>
                    <input
                      type="email"
                      value={teamFormEmail}
                      onChange={(e) => setTeamFormEmail(e.target.value)}
                      placeholder="e.g. aakash@gmail.com"
                      className="w-full bg-surface-container-low border border-charcoal/20 focus:border-secondary rounded-xl px-3.5 py-2.5 outline-none font-medium"
                    />
                  </div>
                  <div>
                    <label className="block font-bold uppercase text-fog tracking-wider mb-1">Leader Mobile</label>
                    <input
                      type="tel"
                      value={teamFormPhone}
                      onChange={(e) => setTeamFormPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full bg-surface-container-low border border-charcoal/20 focus:border-secondary rounded-xl px-3.5 py-2.5 outline-none font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold uppercase text-fog tracking-wider mb-1">Contest Track</label>
                  <select
                    value={teamFormTrack}
                    onChange={(e) => setTeamFormTrack(e.target.value)}
                    className="w-full bg-surface-container-low border border-charcoal/20 focus:border-secondary rounded-xl px-3.5 py-2.5 outline-none font-medium cursor-pointer"
                  >
                    <option>Voice AI &amp; Autonomous Systems</option>
                    <option>Multimodal Agents &amp; Vision</option>
                    <option>Infrastructure, Edge &amp; Latency</option>
                    <option>Open Frontier Innovation</option>
                  </select>
                </div>

                {teamFormError && (
                  <p className="text-xs text-error font-medium">{teamFormError}</p>
                )}
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setJoinStep('role-select')}
                  className="flex-1 py-3 rounded-xl border border-charcoal/20 bg-surface text-charcoal font-bold text-xs hover:bg-surface-variant transition cursor-pointer"
                >
                  ← Back to Roles
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-secondary text-white font-bold text-xs hover:bg-secondary/90 transition flex items-center justify-center gap-1.5 shadow cursor-pointer"
                >
                  <span>Complete &amp; View Scorecard</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </div>
            </form>
          )}

          {/* STEP: JUDGE PASSWORD / PORTAL ENTER */}
          {joinStep === 'judge-password' && (
            <form onSubmit={handleJoinJudge} className="flex flex-col gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-tertiary-container text-tertiary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">gavel</span>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-tertiary bg-tertiary-container/50 px-2.5 py-0.5 rounded-full">
                    Judge Deliberation Access
                  </span>
                  <h3 className="font-headline-sm text-2xl text-charcoal font-bold mt-1">Enter Judge Passkey</h3>
                </div>
              </div>

              <p className="text-sm text-fog leading-relaxed">
                Enter your assigned Judge Security Key to evaluate registered hacker teams and broadcast scores via WebSockets.
              </p>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">
                  Judge Key
                </label>
                <input
                  type="text"
                  value={enteredJudgePassword}
                  onChange={(e) => setEnteredJudgePassword(e.target.value)}
                  placeholder={`Enter ${passwords.judge}`}
                  className="w-full bg-surface-container-low border-2 border-charcoal/20 focus:border-tertiary rounded-xl px-4 py-3 text-charcoal font-mono text-base font-bold tracking-wider outline-none transition"
                />
                {judgePasswordError && (
                  <p className="text-xs text-error font-medium mt-1.5">{judgePasswordError}</p>
                )}
              </div>

              <div className="p-3 rounded-xl bg-lumen-cream border border-charcoal/15 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-fog">Default Demo Key:</span>
                  <span className="font-mono font-bold text-charcoal bg-surface px-2 py-0.5 rounded border border-charcoal/10">
                    {passwords.judge}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEnteredJudgePassword(passwords.judge);
                    setShowJoinModal(false);
                    setCurrentView('judge-scoring');
                  }}
                  className="text-xs font-bold text-tertiary hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>Auto-fill &amp; Enter</span>
                  <span className="material-symbols-outlined text-xs">arrow_forward</span>
                </button>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setJoinStep('role-select')}
                  className="flex-1 py-3 rounded-xl border border-charcoal/20 bg-surface text-charcoal font-bold text-xs hover:bg-surface-variant transition cursor-pointer"
                >
                  ← Back to Roles
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-tertiary text-white font-bold text-xs hover:bg-tertiary/90 transition flex items-center justify-center gap-1.5 shadow cursor-pointer"
                >
                  <span>Enter Judge Chamber</span>
                  <span className="material-symbols-outlined text-sm">login</span>
                </button>
              </div>
            </form>
          )}

          {/* STEP: COORDINATOR PASSWORD */}
          {joinStep === 'coord-password' && (
            <form onSubmit={handleJoinCoordinator} className="flex flex-col gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-secondary-container border border-charcoal/10 flex items-center justify-center overflow-hidden shrink-0">
                  <span className="material-symbols-outlined text-2xl text-secondary">vpn_key</span>
                </div>
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary bg-primary-container px-2.5 py-0.5 rounded-full">
                    Coordinator Authentication
                  </span>
                  <h3 className="font-headline-sm text-2xl text-charcoal font-bold mt-1">Enter Security Key</h3>
                </div>
              </div>

              <p className="text-sm text-fog leading-relaxed">
                Enter the Head / Coordinator password generated after launch to open the Command Dashboard.
              </p>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-charcoal mb-1.5">
                  Coordinator Password
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={enteredCoordPassword}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEnteredCoordPassword(val);
                      if (val.trim().toUpperCase() === passwords.head.toUpperCase()) {
                        setCoordPasswordError('');
                        setShowJoinModal(false);
                        setCurrentView('dashboard');
                      }
                    }}
                    placeholder={`Enter ${passwords.head}`}
                    autoFocus
                    required
                    className="w-full bg-surface-container-low border-2 border-charcoal/20 focus:border-primary rounded-xl px-4 py-3 text-charcoal font-mono text-base font-bold tracking-wider outline-none transition"
                  />
                  <span className="material-symbols-outlined text-fog absolute right-3.5 top-3.5 text-xl">
                    lock
                  </span>
                </div>
                {coordPasswordError && (
                  <p className="text-xs text-error font-medium mt-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">error</span>
                    {coordPasswordError}
                  </p>
                )}
              </div>

              {/* Quick Auto-fill helper */}
              <div className="p-3 rounded-xl bg-lumen-cream border border-charcoal/15 flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-fog">Generated Key:</span>
                  <span className="font-mono font-bold text-charcoal bg-surface px-2 py-0.5 rounded border border-charcoal/10">
                    {passwords.head}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEnteredCoordPassword(passwords.head);
                    setCoordPasswordError('');
                    setShowJoinModal(false);
                    setCurrentView('dashboard');
                  }}
                  className="text-xs font-bold text-secondary hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>Auto-fill &amp; Enter</span>
                  <span className="material-symbols-outlined text-xs">arrow_forward</span>
                </button>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setJoinStep('role-select');
                    setCoordPasswordError('');
                  }}
                  className="flex-1 py-3 rounded-xl border border-charcoal/20 bg-surface text-charcoal font-bold text-xs hover:bg-surface-variant transition cursor-pointer"
                >
                  ← Back to Roles
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-charcoal text-lumen-cream font-bold text-xs hover:bg-black transition flex items-center justify-center gap-1.5 shadow cursor-pointer"
                >
                  <span>Enter Dashboard</span>
                  <span className="material-symbols-outlined text-sm">login</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  };

  // Reviewers view state
  const [reviewersList, setReviewersList] = useState([
    { initials: 'AT', name: 'Dr. Aris Thorne', role: 'Lead Judge', roleKey: 'judge', email: 'aris.thorne@oxford-research.org', assigned: 'All Tracks', status: 'Accepted', badgeBg: 'bg-charcoal text-pure-white', avatarBg: 'bg-secondary-container text-on-secondary-container' },
    { initials: 'EV', name: 'Elena Vance', role: 'Judge', roleKey: 'judge', email: 'elena@blackmesa-systems.io', assigned: 'Flagship Track', status: 'Accepted', badgeBg: 'bg-surface-container-high border border-charcoal/10 text-on-surface', avatarBg: 'bg-primary-container text-on-primary-container' },
    { initials: 'ML', name: 'Marcus Lin', role: 'Judge', roleKey: 'judge', email: 'marcus.lin@wispr.ai', assigned: 'Wispr Voice Bounty', status: 'Accepted', badgeBg: 'bg-surface-container-high border border-charcoal/10 text-on-surface', avatarBg: 'bg-tertiary-fixed text-on-tertiary-fixed' },
    { initials: 'SC', name: 'Sophia Chen', role: 'Mentor', roleKey: 'mentor', email: 'sophia@foundry-capital.com', assigned: 'General Advisory', status: 'Pending', badgeBg: 'bg-tertiary-container border border-tertiary/20 text-on-tertiary-container', avatarBg: 'bg-surface-variant text-on-surface' },
  ]);
  const [rosterFilter, setRosterFilter] = useState<'all' | 'judge' | 'mentor'>('all');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Judge');
  const [inviteTrack, setInviteTrack] = useState('All Tracks');
  const [privacyMode, setPrivacyMode] = useState('blind');
  const [quorum, setQuorum] = useState(3);
  const [copyBtnText, setCopyBtnText] = useState('Copy public juror application link');
  const [resendingIndex, setResendingIndex] = useState<number | null>(null);

  const handleAddReviewer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    const initials = inviteEmail.substring(0, 2).toUpperCase();
    const namePart = inviteEmail.split('@')[0];
    const capitalizedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    const roleKey = inviteRole.toLowerCase().includes('mentor') ? 'mentor' : 'judge';
    const badgeBg = inviteRole.includes('Lead') ? 'bg-charcoal text-pure-white' : inviteRole === 'Mentor' ? 'bg-tertiary-container border border-tertiary/20 text-on-tertiary-container' : 'bg-surface-container-high border border-charcoal/10 text-on-surface';
    const avatarBg = roleKey === 'mentor' ? 'bg-surface-variant text-on-surface' : 'bg-secondary-container text-on-secondary-container';
    
    const newRev = {
      initials,
      name: capitalizedName,
      role: inviteRole,
      roleKey,
      email: inviteEmail.trim(),
      assigned: inviteTrack,
      status: 'Pending',
      badgeBg,
      avatarBg
    };
    setReviewersList([newRev, ...reviewersList]);
    setInviteEmail('');
  };

  const handleRemoveReviewer = (index: number) => {
    setReviewersList(reviewersList.filter((_, i) => i !== index));
  };

  const handleResendInvite = (index: number) => {
    setResendingIndex(index);
    setTimeout(() => {
      setResendingIndex(null);
    }, 2000);
  };

  const handleCopyInvite = () => {
    navigator.clipboard?.writeText(window.location.origin + '/apply-jury');
    setCopyBtnText('Copied to clipboard!');
    setTimeout(() => {
      setCopyBtnText('Copy public juror application link');
    }, 2000);
  };

  const filteredReviewers = reviewersList.filter(r => rosterFilter === 'all' || r.roleKey === rosterFilter);

  const [jurors, setJurors] = useState([
    { initials: 'SC', name: 'Sarah Chen', track: 'LLM Infra Lead • Matrix Track', color: 'bg-secondary' },
    { initials: 'DR', name: 'David Ross', track: 'Design Partner • Synthesis Track', color: 'bg-tertiary' },
    { initials: 'AN', name: 'Anya Ndiaye', track: 'Acoustic Research • Edge Core', color: 'bg-primary' },
    { initials: 'MK', name: 'Mateo Kim', track: 'Security Audit • Protocol lead', color: 'bg-inverse-surface text-inverse-on-surface' },
  ]);

  const roleData = {
    coordinators: {
      title: "One tool. Every operational workflow.",
      desc: "Coordinator broadcasts, scoring consensus, and team queueing seamlessly connect without data loss.",
      cta: "Explore Coordinator Console",
      metrics: [
        { label: "Submission Intake Pipeline", desc: "142 teams routed across 6 specialized tracks", badge: "100% Locked", color: "text-secondary-fixed" },
        { label: "Real-Time Consensus Drift", desc: "Standard deviation < 0.4 across all judge pairs", badge: "Optimized", color: "text-tertiary-fixed" },
        { label: "Encrypted Dispatch Channel", desc: "Instant broadcast to 500+ hacker terminals", badge: "Active", color: "text-primary-fixed" },
      ]
    },
    judges: {
      title: "Voice-driven grading, zero typing friction.",
      desc: "Dictate evaluations in 20 seconds. Mango standardizes rubric scores, generates audit trails, and prompts on discrepancies.",
      cta: "Launch Judge Chamber",
      metrics: [
        { label: "Spoken Rubric Normalization", desc: "AI transcript matched to 5-pillar hackathon criteria", badge: "99.4% Acc", color: "text-secondary-fixed" },
        { label: "Discrepancy Alarm", desc: "Zero scoring divergence flagged between pair judges", badge: "Synced", color: "text-tertiary-fixed" },
        { label: "Instant Leaderboard Sync", desc: "Final scores broadcasted to central wallboards", badge: "Live", color: "text-primary-fixed" },
      ]
    },
    trackleads: {
      title: "Live rubric normalization across tracks.",
      desc: "Detect grading bias early. Re-calibrate tough vs generous judges in real-time with automated Bayesian curve adjustments.",
      cta: "Open Lead Analytics",
      metrics: [
        { label: "Track Calibration Curve", desc: "Bayesian adjustment applied across AI & Web3 panels", badge: "Balanced", color: "text-secondary-fixed" },
        { label: "Judge Workload Distribution", desc: "Queue balanced across 18 active evaluation booths", badge: "Optimal", color: "text-tertiary-fixed" },
        { label: "Finalist Nomination Lock", desc: "Top 3 teams per track verified and signed off", badge: "Ready", color: "text-primary-fixed" },
      ]
    },
    mentors: {
      title: "Smart dispatch queue for 500+ hackers.",
      desc: "Hacker requests are categorized by stack and pinged directly to mentors with matching expertise badges.",
      cta: "View Mentor Queue",
      metrics: [
        { label: "Incoming Help Requests", desc: "Average resolution time: 3 min 12 sec", badge: "Fast", color: "text-secondary-fixed" },
        { label: "Expertise Matching", desc: "React, Rust, PyTorch, and Hardware routing active", badge: "Active", color: "text-tertiary-fixed" },
        { label: "Help Desk Satisfaction", desc: "4.9/5 rating across all sponsor mentor stations", badge: "Top Tier", color: "text-primary-fixed" },
      ]
    },
    hardware: {
      title: "Hardware asset vault & escrow tracking.",
      desc: "Check out GPUs, microcontrollers, and VR headsets with instant NFC or QR barcode scans tied to team badges.",
      cta: "Manage Inventory Vault",
      metrics: [
        { label: "NVIDIA H100 / RTX Cluster", desc: "42 units checked out, 8 units in reserve", badge: "84% Util", color: "text-secondary-fixed" },
        { label: "Arduino & Sensor Kits", desc: "Full inventory tracked via RFID scanner", badge: "Secure", color: "text-tertiary-fixed" },
        { label: "Return & Escrow Status", desc: "Zero missing items recorded at checkpoint delta", badge: "Verified", color: "text-primary-fixed" },
      ]
    },
    volunteers: {
      title: "Shift coordination & meal distribution.",
      desc: "Monitor hacker dietary requirements, room capacity limits, and emergency broadcasts from a unified mobile view.",
      cta: "View Volunteer Dispatch",
      metrics: [
        { label: "Meal Drop Coordination", desc: "Dietary flags synced for 650 vegan/gluten-free orders", badge: "On Time", color: "text-secondary-fixed" },
        { label: "Room Capacity Monitor", desc: "Main auditorium at 72% safe occupancy limit", badge: "Normal", color: "text-tertiary-fixed" },
        { label: "Emergency Broadcasts", desc: "Push notification gateway active across Telegram & Slack", badge: "Online", color: "text-primary-fixed" },
      ]
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loginRole === 'judge') {
      setCurrentView('judge-scoring');
    } else if (loginRole === 'student') {
      if (teams[0]) setActiveTeamScorecardId(teams[0].id);
      setCurrentView('team-scorecard');
    } else {
      setCurrentView('explore');
    }
  };

  const handleAddJuror = () => {
    const pool = [
      { initials: 'EL', name: 'Elena Li', track: 'Audio Synth • DSP Lead', color: 'bg-secondary' },
      { initials: 'JT', name: 'James Thorpe', track: 'Edge Compute • Fellow', color: 'bg-primary' },
      { initials: 'AK', name: 'Anil Kapoor', track: 'Venture Partner • Matrix', color: 'bg-tertiary' }
    ];
    if (jurors.length < 4 + pool.length) {
      const nextCandidate = pool[jurors.length - 4];
      if (nextCandidate) {
        setJurors([...jurors, nextCandidate]);
      }
    }
  };

  const handleRemoveJuror = (index: number) => {
    setJurors(jurors.filter((_, i) => i !== index));
  };

  // 0A. JUDGE SCORING PORTAL (Real-time live scoring with WebSockets)
  if (currentView === 'judge-scoring') {
    const activeContest = createdHackathons.find((h) => h.id === activeScoringHackathonId) || createdHackathons[0];
    return (
      <JudgeScoringPortal
        hackathonTitle={activeContest ? activeContest.title : 'Global Autonomous Voice Hackathon'}
        hackathonId={activeContest ? activeContest.id : 'hack-live-01'}
        teams={teams}
        scores={scores}
        onBack={() => setCurrentView('explore')}
        onViewTeamScorecard={(teamId) => {
          setActiveTeamScorecardId(teamId);
          setCurrentView('team-scorecard');
        }}
        onScoreSubmitted={(newScore) => {
          setScores((prev) => [newScore, ...prev.filter((s) => s.id !== newScore.id)]);
        }}
      />
    );
  }

  // 0B. STUDENT / TEAM LIVE SCORECARD (Real-time marks and feedback stream from judges)
  if (currentView === 'team-scorecard') {
    const activeTeam = teams.find((t) => t.id === activeTeamScorecardId) || teams[0];
    const activeContest = createdHackathons.find((h) => h.id === activeScoringHackathonId) || createdHackathons[0];
    return (
      <TeamScorecard
        team={activeTeam}
        hackathonTitle={activeContest ? activeContest.title : 'Global Autonomous Voice Hackathon'}
        hackathonId={activeContest ? activeContest.id : 'hack-live-01'}
        scores={scores}
        allTeams={teams}
        onBack={() => setCurrentView('explore')}
        onSwitchTeam={(teamId) => setActiveTeamScorecardId(teamId)}
        onTriggerPptUpload={(teamId) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.pdf,.ppt,.pptx';
          input.onchange = (e: any) => {
            const file = e.target?.files?.[0];
            if (!file) return;
            const fileSizeStr = file.size > 1024 * 1024
              ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
              : `${Math.round(file.size / 1024)} KB`;
            const updated = teams.map((t) => {
              if (t.id === teamId) {
                return {
                  ...t,
                  pptStatus: 'submitted' as const,
                  pptFile: {
                    fileName: file.name,
                    uploadedAt: 'Uploaded Just Now',
                    fileSize: fileSizeStr,
                    pdfUrl: URL.createObjectURL(file),
                  },
                };
              }
              return t;
            });
            handleUpdateTeams(updated);
            alert(`Pitch Deck "${file.name}" uploaded successfully!`);
          };
          input.click();
        }}
      />
    );
  }

  // 6. TRACKS & RUBRICS PAGE (When clicking Publish Hackathon Blueprint)
  if (currentView === 'tracks-rubrics') {
    return (
      <div className="bg-lumen-cream font-body-base text-on-surface antialiased selection:bg-primary-container selection:text-on-primary-container min-h-screen flex flex-col justify-between">
        <header className="fixed top-0 left-0 w-full z-50 bg-lumen-cream/95 backdrop-blur-md shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
          <div className="h-20 max-w-[1200px] mx-auto px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentView('explore')}>
              <div className="w-9 h-9 rounded-xl bg-charcoal flex items-center justify-center text-lumen-cream font-headline-sm leading-none pt-0.5">M</div>
              <div className="flex flex-col">
                <span className="font-body-base-bold text-base text-on-surface tracking-tight leading-tight">Mango Studio</span>
                <span className="text-xs text-fog uppercase">Hackathon OS</span>
              </div>
            </div>
            <nav className="hidden lg:flex items-center gap-2 bg-lumen-stone/50 p-1 rounded-full">
              <span onClick={() => setCurrentView('create-hackathon')} className="inline-flex items-center text-xs text-on-surface-variant hover:text-on-surface hover:bg-lumen-stone px-4 py-1.5 rounded-full transition-colors cursor-pointer font-semibold"><span className="text-secondary font-bold mr-1.5">✓</span>01. Overview</span>
              <span className="text-outline-variant text-xs">/</span>
              <span className="inline-flex items-center transition-colors bg-primary-container text-on-primary-container font-bold rounded-full px-4 py-1.5 text-xs"><span className="w-2 h-2 rounded-full bg-tertiary mr-2"></span>02. Tracks &amp; Rubrics</span>
              <span className="text-outline-variant text-xs">/</span>
              <span className="inline-flex items-center text-xs text-on-surface-variant hover:text-on-surface hover:bg-lumen-stone px-4 py-1.5 rounded-full transition-colors cursor-pointer">03. Reviewers</span>
              <span className="text-outline-variant text-xs">/</span>
              <span className="inline-flex items-center text-xs text-on-surface-variant hover:text-on-surface hover:bg-lumen-stone px-4 py-1.5 rounded-full transition-colors cursor-pointer">04. Schedule</span>
            </nav>
            <div className="flex items-center gap-4">
              <button onClick={() => alert('Draft saved successfully!')} className="text-xs bg-lumen-stone text-on-surface hover:bg-surface-container-highest px-4 py-2 rounded-full transition-colors cursor-pointer font-semibold" type="button">Save Draft</button>
              <img alt="Profile" className="w-8 h-8 rounded-full object-cover" src="https://lh3.googleusercontent.com/aida/AEtjO1UT380eD2f4DQy2PRL7xWoutcO_zEzfLb96LbO8SE7gnXA6YR7chD3hRsdWrIFIfHezVfQuVPuf7ljeARndNmxdWm6Wu5Z_umNLLw4E5qv7h6jGHSd_EOuBEx3uDeJtfnzIcFFTgCtm55Z-2o1kuxsRwzAg0kf5-VrZcqNY10Rqh1Hkn3kD6NCq0dRru1ToLGHdDMLzmJfJrFwM6px3-bLaN2hMSMRIBT1FwTSPRTHLha2BjOWdwF-uUm88uhEuqnFkQ4Ux_bWCCuQ"/>
            </div>
          </div>
        </header>

        <main className="w-full pt-28 bg-lumen-cream flex-1">
          <div className="max-w-[1200px] w-full mx-auto px-6 py-10 flex flex-col gap-10">
            {/* HEADER / STEPPER ORCHESTRATION */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b-2 border-charcoal/10 pb-8">
              <div className="flex flex-col gap-2 max-w-2xl">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs uppercase tracking-widest text-secondary font-bold">Step 02 of 04</span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high text-on-surface text-xs font-semibold"><span className="w-2 h-2 rounded-full bg-tertiary"></span>Draft Mode • Est. 2 min</span>
                </div>
                <h1 className="font-headline-lg text-5xl md:text-6xl text-charcoal tracking-tight">Tracks, Rubrics &amp; Prizes</h1>
                <p className="text-lg text-on-surface-variant font-light">Set up your competition tracks and how judges will score projects.</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="hidden sm:flex flex-col items-end text-right">
                  <span className="text-xs text-fog uppercase tracking-wider font-semibold">Step 02</span>
                  <span className="font-bold text-charcoal text-sm">Tracks &amp; Scoring</span>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-charcoal text-lumen-cream flex items-center justify-center font-headline-sm text-2xl font-bold">02</div>
              </div>
            </header>

            {/* ADVISOR BANNER */}
            <aside className="relative overflow-hidden rounded-[32px] bg-surface-container-lowest p-6 md:p-8 shadow-sm border border-on-surface/10">
              <div className="flex flex-col sm:flex-row items-center gap-6 relative z-10">
                <div className="relative shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-lumen-stone/40 overflow-hidden flex items-center justify-center">
                  <img alt="Mango Studio Rubric Balancing Assistant avatar" className="w-full h-full object-contain p-1" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBprSJ4Y3DmveGPACDkhjzJrmBRbF0dQwTdFGIeMMHmafxpNFN-G1Q6DqfkrqWtjpPiFj5lD6SgXzEghECeyzCbsdFCAN8Rhw14juQY_5x6jdZYl1SJWXFGssff1dPuT-zg9WaItO-moMTDM8-iO6Gc2B4eM1BOcAOFUL6VWBdgBUp88mD_NVHQhJZRlTNSJqqNHzFuB9w-FwqPy7XgoX7ocRWVdlzwAwWKm0O35Bw7KbxkXvv2k3drhR9Pg7qug8x_ezc"/>
                </div>
                <div className="flex flex-col gap-1 text-center sm:text-left flex-1 min-w-0">
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="text-xs text-secondary uppercase font-bold tracking-wider">Mango Tip</span>
                    <span className="text-fog text-xs">•</span>
                    <span className="text-xs text-fog font-medium">Rubric Setup</span>
                  </div>
                  <p className="text-base text-charcoal leading-snug">We recommend 3–4 clear criteria so judges can score projects quickly without friction.</p>
                </div>
                <div className="shrink-0 flex items-center">
                  <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-secondary-container text-on-secondary-container text-xs font-semibold">
                    <span className="material-symbols-outlined text-sm">check_circle</span>All Weights Balanced
                  </span>
                </div>
              </div>
            </aside>

            {/* SECTION 1: COMPETITIVE TRACKS & BOUNTIES */}
            <section className="flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-fog uppercase tracking-wider font-semibold">Section 01</span>
                  <h2 className="font-headline-md text-3xl md:text-4xl text-charcoal mt-1">Competition Tracks</h2>
                </div>
                <button onClick={() => alert('Add Track modal opened!')} className="inline-flex items-center gap-2 self-start sm:self-auto px-5 py-3 rounded-xl bg-lumen-stone text-charcoal hover:bg-surface-container-highest transition-colors text-sm font-semibold cursor-pointer border border-on-surface/10" type="button">
                  <span className="material-symbols-outlined text-base">add</span>Add Track
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-[32px] bg-surface-container-lowest p-8 shadow-sm flex flex-col justify-between gap-6 border border-on-surface/10">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-3 py-1 rounded-lg bg-secondary text-on-secondary text-xs uppercase tracking-wider font-bold">Main Track</span>
                      <span className="font-headline-sm text-2xl text-charcoal font-bold">$35,000</span>
                    </div>
                    <h3 className="font-headline-sm text-2xl text-charcoal mt-1">General / Flagship Track</h3>
                    <p className="text-base text-on-surface-variant">Open to all voice, multimodal, and interactive software applications.</p>
                  </div>
                  <div className="pt-6 border-t border-charcoal/10 flex flex-col gap-3">
                    <span className="text-xs text-fog uppercase tracking-wider font-semibold">Prize Breakdown</span>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-3 rounded-xl bg-surface-container-low border border-on-surface/5"><div className="text-xs text-fog">1st Place</div><div className="font-bold text-charcoal text-sm">$20,000</div></div>
                      <div className="p-3 rounded-xl bg-surface-container-low border border-on-surface/5"><div className="text-xs text-fog">2nd Place</div><div className="font-bold text-charcoal text-sm">$10,000</div></div>
                      <div className="p-3 rounded-xl bg-surface-container-low border border-on-surface/5"><div className="text-xs text-fog">3rd Place</div><div className="font-bold text-charcoal text-sm">$5,000</div></div>
                    </div>
                  </div>
                </div>

                <div className="rounded-[32px] bg-surface-container-lowest p-8 shadow-sm flex flex-col justify-between gap-6 border border-on-surface/10">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="px-3 py-1 rounded-lg bg-tertiary-fixed text-on-tertiary-fixed text-xs uppercase tracking-wider font-bold">Sponsor Bounty</span>
                      <span className="font-headline-sm text-2xl text-charcoal font-bold">$15,000</span>
                    </div>
                    <h3 className="font-headline-sm text-2xl text-charcoal mt-1">Wispr Voice AI Bounty</h3>
                    <p className="text-base text-on-surface-variant">Best real-world desktop dictation utility built with the Wispr Voice SDK.</p>
                  </div>
                  <div className="pt-6 border-t border-charcoal/10 flex flex-col gap-3">
                    <span className="text-xs text-fog uppercase tracking-wider font-semibold">Bounty Payout</span>
                    <div className="p-4 rounded-xl bg-surface-container-low flex items-center justify-between border border-on-surface/5">
                      <div><div className="text-xs text-fog">Winner Award</div><div className="font-bold text-charcoal text-sm">$15,000 USD</div></div>
                      <span className="px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container text-xs font-semibold">Single Winner</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 2: WEIGHTED EVALUATION RUBRICS MATRIX */}
            <section className="flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-fog uppercase tracking-wider font-semibold">Section 02</span>
                  <h2 className="font-headline-md text-3xl md:text-4xl text-charcoal mt-1">How Judges Score</h2>
                </div>
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary-container text-on-secondary-container text-xs font-semibold">
                    <span className="material-symbols-outlined text-base">check_circle</span>Total: 100% ✓
                  </div>
                  <button onClick={() => alert('Add Criterion modal opened!')} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-lumen-stone hover:bg-surface-container-highest transition-colors text-xs text-charcoal font-semibold cursor-pointer border border-on-surface/10" type="button">
                    <span className="material-symbols-outlined text-base">add</span>Add Criterion
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                {[
                  { num: '1', title: 'Impact & Innovation', desc: 'How novel and impactful is the solution?', weight: '30%' },
                  { num: '2', title: 'Technical Execution', desc: 'Working demo quality, architecture, and code.', weight: '30%' },
                  { num: '3', title: 'Design & Usability', desc: 'User experience, aesthetics, and ease of use.', weight: '20%' },
                  { num: '4', title: 'Presentation & Pitch', desc: 'Clarity of demo and storytelling.', weight: '20%' },
                ].map((c, i) => (
                  <div key={i} className="rounded-[24px] bg-surface-container-lowest p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-on-surface/10">
                    <div className="flex items-start gap-4">
                      <span className="w-8 h-8 rounded-full bg-surface-container text-on-surface font-bold flex items-center justify-center shrink-0 text-sm">{c.num}</span>
                      <div className="flex flex-col">
                        <span className="font-bold text-charcoal text-base">{c.title}</span>
                        <span className="text-sm text-on-surface-variant">{c.desc}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 self-end sm:self-auto">
                      <span className="px-3 py-1 rounded-full bg-surface-container font-bold text-charcoal text-xs">{c.weight} Weight</span>
                      <span className="text-xs text-fog hidden md:inline font-medium">1–10 pts</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 rounded-2xl bg-surface-container-low flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-on-surface/10">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-secondary">tune</span>
                  <span className="text-sm text-on-surface">Scoring scale: <strong>1 to 10 points per criterion</strong></span>
                </div>
                <span className="text-xs text-fog">Criteria scores are averaged across assigned reviewers</span>
              </div>
            </section>

            {/* SECTION 3: PRIZE ESCROW & DISTRIBUTION PROTOCOL */}
            <section className="flex flex-col gap-6">
              <div>
                <span className="text-xs text-fog uppercase tracking-wider font-semibold">Section 03</span>
                <h2 className="font-headline-md text-3xl md:text-4xl text-charcoal mt-1">Prize Pool Summary</h2>
              </div>
              <div className="rounded-[32px] bg-surface-container-lowest p-8 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6 items-center border border-on-surface/10">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-fog uppercase tracking-wider font-semibold">Total Prize Pool</span>
                  <div className="font-headline-lg text-5xl text-charcoal font-bold">$50,000</div>
                  <span className="text-xs text-secondary font-bold flex items-center gap-1.5 mt-1">
                    <span className="w-2 h-2 rounded-full bg-secondary"></span>Fully allocated across 2 tracks
                  </span>
                </div>
                <div className="flex flex-col gap-1 border-t md:border-t-0 md:border-l border-charcoal/10 pt-4 md:pt-0 md:px-6">
                  <span className="text-xs text-fog uppercase tracking-wider font-semibold">Payout Method</span>
                  <div className="font-bold text-charcoal text-sm">Bank Transfer / ACH &amp; Crypto (USDC)</div>
                  <p className="text-xs text-on-surface-variant mt-0.5">Direct payout to winning team leads within 48h.</p>
                </div>
                <div className="flex flex-col gap-1 border-t md:border-t-0 md:border-l border-charcoal/10 pt-4 md:pt-0 md:px-6">
                  <span className="text-xs text-fog uppercase tracking-wider font-semibold">Winner Selection Rule</span>
                  <div className="font-bold text-charcoal text-sm">Highest overall judge average</div>
                  <p className="text-xs text-on-surface-variant mt-0.5">Ties resolved via lead judge deliberation.</p>
                </div>
              </div>
            </section>

            {/* BOTTOM ACTION DOCK */}
            <footer className="pt-8 border-t-2 border-charcoal/10 flex flex-col-reverse sm:flex-row items-center justify-between gap-6">
              <button onClick={() => setCurrentView('create-hackathon')} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-lumen-stone text-charcoal hover:bg-surface-container-highest transition-colors text-sm font-semibold cursor-pointer border border-on-surface/10" type="button">
                <span className="material-symbols-outlined text-base">arrow_back</span>
                Back to Event Basics &amp; Role
              </button>
              <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                <span className="text-xs text-fog flex items-center gap-1.5 font-medium">
                  <span className="material-symbols-outlined text-sm text-secondary">cloud_done</span>
                  Draft auto-saved 8 seconds ago
                </span>
                <button onClick={() => setCurrentView('reviewers')} className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-primary-container text-charcoal border-2 border-charcoal hover:-translate-y-0.5 transition-transform font-bold text-sm cursor-pointer shadow-sm" type="button">
                  Continue to Reviewers &amp; Schedule
                  <span className="material-symbols-outlined text-base">arrow_forward</span>
                </button>
              </div>
            </footer>
          </div>
        </main>

        <footer className="w-full bg-charcoal text-lumen-stone py-12 border-t border-on-surface/20">
          <div className="max-w-[1200px] mx-auto px-10 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-col items-center md:items-start gap-1">
              <div className="flex items-center gap-2">
                <span className="font-headline-sm text-2xl text-lumen-cream font-semibold">Mango Studio</span>
                <span className="text-xs text-fog uppercase tracking-wider">v2.4 Editorial Core</span>
              </div>
              <p className="text-xs text-fog">Engineered for hackathon directors, evaluation suites, and grand deliberations.</p>
            </div>
            <div className="flex items-center gap-8 text-xs text-fog font-semibold">
              <span className="hover:text-lumen-cream transition-colors cursor-pointer">Overview</span>
              <span className="hover:text-lumen-cream transition-colors cursor-pointer">Rubrics</span>
              <span className="hover:text-lumen-cream transition-colors cursor-pointer">Jury Guild</span>
              <span className="hover:text-lumen-cream transition-colors cursor-pointer">Time Registry</span>
            </div>
            <div className="text-xs text-fog font-medium">© 2025 Mango OS • Deliberate Simplicity</div>
          </div>
        </footer>
      </div>
    );
  }

  // REVIEWERS & JUDGES PAGE (When clicking Continue to Reviewers & Schedule)
  if (currentView === 'reviewers') {
    return (
      <div className="bg-surface font-body-base text-on-surface min-h-screen flex flex-col justify-between selection:bg-primary-container selection:text-on-primary-container">
        {/* Header */}
        <header className="fixed top-0 w-full z-50 bg-lumen-cream/90 backdrop-blur-md border-b border-charcoal/10">
          <div className="h-20 max-w-[1200px] mx-auto px-gutter flex items-center justify-between gap-gutter">
            <div className="flex items-center gap-space-xs cursor-pointer" onClick={() => setCurrentView('explore')}>
              <div className="w-9 h-9 rounded-xl bg-tertiary-container border border-charcoal/10 flex items-center justify-center font-headline-sm text-headline-sm text-on-tertiary-container shadow-sm">M</div>
              <div className="flex flex-col">
                <span className="font-body-base-bold text-body-base-bold text-on-surface tracking-tight leading-none">Mango Studio</span>
                <span className="font-label-sm text-label-sm text-fog uppercase tracking-wider">Setup OS</span>
              </div>
            </div>
            <nav className="hidden lg:flex items-center gap-space-xs bg-surface-container-low p-1.5 rounded-full border border-charcoal/10 shadow-sm">
              <button onClick={() => setCurrentView('create-hackathon')} className="px-4 py-1.5 rounded-full font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer" type="button">01. Overview</button>
              <button onClick={() => setCurrentView('tracks-rubrics')} className="px-4 py-1.5 rounded-full font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer" type="button">02. Tracks &amp; Rubrics</button>
              <button className="px-4 py-1.5 rounded-full font-label-md text-label-md bg-primary-container text-on-surface border border-charcoal/15 font-body-base-bold" type="button">03. Reviewers</button>
              <button onClick={() => setCurrentView('schedule')} className="px-4 py-1.5 rounded-full font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer" type="button">04. Schedule</button>
            </nav>
            <div className="flex items-center gap-space-sm">
              <button onClick={() => alert('Draft saved successfully!')} className="px-space-md py-2.5 rounded-xl border border-charcoal/20 bg-surface font-body-base-bold text-label-md text-on-surface hover:bg-surface-variant transition-colors shadow-sm cursor-pointer" type="button">Save Draft</button>
              <div className="w-9 h-9 rounded-full border border-charcoal/10 overflow-hidden p-0.5 bg-tertiary-fixed">
                <img alt="Profile" className="w-8 h-8 rounded-full object-cover" src="https://lh3.googleusercontent.com/aida/AEtjO1UT380eD2f4DQy2PRL7xWoutcO_zEzfLb96LbO8SE7gnXA6YR7chD3hRsdWrIFIfHezVfQuVPuf7ljeARndNmxdWm6Wu5Z_umNLLw4E5qv7h6jGHSd_EOuBEx3uDeJtfnzIcFFTgCtm55Z-2o1kuxsRwzAg0kf5-VrZcqNY10Rqh1Hkn3kD6NCq0dRru1ToLGHdDMLzmJfJrFwM6px3-bLaN2hMSMRIBT1FwTSPRTHLha2BjOWdwF-uUm88uhEuqnFkQ4Ux_bWCCuQ"/>
              </div>
            </div>
          </div>
        </header>

        <main className="w-full pt-28 sm:pt-32 bg-surface min-h-[calc(100vh-140px)] flex-1">
          <div className="flex flex-col w-full">
            <div className="max-w-[1200px] w-full mx-auto px-gutter py-space-lg flex flex-col gap-space-xl">
              {/* Top Stepper Indicator */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-charcoal/10 pb-space-sm gap-2">
                <div className="flex items-center gap-2 sm:gap-space-md text-label-md flex-wrap">
                  <span onClick={() => setCurrentView('create-hackathon')} className="flex items-center gap-1.5 text-fog hover:text-on-surface transition-colors cursor-pointer">
                    <span className="w-5 h-5 rounded-full bg-secondary text-pure-white flex items-center justify-center text-label-sm font-body-base-bold">✓</span>
                    <span>01. Overview</span>
                  </span>
                  <span className="text-fog">/</span>
                  <span onClick={() => setCurrentView('tracks-rubrics')} className="flex items-center gap-1.5 text-fog hover:text-on-surface transition-colors cursor-pointer">
                    <span className="w-5 h-5 rounded-full bg-secondary text-pure-white flex items-center justify-center text-label-sm font-body-base-bold">✓</span>
                    <span>02. Tracks &amp; Rubrics</span>
                  </span>
                  <span className="text-fog">/</span>
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary-container border border-charcoal/20 text-on-surface font-body-base-bold shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-charcoal"></span>
                    <span>03. Reviewers</span>
                  </div>
                  <span className="text-fog">/</span>
                  <span onClick={() => setCurrentView('schedule')} className="text-fog hover:text-on-surface cursor-pointer">04. Schedule</span>
                </div>
                <div className="flex items-center gap-2 text-label-sm text-fog self-start sm:self-auto">
                  <span className="inline-block w-2 h-2 rounded-full bg-secondary"></span>
                  <span>Autosaved 2m ago</span>
                </div>
              </div>

              {/* Page Title & Mascot Companion Tip */}
              <div className="flex flex-col gap-space-md">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-space-md">
                  <div>
                    <span className="font-label-sm text-label-sm text-fog uppercase tracking-widest block mb-1">Jury Assembly</span>
                    <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Reviewers &amp; Judges</h1>
                    <p className="font-body-lg text-body-lg text-on-surface-variant mt-2 max-w-2xl font-light">
                      Assemble your evaluation jury and mentors, assign track responsibilities, and calibrate deliberation visibility.
                    </p>
                  </div>
                  {/* Clean Mascot Tip Banner */}
                  <div className="flex items-center gap-space-sm bg-lumen-cream border border-charcoal/15 rounded-2xl p-3 px-4 max-w-md shrink-0 shadow-sm">
                    <img alt="Mango Companion" className="w-12 h-12 rounded-xl object-cover shrink-0 border border-charcoal/10 bg-tertiary-fixed" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBe-iqR9nsFF5zE_t3pwcv7X9muhsrICGYo9LT9cMhj2U9XZzWyUBHstZtF6qOyou3qVwHFE6polCknUoK4oO-GzHcxqvSEuxIEvR2s91su4T_8GsGv8YaA_n_c7PzTMZWLP2jgaAsqWh4nYSU7jfLVcd0KN1oRCfJ6Q6BoOVwjEXilWjo4J_RjXBdtQaFXWO6PieqPcKmuMaow6juA-MpI0ckye3UvXvdcoAg7AB74LPlY6vsR_uHe6m5Dh3fB0c4CrcI"/>
                    <div className="flex flex-col">
                      <span className="font-body-base-bold text-label-md text-on-surface">Director's Pro-Tip</span>
                      <p className="font-body-base text-label-sm text-on-surface-variant">Aim for 3–4 judges per track to balance score variance and avoid evaluation burnout.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Add Single-Line Bar */}
              <div className="bg-lumen-cream border border-charcoal/15 rounded-2xl p-space-md flex flex-col gap-3 shadow-sm">
                <div className="text-label-sm font-body-base-bold uppercase tracking-wider text-fog">Quick Invite Jury or Mentor</div>
                <form className="grid grid-cols-1 md:grid-cols-12 gap-space-sm items-center" id="invite-form" onSubmit={handleAddReviewer}>
                  <div className="md:col-span-5 relative">
                    <input 
                      value={inviteEmail} 
                      onChange={(e) => setInviteEmail(e.target.value)} 
                      className="w-full h-14 bg-surface-container-lowest border border-charcoal/20 rounded-xl px-4 font-body-base text-on-surface placeholder:text-fog focus:outline-none focus:ring-2 focus:ring-charcoal/30 shadow-sm" 
                      id="invite-email" 
                      placeholder="colleague@institute.edu or @handle" 
                      type="email"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <select 
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="w-full h-14 bg-surface-container-lowest border border-charcoal/20 rounded-xl px-4 font-body-base text-on-surface focus:outline-none cursor-pointer shadow-sm" 
                      id="invite-role"
                    >
                      <option value="Judge">Role: Judge</option>
                      <option value="Lead Judge">Role: Lead Judge</option>
                      <option value="Mentor">Role: Mentor</option>
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <select 
                      value={inviteTrack}
                      onChange={(e) => setInviteTrack(e.target.value)}
                      className="w-full h-14 bg-surface-container-lowest border border-charcoal/20 rounded-xl px-4 font-body-base text-on-surface focus:outline-none cursor-pointer shadow-sm" 
                      id="invite-track"
                    >
                      <option value="All Tracks">Assignment: All Tracks</option>
                      <option value="Flagship Track">Assignment: Flagship Track</option>
                      <option value="Wispr Voice Bounty">Assignment: Wispr Voice Bounty</option>
                      <option value="General Advisory">Assignment: General Advisory</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <button className="w-full h-14 bg-charcoal text-lumen-cream rounded-xl font-body-base-bold text-label-md flex items-center justify-center gap-2 hover:bg-on-surface-variant transition-colors shadow-sm cursor-pointer" type="submit">
                      <span className="material-symbols-outlined text-[20px]">add</span>
                      <span>Invite</span>
                    </button>
                  </div>
                </form>
                <div className="flex items-center justify-between text-label-sm pt-1">
                  <div className="flex items-center gap-2 text-fog">
                    <span>Need bulk invites?</span>
                    <button onClick={() => alert('Bulk CSV roster import modal opened!')} className="text-on-surface underline hover:text-primary transition-colors cursor-pointer" type="button">Import CSV roster</button>
                  </div>
                  <button className="flex items-center gap-1.5 text-on-surface font-body-base-bold hover:text-primary transition-colors cursor-pointer" onClick={handleCopyInvite} type="button">
                    <span className="material-symbols-outlined text-[16px]">link</span>
                    <span id="copy-btn-text">{copyBtnText}</span>
                  </button>
                </div>
              </div>

              {/* Confirmed Reviewers List Section */}
              <div className="flex flex-col gap-space-md">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm border-b-2 border-charcoal/10 pb-space-xs">
                  <div className="flex items-center gap-3">
                    <h2 className="font-headline-sm text-headline-sm text-on-surface">Confirmed Roster</h2>
                    <span className="px-2.5 py-0.5 rounded-full bg-lumen-stone border border-charcoal/30 text-label-sm font-body-base-bold text-on-surface" id="roster-count">
                      {reviewersList.length} Active
                    </span>
                  </div>
                  {/* Filter Segment */}
                  <div className="flex items-center gap-1 bg-surface-container p-1 rounded-xl border border-charcoal/20 text-label-md">
                    <button className={`roster-tab px-3 py-1 rounded-lg transition-all cursor-pointer ${rosterFilter === 'all' ? 'bg-surface-container-lowest font-body-base-bold text-on-surface shadow-xs' : 'text-fog hover:text-on-surface'}`} onClick={() => setRosterFilter('all')} type="button">All</button>
                    <button className={`roster-tab px-3 py-1 rounded-lg transition-all cursor-pointer ${rosterFilter === 'judge' ? 'bg-surface-container-lowest font-body-base-bold text-on-surface shadow-xs' : 'text-fog hover:text-on-surface'}`} onClick={() => setRosterFilter('judge')} type="button">Judges</button>
                    <button className={`roster-tab px-3 py-1 rounded-lg transition-all cursor-pointer ${rosterFilter === 'mentor' ? 'bg-surface-container-lowest font-body-base-bold text-on-surface shadow-xs' : 'text-fog hover:text-on-surface'}`} onClick={() => setRosterFilter('mentor')} type="button">Mentors</button>
                  </div>
                </div>

                {/* Reviewer Cards */}
                <div className="flex flex-col gap-3" id="roster-list">
                  {filteredReviewers.map((rev, idx) => (
                    <div key={idx} className="reviewer-item flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 bg-surface-container-lowest border border-charcoal/15 rounded-2xl hover:bg-lumen-cream/40 transition-colors shadow-sm" data-role={rev.roleKey}>
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full border border-charcoal/10 ${rev.avatarBg} flex items-center justify-center font-headline-sm font-medium shrink-0`}>
                          {rev.initials}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-headline-sm text-[22px] text-on-surface leading-snug">{rev.name}</span>
                            <span className={`px-2 py-0.5 rounded-md ${rev.badgeBg} text-[11px] font-body-base-bold uppercase tracking-wider`}>{rev.role}</span>
                          </div>
                          <p className="font-body-base text-label-sm text-fog mt-0.5">{rev.email} · Assigned: <strong className="text-on-surface font-body-base-bold">{rev.assigned}</strong></p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between md:justify-end gap-space-md">
                        {rev.status === 'Accepted' ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-secondary/10 text-secondary border border-secondary/20 text-label-sm font-body-base-bold">
                            <span className="material-symbols-outlined text-[15px]">check_circle</span>Accepted
                          </span>
                        ) : (
                          <button className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tertiary/10 text-tertiary border border-tertiary/30 text-label-sm font-body-base-bold hover:bg-tertiary/20 transition-colors cursor-pointer" onClick={() => handleResendInvite(idx)} type="button">
                            <span className="material-symbols-outlined text-[15px]">{resendingIndex === idx ? 'send' : 'mail'}</span>
                            <span>{resendingIndex === idx ? 'Sent!' : 'Pending (Resend)'}</span>
                          </button>
                        )}
                        <button className="w-9 h-9 rounded-lg border border-charcoal/20 flex items-center justify-center text-fog hover:text-error hover:border-error transition-colors cursor-pointer" onClick={() => handleRemoveReviewer(idx)} title="Remove juror" type="button">
                          <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Essential Settings: Exactly 2 Crisp Structural Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                <div className="bg-lumen-cream border border-charcoal/15 rounded-3xl p-space-md flex flex-col justify-between shadow-sm">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-headline-sm text-[26px] text-on-surface">Scoring Privacy</span>
                      <span className="material-symbols-outlined text-fog">shield</span>
                    </div>
                    <p className="font-body-base text-label-md text-on-surface-variant mb-space-md">Control whether judges can view peer scores and comments before the collective final round.</p>
                    <div className="flex flex-col gap-2.5">
                      <label className="flex items-start gap-3 p-3.5 bg-surface-container-lowest border border-charcoal/15 rounded-xl cursor-pointer hover:bg-surface-variant transition-colors shadow-sm">
                        <input checked={privacyMode === 'blind'} onChange={() => setPrivacyMode('blind')} className="mt-1 accent-charcoal w-4 h-4 cursor-pointer" name="privacy-mode" type="radio" value="blind"/>
                        <div className="flex flex-col">
                          <span className="font-body-base-bold text-label-md text-on-surface">Blind Review (Recommended)</span>
                          <span className="font-body-base text-label-sm text-fog">Evaluators score in isolation. Scores only combine in Director view.</span>
                        </div>
                      </label>
                      <label className="flex items-start gap-3 p-3.5 bg-surface-container-lowest border border-charcoal/15 rounded-xl cursor-pointer hover:bg-surface-variant transition-colors shadow-sm">
                        <input checked={privacyMode === 'open'} onChange={() => setPrivacyMode('open')} className="mt-1 accent-charcoal w-4 h-4 cursor-pointer" name="privacy-mode" type="radio" value="open"/>
                        <div className="flex flex-col">
                          <span className="font-body-base-bold text-label-md text-on-surface">Open Deliberation</span>
                          <span className="font-body-base text-label-sm text-fog">Jury sees ongoing live scorecards and written remarks immediately.</span>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="bg-lumen-cream border border-charcoal/15 rounded-3xl p-space-md flex flex-col justify-between shadow-sm">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-headline-sm text-[26px] text-on-surface">Target Reviews per Project</span>
                      <span className="material-symbols-outlined text-fog">tune</span>
                    </div>
                    <p className="font-body-base text-label-md text-on-surface-variant mb-space-md">Algorithm assigns queues until each team reaches this exact number of completed scorecards.</p>
                    <div className="grid grid-cols-3 gap-space-sm mb-4" id="quorum-selector">
                      <button className={`quorum-btn p-3.5 border rounded-xl text-center transition-all shadow-sm cursor-pointer ${quorum === 2 ? 'border-primary/30 bg-primary-container font-body-base-bold' : 'border-charcoal/15 bg-surface-container-lowest hover:bg-surface-variant'}`} onClick={() => setQuorum(2)} type="button">
                        <span className="block font-headline-sm text-headline-sm text-on-surface">2</span>
                        <span className="block font-label-sm text-label-sm text-fog mt-1">Lean Jury</span>
                      </button>
                      <button className={`quorum-btn p-3.5 border rounded-xl text-center transition-all shadow-sm cursor-pointer ${quorum === 3 ? 'border-primary/30 bg-primary-container font-body-base-bold' : 'border-charcoal/15 bg-surface-container-lowest hover:bg-surface-variant'}`} onClick={() => setQuorum(3)} type="button">
                        <span className="block font-headline-sm text-headline-sm text-on-surface">3</span>
                        <span className="block font-label-sm text-label-sm text-on-primary-container mt-1">Recommended</span>
                      </button>
                      <button className={`quorum-btn p-3.5 border rounded-xl text-center transition-all shadow-sm cursor-pointer ${quorum === 4 ? 'border-primary/30 bg-primary-container font-body-base-bold' : 'border-charcoal/15 bg-surface-container-lowest hover:bg-surface-variant'}`} onClick={() => setQuorum(4)} type="button">
                        <span className="block font-headline-sm text-headline-sm text-on-surface">4</span>
                        <span className="block font-label-sm text-label-sm text-fog mt-1">High Precision</span>
                      </button>
                    </div>
                    <p className="text-label-sm text-fog flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">info</span>
                      <span>Based on 40 expected submissions, target requires ~{40 * quorum} total jury reviews.</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom Navigation Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-space-md pt-space-lg border-t border-charcoal/10">
                <button onClick={() => setCurrentView('tracks-rubrics')} className="w-full sm:w-auto px-6 py-3.5 rounded-xl border border-charcoal/20 bg-surface font-body-base-bold text-label-md text-on-surface hover:bg-surface-variant transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer" type="button">
                  <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                  <span>Back to Tracks &amp; Rubrics</span>
                </button>
                <div className="flex items-center gap-space-md w-full sm:w-auto">
                  <span className="hidden md:inline text-label-sm text-fog font-medium">Stage 3 of 4 Complete</span>
                  <button onClick={() => setCurrentView('schedule')} className="w-full sm:w-auto px-8 py-3.5 rounded-xl border border-primary/30 bg-primary-container text-on-surface font-body-base-bold text-label-md hover:bg-primary-fixed-dim transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer" type="button">
                    <span>Continue to Schedule &amp; Launch</span>
                    <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </main>

        <footer className="w-full bg-charcoal text-lumen-cream py-space-xl border-t-2 border-charcoal">
          <div className="max-w-[1200px] mx-auto px-gutter flex flex-col md:flex-row items-center justify-between gap-space-md">
            <div className="flex flex-col items-start gap-1">
              <span className="font-headline-sm text-headline-sm text-lumen-cream">Mango Studio</span>
              <p className="font-label-sm text-label-sm text-fog">© 2025 Mango OS Publishing. Built for Hackathon Directors and Evaluators.</p>
            </div>
            <div className="flex items-center gap-space-lg font-label-md text-label-md text-fog">
              <span className="hover:text-lumen-cream transition-colors cursor-pointer" onClick={() => setCurrentView('tracks-rubrics')}>Evaluation Rubrics</span>
              <span className="hover:text-lumen-cream transition-colors cursor-pointer">Jury Codex</span>
              <span className="hover:text-lumen-cream transition-colors cursor-pointer">Deliberation Arena</span>
              <span className="hover:text-lumen-cream transition-colors cursor-pointer">System Architecture</span>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // 4. SCHEDULE & LAUNCH PAGE (When clicking Continue to Schedule & Launch)
  if (currentView === 'schedule') {
    return (
      <div className="bg-surface font-body-base text-on-surface min-h-screen flex flex-col justify-between selection:bg-primary-container selection:text-on-primary-container">
        {/* Header */}
        <header className="fixed top-0 w-full z-50 bg-lumen-cream/90 backdrop-blur-md border-b-2 border-charcoal">
          <div className="h-20 max-w-[1200px] mx-auto px-gutter flex items-center justify-between gap-gutter">
            <div className="flex items-center gap-space-xs cursor-pointer" onClick={() => setCurrentView('explore')}>
              <div className="w-9 h-9 rounded-xl bg-tertiary-container border-2 border-charcoal flex items-center justify-center font-headline-sm text-headline-sm text-on-tertiary-container">M</div>
              <div className="flex flex-col">
                <span className="font-body-base-bold text-body-base-bold text-on-surface tracking-tight leading-none">Mango Studio</span>
                <span className="font-label-sm text-label-sm text-fog uppercase tracking-wider">Setup OS</span>
              </div>
            </div>
            <nav className="hidden lg:flex items-center gap-space-xs bg-surface-container-low p-1.5 rounded-full border-2 border-charcoal">
              <button onClick={() => setCurrentView('create-hackathon')} className="px-4 py-1.5 rounded-full font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer" type="button">01. Overview</button>
              <button onClick={() => setCurrentView('tracks-rubrics')} className="px-4 py-1.5 rounded-full font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer" type="button">02. Tracks &amp; Rubrics</button>
              <button onClick={() => setCurrentView('reviewers')} className="px-4 py-1.5 rounded-full font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer" type="button">03. Reviewers</button>
              <button className="px-4 py-1.5 rounded-full font-label-md text-label-md bg-primary-container text-on-surface border-2 border-charcoal font-body-base-bold" type="button">04. Schedule</button>
            </nav>
            <div className="flex items-center gap-space-sm">
              <button onClick={() => alert('Draft saved successfully!')} className="px-space-md py-2.5 rounded-xl border-2 border-charcoal bg-surface font-body-base-bold text-label-md text-on-surface hover:bg-surface-variant transition-colors cursor-pointer" type="button">Save Draft</button>
              <div className="w-9 h-9 rounded-full border-2 border-charcoal overflow-hidden p-0.5 bg-tertiary-fixed">
                <img alt="Profile" className="w-8 h-8 rounded-full object-cover" src="https://lh3.googleusercontent.com/aida/AEtjO1UT380eD2f4DQy2PRL7xWoutcO_zEzfLb96LbO8SE7gnXA6YR7chD3hRsdWrIFIfHezVfQuVPuf7ljeARndNmxdWm6Wu5Z_umNLLw4E5qv7h6jGHSd_EOuBEx3uDeJtfnzIcFFTgCtm55Z-2o1kuxsRwzAg0kf5-VrZcqNY10Rqh1Hkn3kD6NCq0dRru1ToLGHdDMLzmJfJrFwM6px3-bLaN2hMSMRIBT1FwTSPRTHLha2BjOWdwF-uUm88uhEuqnFkQ4Ux_bWCCuQ"/>
              </div>
            </div>
          </div>
        </header>

        <main className="w-full pt-28 sm:pt-32 bg-surface min-h-[calc(100vh-140px)] flex-1">
          <div className="flex flex-col w-full">
            <div className="max-w-[1120px] mx-auto w-full px-gutter-mobile md:px-gutter py-space-lg flex flex-col gap-space-xl">
              {/* Top Stepper Pill Navigation */}
              <div className="w-full flex items-center justify-between flex-wrap gap-space-sm bg-surface-container-low px-space-md py-space-xs rounded-full">
                <div className="flex items-center gap-space-xs overflow-x-auto py-1 flex-wrap sm:flex-nowrap">
                  <button onClick={() => setCurrentView('create-hackathon')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer" type="button">
                    <span className="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
                    <span className="text-fog">01.</span> Overview
                  </button>
                  <span className="text-fog/40 text-xs">·</span>
                  <button onClick={() => setCurrentView('tracks-rubrics')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer" type="button">
                    <span className="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
                    <span className="text-fog">02.</span> Tracks &amp; Rubrics
                  </button>
                  <span className="text-fog/40 text-xs">·</span>
                  <button onClick={() => setCurrentView('reviewers')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer" type="button">
                    <span className="material-symbols-outlined text-[16px] text-secondary">check_circle</span>
                    <span className="text-fog">03.</span> Reviewers
                  </button>
                  <span className="text-fog/40 text-xs">·</span>
                  <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-primary-container text-on-surface font-body-base-bold text-label-md">
                    <span className="w-2 h-2 rounded-full bg-tertiary"></span>
                    <span>04. Schedule &amp; Launch</span>
                  </div>
                </div>
                <div className="flex items-center gap-space-sm text-fog font-label-sm text-label-sm">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-secondary"></span> System Ready</span>
                  <span className="hidden sm:inline">|</span>
                  <span className="hidden sm:inline">Step 4 of 4</span>
                </div>
              </div>

              {/* Editorial Header & Pre-Flight Ribbon */}
              <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-space-md">
                <div className="flex flex-col gap-1 max-w-xl">
                  <span className="font-label-sm text-label-sm uppercase tracking-wider text-fog">Final Stage Execution</span>
                  <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tight">Schedule &amp; Launch</h1>
                  <p className="font-body-base text-body-base text-on-surface-variant">Set key milestones, configure automated gating, and deploy your hackathon portal.</p>
                </div>
                {/* Mascot Pre-Flight Verification Card */}
                <div className="w-full md:w-auto flex items-center gap-space-sm bg-lumen-cream p-space-sm rounded-xl max-w-md shadow-sm border border-charcoal/10">
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-tertiary-container flex-shrink-0">
                    <img alt="Mango AI Mascot with green headphones smiling gently" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBe-iqR9nsFF5zE_t3pwcv7X9muhsrICGYo9LT9cMhj2U9XZzWyUBHstZtF6qOyou3qVwHFE6polCknUoK4oO-GzHcxqvSEuxIEvR2s91su4T_8GsGv8YaA_n_c7PzTMZWLP2jgaAsqWh4nYSU7jfLVcd0KN1oRCfJ6Q6BoOVwjEXilWjo4J_RjXBdtQaFXWO6PieqPcKmuMaow6juA-MpI0ckye3UvXvdcoAg7AB74LPlY6vsR_uHe6m5Dh3fB0c4CrcI"/>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="font-body-base-bold text-label-md text-on-surface">Pre-Flight Clear</span>
                      <span className="px-1.5 py-0.5 rounded bg-secondary-container text-on-secondary-container font-label-sm text-[10px] uppercase">Verified</span>
                    </div>
                    <p className="font-label-sm text-label-sm text-on-surface-variant leading-snug">All 3 stages complete. $50k prize pool allocated, 4 judges assigned.</p>
                  </div>
                </div>
              </div>

              {/* Key Milestones Timeline (Ultra-Clean Editorial Style) */}
              <div className="bg-surface-container-lowest p-space-md md:p-space-lg rounded-[28px] shadow-sm flex flex-col gap-space-md border border-charcoal/10">
                <div className="flex items-center justify-between pb-space-xs">
                  <div className="flex items-center gap-space-xs">
                    <span className="material-symbols-outlined text-on-surface-variant">schedule</span>
                    <h2 className="font-headline-sm text-headline-sm text-on-surface">Core Milestones</h2>
                  </div>
                  <button onClick={() => alert('Time editor dialog opened: Milestones can be adjusted in UTC or Local PST timezone.')} className="flex items-center gap-1 font-label-md text-label-md text-on-surface-variant hover:text-on-surface transition-colors underline underline-offset-4 cursor-pointer" id="editTimesBtn" type="button">
                    <span className="material-symbols-outlined text-[16px]">edit_calendar</span>
                    <span>Edit Times</span>
                  </button>
                </div>
                {/* Linear Step Visualizer */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-space-sm pt-2">
                  {/* Milestone 1 */}
                  <div className="group flex flex-col justify-between p-space-sm rounded-xl bg-surface-container-low hover:bg-surface-container transition-all">
                    <div className="flex items-center justify-between mb-space-sm">
                      <span className="font-label-sm text-label-sm text-fog uppercase tracking-widest font-mono">01. Kickoff</span>
                      <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-body-base-bold text-body-base text-on-surface">Hackathon Launch</span>
                      <span className="font-label-md text-label-md text-on-surface-variant mt-1">Oct 24, 2026</span>
                      <span className="font-label-sm text-label-sm text-fog">09:00 AM PST</span>
                    </div>
                  </div>
                  {/* Milestone 2 (Code Freeze - Prominent) */}
                  <div className="group flex flex-col justify-between p-space-sm rounded-xl bg-tertiary-container/35 hover:bg-tertiary-container/50 transition-all relative">
                    <div className="flex items-center justify-between mb-space-sm">
                      <span className="font-label-sm text-label-sm text-on-tertiary-container uppercase tracking-widest font-mono">02. Submission Cutoff</span>
                      <span className="px-2 py-0.5 rounded-full bg-tertiary text-on-tertiary font-label-sm text-[10px] font-bold tracking-wider">FREEZE</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-body-base-bold text-body-base text-on-surface">Code Repository Lock</span>
                      <span className="font-label-md text-label-md text-on-surface-variant mt-1">Oct 26, 2026</span>
                      <span className="font-label-sm text-label-sm text-tertiary font-semibold">01:00 PM PST</span>
                    </div>
                  </div>
                  {/* Milestone 3 */}
                  <div className="group flex flex-col justify-between p-space-sm rounded-xl bg-surface-container-low hover:bg-surface-container transition-all">
                    <div className="flex items-center justify-between mb-space-sm">
                      <span className="font-label-sm text-label-sm text-fog uppercase tracking-widest font-mono">03. Deliberation</span>
                      <span className="w-2.5 h-2.5 rounded-full bg-primary"></span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-body-base-bold text-body-base text-on-surface">Jury Deliberation</span>
                      <span className="font-label-md text-label-md text-on-surface-variant mt-1">Oct 26, 2026</span>
                      <span className="font-label-sm text-label-sm text-fog">03:00 PM – 06:00 PM</span>
                    </div>
                  </div>
                  {/* Milestone 4 */}
                  <div className="group flex flex-col justify-between p-space-sm rounded-xl bg-surface-container-low hover:bg-surface-container transition-all">
                    <div className="flex items-center justify-between mb-space-sm">
                      <span className="font-label-sm text-label-sm text-fog uppercase tracking-widest font-mono">04. Ceremonies</span>
                      <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
                    </div>
                    <div className="flex flex-col">
                      <span className="font-body-base-bold text-body-base text-on-surface">Winner Announcement</span>
                      <span className="font-label-md text-label-md text-on-surface-variant mt-1">Oct 26, 2026</span>
                      <span className="font-label-sm text-label-sm text-fog">07:00 PM PST</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Launch Protocol (Two Crisp Side-by-Side Cards) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-space-md">
                {/* Automation Rules */}
                <div className="bg-surface-container-lowest p-space-md md:p-space-lg rounded-[28px] shadow-sm flex flex-col justify-between gap-space-md border border-charcoal/10">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-space-xs text-on-surface mb-1">
                      <span className="material-symbols-outlined text-primary">precision_manufacturing</span>
                      <h3 className="font-subheading text-subheading">Automation Rules</h3>
                    </div>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">Deterministic system gates triggered precisely on schedule.</p>
                  </div>
                  <div className="flex flex-col gap-space-sm">
                    {/* Toggle 1 */}
                    <label className="flex items-center justify-between p-space-sm rounded-xl bg-surface-container-low cursor-pointer hover:bg-surface-container transition-colors">
                      <div className="flex flex-col pr-4">
                        <span className="font-body-base-bold text-label-md text-on-surface">Auto-lock repos at deadline</span>
                        <span className="font-label-sm text-label-sm text-fog">Closes GitHub/GitLab commit access at 01:00 PM PST</span>
                      </div>
                      <input checked={autoLockRepos} onChange={(e) => setAutoLockRepos(e.target.checked)} className="w-5 h-5 accent-secondary cursor-pointer" type="checkbox"/>
                    </label>
                    {/* Toggle 2 */}
                    <label className="flex items-center justify-between p-space-sm rounded-xl bg-surface-container-low cursor-pointer hover:bg-surface-container transition-colors">
                      <div className="flex flex-col pr-4">
                        <span className="font-body-base-bold text-label-md text-on-surface">Open live WebRTC judge rooms</span>
                        <span className="font-label-sm text-label-sm text-fog">Spins up private audio-video review docks automatically</span>
                      </div>
                      <input checked={openWebRtcRooms} onChange={(e) => setOpenWebRtcRooms(e.target.checked)} className="w-5 h-5 accent-secondary cursor-pointer" type="checkbox"/>
                    </label>
                  </div>
                </div>

                {/* Visibility Protocol */}
                <div className="bg-surface-container-lowest p-space-md md:p-space-lg rounded-[28px] shadow-sm flex flex-col justify-between gap-space-md border border-charcoal/10">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-space-xs text-on-surface mb-1">
                      <span className="material-symbols-outlined text-secondary">visibility</span>
                      <h3 className="font-subheading text-subheading">Portal Visibility</h3>
                    </div>
                    <p className="font-label-sm text-label-sm text-on-surface-variant">Define how participants and sponsors discover your event.</p>
                  </div>
                  <div className="flex flex-col gap-space-sm">
                    {/* Radio Option 1 */}
                    <label className="flex items-start gap-3 p-space-sm rounded-xl bg-surface-container-low cursor-pointer hover:bg-surface-container transition-colors">
                      <input checked={portalVisibility === 'public'} onChange={() => setPortalVisibility('public')} className="mt-1 w-4 h-4 accent-secondary cursor-pointer" name="visibility" type="radio"/>
                      <div className="flex flex-col">
                        <span className="font-body-base-bold text-label-md text-on-surface">Public Directory</span>
                        <span className="font-label-sm text-label-sm text-fog">Featured on Mango Studio showcase &amp; discover feed. Open registrations.</span>
                      </div>
                    </label>
                    {/* Radio Option 2 */}
                    <label className="flex items-start gap-3 p-space-sm rounded-xl bg-surface-container-low cursor-pointer hover:bg-surface-container transition-colors">
                      <input checked={portalVisibility === 'private'} onChange={() => setPortalVisibility('private')} className="mt-1 w-4 h-4 accent-secondary cursor-pointer" name="visibility" type="radio"/>
                      <div className="flex flex-col">
                        <span className="font-body-base-bold text-label-md text-on-surface">Private / Invite-Only</span>
                        <span className="font-label-sm text-label-sm text-fog">Hidden from discovery. Access requires an authorization token or invite link.</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Sleek Compact Summary Ribbon */}
              <div className="w-full bg-lumen-cream px-space-md py-space-sm rounded-2xl flex flex-col md:flex-row items-center justify-between gap-space-sm border border-charcoal/10">
                <div className="flex items-center flex-wrap gap-x-space-md gap-y-1 text-on-surface font-label-md text-label-md">
                  <span className="font-body-base-bold">Global AI &amp; Multimodal</span>
                  <span className="text-fog">·</span>
                  <span>$50,000 Pool</span>
                  <span className="text-fog">·</span>
                  <span>4 Active Judges</span>
                  <span className="text-fog">·</span>
                  <span className="text-on-surface-variant">MIT Media Lab</span>
                </div>
                <div className="flex items-center gap-2 text-secondary font-body-base-bold text-label-md">
                  <span className="material-symbols-outlined text-[18px]">verified</span>
                  <span>Ready to publish</span>
                </div>
              </div>

              {/* Final Launch Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-space-md pt-space-xs pb-space-lg">
                <div className="flex items-center gap-space-sm w-full sm:w-auto">
                  <button onClick={() => setCurrentView('reviewers')} className="px-5 py-3 rounded-xl bg-surface-container-low text-on-surface font-label-md text-label-md hover:bg-surface-variant transition-colors flex items-center justify-center gap-1.5 w-full sm:w-auto cursor-pointer" type="button">
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    <span>Back to Reviewers</span>
                  </button>
                  <button onClick={() => alert('Draft saved successfully!')} className="px-5 py-3 rounded-xl bg-transparent text-on-surface-variant hover:text-on-surface font-label-md text-label-md transition-colors hidden md:block cursor-pointer" type="button">
                    Save as Draft
                  </button>
                </div>
                <button 
                  onClick={handleLaunchHackathon}
                  className={`w-full sm:w-auto px-space-lg py-3.5 rounded-xl font-body-base-bold text-body-base active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer ${
                    isDeployed 
                      ? 'bg-secondary-container text-on-secondary-container' 
                      : isDeploying 
                        ? 'bg-primary-container text-on-surface opacity-90 pointer-events-none' 
                        : 'bg-primary-container text-on-surface hover:bg-primary-fixed-dim'
                  }`} 
                  id="launchBtn" 
                  type="button"
                >
                  {isDeploying ? (
                    <>
                      <span>Deploying Live Infrastructure...</span>
                      <span className="material-symbols-outlined animate-spin text-[20px]">autorenew</span>
                    </>
                  ) : isDeployed ? (
                    <>
                      <span>Hackathon Live! View Portal</span>
                      <span className="material-symbols-outlined text-[20px]">check</span>
                    </>
                  ) : (
                    <>
                      <span>Launch Hackathon &amp; Deploy Portal</span>
                      <span className="text-lg">🚀</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </main>

        <footer className="w-full bg-charcoal text-lumen-cream py-space-xl border-t-2 border-charcoal">
          <div className="max-w-[1200px] mx-auto px-gutter flex flex-col md:flex-row items-center justify-between gap-space-md">
            <div className="flex flex-col items-start gap-1">
              <span className="font-headline-sm text-headline-sm text-lumen-cream">Mango Studio</span>
              <p className="font-label-sm text-label-sm text-fog">© 2025 Mango OS Publishing. Built for Hackathon Directors and Evaluators.</p>
            </div>
            <div className="flex items-center gap-space-lg font-label-md text-label-md text-fog">
              <span className="hover:text-lumen-cream transition-colors cursor-pointer" onClick={() => setCurrentView('tracks-rubrics')}>Evaluation Rubrics</span>
              <span className="hover:text-lumen-cream transition-colors cursor-pointer">Jury Codex</span>
              <span className="hover:text-lumen-cream transition-colors cursor-pointer">Deliberation Arena</span>
              <span className="hover:text-lumen-cream transition-colors cursor-pointer">System Architecture</span>
            </div>
          </div>
        </footer>

        {/* Passwords Generated Popup Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 bg-charcoal/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface rounded-3xl max-w-lg w-full p-6 md:p-8 shadow-2xl border-2 border-charcoal flex flex-col gap-5">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-secondary-container border border-charcoal/10 flex items-center justify-center overflow-hidden shrink-0">
                  <img alt="Mascot Sentinel" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBe-iqR9nsFF5zE_t3pwcv7X9muhsrICGYo9LT9cMhj2U9XZzWyUBHstZtF6qOyou3qVwHFE6polCknUoK4oO-GzHcxqvSEuxIEvR2s91su4T_8GsGv8YaA_n_c7PzTMZWLP2jgaAsqWh4nYSU7jfLVcd0KN1oRCfJ6Q6BoOVwjEXilWjo4J_RjXBdtQaFXWO6PieqPcKmuMaow6juA-MpI0ckye3UvXvdcoAg7AB74LPlY6vsR_uHe6m5Dh3fB0c4CrcI"/>
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-secondary bg-secondary-container/50 px-2.5 py-0.5 rounded-full">
                    🚀 Hackathon Live &amp; Deployed
                  </span>
                  <h3 className="font-headline-sm text-2xl text-charcoal font-bold mt-1">Generated Access Passwords</h3>
                </div>
              </div>

              <p className="text-sm text-fog leading-relaxed">
                Save these credentials. Participants, judges, and coordinators will use these keys to authenticate into their respective portals.
              </p>

              <div className="flex flex-col gap-3">
                {/* Head Password */}
                <div className="p-3.5 rounded-2xl bg-primary-container/40 border border-primary/30 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase text-primary tracking-wider">Head / Coordinator Password</span>
                      <span className="px-1.5 py-0.2 rounded bg-primary text-white text-[10px] font-bold">FULL CONTROL</span>
                    </div>
                    <div className="font-mono text-lg font-bold text-charcoal mt-0.5">{passwords.head}</div>
                  </div>
                  <button 
                    onClick={() => handleCopyKey('head', passwords.head)} 
                    className="px-3 py-1.5 rounded-xl bg-surface border border-charcoal/20 text-xs font-bold text-charcoal hover:bg-surface-variant transition flex items-center gap-1 cursor-pointer"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[15px]">{copiedKey === 'head' ? 'check' : 'content_copy'}</span>
                    <span>{copiedKey === 'head' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                {/* Member Password */}
                <div className="p-3.5 rounded-2xl bg-surface-container-low border border-charcoal/15 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase text-fog tracking-wider">Team / Member Password</span>
                      <span className="px-1.5 py-0.2 rounded bg-surface-container-high text-on-surface text-[10px] font-bold">HACKER</span>
                    </div>
                    <div className="font-mono text-lg font-bold text-charcoal mt-0.5">{passwords.member}</div>
                  </div>
                  <button 
                    onClick={() => handleCopyKey('member', passwords.member)} 
                    className="px-3 py-1.5 rounded-xl bg-surface border border-charcoal/20 text-xs font-bold text-charcoal hover:bg-surface-variant transition flex items-center gap-1 cursor-pointer"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[15px]">{copiedKey === 'member' ? 'check' : 'content_copy'}</span>
                    <span>{copiedKey === 'member' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                {/* Judge Password */}
                <div className="p-3.5 rounded-2xl bg-secondary-container/40 border border-secondary/30 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase text-secondary tracking-wider">Judge / Juror Password</span>
                      <span className="px-1.5 py-0.2 rounded bg-secondary text-white text-[10px] font-bold">SCORING</span>
                    </div>
                    <div className="font-mono text-lg font-bold text-charcoal mt-0.5">{passwords.judge}</div>
                  </div>
                  <button 
                    onClick={() => handleCopyKey('judge', passwords.judge)} 
                    className="px-3 py-1.5 rounded-xl bg-surface border border-charcoal/20 text-xs font-bold text-charcoal hover:bg-surface-variant transition flex items-center gap-1 cursor-pointer"
                    type="button"
                  >
                    <span className="material-symbols-outlined text-[15px]">{copiedKey === 'judge' ? 'check' : 'content_copy'}</span>
                    <span>{copiedKey === 'judge' ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setCurrentView('dashboard');
                  }}
                  className="w-full py-4 px-6 rounded-2xl bg-charcoal text-lumen-cream font-bold text-base hover:bg-black transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                  type="button"
                >
                  <span>Done</span>
                  <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </button>
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setCurrentView('explore');
                  }}
                  className="w-full py-2 text-xs text-fog hover:text-charcoal font-semibold transition cursor-pointer text-center"
                  type="button"
                >
                  Return to Discovery Feed
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // COMMAND CENTER DASHBOARD (Team Head Command Dashboard)
  if (currentView === 'dashboard') {
    return (
      <div className="font-sans text-on-surface antialiased bg-background min-h-screen selection:bg-primary-container selection:text-on-primary-container">
        {/* TOP HEADER */}
        <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-lumen-stone px-6 lg:px-10 h-20 flex items-center justify-between transition-all">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentView('explore')}>
              <div className="relative w-11 h-11 rounded-2xl bg-lumen-cream border border-lumen-stone overflow-hidden p-0.5 flex items-center justify-center shadow-sm">
                <img alt="Mascot Co-pilot" className="w-full h-full object-cover rounded-xl" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAZOcs5DUmombeuOGsoxqh8VSfRDikLG9XxXoGT9LJazZoomml38OJqya8f0KrWvwIFXqOU5rmaONRngFYnLnvVL1MaPF7mDmnYoiQpp038ULDrkFg1_7A0zmMnObvN0NaJMSSKLS1gL876UDe05y3ypb-_G7C-pvVyZX2MyNju08UYlqh3a5y_3hR7Luqoq2ws4BuXTcMNsARO7bHWXinpjbHjy-smagYg8CBcyQHq6k2ZFMNJP_vpklpcgwY90VB4LmQ"/>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-serif text-2xl font-medium tracking-tight text-charcoal">Global AI 2026</h1>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary-container/70 border border-secondary/20 text-secondary text-xs font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                    LIVE
                  </span>
                </div>
              </div>
            </div>
            {/* Quick stats in header */}
            <nav className="hidden md:flex items-center bg-lumen-cream/70 border border-lumen-stone p-1 rounded-full text-xs font-semibold shadow-sm ml-2">
              <button 
                onClick={() => setDashboardTab('overview')} 
                className={`px-4 py-1.5 rounded-full font-bold shadow-sm transition cursor-pointer ${
                  dashboardTab === 'overview' ? 'bg-primary-container text-on-primary-container' : 'text-fog hover:text-charcoal'
                }`} 
                type="button"
              >
                Dashboard
              </button>
              <button 
                onClick={() => setDashboardTab('teams')} 
                className={`px-4 py-1.5 rounded-full font-bold shadow-sm transition cursor-pointer flex items-center gap-1.5 ${
                  dashboardTab === 'teams' ? 'bg-primary-container text-on-primary-container' : 'text-fog hover:text-charcoal'
                }`} 
                type="button"
              >
                <span>Teams</span>
                <span className="px-1.5 py-0.2 rounded-full bg-charcoal text-white text-[10px]">{teams.length}</span>
              </button>
              <button 
                onClick={() => setDashboardTab('judges')} 
                className={`px-4 py-1.5 rounded-full font-bold shadow-sm transition cursor-pointer ${
                  dashboardTab === 'judges' ? 'bg-primary-container text-on-primary-container' : 'text-fog hover:text-charcoal'
                }`} 
                type="button"
              >
                Judges
              </button>
              <button 
                onClick={() => setDashboardTab('manage')} 
                className={`px-4 py-1.5 rounded-full font-bold shadow-sm transition cursor-pointer ${
                  dashboardTab === 'manage' ? 'bg-primary-container text-on-primary-container' : 'text-fog hover:text-charcoal'
                }`} 
                type="button"
              >
                Manage
              </button>
            </nav>
          </div>
          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2.5">
            {/* Real-time WebSocket Live Status */}
            <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>{wsConnected ? 'WebSocket Live' : 'WS Connecting...'}</span>
            </div>

            {/* Quick Link to Judge Scoring Chamber */}
            <button
              onClick={() => setCurrentView('judge-scoring')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-tertiary-container hover:bg-tertiary-fixed text-on-tertiary-fixed text-xs font-bold border border-tertiary/30 shadow-sm transition active:scale-95 cursor-pointer"
              type="button"
              title="Open Real-time Judge Scoring Chamber"
            >
              <span className="material-symbols-outlined text-base">gavel</span>
              <span className="hidden sm:inline">Judge Chamber</span>
            </button>

            {/* Quick Link to Student Team Scorecard */}
            <button
              onClick={() => setCurrentView('team-scorecard')}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-secondary-container hover:bg-secondary-container/80 text-secondary text-xs font-bold border border-secondary/30 shadow-sm transition active:scale-95 cursor-pointer"
              type="button"
              title="Open Student Team Live Scorecard"
            >
              <span className="material-symbols-outlined text-base">scoreboard</span>
              <span className="hidden sm:inline">Team Scorecard</span>
            </button>

            <button onClick={() => alert('Broadcast announcement modal: dispatch to 500+ hacker terminals')} className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-surface hover:bg-lumen-cream text-charcoal text-xs font-semibold border border-lumen-stone shadow-sm transition active:scale-95 cursor-pointer" type="button">
              <span className="material-symbols-outlined text-base text-tertiary">campaign</span>
              Broadcast
            </button>
            <button onClick={() => alert('Calling Next Team to Stage: Team LlamaAgents pings dispatched')} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary-container hover:bg-primary-container/80 text-on-primary-container text-xs font-bold border-2 border-primary/30 shadow-sm transition active:scale-95 cursor-pointer" type="button">
              <span className="material-symbols-outlined text-base">ring_volume</span>
              <span>+ Call Team</span>
            </button>
            <div className="h-6 w-px bg-lumen-stone hidden sm:block"></div>
            <button 
              onClick={() => setCurrentView('explore')} 
              className="px-3 py-1.5 rounded-full bg-lumen-stone/50 hover:bg-lumen-stone text-charcoal text-xs font-bold border border-charcoal/15 transition cursor-pointer flex items-center gap-1"
              type="button"
              title="Return to Home / Explore"
            >
              <span className="material-symbols-outlined text-sm">home</span>
              <span>Home</span>
            </button>
            <div className="flex items-center gap-2 pl-1">
              <div className="w-9 h-9 rounded-full bg-lumen-cream border border-lumen-stone flex items-center justify-center font-serif font-bold text-charcoal text-sm">
                EV
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Sub-Header Tabs */}
        <div className="flex md:hidden items-center justify-around bg-lumen-cream/90 border-b border-lumen-stone px-4 py-2 text-xs font-semibold">
          <button 
            onClick={() => setDashboardTab('overview')} 
            className={`px-3 py-1.5 rounded-full transition ${dashboardTab === 'overview' ? 'bg-primary-container text-on-primary-container font-bold' : 'text-fog'}`}
            type="button"
          >
            Dashboard
          </button>
          <button 
            onClick={() => setDashboardTab('teams')} 
            className={`px-3 py-1.5 rounded-full transition flex items-center gap-1 ${dashboardTab === 'teams' ? 'bg-primary-container text-on-primary-container font-bold' : 'text-fog'}`}
            type="button"
          >
            <span>Teams</span>
            <span className="px-1.5 py-0.2 rounded-full bg-charcoal text-white text-[10px]">{teams.length}</span>
          </button>
          <button 
            onClick={() => setDashboardTab('judges')} 
            className={`px-3 py-1.5 rounded-full transition ${dashboardTab === 'judges' ? 'bg-primary-container text-on-primary-container font-bold' : 'text-fog'}`}
            type="button"
          >
            Judges
          </button>
          <button 
            onClick={() => setDashboardTab('manage')} 
            className={`px-3 py-1.5 rounded-full transition ${dashboardTab === 'manage' ? 'bg-primary-container text-on-primary-container font-bold' : 'text-fog'}`}
            type="button"
          >
            Manage
          </button>
        </div>

        {/* TEAMS TAB: AI VISION ROSTER & ROW-WISE BAR CARDS */}
        {dashboardTab === 'teams' && (
          <TeamsHub
            teams={teams}
            onUpdateTeams={handleUpdateTeams}
            hackathonTitle={eventTitle}
            onBackToDashboard={() => setDashboardTab('overview')}
          />
        )}

        {/* OVERVIEW TAB: EVALUATION PANELS & STATS */}
        {dashboardTab === 'overview' && (
        <main className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
          {/* SECTION 1: PANELS & ACTIVE TEAMS (LIVE ROOMS STATUS) */}
          <section>
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
                <h2 className="font-serif text-xl font-normal text-charcoal">Live Evaluation Panels</h2>
                <span className="text-xs text-fog font-medium">3 Rooms In Session</span>
              </div>
              <span className="text-xs text-fog font-medium">Target Cadence: 12m pitch / 5m Q&amp;A</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Panel A */}
              <div className="p-5 rounded-[28px] bg-lumen-cream border border-lumen-stone shadow-sm flex flex-col justify-between gap-4 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-xl bg-surface border border-lumen-stone text-xs font-bold text-charcoal">Panel A</span>
                    <span className="text-xs text-fog font-medium">Multimodal AI</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-secondary text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span>
                    Pitching
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-surface border border-lumen-stone/80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-fog font-semibold uppercase tracking-wider">Presenting Now</span>
                    <span className="text-xs font-mono font-bold text-secondary">07:42 / 12:00</span>
                  </div>
                  <div className="font-serif text-xl font-medium text-charcoal mt-1">Team NeuroFlow</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-on-surface-variant font-medium">Wispr Realtime Speech Engine</span>
                    <span className="text-fog text-xs">•</span>
                    <span className="text-xs text-tertiary font-semibold">Room #A-01</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-lumen-stone/60">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-fog font-medium">Next:</span>
                    <span className="text-xs font-bold text-charcoal">Team LlamaAgents</span>
                    <span className="px-1.5 py-0.2 rounded bg-surface border border-lumen-stone text-[10px] text-fog">In Lobby</span>
                  </div>
                  <button onClick={() => alert('Pinging Team LlamaAgents to enter Room #A-01')} className="px-3 py-1 rounded-full bg-primary-container border border-primary/20 text-on-primary-container text-xs font-semibold hover:bg-primary hover:text-white transition active:scale-95 cursor-pointer">
                    Ping
                  </button>
                </div>
              </div>

              {/* Panel B */}
              <div className="p-5 rounded-[28px] bg-lumen-cream border border-lumen-stone shadow-sm flex flex-col justify-between gap-4 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-xl bg-surface border border-lumen-stone text-xs font-bold text-charcoal">Panel B</span>
                    <span className="text-xs text-fog font-medium">Autonomous Agents</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></span>
                    Q&amp;A
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-surface border border-lumen-stone/80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-fog font-semibold uppercase tracking-wider">Presenting Now</span>
                    <span className="text-xs font-mono font-bold text-tertiary">03:15 / 05:00</span>
                  </div>
                  <div className="font-serif text-xl font-medium text-charcoal mt-1">Team Cortex</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-on-surface-variant font-medium">Autonomous Sandbox Agent</span>
                    <span className="text-fog text-xs">•</span>
                    <span className="text-xs text-tertiary font-semibold">Room #B-02</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-lumen-stone/60">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-fog font-medium">Next:</span>
                    <span className="text-xs font-bold text-charcoal">Team VisionCraft</span>
                    <span className="px-1.5 py-0.2 rounded bg-surface border border-lumen-stone text-[10px] text-fog">Ready</span>
                  </div>
                  <button onClick={() => alert('Pinging Team VisionCraft to prepare for Q&A')} className="px-3 py-1 rounded-full bg-primary-container border border-primary/20 text-on-primary-container text-xs font-semibold hover:bg-primary hover:text-white transition active:scale-95 cursor-pointer">
                    Ping
                  </button>
                </div>
              </div>

              {/* Panel C */}
              <div className="p-5 rounded-[28px] bg-lumen-cream border border-lumen-stone shadow-sm flex flex-col justify-between gap-4 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-xl bg-surface border border-lumen-stone text-xs font-bold text-charcoal">Panel C</span>
                    <span className="text-xs text-fog font-medium">Infrastructure &amp; Latency</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-surface border border-lumen-stone text-charcoal text-[11px] font-bold uppercase tracking-wider flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                    Screen Share
                  </span>
                </div>
                <div className="p-3.5 rounded-2xl bg-surface border border-lumen-stone/80">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-fog font-semibold uppercase tracking-wider">Presenting Now</span>
                    <span className="text-xs font-mono font-bold text-charcoal">01:10 / 12:00</span>
                  </div>
                  <div className="font-serif text-xl font-medium text-charcoal mt-1">Team Synthetix</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-on-surface-variant font-medium">Sub-20ms WebRTC Pipeline</span>
                    <span className="text-fog text-xs">•</span>
                    <span className="text-xs text-tertiary font-semibold">Room #C-03</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-lumen-stone/60">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-fog font-medium">Next:</span>
                    <span className="text-xs font-bold text-charcoal">Team OmniCore</span>
                    <span className="px-1.5 py-0.2 rounded bg-surface border border-lumen-stone text-[10px] text-fog">In Lobby</span>
                  </div>
                  <button onClick={() => alert('Pinging Team OmniCore for screen check')} className="px-3 py-1 rounded-full bg-primary-container border border-primary/20 text-on-primary-container text-xs font-semibold hover:bg-primary hover:text-white transition active:scale-95 cursor-pointer">
                    Ping
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* 2-COLUMN MAIN MATRIX (QUEUE + PPT SUBMISSIONS & DIRECTORY + JUDGES) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT SIDE (7 Cols): QUEUE & PPT SUBMISSIONS */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              {/* SECTION 2: QUEUE & NEXT TEAM TO CALL */}
              <section className="p-6 rounded-[30px] bg-surface border border-lumen-stone shadow-sm">
                <div className="flex items-center justify-between pb-4 border-b border-lumen-stone">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-secondary text-lg">queue_music</span>
                    <div>
                      <h3 className="font-serif text-xl font-normal text-charcoal leading-none">Queue: Next Teams to Call</h3>
                      <p className="text-xs text-fog mt-0.5">Staged for incoming room handoffs</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-lumen-cream border border-lumen-stone text-xs font-bold text-charcoal">
                    4 Up Next
                  </span>
                </div>
                <div className="divide-y divide-lumen-stone/60 mt-2">
                  {/* Queue Item 1 */}
                  <div className="py-3.5 flex items-center justify-between gap-3 group">
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-center text-xs font-bold text-fog">#01</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-charcoal">Team LlamaAgents</span>
                          <span className="px-2 py-0.2 rounded bg-primary-container text-on-primary-container text-[11px] font-semibold">Panel A</span>
                        </div>
                        <span className="text-xs text-fog">Agents Track • Ready in Waiting Room</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-secondary"></span>
                      <button onClick={() => alert('Called Team LlamaAgents to Stage #A')} className="px-3.5 py-1.5 rounded-full bg-secondary text-white text-xs font-semibold hover:bg-secondary/90 transition flex items-center gap-1 active:scale-95 cursor-pointer" type="button">
                        <span className="material-symbols-outlined text-sm">notifications_active</span>
                        Call to Stage
                      </button>
                    </div>
                  </div>
                  {/* Queue Item 2 */}
                  <div className="py-3.5 flex items-center justify-between gap-3 group">
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-center text-xs font-bold text-fog">#02</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-charcoal">Team VisionCraft</span>
                          <span className="px-2 py-0.2 rounded bg-tertiary-container text-on-tertiary-container text-[11px] font-semibold">Panel B</span>
                        </div>
                        <span className="text-xs text-fog">Vision Track • Deck Synced</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-secondary"></span>
                      <button onClick={() => alert('Called Team VisionCraft to Stage #B')} className="px-3.5 py-1.5 rounded-full bg-secondary text-white text-xs font-semibold hover:bg-secondary/90 transition flex items-center gap-1 active:scale-95 cursor-pointer" type="button">
                        <span className="material-symbols-outlined text-sm">notifications_active</span>
                        Call to Stage
                      </button>
                    </div>
                  </div>
                  {/* Queue Item 3 */}
                  <div className="py-3.5 flex items-center justify-between gap-3 group">
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-center text-xs font-bold text-fog">#03</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-charcoal">Team OmniCore</span>
                          <span className="px-2 py-0.2 rounded bg-lumen-cream border border-lumen-stone text-charcoal text-[11px] font-semibold">Panel C</span>
                        </div>
                        <span className="text-xs text-fog">Infra Track • Tech Check OK</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-secondary"></span>
                      <button onClick={() => alert('Called Team OmniCore to Stage #C')} className="px-3.5 py-1.5 rounded-full bg-secondary text-white text-xs font-semibold hover:bg-secondary/90 transition flex items-center gap-1 active:scale-95 cursor-pointer" type="button">
                        <span className="material-symbols-outlined text-sm">notifications_active</span>
                        Call to Stage
                      </button>
                    </div>
                  </div>
                  {/* Queue Item 4 */}
                  <div className="py-3.5 flex items-center justify-between gap-3 group">
                    <div className="flex items-center gap-3">
                      <span className="w-6 text-center text-xs font-bold text-fog">#04</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-charcoal">Team HyperSpeech</span>
                          <span className="px-2 py-0.2 rounded bg-primary-container text-on-primary-container text-[11px] font-semibold">Panel A</span>
                        </div>
                        <span className="text-xs text-fog">Multimodal Track • PPT Ready</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-fog/60"></span>
                      <button onClick={() => alert('Ringing Team HyperSpeech hotline')} className="px-3.5 py-1.5 rounded-full bg-lumen-cream border border-lumen-stone text-charcoal text-xs font-semibold hover:bg-surface transition flex items-center gap-1 active:scale-95 cursor-pointer" type="button">
                        <span className="material-symbols-outlined text-sm">ring_volume</span>
                        Ring
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* SECTION 3: PPT / SUBMISSIONS SUBMITTED BY TEAMS */}
              <section className="p-6 rounded-[30px] bg-surface border border-lumen-stone shadow-sm">
                <div className="flex items-center justify-between pb-4 border-b border-lumen-stone">
                  <div className="flex items-center gap-2.5">
                    <span className="material-symbols-outlined text-primary text-lg">slideshow</span>
                    <div>
                      <h3 className="font-serif text-xl font-normal text-charcoal leading-none">Submitted PPT Decks &amp; Artifacts</h3>
                      <p className="text-xs text-fog mt-0.5">Verified finalist presentation assets</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-fog">Recent 5</span>
                    <span className="w-1 h-1 rounded-full bg-lumen-stone"></span>
                    <a className="text-xs text-secondary font-semibold hover:underline" href="#">All Decks</a>
                  </div>
                </div>
                <div className="overflow-x-auto mt-2">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-fog uppercase tracking-wider border-b border-lumen-stone/60">
                        <th className="py-2.5 font-semibold">Team</th>
                        <th className="py-2.5 font-semibold">Deck</th>
                        <th className="py-2.5 font-semibold">Repository</th>
                        <th className="py-2.5 font-semibold">Submitted</th>
                        <th className="py-2.5 font-semibold text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-lumen-stone/50 font-medium text-charcoal">
                      <tr className="hover:bg-lumen-cream/50 transition">
                        <td className="py-3"><div className="flex items-center gap-2"><span className="font-semibold text-charcoal">NeuroFlow</span><span className="px-1.5 py-0.2 rounded bg-primary-container text-on-primary-container text-[10px] font-semibold">Panel A</span></div></td>
                        <td className="py-3"><a className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-lumen-cream border border-lumen-stone text-charcoal font-semibold hover:bg-white transition" href="#"><span className="material-symbols-outlined text-xs text-tertiary">co_present</span> PitchDeck.pdf</a></td>
                        <td className="py-3"><span className="font-mono text-[11px] text-fog hover:text-charcoal cursor-pointer">github/neuroflow-ai</span></td>
                        <td className="py-3 text-fog">12m ago</td>
                        <td className="py-3 text-right"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-secondary text-[10px] font-bold"><span className="material-symbols-outlined text-[10px]">check</span> Verified</span></td>
                      </tr>
                      <tr className="hover:bg-lumen-cream/50 transition">
                        <td className="py-3"><div className="flex items-center gap-2"><span className="font-semibold text-charcoal">Team Cortex</span><span className="px-1.5 py-0.2 rounded bg-tertiary-container text-on-tertiary-container text-[10px] font-semibold">Panel B</span></div></td>
                        <td className="py-3"><a className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-lumen-cream border border-lumen-stone text-charcoal font-semibold hover:bg-white transition" href="#"><span className="material-symbols-outlined text-xs text-tertiary">co_present</span> Cortex_v2.pptx</a></td>
                        <td className="py-3"><span className="font-mono text-[11px] text-fog hover:text-charcoal cursor-pointer">github/cortex-core</span></td>
                        <td className="py-3 text-fog">28m ago</td>
                        <td className="py-3 text-right"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-secondary text-[10px] font-bold"><span className="material-symbols-outlined text-[10px]">check</span> Verified</span></td>
                      </tr>
                      <tr className="hover:bg-lumen-cream/50 transition">
                        <td className="py-3"><div className="flex items-center gap-2"><span className="font-semibold text-charcoal">Synthetix</span><span className="px-1.5 py-0.2 rounded bg-lumen-cream border border-lumen-stone text-charcoal text-[10px] font-semibold">Panel C</span></div></td>
                        <td className="py-3"><a className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-lumen-cream border border-lumen-stone text-charcoal font-semibold hover:bg-white transition" href="#"><span className="material-symbols-outlined text-xs text-tertiary">co_present</span> DemoDeck_Final.pdf</a></td>
                        <td className="py-3"><span className="font-mono text-[11px] text-fog hover:text-charcoal cursor-pointer">github/synthetix-rtc</span></td>
                        <td className="py-3 text-fog">41m ago</td>
                        <td className="py-3 text-right"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-secondary text-[10px] font-bold"><span className="material-symbols-outlined text-[10px]">check</span> Verified</span></td>
                      </tr>
                      <tr className="hover:bg-lumen-cream/50 transition">
                        <td className="py-3"><div className="flex items-center gap-2"><span className="font-semibold text-charcoal">LlamaAgents</span><span className="px-1.5 py-0.2 rounded bg-primary-container text-on-primary-container text-[10px] font-semibold">Panel A</span></div></td>
                        <td className="py-3"><a className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-lumen-cream border border-lumen-stone text-charcoal font-semibold hover:bg-white transition" href="#"><span className="material-symbols-outlined text-xs text-tertiary">co_present</span> Keynote_Slides.pdf</a></td>
                        <td className="py-3"><span className="font-mono text-[11px] text-fog hover:text-charcoal cursor-pointer">github/llama-swarm</span></td>
                        <td className="py-3 text-fog">55m ago</td>
                        <td className="py-3 text-right"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-secondary text-[10px] font-bold"><span className="material-symbols-outlined text-[10px]">check</span> Verified</span></td>
                      </tr>
                      <tr className="hover:bg-lumen-cream/50 transition">
                        <td className="py-3"><div className="flex items-center gap-2"><span className="font-semibold text-charcoal">VisionCraft</span><span className="px-1.5 py-0.2 rounded bg-tertiary-container text-on-tertiary-container text-[10px] font-semibold">Panel B</span></div></td>
                        <td className="py-3"><a className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-lumen-cream border border-lumen-stone text-charcoal font-semibold hover:bg-white transition" href="#"><span className="material-symbols-outlined text-xs text-tertiary">co_present</span> VisionDeck.pdf</a></td>
                        <td className="py-3"><span className="font-mono text-[11px] text-fog hover:text-charcoal cursor-pointer">github/visioncraft-ui</span></td>
                        <td className="py-3 text-fog">1h 10m ago</td>
                        <td className="py-3 text-right"><span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-secondary text-[10px] font-bold"><span className="material-symbols-outlined text-[10px]">check</span> Verified</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            {/* RIGHT SIDE (5 Cols): REGISTERED TEAMS & QUICK DIRECTORY + JUDGES */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {/* SECTION 4: REGISTERED TEAMS & QUICK DIRECTORY */}
              <section className="p-6 rounded-[30px] bg-lumen-cream border border-lumen-stone shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-lumen-stone">
                  <div>
                    <span className="text-xs font-semibold text-fog uppercase tracking-wider">Directory</span>
                    <h3 className="font-serif text-xl font-normal text-charcoal">Registered Teams</h3>
                  </div>
                  <div className="text-right">
                    <span className="font-serif text-2xl font-normal text-charcoal">{teams.length}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary-container text-secondary font-bold ml-1">
                      {teams.filter(t => t.pptStatus === 'submitted').length} PPTs In
                    </span>
                  </div>
                </div>
                {/* Quick Directory List from real state */}
                <div className="flex flex-col gap-2">
                  {teams.slice(0, 5).map((t, idx) => (
                    <div 
                      key={t.id} 
                      onClick={() => setDashboardTab('teams')}
                      className="p-3 rounded-2xl bg-surface hover:bg-white border border-lumen-stone/80 flex items-center justify-between cursor-pointer transition"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-lumen-cream border border-lumen-stone flex items-center justify-center font-bold text-xs text-charcoal">
                          {String(idx + 1).padStart(2, '0')}
                        </div>
                        <div>
                          <span className="font-semibold text-xs text-charcoal">{t.teamName}</span>
                          <div className="text-[11px] text-fog">
                            {t.totalMembers || t.members.length} Members • {t.leaderName || 'No Leader'}
                          </div>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        t.pptStatus === 'submitted' 
                          ? 'bg-secondary/10 text-secondary' 
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {t.pptStatus === 'submitted' ? 'PPT Ready' : 'PPT Missing'}
                      </span>
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => setDashboardTab('teams')} 
                  className="w-full py-2.5 px-4 rounded-2xl bg-charcoal hover:bg-black text-lumen-cream text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition active:scale-95 cursor-pointer" 
                  type="button"
                >
                  <span className="material-symbols-outlined text-sm text-secondary">document_scanner</span>
                  <span>Open Teams AI Vision Registry ({teams.length} Teams)</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </button>
              </section>

              {/* SECTION 5: JUDGE LIST */}
              <section className="p-6 rounded-[30px] bg-surface border border-lumen-stone shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-lumen-stone">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-base">gavel</span>
                    <h3 className="font-serif text-xl font-normal text-charcoal">Judges Roster</h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-secondary text-xs font-semibold">4 / 4 Online</span>
                </div>
                <div className="flex flex-col gap-2.5">
                  <div className="p-3 rounded-2xl bg-lumen-cream/70 border border-lumen-stone flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-primary-container text-on-primary-container text-[11px] font-bold">Panel A • Multimodal AI</span>
                      <span className="text-[11px] font-semibold text-secondary">12/15 Teams Attended (80%)</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-lumen-stone/60">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container font-serif font-bold text-xs flex items-center justify-center">AT</div>
                        <div>
                          <div className="font-semibold text-xs text-charcoal">Dr. Aris Thorne</div>
                          <div className="text-[11px] text-fog">Lead AI Scientist</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] text-secondary font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span> Active Room #A-01
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-lumen-cream/70 border border-lumen-stone flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-tertiary-container text-on-tertiary-container text-[11px] font-bold">Panel B • Autonomous Agents</span>
                      <span className="text-[11px] font-semibold text-tertiary">11/15 Teams Attended (73%)</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-lumen-stone/60">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-tertiary-container text-on-tertiary-container font-serif font-bold text-xs flex items-center justify-center">EV</div>
                        <div>
                          <div className="font-semibold text-xs text-charcoal">Elena Vance</div>
                          <div className="text-[11px] text-fog">Director Organizer</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] text-secondary font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span> Active Room #B-02
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-lumen-cream/70 border border-lumen-stone flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-surface border border-lumen-stone text-charcoal text-[11px] font-bold">Panel C • Infra &amp; Latency</span>
                      <span className="text-[11px] font-semibold text-secondary">10/15 Teams Attended (67%)</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-lumen-stone/60">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container font-serif font-bold text-xs flex items-center justify-center">ML</div>
                        <div>
                          <div className="font-semibold text-xs text-charcoal">Marcus Lin</div>
                          <div className="text-[11px] text-fog">Principal Engineer</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] text-secondary font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></span> Active Room #C-03
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-lumen-cream/70 border border-lumen-stone flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="px-2 py-0.5 rounded-full bg-surface border border-lumen-stone text-fog text-[11px] font-bold uppercase tracking-wider">Floater / Cross-Panel</span>
                      <span className="text-[11px] font-semibold text-fog">5 Reviews Completed</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-lumen-stone/60">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-surface border border-lumen-stone text-charcoal font-serif font-bold text-xs flex items-center justify-center">SC</div>
                        <div>
                          <div className="font-semibold text-xs text-charcoal">Sophia Chen</div>
                          <div className="text-[11px] text-fog">VC Syndicate</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-[11px] text-secondary font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span> Roaming
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* SECTION 6: REAL-TIME WEBSOCKET JUDGE MARKS & CRITIQUE FEED */}
              <section className="p-6 rounded-[30px] bg-surface border border-lumen-stone shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-lumen-stone">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-tertiary text-base">sensors</span>
                    <h3 className="font-serif text-xl font-normal text-charcoal">Live Judge Marks &amp; Telemetry</h3>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-[11px] font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      Synced via WebSockets
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentView('judge-scoring')}
                      className="px-3 py-1 rounded-full bg-tertiary-container hover:bg-tertiary-fixed text-on-tertiary-fixed text-xs font-bold transition cursor-pointer flex items-center gap-1"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-sm">edit_note</span>
                      <span>Score as Judge</span>
                    </button>
                    <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high text-charcoal text-xs font-semibold">
                      {scores.length} Submissions
                    </span>
                  </div>
                </div>

                {scores.length === 0 ? (
                  <div className="p-8 text-center text-fog text-xs rounded-2xl bg-lumen-cream/50 border border-lumen-stone">
                    No judge evaluations submitted yet. Jurors can grade teams in the Judge Chamber to push marks in real-time.
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {scores.map((sc) => (
                      <div
                        key={sc.id}
                        className="p-4 rounded-2xl bg-lumen-cream/60 border border-lumen-stone flex flex-col gap-2.5 hover:bg-lumen-cream transition"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-full bg-charcoal text-white font-serif font-bold text-xs flex items-center justify-center shrink-0">
                              {sc.totalScore.toFixed(1)}
                            </span>
                            <div>
                              <div className="font-bold text-sm text-charcoal">{sc.teamName}</div>
                              <div className="text-[11px] text-fog">Evaluated by: <strong className="text-charcoal">{sc.judgeName}</strong> • {sc.submittedAt}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-auto">
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px] uppercase tracking-wider">
                              Real-Time Consensus
                            </span>
                            <button
                              onClick={() => {
                                setActiveTeamScorecardId(sc.teamId);
                                setCurrentView('team-scorecard');
                              }}
                              className="px-2.5 py-1 rounded-lg bg-surface border border-charcoal/15 text-charcoal text-[11px] font-bold hover:bg-surface-variant transition cursor-pointer flex items-center gap-1"
                              type="button"
                            >
                              <span>View Team Scorecard</span>
                              <span className="material-symbols-outlined text-xs">arrow_forward</span>
                            </button>
                          </div>
                        </div>

                        {/* Criteria marks pills */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-lumen-stone/60 text-xs">
                          <div className="p-2 rounded-xl bg-surface border border-lumen-stone/80 flex items-center justify-between">
                            <span className="text-fog text-[11px]">Technical</span>
                            <span className="font-mono font-bold text-charcoal">{sc.technical}/10</span>
                          </div>
                          <div className="p-2 rounded-xl bg-surface border border-lumen-stone/80 flex items-center justify-between">
                            <span className="text-fog text-[11px]">Innovation</span>
                            <span className="font-mono font-bold text-charcoal">{sc.innovation}/10</span>
                          </div>
                          <div className="p-2 rounded-xl bg-surface border border-lumen-stone/80 flex items-center justify-between">
                            <span className="text-fog text-[11px]">Presentation</span>
                            <span className="font-mono font-bold text-charcoal">{sc.presentation}/10</span>
                          </div>
                          <div className="p-2 rounded-xl bg-surface border border-lumen-stone/80 flex items-center justify-between">
                            <span className="text-fog text-[11px]">Feasibility</span>
                            <span className="font-mono font-bold text-charcoal">{sc.feasibility}/10</span>
                          </div>
                        </div>

                        {sc.feedback && (
                          <div className="text-xs text-on-surface-variant bg-surface/70 p-2.5 rounded-xl border border-lumen-stone/70 italic flex items-start gap-1.5">
                            <span className="material-symbols-outlined text-sm text-secondary shrink-0 not-italic">format_quote</span>
                            <span>&ldquo;{sc.feedback}&rdquo;</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </main>
        )}

        {/* JUDGES TAB: SCORING & EVALUATION PANELS WITH TEAM DROPDOWNS */}
        {dashboardTab === 'judges' && (() => {
          const defaultPanels = [
            { id: 'panel-a', name: 'Alpha Nexus Chamber (Room #A-01)', judge: 'Dr. Aris Thorne', track: 'Multimodal AI', badgeBg: 'bg-primary-container text-on-primary-container' },
            { id: 'panel-b', name: 'Quantum Core Grid (Room #B-02)', judge: 'Elena Vance', track: 'Autonomous Agents', badgeBg: 'bg-tertiary-container text-on-tertiary-container' },
            { id: 'panel-c', name: 'Hyperion Matrix Room (Room #C-03)', judge: 'Marcus Lin', track: 'Infrastructure & Latency', badgeBg: 'bg-surface border border-lumen-stone text-charcoal' },
          ];

          const teamAssignedPanels = Array.from(new Set(teams.map(t => t.assignedPanel).filter(Boolean))) as string[];
          const allPanels = [
            ...defaultPanels,
            ...teamAssignedPanels.map((pName, i) => ({
              id: `custom-panel-${i}`,
              name: pName,
              judge: `Allotted Panel Jury #${i + 1}`,
              track: 'Allotted via Allot Panel',
              badgeBg: 'bg-secondary-container text-secondary'
            }))
          ];

          return (
            <main className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-[28px] bg-surface border border-lumen-stone shadow-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-secondary">Judging Command</span>
                    <span className="text-fog text-xs">•</span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span> WebSocket Sync Live
                    </span>
                  </div>
                  <h2 className="font-serif text-2xl font-normal text-charcoal">Judges Roster &amp; Live Deliberation Stream</h2>
                  <p className="text-xs text-fog mt-0.5">Oversee real-time scores submitted by judges, allotted panels, and student scorecards</p>
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setCurrentView('judge-scoring')}
                    className="px-4 py-2.5 rounded-xl bg-secondary hover:bg-secondary/90 text-white text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <span className="material-symbols-outlined text-base">gavel</span>
                    <span>Launch Judge Scoring Chamber</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (teams[0]) setActiveTeamScorecardId(teams[0].id);
                      setCurrentView('team-scorecard');
                    }}
                    className="px-4 py-2.5 rounded-xl bg-charcoal hover:bg-black text-lumen-cream text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <span className="material-symbols-outlined text-base">visibility</span>
                    <span>View Student Scorecard</span>
                  </button>
                </div>
              </div>

              {/* REAL-TIME LIVE SCORES STREAM CARD */}
              <div className="p-6 rounded-[28px] bg-surface border border-lumen-stone shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between pb-3 border-b border-lumen-stone">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-xl">sensors</span>
                    <h3 className="font-serif text-xl font-normal text-charcoal">
                      Live Judge Scores Stream ({scores.length} Scores Recorded)
                    </h3>
                  </div>
                  <span className="text-xs text-fog font-medium">Broadcasts to Hacker Terminals in Real Time</span>
                </div>

                {scores.length === 0 ? (
                  <p className="text-xs text-fog py-4 text-center italic">No scores submitted yet. Click "Launch Judge Scoring Chamber" above to grade a team.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                    {scores.map((s) => (
                      <div
                        key={s.id}
                        className="p-4 rounded-2xl bg-lumen-cream/70 border border-lumen-stone flex flex-col justify-between gap-2.5 text-xs hover:border-secondary/50 transition shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-bold text-sm text-charcoal block">{s.teamName}</span>
                            <span className="text-[11px] text-fog">Evaluated by {s.judgeName}</span>
                          </div>
                          <span className="px-2.5 py-1 rounded-xl bg-secondary text-white font-mono font-bold text-xs shrink-0">
                            {s.totalScore} / 10
                          </span>
                        </div>

                        <div className="grid grid-cols-4 gap-1 text-[10px] text-fog font-mono bg-surface p-2 rounded-xl border border-lumen-stone/60">
                          <span>Tech: {s.technical}</span>
                          <span>Innov: {s.innovation}</span>
                          <span>Pres: {s.presentation}</span>
                          <span>Feas: {s.feasibility}</span>
                        </div>

                        <p className="text-[11px] text-on-surface-variant italic line-clamp-2">"{s.feedback}"</p>

                        <div className="flex items-center justify-between text-[10px] text-fog pt-1 border-t border-lumen-stone/50">
                          <span className="text-emerald-700 font-semibold">✓ Live on Team Scorecard</span>
                          <span>{s.submittedAt}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {allPanels.map((panel) => {
                  const isExpanded = Boolean(expandedJudgePanels[panel.id]);
                  const panelTeams = teams.filter(t => 
                    t.assignedPanel === panel.name || 
                    (panel.id === 'panel-a' && (!t.assignedPanel || t.track?.toLowerCase().includes('voice') || t.track?.toLowerCase().includes('multimodal'))) ||
                    (panel.id === 'panel-b' && (panel.id === 'panel-b' && (!t.assignedPanel || t.track?.toLowerCase().includes('agent') || t.track?.toLowerCase().includes('vision')))) ||
                    (panel.id === 'panel-c' && (panel.id === 'panel-c' && (!t.assignedPanel || t.track?.toLowerCase().includes('infra') || t.track?.toLowerCase().includes('latency'))))
                  );

                  return (
                    <div
                      key={panel.id}
                      className={`rounded-[28px] border transition-all duration-200 overflow-hidden shadow-sm bg-lumen-cream ${
                        isExpanded ? 'border-secondary shadow-md ring-2 ring-secondary/20' : 'border-lumen-stone hover:border-secondary/40'
                      }`}
                    >
                      {/* Panel Header Card */}
                      <div
                        onClick={() => setExpandedJudgePanels(prev => ({ ...prev, [panel.id]: !prev[panel.id] }))}
                        className="p-5 flex flex-col gap-3 cursor-pointer select-none"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold truncate max-w-[220px] ${panel.badgeBg}`}>
                            {panel.name}
                          </span>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-secondary shrink-0">
                            <span>{panelTeams.length} Teams</span>
                            <span className="material-symbols-outlined text-base">
                              {isExpanded ? 'expand_less' : 'expand_more'}
                            </span>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-serif text-lg font-medium text-charcoal">{panel.judge}</h4>
                          <p className="text-xs text-fog">{panel.track}</p>
                        </div>

                        <div className="text-xs text-charcoal font-semibold border-t border-lumen-stone/80 pt-2.5 flex items-center justify-between">
                          <span className="text-fog">Click to view assigned team dropdown:</span>
                          <span className="text-secondary font-bold">{isExpanded ? 'Hide Teams' : 'Show Teams ↓'}</span>
                        </div>
                      </div>

                      {/* Dropdown Teams List */}
                      {isExpanded && (
                        <div className="px-5 pb-5 pt-2 border-t border-lumen-stone bg-surface flex flex-col gap-2 animate-fade-in">
                          <div className="flex items-center justify-between text-xs text-fog font-bold uppercase tracking-wider py-1">
                            <span>Assigned Team Name</span>
                            <span>Leader &amp; PPT Status</span>
                          </div>
                          {panelTeams.length === 0 ? (
                            <div className="py-4 text-center text-xs text-fog">
                              No teams assigned to this panel yet. Use "Allot Panel" in the Teams tab.
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                              {panelTeams.map((t, idx) => (
                                <div key={t.id} className="p-3 rounded-xl bg-lumen-cream/70 border border-lumen-stone flex items-center justify-between gap-3 text-xs">
                                  <div className="flex items-center gap-2.5 truncate">
                                    <span className="font-mono text-fog font-bold">#{idx + 1}</span>
                                    <div className="truncate">
                                      <span className="font-bold text-charcoal block truncate">{t.teamName}</span>
                                      <span className="text-[11px] text-fog truncate">Leader: {t.leaderName || 'Unassigned'}</span>
                                    </div>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                    t.pptStatus === 'submitted' ? 'bg-secondary/10 text-secondary' : 'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}>
                                    {t.pptStatus === 'submitted' ? 'PPT Ready' : 'PPT Missing'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </main>
          );
        })()}

        {/* MANAGE TAB: EVENT SETTINGS & PASSWORDS */}
        {dashboardTab === 'manage' && (
          <main className="max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">
            <div className="p-6 rounded-[28px] bg-surface border border-lumen-stone shadow-sm flex flex-col gap-5">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-secondary">Event Administration</span>
                <h2 className="font-serif text-2xl font-normal text-charcoal">Hackathon Settings &amp; Access Keys</h2>
                <p className="text-xs text-fog mt-0.5">Coordinator credentials generated during launch</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-lumen-cream border border-lumen-stone flex flex-col gap-2">
                  <span className="text-xs font-bold uppercase text-fog">Coordinator Key</span>
                  <div className="font-mono text-lg font-bold text-charcoal">{passwords.head}</div>
                  <span className="text-[11px] text-fog">Grants full admin access to this command panel</span>
                </div>
                <div className="p-4 rounded-2xl bg-lumen-cream border border-lumen-stone flex flex-col gap-2">
                  <span className="text-xs font-bold uppercase text-fog">Member / Hacker Key</span>
                  <div className="font-mono text-lg font-bold text-charcoal">{passwords.member}</div>
                  <span className="text-[11px] text-fog">Will be used by teams in the upcoming Team Module</span>
                </div>
                <div className="p-4 rounded-2xl bg-lumen-cream border border-lumen-stone flex flex-col gap-2">
                  <span className="text-xs font-bold uppercase text-fog">Judge Scoring Key</span>
                  <div className="font-mono text-lg font-bold text-charcoal">{passwords.judge}</div>
                  <span className="text-[11px] text-fog">Used by jurors to access rubric scoring cards</span>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  onClick={() => setDashboardTab('teams')}
                  className="px-5 py-2.5 rounded-xl bg-charcoal text-lumen-cream text-xs font-bold hover:bg-black transition cursor-pointer"
                >
                  Manage Teams Directory
                </button>
                <button
                  onClick={() => setCurrentView('explore')}
                  className="px-5 py-2.5 rounded-xl bg-surface border border-lumen-stone text-xs font-semibold text-charcoal hover:bg-lumen-cream transition cursor-pointer"
                >
                  Return to Discovery Feed
                </button>
              </div>
            </div>
          </main>
        )}
      </div>
    );
  }

  // 5. CREATE HACKATHON PAGE (When clicking Create New Hackathon)
  if (currentView === 'create-hackathon') {
    return (
      <div className="bg-lumen-cream font-body-base text-charcoal min-h-screen selection:bg-primary-container selection:text-on-primary-container flex flex-col justify-between">
        <header className="fixed top-0 w-full z-50 bg-lumen-cream/95 backdrop-blur-md shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
          <div className="h-20 max-w-[1200px] mx-auto px-4 lg:px-10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentView('explore')}>
                <img alt="Mango Mascot" className="w-9 h-9 rounded-full object-cover shrink-0" src="https://lh3.googleusercontent.com/aida/AEtjO1UT380eD2f4DQy2PRL7xWoutcO_zEzfLb96LbO8SE7gnXA6YR7chD3hRsdWrIFIfHezVfQuVPuf7ljeARndNmxdWm6Wu5Z_umNLLw4E5qv7h6jGHSd_EOuBEx3uDeJtfnzIcFFTgCtm55Z-2o1kuxsRwzAg0kf5-VrZcqNY10Rqh1Hkn3kD6NCq0dRru1ToLGHdDMLzmJfJrFwM6px3-bLaN2hMSMRIBT1FwTSPRTHLha2BjOWdwF-uUm88uhEuqnFkQ4Ux_bWCCuQ"/>
                <div className="flex flex-col">
                  <span className="font-headline-sm text-2xl leading-none text-charcoal tracking-tight font-semibold">Mango</span>
                  <span className="font-label-sm text-xs uppercase tracking-wider text-fog mt-0.5">Hackathon Setup Studio</span>
                </div>
              </div>
              <div className="hidden xl:block h-6 w-px bg-outline-variant/60"></div>
              <nav className="hidden lg:flex items-center gap-4 text-fog">
                <span className="transition-colors text-charcoal font-semibold text-sm cursor-pointer">01. Overview</span>
                <span className="text-outline-variant text-xs">/</span>
                <span className="font-label-md text-xs text-fog hover:text-charcoal transition-colors cursor-pointer">02. Tracks &amp; Rubrics</span>
                <span className="text-outline-variant text-xs">/</span>
                <span className="font-label-md text-xs text-fog hover:text-charcoal transition-colors cursor-pointer">03. Reviewers</span>
                <span className="text-outline-variant text-xs">/</span>
                <span className="font-label-md text-xs text-fog hover:text-charcoal transition-colors cursor-pointer">04. Schedule</span>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={() => alert('Draft saved successfully in Session Vault!')} className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-lumen-stone text-charcoal font-semibold text-xs hover:bg-surface-container-high transition-colors cursor-pointer" type="button">Save Draft</button>
              <div className="flex items-center pl-2">
                <img alt="Profile" className="w-8 h-8 rounded-full object-cover" src="https://lh3.googleusercontent.com/aida/AEtjO1UT380eD2f4DQy2PRL7xWoutcO_zEzfLb96LbO8SE7gnXA6YR7chD3hRsdWrIFIfHezVfQuVPuf7ljeARndNmxdWm6Wu5Z_umNLLw4E5qv7h6jGHSd_EOuBEx3uDeJtfnzIcFFTgCtm55Z-2o1kuxsRwzAg0kf5-VrZcqNY10Rqh1Hkn3kD6NCq0dRru1ToLGHdDMLzmJfJrFwM6px3-bLaN2hMSMRIBT1FwTSPRTHLha2BjOWdwF-uUm88uhEuqnFkQ4Ux_bWCCuQ"/>
              </div>
            </div>
          </div>
        </header>

        <main className="w-full pt-28 bg-lumen-cream flex-1">
          <div className="max-w-[1200px] w-full mx-auto px-4 lg:px-10 py-6 lg:py-10">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-secondary"></span>
                  <span className="text-xs uppercase tracking-widest text-secondary font-semibold">Chamber II • Architectural Ingestion</span>
                </div>
                <h1 className="font-headline-lg text-5xl md:text-6xl text-charcoal tracking-tight">Deploy New Event.</h1>
                <p className="text-base text-fog max-w-xl">
                  Establish cryptographic stakes, evaluation parameters, and sovereign juror roles. Changes render synchronously in the live dossier preview.
                </p>
              </div>
              <div className="flex items-center gap-2 bg-lumen-stone px-4 py-2 rounded-full self-start lg:self-auto border border-on-surface/10">
                <span className="material-symbols-outlined text-charcoal text-[18px]">verified_user</span>
                <span className="text-xs text-charcoal font-medium">Session Vault: Active</span>
                <span className="text-fog">/</span>
                <span className="text-xs text-fog uppercase font-semibold">Draft #HK-8841</span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-7 flex flex-col gap-8">
                {/* Section 01 */}
                <section className="flex flex-col gap-4">
                  <div className="flex items-baseline justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-headline-sm text-2xl text-secondary font-semibold">01</span>
                      <span className="font-bold text-charcoal">Identify your operational role</span>
                    </div>
                    <span className="text-xs uppercase tracking-wider text-tertiary bg-tertiary-container/40 px-2.5 py-0.5 rounded font-semibold">Mandatory</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      onClick={() => setCreateRole('head')}
                      className={`role-card text-left p-6 rounded-2xl transition-all cursor-pointer border-2 ${createRole === 'head' ? 'bg-primary-container border-primary shadow-sm' : 'bg-surface-container-low border-transparent hover:bg-surface-container'}`}
                      type="button"
                    >
                      <div className="flex items-start justify-between">
                        <span className={`material-symbols-outlined text-[28px] ${createRole === 'head' ? 'text-primary' : 'text-fog'}`}>gavel</span>
                        <span className={`role-radio w-5 h-5 rounded-full flex items-center justify-center ${createRole === 'head' ? 'bg-primary text-white' : 'bg-outline-variant'}`}>
                          {createRole === 'head' && <span className="w-2 h-2 rounded-full bg-primary-container"></span>}
                        </span>
                      </div>
                      <div className="mt-4">
                        <p className="font-bold text-charcoal text-base">Head / Director</p>
                        <p className="text-xs text-fog mt-1">Lead signatory, multi-sig escrow hold, full evaluation jurisdiction.</p>
                      </div>
                    </button>
                    <button
                      onClick={() => setCreateRole('core')}
                      className={`role-card text-left p-6 rounded-2xl transition-all cursor-pointer border-2 ${createRole === 'core' ? 'bg-primary-container border-primary shadow-sm' : 'bg-surface-container-low border-transparent hover:bg-surface-container'}`}
                      type="button"
                    >
                      <div className="flex items-start justify-between">
                        <span className={`material-symbols-outlined text-[28px] ${createRole === 'core' ? 'text-primary' : 'text-fog'}`}>hub</span>
                        <span className={`role-radio w-5 h-5 rounded-full flex items-center justify-center ${createRole === 'core' ? 'bg-primary text-white' : 'bg-outline-variant'}`}>
                          {createRole === 'core' && <span className="w-2 h-2 rounded-full bg-primary-container"></span>}
                        </span>
                      </div>
                      <div className="mt-4">
                        <p className="font-bold text-charcoal text-base">Core Team Member</p>
                        <p className="text-xs text-fog mt-1">Logistics coordinator, mentor dispatch, operational staging.</p>
                      </div>
                    </button>
                  </div>
                </section>

                {/* Section 02 */}
                <section className="flex flex-col gap-4 bg-surface-container-lowest p-8 rounded-[32px] border border-on-surface/10 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-headline-sm text-2xl text-secondary font-semibold">02</span>
                    <span className="font-bold text-charcoal">Core Event Identity</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-charcoal uppercase tracking-wider" htmlFor="event-title-input">Event Legal Title</label>
                    <input
                      className="w-full bg-lumen-cream text-charcoal font-headline-sm text-xl px-4 py-3 rounded-xl border border-on-surface/20 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all font-semibold"
                      id="event-title-input"
                      type="text"
                      value={eventTitle}
                      onChange={(e) => setEventTitle(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-charcoal uppercase tracking-wider" htmlFor="event-tagline-input">Dossier Purpose / Thesis</label>
                    <textarea
                      className="w-full bg-lumen-cream text-charcoal text-sm p-4 rounded-xl border border-on-surface/20 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all resize-none"
                      id="event-tagline-input"
                      rows={2}
                      value={eventTagline}
                      onChange={(e) => setEventTagline(e.target.value)}
                    />
                  </div>
                </section>

                {/* Section 03 */}
                <section className="flex flex-col gap-4 bg-surface-container-lowest p-8 rounded-[32px] border border-on-surface/10 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-headline-sm text-2xl text-secondary font-semibold">03</span>
                    <span className="font-bold text-charcoal">Venue &amp; Format Coordinates</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 flex flex-col gap-2">
                      <label className="text-xs font-semibold text-charcoal uppercase tracking-wider" htmlFor="event-location-input">Primary Staging Nexus</label>
                      <div className="flex items-center gap-2 bg-lumen-cream px-4 py-3 rounded-xl border border-on-surface/20">
                        <span className="material-symbols-outlined text-secondary shrink-0">location_on</span>
                        <input
                          className="w-full bg-transparent text-charcoal text-sm focus:outline-none font-semibold"
                          id="event-location-input"
                          type="text"
                          value={eventLocation}
                          onChange={(e) => setEventLocation(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-semibold text-charcoal uppercase tracking-wider" htmlFor="event-capacity-input">Max Builder Quorum</label>
                      <div className="flex items-center gap-2 bg-lumen-cream px-4 py-3 rounded-xl border border-on-surface/20">
                        <span className="material-symbols-outlined text-fog shrink-0">groups</span>
                        <input
                          className="w-full bg-transparent text-charcoal text-sm focus:outline-none font-semibold"
                          id="event-capacity-input"
                          type="text"
                          value={eventCapacity}
                          onChange={(e) => setEventCapacity(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-xs uppercase tracking-wider text-fog font-semibold">Hardware Tiers:</span>
                    <span className="px-3 py-1 rounded-full bg-secondary-container text-on-secondary-fixed text-xs font-semibold">A100 Clusters</span>
                    <span className="px-3 py-1 rounded-full bg-lumen-stone text-charcoal text-xs font-semibold">Whisper SDKs</span>
                    <span className="px-3 py-1 rounded-full bg-lumen-stone text-charcoal text-xs font-semibold">WebRTC Relays</span>
                  </div>
                </section>

                {/* Section 04 */}
                <section className="flex flex-col gap-4 bg-surface-container-lowest p-8 rounded-[32px] border border-on-surface/10 shadow-sm">
                  <div className="flex items-center gap-3">
                    <span className="font-headline-sm text-2xl text-secondary font-semibold">04</span>
                    <span className="font-bold text-charcoal">Timeline &amp; Deliberation Schedule</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex flex-col gap-2 p-4 rounded-2xl bg-lumen-cream border border-on-surface/10">
                      <div className="flex items-center gap-2 text-fog text-xs">
                        <span className="material-symbols-outlined text-[18px]">flag</span>
                        <span className="uppercase font-semibold">Step 01: Inception</span>
                      </div>
                      <p className="font-bold text-charcoal text-sm">Oct 24, 09:00 PST</p>
                      <span className="text-xs text-fog">Keynote &amp; Repo Forking</span>
                    </div>
                    <div className="flex flex-col gap-2 p-4 rounded-2xl bg-lumen-cream border border-on-surface/10">
                      <div className="flex items-center gap-2 text-fog text-xs">
                        <span className="material-symbols-outlined text-[18px]">terminal</span>
                        <span className="uppercase font-semibold">Step 02: Ice Freeze</span>
                      </div>
                      <p className="font-bold text-charcoal text-sm">Oct 26, 12:00 PST</p>
                      <span className="text-xs text-fog">Commit Hashes Locked</span>
                    </div>
                    <div className="flex flex-col gap-2 p-4 rounded-2xl bg-lumen-cream border border-on-surface/10">
                      <div className="flex items-center gap-2 text-tertiary text-xs">
                        <span className="material-symbols-outlined text-[18px]">lock_clock</span>
                        <span className="uppercase font-semibold">Step 03: Jury Lock</span>
                      </div>
                      <p className="font-bold text-charcoal text-sm">Oct 26, 16:30 PST</p>
                      <span className="text-xs text-tertiary font-semibold">Sovereign Quorum Vote</span>
                    </div>
                  </div>
                </section>

                {/* Section 05 */}
                <section className="flex flex-col gap-4 bg-surface-container-lowest p-8 rounded-[32px] border border-on-surface/10 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-headline-sm text-2xl text-secondary font-semibold">05</span>
                      <span className="font-bold text-charcoal">Confirmed Judges &amp; Mentors</span>
                    </div>
                    <button
                      onClick={handleAddJuror}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-lumen-cream hover:bg-lumen-stone text-charcoal text-xs font-semibold transition-colors cursor-pointer border border-on-surface/10"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-[18px]">add</span>
                      <span>Add Juror</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" id="judges-list">
                    {jurors.map((j, idx) => (
                      <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-lumen-cream border border-on-surface/10">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full ${j.color} flex items-center justify-center font-bold text-xs text-white`}>
                            {j.initials}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-charcoal text-sm leading-snug">{j.name}</span>
                            <span className="text-xs text-fog">{j.track}</span>
                          </div>
                        </div>
                        <span onClick={() => handleRemoveJuror(idx)} className="material-symbols-outlined text-outline-variant hover:text-error cursor-pointer text-[20px]">remove_circle_outline</span>
                      </div>
                    ))}
                  </div>
                </section>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 pb-8">
                  <button onClick={() => setCurrentView('register')} className="inline-flex items-center gap-2 text-fog hover:text-charcoal text-sm font-semibold transition-colors cursor-pointer" type="button">
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    <span>Return to Gateway</span>
                  </button>
                  <div className="flex items-center gap-4 w-full sm:w-auto">
                    <button onClick={() => alert('Schema validated successfully against Mango Protocol v2.4!')} className="flex-1 sm:flex-none px-6 py-3.5 rounded-xl bg-lumen-stone hover:bg-surface-container-high text-charcoal font-bold text-sm transition-all text-center cursor-pointer border border-on-surface/10" type="button">
                      Validate Schema
                    </button>
                    <button onClick={() => setCurrentView('tracks-rubrics')} className="flex-1 sm:flex-none px-8 py-3.5 rounded-xl bg-primary-container text-on-primary-fixed hover:bg-primary-fixed text-center font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm" type="button">
                      <span>Publish Hackathon Blueprint</span>
                      <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Real-Time Dossier Projection Sidebar */}
              <div className="lg:col-span-5 lg:sticky lg:top-24 flex flex-col gap-4">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs uppercase tracking-widest text-fog font-semibold">Real-Time Dossier Projection</span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-secondary bg-secondary-container/60 px-2.5 py-0.5 rounded-full font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary"></span>
                    Synchronous
                  </span>
                </div>
                <div className="relative bg-charcoal text-lumen-cream rounded-[40px] p-8 lg:p-10 overflow-hidden shadow-2xl flex flex-col gap-6 border-2 border-on-surface">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-highest/10 text-lumen-cream text-xs tracking-wider uppercase font-semibold">
                      <span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim"></span>
                      Live Preview • Draft
                    </span>
                    <span className="text-xs text-fog font-medium">Edition 2025.1</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wider text-secondary-fixed font-bold">
                      {createRole === 'head' ? 'Organized by Head Lead • Sovereign Root' : 'Organized by Operations Lead • Core Delegate'}
                    </span>
                    <h2 className="font-headline-md text-3xl text-lumen-cream leading-tight mt-1">
                      {eventTitle || 'Untitled Hackathon'}
                    </h2>
                    <p className="text-sm text-fog line-clamp-3 mt-1">
                      {eventTagline || 'No mission thesis specified yet.'}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 p-4 rounded-2xl bg-surface-container-highest/10 border border-pure-white/10">
                    <div className="flex items-center justify-between text-lumen-cream">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-secondary-fixed text-[18px]">satellite_alt</span>
                        <span className="text-sm truncate max-w-[200px] font-medium">
                          {eventLocation || 'Unspecified Venue'}
                        </span>
                      </div>
                      <span className="text-xs text-fog font-semibold">
                        {eventCapacity || 'Open Cohort'}
                      </span>
                    </div>
                    <div className="h-px bg-outline-variant/20 my-1"></div>
                    <div className="flex items-center justify-between text-fog text-xs font-semibold">
                      <span>Timeframe: Oct 24 – 26</span>
                      <span className="text-tertiary-fixed-dim">48h In-Arena Coding</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs uppercase tracking-widest text-fog font-semibold">Juror Roster Preview</span>
                      <span className="text-xs text-lumen-cream font-bold">{jurors.length} Confirmed</span>
                    </div>
                    <div className="flex items-center -space-x-3 pt-1">
                      {jurors.map((j, i) => (
                        <div key={i} className={`w-10 h-10 rounded-full ${j.color} text-white flex items-center justify-center font-bold text-xs ring-2 ring-charcoal`}>
                          {j.initials}
                        </div>
                      ))}
                      {jurors.length < 8 && (
                        <div className="w-10 h-10 rounded-full bg-surface-container-highest/20 text-fog flex items-center justify-center text-xs ring-2 ring-charcoal font-bold">
                          +{8 - jurors.length}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-surface-container-highest/15 flex items-start gap-3 mt-1 border border-pure-white/10">
                    <span className="material-symbols-outlined text-secondary-fixed text-[20px] shrink-0 mt-0.5">verified</span>
                    <div className="flex flex-col">
                      <span className="text-sm text-lumen-cream font-semibold">Smart Deliberation Protocol</span>
                      <p className="text-xs text-fog mt-0.5 leading-relaxed">
                        Anonymous score hashes prevent anchoring bias. Review rounds unlock strictly at the 16:30 lock gate.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-3xl bg-surface-container-low flex items-start gap-4 border border-on-surface/10">
                  <img alt="Mango Sentinel Helper Mascot" className="w-14 h-14 rounded-2xl object-cover shrink-0 bg-primary-container" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCzr5wm-Efk-P2O59GHEQz-O7UGQ0Uyp26cv3bAx9tJZwgXKrrDgihEEd5e_-O0NZXNIC-qldN_rky_sT4Dswb_hSKFPCXCKlgWH0ckoP32C_q0zTIRX1PmNk1UNMEJVXEk_QfSkmxJ_YwFkDZ-a3hKNk72rDPhedRhTkFRpKEex31-TofWYf6iV7ndUt-QpR9lpPrSd8x_J7Cx02UyWlhDO3od3yrVq2rhDsLAXjrm008Hmo73aUCFiv8mdYtx8EJv1tU"/>
                  <div className="flex flex-col justify-center">
                    <span className="font-bold text-charcoal text-sm">Mango Sentinel Oversight</span>
                    <p className="text-xs text-fog mt-0.5 leading-relaxed">
                      {createRole === 'head' 
                        ? 'All set! As Head Organizer, you will hold final multi-sig confirmation on the prize pool and juror qualification thresholds.' 
                        : 'Noted! As Core Team Member, your submissions will queue for Head signatory review prior to public mainnet dispatch.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        <footer className="w-full bg-charcoal text-lumen-cream py-12 mt-12 border-t border-on-surface/20">
          <div className="max-w-[1200px] mx-auto px-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="font-headline-sm text-2xl text-lumen-cream font-semibold">Mango</span>
                <span className="text-xs text-fog uppercase tracking-widest">Architectural Edition</span>
              </div>
              <p className="text-xs text-fog max-w-sm">Editorial orchestration for technical juries, hackathon leads, and collegiate decathlons.</p>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-xs text-fog font-semibold">
              <span className="hover:text-lumen-cream transition-colors cursor-pointer">Guidelines</span>
              <span className="hover:text-lumen-cream transition-colors cursor-pointer">Rubric Catalog</span>
              <span className="hover:text-lumen-cream transition-colors cursor-pointer">Support Terminal</span>
              <span className="hover:text-lumen-cream transition-colors cursor-pointer">Security &amp; Vault</span>
              <span className="text-outline">© 2025 Mango Systems</span>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // 4. REGISTER / HOST HACKATHON PAGE (When clicking Register Hackathon)
  if (currentView === 'register') {
    return (
      <div className="bg-lumen-cream font-body-base text-body-base text-on-surface antialiased min-h-screen flex flex-col justify-between">
        <header className="fixed top-0 w-full z-50 bg-lumen-cream/90 backdrop-blur-md shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
          <div className="h-20 max-w-[1200px] mx-auto px-10 flex items-center justify-between gap-6">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentView('explore')}>
              <img alt="Mango Mascot" className="w-10 h-10 rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB7SWA6cXvghxYSRwpYBg6dvVIe4ui_OJ9wZB2Dv3NvFA7YVDEE2gGfIxRR2mueV1BqBKijSZU2h-KTNcfc3G24NIw6rmlZ8zOfhNsBrqtPUfMu7-pV2oEMJ_v7uedagZhbiw8ytnxD8B8SmlwFeIL8E2ULYuAxW50gZ2O4UGVDBokikIAvmOK4PrR_EeV2qh-W9m8DAOUG4d7X4lDKy5BgxIQ5nfxp3ZmHV0yerVVo1UDxqnr7bbqCQUbMP_JKFJnxJR8"/>
              <div className="flex flex-col">
                <span className="font-headline-sm text-2xl text-on-surface tracking-tight leading-none font-semibold">Mango</span>
                <span className="text-xs text-fog uppercase tracking-widest">Hackathons</span>
              </div>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <button onClick={() => setCurrentView('explore')} className="text-on-surface-variant text-sm hover:text-on-surface transition-colors py-1.5 cursor-pointer font-semibold">Explore Hackathons</button>
              <button onClick={() => setCurrentView('register')} className="transition-colors bg-primary-container text-on-primary-container font-semibold rounded-lg px-3 py-1.5 text-sm cursor-pointer">Host Hackathon</button>
              <span className="text-on-surface-variant text-sm py-1.5 cursor-pointer hover:text-on-surface">Documentation</span>
              <span className="text-on-surface-variant text-sm py-1.5 cursor-pointer hover:text-on-surface">Support</span>
            </nav>
            <div className="flex items-center gap-4">
              <button onClick={() => setCurrentView('landing')} className="hidden sm:inline-flex items-center justify-center text-sm text-on-surface hover:text-primary transition-colors px-3 py-1.5 cursor-pointer font-semibold">Sign Out</button>
              <button onClick={() => setCurrentView('create-hackathon')} className="inline-flex items-center justify-center bg-primary-container text-on-primary-container font-semibold text-sm px-4 py-2 rounded-xl transition-transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer">Create Track</button>
              <div className="flex items-center pl-2">
                <img alt="Profile" className="w-8 h-8 rounded-full object-cover ring-2 ring-primary-container" src="https://lh3.googleusercontent.com/aida/AEtjO1UT380eD2f4DQy2PRL7xWoutcO_zEzfLb96LbO8SE7gnXA6YR7chD3hRsdWrIFIfHezVfQuVPuf7ljeARndNmxdWm6Wu5Z_umNLLw4E5qv7h6jGHSd_EOuBEx3uDeJtfnzIcFFTgCtm55Z-2o1kuxsRwzAg0kf5-VrZcqNY10Rqh1Hkn3kD6NCq0dRru1ToLGHdDMLzmJfJrFwM6px3-bLaN2hMSMRIBT1FwTSPRTHLha2BjOWdwF-uUm88uhEuqnFkQ4Ux_bWCCuQ"/>
              </div>
            </div>
          </div>
        </header>

        <main className="w-full pt-32 bg-lumen-cream flex-1">
          <div className="w-full max-w-[1200px] mx-auto px-6 md:px-10 py-10 flex flex-col gap-10">
            <header className="flex flex-col gap-4">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-end">
                <div className="lg:col-span-8 flex flex-col gap-2">
                  <h1 className="font-headline-lg text-5xl md:text-6xl text-on-surface tracking-tight">Choose your track.</h1>
                  <p className="font-body-lg text-lg text-on-surface-variant max-w-2xl">Enter an active deliberation room or deploy a new hackathon from scratch.</p>
                </div>
              </div>
            </header>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Chamber 1 */}
              <article className="bg-surface-container-lowest rounded-[36px] p-8 border border-surface-container-highest flex flex-col justify-between gap-8 shadow-sm">
                <div className="flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full bg-secondary text-on-secondary text-xs uppercase tracking-wider font-bold">Ongoing Hackathons</span>
                    <div className="flex items-center gap-1.5 text-fog text-xs">
                      <span className="w-2 h-2 rounded-full bg-tertiary"></span>
                      <span>18 Active Suites</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <h2 className="font-headline-sm text-2xl text-on-surface">Judge &amp; Coordinator Workspace</h2>
                    <p className="text-base text-on-surface-variant">Access active scoring rooms, live rubrics, and mentor queues.</p>
                  </div>
                  <ul className="flex flex-col gap-2.5">
                    <li className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low">
                      <span className="material-symbols-outlined text-secondary text-lg">timer</span>
                      <span className="text-sm text-on-surface font-medium">Live telemetry &amp; quorum locks</span>
                    </li>
                    <li className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low">
                      <span className="material-symbols-outlined text-secondary text-lg">record_voice_over</span>
                      <span className="text-sm text-on-surface font-medium">Synchronized voice rubrics</span>
                    </li>
                    <li className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-low">
                      <span className="material-symbols-outlined text-secondary text-lg">alt_route</span>
                      <span className="text-sm text-on-surface font-medium">Direct mentor dispatch</span>
                    </li>
                  </ul>
                  <div className="pt-2 flex flex-col gap-3">
                    <label className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Select Portal Credential</label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-surface-container rounded-xl">
                      <button
                        type="button"
                        onClick={() => setSelectedPortalRole('coord')}
                        className={`py-2 text-center rounded-lg text-sm transition-colors cursor-pointer font-semibold ${selectedPortalRole === 'coord' ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                      >
                        Coordinator
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedPortalRole('judge')}
                        className={`py-2 text-center rounded-lg text-sm transition-colors cursor-pointer font-semibold ${selectedPortalRole === 'judge' ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'}`}
                      >
                        Juror
                      </button>
                    </div>
                    <div className="relative flex items-center">
                      <span className="material-symbols-outlined absolute left-3.5 text-fog text-lg">key</span>
                      <input className="w-full pl-11 pr-4 py-3 bg-surface-container-low border border-surface-container-highest rounded-xl text-on-surface placeholder:text-fog text-sm focus:outline-none focus:border-secondary transition-colors" placeholder="Enter Passkey or ID (e.g. MNG-8842)" type="text" defaultValue="MNG-8842"/>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-3 pt-2">
                  <button onClick={() => alert(`Entering operational room as ${selectedPortalRole.toUpperCase()}!`)} className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-primary-container text-on-primary-container font-bold text-sm hover:opacity-95 transition-all text-center cursor-pointer shadow-sm">
                    <span>Enter Operational Room →</span>
                  </button>
                  <div className="flex items-center justify-between text-fog text-xs px-1">
                    <span>Looking for public teams?</span>
                    <button onClick={() => setCurrentView('explore')} className="text-secondary hover:underline font-medium cursor-pointer">Browse Live Catalog →</button>
                  </div>
                </div>
              </article>

              {/* Chamber 2 */}
              <article className="bg-surface-container rounded-[36px] p-8 border border-surface-container-highest flex flex-col justify-between gap-8 shadow-sm">
                <div className="flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-xs uppercase tracking-wider font-bold">Create from Scratch</span>
                    <span className="text-xs text-on-surface-variant font-semibold">Deployment Time: &lt; 10 min</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <h2 className="font-headline-sm text-2xl text-on-surface">Deploy New Hackathon</h2>
                    <p className="text-base text-on-surface-variant">Initialize an engineering sprint or global innovation summit in &lt; 10 min.</p>
                  </div>
                  <ul className="flex flex-col gap-2.5">
                    <li className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-lowest">
                      <span className="material-symbols-outlined text-tertiary text-lg">account_tree</span>
                      <span className="text-sm text-on-surface font-medium">Dual coordinator &amp; judge engine</span>
                    </li>
                    <li className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-lowest">
                      <span className="material-symbols-outlined text-tertiary text-lg">balance</span>
                      <span className="text-sm text-on-surface font-medium">Automated multi-track consensus</span>
                    </li>
                    <li className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-lowest">
                      <span className="material-symbols-outlined text-tertiary text-lg">payments</span>
                      <span className="text-sm text-on-surface font-medium">Cryptographic prize escrow</span>
                    </li>
                  </ul>
                  <div className="pt-2 flex flex-col gap-3">
                    <label className="text-xs uppercase tracking-wider text-on-surface-variant font-semibold">Select Baseline Blueprint</label>
                    <div className="flex flex-wrap gap-2">
                      {["Autonomous Agents", "ZK & Infra", "Climate & Bio", "Open Frontier"].map((bp, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedBlueprint(bp)}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                            selectedBlueprint === bp
                              ? 'border-secondary bg-secondary-container text-on-secondary-container'
                              : 'border-surface-container-highest bg-surface-container-lowest text-on-surface hover:border-secondary'
                          }`}
                        >
                          {bp}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl bg-surface-container-lowest flex items-center justify-between gap-2 text-xs text-on-surface-variant font-semibold">
                    <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center font-bold text-xs">1</span><span>Tracks</span></div>
                    <span className="text-fog">→</span>
                    <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center font-bold text-xs">2</span><span>Jurors</span></div>
                    <span className="text-fog">→</span>
                    <div className="flex items-center gap-1.5"><span className="w-5 h-5 rounded-full bg-surface-container-high text-on-surface flex items-center justify-center font-bold text-xs">3</span><span>Publish</span></div>
                  </div>
                </div>
                <div className="flex flex-col gap-3 pt-2">
                  <button onClick={() => setCurrentView('create-hackathon')} className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl bg-charcoal text-lumen-cream font-bold text-sm hover:bg-black transition-all text-center cursor-pointer shadow">
                    <span className="material-symbols-outlined text-lg">add_circle</span>
                    <span>Create New Hackathon</span>
                  </button>
                  <div className="flex items-center justify-between text-fog text-xs px-1">
                    <span>Enterprise dedicated VPC?</span>
                    <span className="text-secondary hover:underline font-medium cursor-pointer">Talk to Platform Engineering →</span>
                  </div>
                </div>
              </article>
            </section>
          </div>
        </main>

        <footer className="w-full bg-[#1a1a1a] text-[#ffffeb] border-t border-[#2a2a2a]">
          <div className="max-w-[1200px] mx-auto px-10 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-col items-center md:items-start gap-2">
              <div className="flex items-center gap-2">
                <span className="font-headline-sm text-2xl text-[#ffffeb] font-semibold">Mango OS</span>
                <span className="text-xs bg-[#2a2a2a] text-[#94d2c6] px-2 py-0.5 rounded border border-[#3a3a3a] font-semibold">v2.4 Editorial</span>
              </div>
              <p className="text-sm text-fog max-w-sm text-center md:text-left">Operational deliberation suites, rubric judging, and high-velocity developer competitions.</p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[#dcd9d9] font-semibold">
              <span onClick={() => setCurrentView('explore')} className="hover:text-[#ffffeb] transition-colors cursor-pointer">Competitions</span>
              <span onClick={() => setCurrentView('register')} className="hover:text-[#ffffeb] transition-colors cursor-pointer">Directors</span>
              <span className="hover:text-[#ffffeb] transition-colors cursor-pointer">Judging Rubrics</span>
              <span className="hover:text-[#ffffeb] transition-colors cursor-pointer">Live Dispatch</span>
            </div>
            <div className="text-xs text-fog text-center md:text-right">© 2025 Mango OS Hackathons. Broadside Edition.</div>
          </div>
        </footer>
      </div>
    );
  }

  // 1. EXPLORE & REGISTER HACKATHONS PAGE (After Login)
  if (currentView === 'explore') {
    return (
      <div className="bg-lumen-cream text-on-surface font-body-base min-h-screen">
        <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center pt-3 px-10">
          <div className="h-20 w-full max-w-[1200px] bg-surface-bright/95 backdrop-blur-md rounded-full px-6 flex items-center justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)] border border-on-surface/10">
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentView('explore')}>
              <div className="w-10 h-10 rounded-full bg-tertiary-container flex items-center justify-center overflow-hidden">
                <img alt="Mango Mascot" className="w-8 h-8 rounded-full object-cover" src="https://lh3.googleusercontent.com/aida/AEtjO1UT380eD2f4DQy2PRL7xWoutcO_zEzfLb96LbO8SE7gnXA6YR7chD3hRsdWrIFIfHezVfQuVPuf7ljeARndNmxdWm6Wu5Z_umNLLw4E5qv7h6jGHSd_EOuBEx3uDeJtfnzIcFFTgCtm55Z-2o1kuxsRwzAg0kf5-VrZcqNY10Rqh1Hkn3kD6NCq0dRru1ToLGHdDMLzmJfJrFwM6px3-bLaN2hMSMRIBT1FwTSPRTHLha2BjOWdwF-uUm88uhEuqnFkQ4Ux_bWCCuQ"/>
              </div>
              <span className="font-headline-sm text-2xl text-on-surface font-semibold tracking-tight">Mango</span>
            </div>
            <nav className="hidden lg:flex items-center gap-2 p-1">
              <button onClick={() => setCurrentView('explore')} className="px-4 py-2 transition-all bg-primary-container text-on-primary-container font-label-md text-sm rounded-full font-semibold cursor-pointer">Explore Hackathons</button>
              <button onClick={() => setCurrentView('register')} className="px-4 py-2 rounded-full font-label-md text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all cursor-pointer">Host Hackathon</button>
              <a className="px-4 py-2 rounded-full font-label-md text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all" href="#">My Registrations</a>
              <a className="px-4 py-2 rounded-full font-label-md text-sm text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-all" href="#">Leaderboard</a>
            </nav>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center bg-surface-container-low rounded-full px-4 py-2">
                <span className="material-symbols-outlined text-outline text-base mr-2">search</span>
                <input className="bg-transparent border-0 outline-none text-on-surface text-sm placeholder:text-outline w-36 focus:w-48 transition-all" placeholder="Search tracks, bounties..." type="text"/>
              </div>
              <button onClick={() => setCurrentView('landing')} className="bg-primary-container text-on-primary-fixed font-body-base-bold text-sm px-5 py-2.5 rounded-full hover:bg-primary-fixed-dim transition-all cursor-pointer">Sign Out</button>
              <div className="flex items-center pl-2">
                <img alt="Profile" className="w-8 h-8 rounded-full object-cover ring-2 ring-primary-container" src="https://lh3.googleusercontent.com/aida/AEtjO1UT380eD2f4DQy2PRL7xWoutcO_zEzfLb96LbO8SE7gnXA6YR7chD3hRsdWrIFIfHezVfQuVPuf7ljeARndNmxdWm6Wu5Z_umNLLw4E5qv7h6jGHSd_EOuBEx3uDeJtfnzIcFFTgCtm55Z-2o1kuxsRwzAg0kf5-VrZcqNY10Rqh1Hkn3kD6NCq0dRru1ToLGHdDMLzmJfJrFwM6px3-bLaN2hMSMRIBT1FwTSPRTHLha2BjOWdwF-uUm88uhEuqnFkQ4Ux_bWCCuQ"/>
              </div>
            </div>
          </div>
        </header>
        <main className="w-full max-w-[1200px] mx-auto pt-32 px-6 md:px-10 bg-lumen-cream">
          <div className="flex flex-col w-full pb-16">
            <section className="w-full pt-6 pb-10 flex flex-col items-start gap-4">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary-container/40 text-on-secondary-fixed-variant">
                <span className="w-2 h-2 rounded-full bg-secondary animate-pulse"></span>
                <span className="font-label-sm text-xs uppercase tracking-wider font-semibold">Discovery &amp; Compete • Mango Network</span>
              </div>
              <div className="flex flex-col lg:flex-row lg:items-end justify-between w-full gap-6">
                <div className="max-w-3xl">
                  <h1 className="font-headline-lg text-4xl sm:text-6xl text-on-surface tracking-tight leading-none">
                    Where builders unite &amp; ship the future.
                  </h1>
                  <p className="font-body-lg text-lg text-on-surface-variant mt-3 max-w-2xl">
                    Explore premier global engineering sprints, track verified bounties, or orchestrate high-velocity tournaments with automated rubrics.
                  </p>
                </div>
                <div className="flex items-center gap-4 px-5 py-3 rounded-full bg-surface-container-low border border-on-surface/10">
                  <div className="flex -space-x-2">
                    <img className="w-8 h-8 rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCSa6dsRJzoDOAlmAxMljeBd5JREu4zkqH-HnNgXlAuKu-UBhCGWOoIJ2n8pB0ib6akk4jbRcLgUM3szk1I2xsnb18RqtfKfpqs88nFwoJvX6r5hYpLbtYuy5255H0X3JHVNdGfITV1wzSc7CB0NSLYJBDtKsFKfDruFaSKOV_V-6qbwO3Whz10622aB9i0qmuqTPQSFHDsdyaGClJX_cIX9PETVbNJ-11apre9zOeRdnJ8aA4SH6XVRQ"/>
                    <img className="w-8 h-8 rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuD5Yaet6bAE8CtxYFl4fiJGFaPwTN-axgZuaQOf1HJZeDn8ZAB5sKMr8UMtfiwpT_5EB9dVPyeGvqnW2zQWvdxs2jIW_qfOPPu-3SdKLVxQtP_1CrVLPYLxKPDtz6BGbh7HzQgQqIzCpaZj8Js0R_W3mIEeipAfopcImKfsUuTSISlvqTusBXFPFJCIElgMXHa6wqCWKoi-p37MTntOtIKJK02gQg627I3D_oxNQ6W0vsOOotY0dMya0w"/>
                    <img className="w-8 h-8 rounded-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDHFODE8PLgRQF3C13p-ohSc32s9WFn93H5ZYSuyHxGx6D2OwIBONKHtwwyOPMYaT2LAVy_lVSH4wBozX5tN-htVIhkKJgNWnd-QR62__dURX6viENFa87lP56RKzD-apuvr6rJFV-x2BlqMvnEc1WHBrLH9CKTsF-o-Fmhp6aUPAuz45IQ9LywQStXL4JDEIO55bsHlkLHzIYzZXcsgXH63aUXy6XpDr2HrSLINNMljU8B_iHo_Y5Zxw"/>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-on-surface font-bold leading-tight">1,840 Hackers</span>
                    <span className="text-xs text-fog leading-none">Building in 14 active arenas</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Dual Primary Action Chambers (Hero Modules) */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 my-6">
              {/* Box 1: Join as Hacker */}
              <div className="lg:col-span-7 rounded-[32px] bg-secondary-fixed/20 p-8 flex flex-col justify-between relative overflow-hidden border border-secondary/20">
                <div className="flex items-start justify-between gap-4">
                  <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-pure-white text-secondary font-semibold text-xs">
                    <span className="w-2 h-2 rounded-full bg-secondary"></span>
                    <span className="uppercase tracking-wide">12 Hackathons Live Now</span>
                  </div>
                  <span className="text-xs text-on-secondary-container bg-secondary-container px-3 py-1 rounded font-semibold">Hacker Portal</span>
                </div>
                <div className="my-6 max-w-xl">
                  <h2 className="font-headline-md text-3xl text-on-surface mb-2">
                    Join an Active Hackathon
                  </h2>
                  <p className="text-base text-on-surface-variant">
                    Find high-stakes sprints, match with dream teammates via semantic skill matching, submit multimodal voice/code demos, and access direct mentor deliberation rooms.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-4">
                    {["AI Agents", "ZK & Rollups", "BioTech", "Embodied Robotics", "Voice UX"].map((tag, i) => (
                      <span key={i} className="px-3 py-1 rounded-full bg-pure-white text-xs font-semibold text-on-surface border border-on-surface/10">{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <a className="inline-flex items-center gap-2 bg-primary-container text-on-primary-fixed font-semibold text-sm px-6 py-3 rounded-xl hover:bg-primary-fixed-dim transition-transform duration-150 hover:-translate-y-0.5" href="#explore-grid">
                    <span>Find Ongoing Hackathons</span>
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                  </a>
                  <a className="inline-flex items-center gap-1 text-sm font-semibold text-secondary hover:text-on-secondary-fixed transition-colors" href="#">
                    <span className="material-symbols-outlined text-base">group_add</span>
                    <span>Quick Teammate Matcher</span>
                  </a>
                </div>
              </div>

              {/* Box 2: Host / Register (Coordinator Engine) */}
              <div className="lg:col-span-5 rounded-[32px] bg-tertiary-container/30 p-8 flex flex-col justify-between relative overflow-hidden border border-tertiary/20">
                <div className="flex items-start justify-between gap-4">
                  <div className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-pure-white text-tertiary font-semibold text-xs">
                    <span className="material-symbols-outlined text-sm">bolt</span>
                    <span className="uppercase tracking-wide">Mango OS Engine</span>
                  </div>
                  <span className="text-xs text-tertiary bg-tertiary-fixed px-3 py-1 rounded font-semibold">Chamber Protocol</span>
                </div>
                <div className="my-6">
                  <h2 className="font-headline-md text-3xl text-on-surface mb-2">
                    Host Your Hackathon
                  </h2>
                  <p className="text-base text-on-surface-variant">
                    Deploy the dual coordinator &amp; judge command engine. Automated telemetry, voice rubric consensus, instant mentor queue management, and zero spreadsheet chaos.
                  </p>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="p-3 bg-pure-white/80 rounded-xl border border-on-surface/10">
                      <span className="block font-headline-sm text-2xl text-tertiary font-bold">4×</span>
                      <span className="text-xs text-fog uppercase">Deliberation Speed</span>
                    </div>
                    <div className="p-3 bg-pure-white/80 rounded-xl border border-on-surface/10">
                      <span className="block font-headline-sm text-2xl text-on-surface font-bold">Voice</span>
                      <span className="text-xs text-fog uppercase">Scoring &amp; Transcript</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-4 pt-2">
                  <button 
                    onClick={() => setCurrentView('register')} 
                    className="inline-flex items-center gap-2 bg-tertiary-container text-on-tertiary-fixed font-semibold text-sm px-6 py-3 rounded-xl hover:bg-tertiary-fixed-dim transition-transform duration-150 hover:-translate-y-0.5 cursor-pointer"
                  >
                    <span>Register Hackathon</span>
                    <span className="material-symbols-outlined text-base">add_circle</span>
                  </button>
                  <button className="inline-flex items-center gap-1 text-sm font-semibold text-tertiary hover:text-on-tertiary-fixed-variant transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-base">play_circle</span>
                    <span>Watch Coordinator Demo</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Filter & Track Selector Bar */}
            <section className="w-full mt-8 mb-6 flex flex-col gap-4" id="explore-grid">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
                <div className="flex-1 flex items-center bg-surface-container-lowest rounded-2xl px-5 py-2 max-w-xl border border-on-surface/10">
                  <span className="material-symbols-outlined text-outline text-base mr-2">search</span>
                  <input className="w-full bg-transparent border-0 outline-none text-sm text-on-surface placeholder:text-outline py-2" placeholder="Search hackathons by track, host, prize pool, or tech stack..." type="text"/>
                  <span className="text-xs text-fog px-2 py-0.5 bg-surface-container rounded ml-2 font-semibold">⌘K</span>
                </div>
                <div className="flex items-center gap-3 self-end lg:self-center">
                  <span className="text-xs text-fog font-semibold uppercase">Sort by:</span>
                  <div className="relative inline-block">
                    <select className="appearance-none bg-surface-container-lowest text-on-surface text-sm pl-4 pr-10 py-2.5 rounded-xl border border-on-surface/10 cursor-pointer outline-none font-semibold">
                      <option>Highest Prize Pool</option>
                      <option>Submission Deadline</option>
                      <option>Most Hacker Interest</option>
                      <option>Recently Added</option>
                    </select>
                    <span className="material-symbols-outlined text-outline text-base absolute right-3 top-3 pointer-events-none">expand_more</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                {["All Sprints", "Closing Soon", "GenAI & Voice Agents", "Decentralized Systems", "Hardware & Robotics", "BioEngineering"].map((tab, idx) => (
                  <button key={idx} className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors shrink-0 cursor-pointer ${idx === 0 ? 'bg-inverse-surface text-inverse-on-surface' : 'bg-surface-container-lowest text-on-surface hover:bg-surface-container'}`}>
                    {tab}
                  </button>
                ))}
              </div>
            </section>

            {/* Hackathon Poster Cards Grid */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6">
              {/* Newly Created Hackathon Cards */}
              {createdHackathons.map((hackathon) => (
                <article key={hackathon.id} className="rounded-[32px] bg-charcoal text-pure-white p-8 flex flex-col justify-between relative overflow-hidden group border-2 border-secondary shadow-xl">
                  <div className="absolute -right-20 -top-20 w-64 h-64 bg-secondary/40 rounded-full blur-3xl pointer-events-none"></div>
                  <div>
                    <div className="flex items-center justify-between gap-4 mb-6">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded bg-secondary text-pure-white text-xs uppercase font-semibold tracking-wider">
                          Created Hackathon • Live
                        </span>
                        <span className="text-xs text-fog">Chamber #01</span>
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/20 text-secondary-fixed border border-secondary/40">
                        <span className="w-2 h-2 rounded-full bg-secondary-fixed animate-ping"></span>
                        <span className="text-xs font-bold uppercase">{hackathon.createdAt}</span>
                      </div>
                    </div>
                    <div className="mb-6">
                      <div className="inline-block px-4 py-1 rounded-full bg-secondary-container text-on-secondary-container font-headline-sm text-xl font-bold mb-2">
                        {hackathon.prizePool}
                      </div>
                      <h3 className="font-headline-md text-3xl text-pure-white mt-2 leading-tight">
                        {hackathon.title}
                      </h3>
                      <p className="text-base text-fog mt-2">
                        {hackathon.tagline}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 py-4 my-4 bg-pure-white/5 rounded-2xl px-4 border border-pure-white/10">
                      <div>
                        <span className="block text-xs text-fog uppercase">Deliberation</span>
                        <span className="text-sm font-bold text-pure-white">3 Rooms Active</span>
                      </div>
                      <div>
                        <span className="block text-xs text-fog uppercase">Format</span>
                        <span className="text-sm font-bold text-pure-white">Virtual &amp; Hybrid</span>
                      </div>
                      <div>
                        <span className="block text-xs text-fog uppercase">Passcodes</span>
                        <span className="text-sm font-bold text-pure-white">Head • Judge • Team</span>
                      </div>
                    </div>
                    {/* Passkeys Bar */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-3 px-3 rounded-2xl bg-pure-white/5 my-2 border border-pure-white/10 text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-fog uppercase">Head / Coord Key</span>
                        <div className="flex items-center justify-between bg-white/10 px-2 py-1 rounded">
                          <span className="font-mono font-bold text-white text-xs">{hackathon.passwords.head}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyKey('head', hackathon.passwords.head)}
                            className="text-[10px] text-secondary hover:text-white"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-fog uppercase">Judge Scoring Key</span>
                        <div className="flex items-center justify-between bg-white/10 px-2 py-1 rounded">
                          <span className="font-mono font-bold text-secondary-fixed text-xs">{hackathon.passwords.judge}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyKey('judge', hackathon.passwords.judge)}
                            className="text-[10px] text-secondary hover:text-white"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-fog uppercase">Team Join Key</span>
                        <div className="flex items-center justify-between bg-white/10 px-2 py-1 rounded">
                          <span className="font-mono font-bold text-tertiary-fixed text-xs">{hackathon.passwords.member}</span>
                          <button
                            type="button"
                            onClick={() => handleCopyKey('member', hackathon.passwords.member)}
                            className="text-[10px] text-secondary hover:text-white"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3 Role Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-5 border-t border-pure-white/10 mt-2">
                    <button 
                      onClick={() => {
                        setActiveScoringHackathonId(hackathon.id);
                        setPasswords(hackathon.passwords);
                        setShowJoinModal(true);
                        setJoinStep('team-join');
                      }} 
                      className="flex-1 min-w-[130px] bg-secondary hover:bg-secondary/90 text-pure-white font-bold text-xs py-3 rounded-xl transition-colors text-center cursor-pointer flex items-center justify-center gap-1.5 shadow"
                    >
                      <span className="material-symbols-outlined text-base">group_add</span>
                      <span>Join as Team</span>
                    </button>

                    <button 
                      onClick={() => {
                        setActiveScoringHackathonId(hackathon.id);
                        setPasswords(hackathon.passwords);
                        setCurrentView('judge-scoring');
                      }} 
                      className="flex-1 min-w-[130px] bg-tertiary-container hover:bg-tertiary-fixed text-on-tertiary-fixed font-bold text-xs py-3 rounded-xl transition-colors text-center cursor-pointer flex items-center justify-center gap-1.5 shadow"
                    >
                      <span className="material-symbols-outlined text-base">gavel</span>
                      <span>Judge Scoring</span>
                    </button>

                    <button 
                      onClick={() => {
                        setActiveScoringHackathonId(hackathon.id);
                        setPasswords(hackathon.passwords);
                        setShowJoinModal(true);
                        setJoinStep('coord-password');
                      }} 
                      className="flex-1 min-w-[130px] bg-surface-container-high hover:bg-surface-container-highest text-charcoal font-bold text-xs py-3 rounded-xl transition-colors text-center cursor-pointer flex items-center justify-center gap-1.5 shadow"
                    >
                      <span className="material-symbols-outlined text-base">admin_panel_settings</span>
                      <span>Coordinator</span>
                    </button>
                  </div>
                </article>
              ))}

              {/* Card 1 */}
              <article className="rounded-[32px] bg-charcoal text-pure-white p-8 flex flex-col justify-between relative overflow-hidden group border-2 border-on-surface">
                <div className="absolute -right-20 -top-20 w-64 h-64 bg-secondary/30 rounded-full blur-3xl pointer-events-none"></div>
                <div>
                  <div className="flex items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded bg-secondary text-pure-white text-xs uppercase font-semibold tracking-wider">Wispr × Mango Labs</span>
                      <span className="text-xs text-fog">Chamber #09</span>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pure-white/10 text-tertiary-fixed">
                      <span className="w-2 h-2 rounded-full bg-tertiary-fixed animate-ping"></span>
                      <span className="text-xs font-bold">LIVE • 36h Left</span>
                    </div>
                  </div>
                  <div className="mb-6">
                    <div className="inline-block px-4 py-1 rounded-full bg-tertiary-container text-on-tertiary-container font-headline-sm text-xl font-bold mb-2">
                      $120,000 Prize Pool
                    </div>
                    <h3 className="font-headline-md text-3xl text-pure-white mt-2 leading-tight">
                      Global Voice &amp; Multimodal AI Sprint
                    </h3>
                    <p className="text-base text-fog mt-2">
                      Design real-time speech-to-intent pipelines, local whisper edge runners, and emotional synthesis agents. Evaluated with real-time judge telemetry.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 py-4 my-4 bg-pure-white/5 rounded-2xl px-4 border border-pure-white/10">
                    <div>
                      <span className="block text-xs text-fog uppercase">Teams Competing</span>
                      <span className="text-sm font-bold text-pure-white">142 Active</span>
                    </div>
                    <div>
                      <span className="block text-xs text-fog uppercase">Format</span>
                      <span className="text-sm font-bold text-pure-white">SF &amp; Virtual</span>
                    </div>
                    <div>
                      <span className="block text-xs text-fog uppercase">Guest Jurors</span>
                      <span className="text-sm font-bold text-pure-white">Anthropic / Wispr</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-pure-white/5 my-2 border border-pure-white/10">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary-fixed text-base">mic</span>
                      <span className="text-xs text-fog">Voice Deliberation Feed: Active</span>
                    </div>
                    <div className="flex items-center gap-1 h-5">
                      <span className="w-1 bg-secondary-fixed rounded-full h-3 animate-pulse"></span>
                      <span className="w-1 bg-secondary-fixed rounded-full h-5 animate-pulse"></span>
                      <span className="w-1 bg-secondary-fixed rounded-full h-2 animate-pulse"></span>
                      <span className="w-1 bg-secondary-fixed rounded-full h-4 animate-pulse"></span>
                      <span className="w-1 bg-secondary-fixed rounded-full h-1"></span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <button 
                    onClick={() => setCurrentView('register')} 
                    className="flex-1 bg-primary-container text-on-primary-fixed font-bold text-sm py-3.5 rounded-xl hover:bg-primary-fixed-dim transition-colors text-center cursor-pointer"
                  >
                    Register Team
                  </button>
                  <button aria-label="Bookmark Hackathon" className="w-12 h-12 rounded-xl bg-pure-white/10 hover:bg-pure-white/20 flex items-center justify-center text-pure-white transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-base">bookmark_border</span>
                  </button>
                  <button aria-label="Share Hackathon" className="w-12 h-12 rounded-xl bg-pure-white/10 hover:bg-pure-white/20 flex items-center justify-center text-pure-white transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-base">ios_share</span>
                  </button>
                </div>
              </article>

              {/* Card 2 */}
              <article className="rounded-[32px] bg-surface-container-lowest p-8 flex flex-col justify-between relative group border-2 border-on-surface/10">
                <div>
                  <div className="flex items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded bg-secondary-container text-on-secondary-container text-xs uppercase font-semibold tracking-wider">MIT &amp; Stanford Guild</span>
                      <span className="text-xs text-fog">Physical AI Track</span>
                    </div>
                    <span className="text-xs text-secondary font-bold bg-secondary-fixed/30 px-3 py-1 rounded-full">
                      Starts in 4 Days
                    </span>
                  </div>
                  <div className="mb-6">
                    <div className="inline-block px-4 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-headline-sm text-xl font-bold mb-2">
                      $85,000 + Jetson Grants
                    </div>
                    <h3 className="font-headline-md text-3xl text-on-surface mt-2 leading-tight">
                      Autonomous Agents &amp; Robotics Invitational
                    </h3>
                    <p className="text-base text-on-surface-variant mt-2">
                      Tackle vision-language-action (VLA) models, ROS2 micro-controllers, and autonomous spatial drone mapping with hardware sandbox access.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 py-4 my-4 bg-surface-container-low rounded-2xl px-4 border border-on-surface/10">
                    <div>
                      <span className="block text-xs text-fog uppercase">Accepted Hackers</span>
                      <span className="text-sm font-bold text-on-surface">480 Builders</span>
                    </div>
                    <div>
                      <span className="block text-xs text-fog uppercase">Hardware Lab</span>
                      <span className="text-sm font-bold text-on-surface">Nvidia Orin Kits</span>
                    </div>
                    <div>
                      <span className="block text-xs text-fog uppercase">Rubric Key</span>
                      <span className="text-sm font-bold text-on-surface">Sim2Real Latency</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 my-2">
                    {["Embodied AI", "Drone Swarms", "Local SLAM"].map((t, i) => (
                      <span key={i} className="px-3 py-1 rounded bg-surface-container text-on-surface text-xs font-semibold">{t}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <button 
                    onClick={() => setCurrentView('register')} 
                    className="flex-1 bg-surface-container-high text-on-surface font-bold text-sm py-3.5 rounded-xl hover:bg-surface-container-highest transition-colors text-center cursor-pointer"
                  >
                    Register Team
                  </button>
                  <button aria-label="Bookmark Hackathon" className="w-12 h-12 rounded-xl bg-surface-container-low hover:bg-surface-container flex items-center justify-center text-on-surface transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-base">bookmark_border</span>
                  </button>
                  <button aria-label="Share Hackathon" className="w-12 h-12 rounded-xl bg-surface-container-low hover:bg-surface-container flex items-center justify-center text-on-surface transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-base">ios_share</span>
                  </button>
                </div>
              </article>

              {/* Card 3 */}
              <article className="rounded-[32px] bg-primary-fixed/25 p-8 flex flex-col justify-between relative group border-2 border-on-surface/10">
                <div>
                  <div className="flex items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded bg-primary text-on-primary text-xs uppercase font-semibold tracking-wider">ETHGlobal • Paradigm</span>
                      <span className="text-xs text-on-primary-fixed-variant">Privacy Track</span>
                    </div>
                    <span className="text-xs text-on-primary-container font-bold bg-primary-container px-3 py-1 rounded-full">
                      Submissions Open
                    </span>
                  </div>
                  <div className="mb-6">
                    <div className="inline-block px-4 py-1 rounded-full bg-primary-container text-on-primary-fixed font-headline-sm text-xl font-bold mb-2">
                      $150,000 in Grants
                    </div>
                    <h3 className="font-headline-md text-3xl text-on-surface mt-2 leading-tight">
                      Zero-Knowledge &amp; Decentralized Infra Summit
                    </h3>
                    <p className="text-base text-on-surface-variant mt-2">
                      Construct recursive zk-SNARK circuits, sovereign rollups, verifiable credential vaults, and censorship-resistant data availability layers.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 py-4 my-4 bg-pure-white/70 rounded-2xl px-4 border border-on-surface/10">
                    <div>
                      <span className="block text-xs text-fog uppercase">Format</span>
                      <span className="text-sm font-bold text-on-surface">Fully Remote</span>
                    </div>
                    <div>
                      <span className="block text-xs text-fog uppercase">Hiring Partners</span>
                      <span className="text-sm font-bold text-on-surface">18 Venture Funds</span>
                    </div>
                    <div>
                      <span className="block text-xs text-fog uppercase">Verification</span>
                      <span className="text-sm font-bold text-on-surface">On-chain Proof</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 my-2">
                    {["Circom", "Halo2", "Rust DA"].map((t, i) => (
                      <span key={i} className="px-3 py-1 rounded bg-pure-white text-on-surface text-xs font-semibold">{t}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <button 
                    onClick={() => setCurrentView('register')} 
                    className="flex-1 bg-primary text-on-primary font-bold text-sm py-3.5 rounded-xl hover:bg-on-surface transition-colors text-center cursor-pointer"
                  >
                    Register Team
                  </button>
                  <button aria-label="Bookmark Hackathon" className="w-12 h-12 rounded-xl bg-pure-white/80 hover:bg-pure-white flex items-center justify-center text-on-surface transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-base">bookmark_border</span>
                  </button>
                  <button aria-label="Share Hackathon" className="w-12 h-12 rounded-xl bg-pure-white/80 hover:bg-pure-white flex items-center justify-center text-on-surface transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-base">ios_share</span>
                  </button>
                </div>
              </article>

              {/* Card 4 */}
              <article className="rounded-[32px] bg-secondary-fixed-dim/20 p-8 flex flex-col justify-between relative group border-2 border-on-surface/10">
                <div>
                  <div className="flex items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded bg-secondary text-pure-white text-xs uppercase font-semibold tracking-wider">Arc Institute • YC Bio</span>
                      <span className="text-xs text-on-surface-variant">Applied Genomics</span>
                    </div>
                    <span className="text-xs text-tertiary font-bold bg-tertiary-fixed px-3 py-1 rounded-full">
                      Early Bird Open
                    </span>
                  </div>
                  <div className="mb-6">
                    <div className="inline-block px-4 py-1 rounded-full bg-tertiary-container text-on-tertiary-fixed font-headline-sm text-xl font-bold mb-2">
                      $60,000 Prize Pool
                    </div>
                    <h3 className="font-headline-md text-3xl text-on-surface mt-2 leading-tight">
                      Next-Gen BioEngineering &amp; Longevity Hack
                    </h3>
                    <p className="text-base text-on-surface-variant mt-2">
                      Harness foundation models for de-novo protein generation, accelerated CRISPR target scoring, and biological longevity biomarker analysis.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-3 py-4 my-4 bg-pure-white/70 rounded-2xl px-4 border border-on-surface/10">
                    <div>
                      <span className="block text-xs text-fog uppercase">Location</span>
                      <span className="text-sm font-bold text-on-surface">Kendall Sq &amp; Hybrid</span>
                    </div>
                    <div>
                      <span className="block text-xs text-fog uppercase">Compute</span>
                      <span className="text-sm font-bold text-on-surface">H100 Node Cluster</span>
                    </div>
                    <div>
                      <span className="block text-xs text-fog uppercase">Mentors</span>
                      <span className="text-sm font-bold text-on-surface">Computational Bio PhDs</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 my-2">
                    {["ESMFold", "RNA-seq", "Synthetic Bio"].map((t, i) => (
                      <span key={i} className="px-3 py-1 rounded bg-pure-white text-on-surface text-xs font-semibold">{t}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <button 
                    onClick={() => setCurrentView('register')} 
                    className="flex-1 bg-on-surface text-pure-white font-bold text-sm py-3.5 rounded-xl hover:bg-charcoal transition-colors text-center cursor-pointer"
                  >
                    Join Sprint
                  </button>
                  <button aria-label="Bookmark Hackathon" className="w-12 h-12 rounded-xl bg-pure-white/80 hover:bg-pure-white flex items-center justify-center text-on-surface transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-base">bookmark_border</span>
                  </button>
                  <button aria-label="Share Hackathon" className="w-12 h-12 rounded-xl bg-pure-white/80 hover:bg-pure-white flex items-center justify-center text-on-surface transition-colors cursor-pointer">
                    <span className="material-symbols-outlined text-base">ios_share</span>
                  </button>
                </div>
              </article>
            </section>

            {/* Live Judging Arena Preview */}
            <section className="my-8 p-8 rounded-[32px] bg-surface-container-low flex flex-col md:flex-row items-center justify-between gap-6 border border-on-surface/10">
              <div className="flex items-center gap-6">
                <div className="w-14 h-14 rounded-2xl bg-secondary-container flex items-center justify-center text-on-secondary-container shrink-0">
                  <span className="material-symbols-outlined text-3xl">gavel</span>
                </div>
                <div>
                  <h4 className="font-headline-sm text-2xl text-on-surface">Deliberation Protocol Live</h4>
                  <p className="text-base text-on-surface-variant max-w-lg mt-1">
                    Judge evaluations are scored via cryptographic consensus. Direct voice transcript memos and weighted rubric scoring prevent review bias.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-fog uppercase font-semibold">Coordinator Status: Active</span>
                <button className="px-6 py-3 rounded-xl bg-pure-white text-on-surface font-bold text-sm hover:bg-surface-container-high transition-colors cursor-pointer border border-on-surface/10">
                  Read Judging Matrix
                </button>
              </div>
            </section>

            {/* Quick Stats Footer Banner */}
            <section className="w-full mt-6 pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-on-surface-variant text-xs border-t border-on-surface/10">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
                <span className="font-semibold">Trusted by 18,000+ builders worldwide • 100% automated judging verification</span>
              </div>
              <div className="flex items-center gap-6 font-semibold">
                <a className="hover:text-on-surface transition-colors cursor-pointer" href="#">Organizers Handbook</a>
                <span>•</span>
                <a className="hover:text-on-surface transition-colors cursor-pointer" href="#">Bounty Escrow Policy</a>
                <span>•</span>
                <a className="hover:text-on-surface transition-colors cursor-pointer" href="#">API &amp; Webhooks</a>
              </div>
            </section>
          </div>
        </main>
        <footer className="w-full bg-surface-container-low mt-12 py-8 border-t border-on-surface/10">
          <div className="max-w-[1200px] mx-auto px-10 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="font-headline-sm text-xl text-on-surface font-bold">Mango</span>
              <span className="text-xs text-fog">© 2025 Mango Operations. Deliberate editorial engineering.</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-on-surface-variant font-semibold">
              <a className="hover:text-on-surface transition-colors cursor-pointer" href="#">Chamber Protocol</a>
              <a className="hover:text-on-surface transition-colors cursor-pointer" href="#">Judging Matrix</a>
              <a className="hover:text-on-surface transition-colors cursor-pointer" href="#">Terms</a>
            </div>
          </div>
        </footer>
        {renderJoinModal()}
      </div>
    );
  }

  // 2. LOGIN SCREEN
  if (currentView === 'login') {
    return (
      <div className="min-h-screen bg-lumen-cream font-body-base text-on-surface flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface-bright rounded-[32px] p-8 border-2 border-on-surface shadow-[0_8px_30px_rgba(28,27,27,0.12)] relative">
          <button
            onClick={() => setCurrentView('landing')}
            className="absolute top-6 right-6 w-8 h-8 rounded-full bg-surface-container text-on-surface flex items-center justify-center hover:bg-surface-container-high transition-colors cursor-pointer text-sm font-bold"
          >
            ✕
          </button>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-tertiary-container flex items-center justify-center overflow-hidden border border-on-surface">
              <img
                alt="Mango Mascot"
                className="w-10 h-10 rounded-full object-cover"
                src="https://lh3.googleusercontent.com/aida/AEtjO1UT380eD2f4DQy2PRL7xWoutcO_zEzfLb96LbO8SE7gnXA6YR7chD3hRsdWrIFIfHezVfQuVPuf7ljeARndNmxdWm6Wu5Z_umNLLw4E5qv7h6jGHSd_EOuBEx3uDeJtfnzIcFFTgCtm55Z-2o1kuxsRwzAg0kf5-VrZcqNY10Rqh1Hkn3kD6NCq0dRru1ToLGHdDMLzmJfJrFwM6px3-bLaN2hMSMRIBT1FwTSPRTHLha2BjOWdwF-uUm88uhEuqnFkQ4Ux_bWCCuQ"
              />
            </div>
            <div>
              <h1 className="font-headline-sm text-2xl font-semibold text-on-surface">Mango OS</h1>
              <p className="font-label-md text-xs uppercase tracking-wider text-fog">Sign In // Secure Vault</p>
            </div>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {/* Role Selector Tabs */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5">
                Select Your Role
              </label>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface-container rounded-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setLoginRole('coordinator');
                    setEmail('jhapremkumar30nov@gmail.com');
                    setPassword('HEAD-8841');
                  }}
                  className={`py-2 px-1 rounded-xl text-xs font-bold transition cursor-pointer text-center ${
                    loginRole === 'coordinator'
                      ? 'bg-surface-bright text-charcoal shadow-sm'
                      : 'text-fog hover:text-charcoal'
                  }`}
                >
                  Coordinator
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginRole('judge');
                    setEmail('judge.elena@stanford.edu');
                    setPassword('JUDGE-3108');
                  }}
                  className={`py-2 px-1 rounded-xl text-xs font-bold transition cursor-pointer text-center ${
                    loginRole === 'judge'
                      ? 'bg-surface-bright text-secondary shadow-sm'
                      : 'text-fog hover:text-charcoal'
                  }`}
                >
                  Judge
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginRole('student');
                    setEmail('student.lead@hackathon.edu');
                    setPassword('TEAM-5519');
                  }}
                  className={`py-2 px-1 rounded-xl text-xs font-bold transition cursor-pointer text-center ${
                    loginRole === 'student'
                      ? 'bg-surface-bright text-tertiary shadow-sm'
                      : 'text-fog hover:text-charcoal'
                  }`}
                >
                  Student / Team
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                Email / Workspace ID
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-surface-container-low border-2 border-on-surface/20 rounded-xl px-4 py-3 text-on-surface font-body-base focus:outline-none focus:border-primary text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                {loginRole === 'coordinator'
                  ? 'Coordinator Key (e.g. HEAD-8841)'
                  : loginRole === 'judge'
                  ? 'Judge Scoring Key (e.g. JUDGE-3108)'
                  : 'Team Access Key (e.g. TEAM-5519)'}
              </label>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-surface-container-low border-2 border-on-surface/20 rounded-xl px-4 py-3 text-on-surface font-mono text-sm focus:outline-none focus:border-primary font-bold"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full bg-primary-container text-on-primary-fixed font-body-base-bold py-3.5 rounded-xl border-2 border-on-surface hover:bg-primary-fixed-dim transition-transform active:translate-y-0.5 shadow-sm cursor-pointer flex items-center justify-center gap-2"
              >
                <span>
                  {loginRole === 'coordinator'
                    ? 'Enter as Coordinator'
                    : loginRole === 'judge'
                    ? 'Enter Judge Chamber (Real-Time Scoring)'
                    : 'Enter Student Team Scorecard'}
                </span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            </div>

            {/* Firebase Google Auth Button */}
            <div className="pt-3 border-t border-charcoal/15 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={async () => {
                  const user = await signInWithGoogle();
                  if (user) {
                    if (loginRole === 'judge') {
                      setCurrentView('judge-scoring');
                    } else if (loginRole === 'student') {
                      if (teams[0]) setActiveTeamScorecardId(teams[0].id);
                      setCurrentView('team-scorecard');
                    } else {
                      setCurrentView('explore');
                    }
                  }
                }}
                className="w-full bg-surface-container-lowest text-on-surface font-body-base-bold py-3 rounded-xl border-2 border-on-surface/20 hover:bg-surface-variant transition-all shadow-sm cursor-pointer flex items-center justify-center gap-2.5 text-xs"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Continue with Google (Firebase Auth)</span>
              </button>

              {firebaseUser && (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center justify-between text-xs text-emerald-900">
                  <div className="flex items-center gap-2 truncate">
                    {firebaseUser.photoURL ? (
                      <img src={firebaseUser.photoURL} alt="" className="w-5 h-5 rounded-full" />
                    ) : (
                      <span className="material-symbols-outlined text-sm">account_circle</span>
                    )}
                    <span className="font-bold truncate">{firebaseUser.displayName || firebaseUser.email}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => logOutFirebase()}
                    className="text-[11px] font-bold text-rose-700 hover:underline cursor-pointer"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setCurrentView('landing')}
                className="text-xs text-secondary hover:underline font-semibold cursor-pointer"
              >
                ← Back to Landing Page
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 3. LANDING PAGE (Initial Default View)
  return (
    <div className="min-h-screen bg-background font-body-base text-body-base text-on-surface antialiased selection:bg-primary-container selection:text-on-primary-container">
      {/* FLOATING REAL-TIME JUDGE SCORE ALERT */}
      {liveScoreAlert && (
        <div className="fixed top-28 left-1/2 -translate-x-1/2 z-50 bg-charcoal text-white px-6 py-3.5 rounded-2xl shadow-2xl border-2 border-secondary flex items-center gap-3.5 animate-bounce max-w-lg w-full mx-4">
          <span className="material-symbols-outlined text-secondary text-2xl shrink-0">sensors</span>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold block leading-snug">{liveScoreAlert.message}</span>
            <span className="text-[10px] text-fog">Broadcasted instantaneously via WebSockets</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveTeamScorecardId(liveScoreAlert.score.teamId);
              setCurrentView('team-scorecard');
              setLiveScoreAlert(null);
            }}
            className="text-xs font-bold text-secondary bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl transition cursor-pointer shrink-0"
          >
            View Live →
          </button>
        </div>
      )}

      {/* HEADER */}
      <header className="fixed top-6 left-0 right-0 z-50 pointer-events-none">
        <div className="max-w-[1200px] mx-auto px-4 md:px-10">
          <div className="pointer-events-auto h-20 bg-lumen-cream rounded-full border-2 border-on-surface px-6 md:px-8 flex items-center justify-between shadow-[0_4px_24px_rgba(28,27,27,0.08)]">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full border-2 border-on-surface overflow-hidden bg-lumen-stone flex items-center justify-center shrink-0">
                <img
                  alt="Profile"
                  className="w-8 h-8 rounded-full object-cover"
                  src="https://lh3.googleusercontent.com/aida/AEtjO1UT380eD2f4DQy2PRL7xWoutcO_zEzfLb96LbO8SE7gnXA6YR7chD3hRsdWrIFIfHezVfQuVPuf7ljeARndNmxdWm6Wu5Z_umNLLw4E5qv7h6jGHSd_EOuBEx3uDeJtfnzIcFFTgCtm55Z-2o1kuxsRwzAg0kf5-VrZcqNY10Rqh1Hkn3kD6NCq0dRru1ToLGHdDMLzmJfJrFwM6px3-bLaN2hMSMRIBT1FwTSPRTHLha2BjOWdwF-uUm88uhEuqnFkQ4Ux_bWCCuQ"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-headline-sm text-2xl font-semibold text-on-surface leading-none tracking-tight">Mango</span>
                <span className="text-fog font-label-md">//</span>
                <span className="font-label-md uppercase tracking-wider text-on-surface-variant font-medium">Operations OS</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* WebSocket Indicator */}
              <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-600 animate-pulse' : 'bg-amber-500'}`}></span>
                <span className="text-[11px] font-bold">{wsConnected ? 'WebSocket Online' : 'Connecting WS'}</span>
              </div>

              <nav className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentView('explore')}
                  className="hidden md:inline-flex items-center justify-center bg-surface border border-on-surface/20 hover:bg-lumen-stone text-on-surface rounded-xl px-4 py-2 text-xs font-bold transition cursor-pointer"
                >
                  Explore Contests ({createdHackathons.length})
                </button>
                <button
                  onClick={() => setCurrentView('login')}
                  className="inline-flex items-center justify-center bg-primary-container text-on-surface border-2 border-on-surface rounded-xl px-5 py-2.5 font-body-base-bold text-xs transition-transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer shadow-sm"
                >
                  Sign In
                </button>
              </nav>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="w-full pt-28 bg-background min-h-screen">
        <div className="flex flex-col w-full">

          {/* SECTION 1: HERO */}
          <section className="w-full bg-lumen-cream py-14 md:py-20 border-b border-on-surface/10">
            <div className="max-w-[1200px] mx-auto px-4 md:px-10">
              <div className="flex flex-wrap items-center gap-2 mb-6">
                <div className="inline-flex items-center gap-2 bg-on-surface text-lumen-cream px-4 py-1.5 rounded-full border-2 border-on-surface">
                  <span className="w-2.5 h-2.5 rounded-full bg-tertiary-fixed animate-pulse"></span>
                  <span className="font-label-sm uppercase tracking-wider text-xs font-semibold">v2.4 Editorial Engine Online</span>
                </div>
                <div className="hidden sm:inline-flex items-center gap-1.5 bg-surface-container text-on-surface-variant px-3 py-1.5 rounded-full border border-on-surface/20 font-label-sm text-xs">
                  <span>Global Deliberation Vault</span>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                <div className="lg:col-span-7 flex flex-col items-start gap-6">
                  <h1 className="font-headline-lg text-4xl sm:text-6xl md:text-[76px] md:leading-[74px] text-on-surface tracking-tight">
                    Orchestrate hackathons.<br />
                    <span className="italic font-display text-primary">From kickoff to consensus.</span>
                  </h1>
                  <p className="font-body-lg text-lg md:text-xl text-on-surface-variant max-w-xl">
                    Dual-interface command engine for coordinators and judges. Real-time rubric consensus, automated submission pipelines, and live telemetry without the spreadsheet chaos.
                  </p>
                  <div className="flex flex-wrap items-center gap-4 pt-2">
                    <button
                      onClick={() => setCurrentView('login')}
                      className="inline-flex items-center justify-center bg-primary-container text-on-surface border-2 border-on-surface rounded-xl px-6 py-4 font-body-base-bold transition-transform hover:-translate-y-0.5 active:translate-y-0 gap-2 cursor-pointer shadow-sm"
                    >
                      <span className="material-symbols-outlined text-lg">terminal</span>
                      Launch OS Console
                    </button>
                    <button
                      onClick={() => setCurrentView('login')}
                      className="inline-flex items-center justify-center bg-lumen-cream text-on-surface border-2 border-on-surface rounded-xl px-6 py-4 font-body-base-bold transition-transform hover:-translate-y-0.5 active:translate-y-0 gap-2 cursor-pointer shadow-sm"
                    >
                      <span className="material-symbols-outlined text-lg">view_stream</span>
                      Explore Submissions
                    </button>
                  </div>

                  <div className="pt-6 grid grid-cols-3 gap-6 w-full max-w-lg border-t-2 border-on-surface/10 mt-2">
                    <div>
                      <p className="font-headline-sm text-2xl md:text-3xl text-on-surface font-semibold">1,400+</p>
                      <p className="font-label-sm text-xs text-fog uppercase tracking-wider">Hacks Scored</p>
                    </div>
                    <div>
                      <p className="font-headline-sm text-2xl md:text-3xl text-secondary font-semibold">&lt; 45m</p>
                      <p className="font-label-sm text-xs text-fog uppercase tracking-wider">Deliberation</p>
                    </div>
                    <div>
                      <p className="font-headline-sm text-2xl md:text-3xl text-on-surface font-semibold">99.8%</p>
                      <p className="font-label-sm text-xs text-fog uppercase tracking-wider">Judge Uptime</p>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-5 relative mt-8 lg:mt-0">
                  <div className="absolute -top-16 -right-4 md:-right-6 w-28 md:w-36 z-20 pointer-events-none drop-shadow-md">
                    <img
                      alt="Flowy the friendly dragon mascot wearing headphones"
                      className="w-full h-auto object-contain"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuBYKWjL-zTRTvfyw8q825dfPl9XTT00EAaZx0bPG_YbxhBaQ0ICt89xJxkRHA51L62TDlgWVzHJW3WTWv3NXEenUdLhmmDlxfpHUQ6pE-F1QZKWRuqNBTgLiVpAkOKXlfyAVJvRo_tHGaWstbHujI9BReExjMeeOnUYtGDn9uIRknFN5-pg0GL7DCrTCRCv8151idj9iBy-Ipm3s8MmGciWJJC2mPP66hEWlH6mhjIRc1CkO6yjCM8tB6mv1Cb2fLVZmlk"
                    />
                  </div>

                  <div className="bg-charcoal text-lumen-cream rounded-[32px] p-6 md:p-8 border-2 border-on-surface relative z-10 shadow-xl">
                    <div className="flex items-center justify-between pb-4 border-b border-fog/30 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-error inline-block"></span>
                        <span className="w-3 h-3 rounded-full bg-tertiary-fixed inline-block"></span>
                        <span className="w-3 h-3 rounded-full bg-secondary-fixed inline-block"></span>
                        <span className="font-label-sm text-xs text-fog ml-2">VOICE_INPUT_DOCK // MIC-01</span>
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-secondary-fixed font-label-sm text-xs bg-secondary/30 px-3 py-1 rounded-full border border-secondary-fixed/40">
                        <span className="w-2 h-2 rounded-full bg-secondary-fixed animate-ping"></span>
                        SYNCHRONIZED
                      </span>
                    </div>

                    <div className="bg-on-surface rounded-2xl p-5 border border-fog/20 mb-4">
                      <textarea
                        value={voiceText}
                        onChange={(e) => setVoiceText(e.target.value)}
                        className="w-full bg-transparent text-lumen-cream font-body-base-bold resize-none focus:outline-none text-base leading-relaxed"
                        rows={3}
                      />
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-fog/20 text-fog text-xs">
                        <span>Confidence: 99.4%</span>
                        <span className="text-tertiary-fixed">Track: Edge AI Systems</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 bg-on-surface/60 rounded-xl p-3 border border-fog/20">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setIsRecording(!isRecording)}
                          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                            isRecording ? 'bg-error text-white animate-pulse' : 'bg-surface-container-highest text-on-surface hover:bg-lumen-cream'
                          }`}
                          title="Toggle Microphone"
                        >
                          <span className="material-symbols-outlined text-xl">mic</span>
                        </button>
                        <div className="flex items-end gap-1 h-6 px-2">
                          <span className={`w-1 bg-tertiary-fixed h-3 rounded-full ${isRecording ? 'animate-bounce' : 'animate-pulse'}`}></span>
                          <span className="w-1 bg-tertiary-fixed h-5 rounded-full"></span>
                          <span className="w-1 bg-tertiary-fixed h-6 rounded-full animate-bounce"></span>
                          <span className="w-1 bg-tertiary-fixed h-4 rounded-full"></span>
                          <span className="w-1 bg-tertiary-fixed h-2 rounded-full"></span>
                          <span className="w-1 bg-tertiary-fixed h-5 rounded-full animate-pulse"></span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-fog hidden sm:inline">
                          {commitSuccess ? 'Committed!' : 'Enter to commit'}
                        </span>
                        <button
                          onClick={() => {
                            setCommitSuccess(true);
                            setTimeout(() => setCommitSuccess(false), 3000);
                          }}
                          className="w-10 h-10 rounded-full bg-tertiary-fixed text-on-tertiary-fixed flex items-center justify-center font-bold hover:scale-105 transition-transform cursor-pointer shadow"
                          title="Commit Command"
                        >
                          <span className="material-symbols-outlined text-lg">arrow_forward</span>
                        </button>
                      </div>
                    </div>

                    {commitSuccess && (
                      <div className="mt-3 p-2 bg-secondary/40 text-secondary-fixed text-xs rounded-lg text-center font-semibold animate-fade-in">
                        Command committed successfully to Track Lead queue!
                      </div>
                    )}

                    <div className="mt-4 flex items-center gap-2 text-fog text-xs">
                      <span className="material-symbols-outlined text-sm text-primary-fixed">info</span>
                      <span>Flowy auto-routes rubric tallies to Track Leads in real time.</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </section>

          {/* SECTION 2: LOGO PARADE & STAT BANNER */}
          <section className="w-full bg-background py-16">
            <div className="max-w-[1200px] mx-auto px-4 md:px-10">
              <div className="bg-secondary text-on-secondary rounded-[40px] p-8 md:p-12 border-2 border-on-surface relative overflow-hidden shadow-lg">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0 border border-on-surface/20">
                      <span className="material-symbols-outlined text-2xl">verified</span>
                    </div>
                    <div>
                      <p className="font-label-md text-xs uppercase tracking-wider text-secondary-fixed font-semibold">Global Operational Trust</p>
                      <h3 className="font-headline-sm text-2xl md:text-3xl text-on-secondary">Chosen by world-tier hackathons &amp; academic summits</h3>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-on-secondary-fixed-variant px-4 py-2 rounded-full border border-secondary-fixed/30 text-xs text-secondary-fixed">
                    <span className="w-2 h-2 rounded-full bg-secondary-fixed"></span>
                    <span>Synchronized Scoring Network</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 pt-2">
                  {[
                    { name: 'MIT Hack', loc: 'Boston, MA' },
                    { name: 'ETHGlobal', loc: 'Worldwide' },
                    { name: 'TreeHacks', loc: 'Stanford' },
                    { name: 'CalHacks', loc: 'UC Berkeley' },
                    { name: 'HackMIT', loc: 'Cambridge' },
                    { name: 'Stanford AI', loc: 'Palo Alto' },
                    { name: 'Notion Lab', loc: 'San Francisco' },
                    { name: 'Warp Engine', loc: 'Dev Guild' },
                  ].map((partner, idx) => (
                    <div
                      key={idx}
                      className="bg-on-surface/40 hover:bg-on-surface/60 border border-secondary-fixed/20 rounded-xl py-3 px-2 flex flex-col items-center justify-center text-center transition-colors cursor-pointer"
                      onClick={() => setCurrentView('login')}
                    >
                      <span className="font-body-base-bold text-sm text-pure-white font-semibold">{partner.name}</span>
                      <span className="text-[10px] text-secondary-fixed-dim mt-0.5">{partner.loc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-20 flex flex-col items-center text-center max-w-3xl mx-auto">
                <div className="inline-flex items-center gap-2 bg-primary-container px-4 py-1.5 rounded-full border-2 border-on-surface mb-4">
                  <span className="material-symbols-outlined text-sm text-primary">bolt</span>
                  <span className="font-label-sm uppercase tracking-wider text-xs font-semibold text-on-surface">Deliberation Velocity</span>
                </div>
                <h2 className="font-headline-md text-3xl sm:text-5xl md:text-[56px] md:leading-[58px] text-on-surface mb-3">
                  4x faster than manual grading.
                </h2>
                <div className="w-48 h-2 bg-primary-container rounded-full border-2 border-on-surface mb-4"></div>
                <p className="font-body-lg text-lg text-on-surface-variant mb-6">
                  Voice rubrics and synchronized scoring. Coordinators dispatch alerts, judges submit spoken feedback, and final consensus locks 4x faster than typing into disconnected forms.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-4">
                  <button
                    onClick={() => setCurrentView('login')}
                    className="bg-primary-container text-on-surface border-2 border-on-surface rounded-xl px-6 py-3 font-body-base-bold hover:-translate-y-0.5 active:translate-y-0 transition-transform cursor-pointer shadow-sm"
                  >
                    Try Mango OS Free
                  </button>
                  <button
                    onClick={() => setCurrentView('login')}
                    className="bg-lumen-cream text-on-surface border-2 border-on-surface rounded-xl px-6 py-3 font-body-base-bold hover:-translate-y-0.5 active:translate-y-0 transition-transform cursor-pointer shadow-sm"
                  >
                    Sign In to Judge Room
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: ROLE WORKFLOW SWITCHER */}
          <section className="w-full bg-background py-16" id="workflow">
            <div className="max-w-[1200px] mx-auto px-4 md:px-10">
              <div className="bg-charcoal text-lumen-cream rounded-[48px] md:rounded-[64px] p-8 md:p-16 border-2 border-on-surface relative shadow-2xl">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                  <div className="lg:col-span-6 flex flex-col items-start gap-6">
                    <div>
                      <span className="font-label-md text-xs uppercase tracking-widest text-tertiary-fixed font-semibold">OPERATIONAL ARCHITECTURE</span>
                      <h2 className="font-headline-md text-3xl sm:text-4xl text-lumen-cream mt-2 tracking-tight">
                        Made for the way you run hackathons.
                      </h2>
                      <p className="font-body-base text-base text-fog mt-2">
                        Select your role to see Mango's bespoke interface in action. Every seat gets tailored ergonomics with synchronized telemetry.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 pt-2">
                      {[
                        { key: 'coordinators', label: 'Coordinators' },
                        { key: 'judges', label: 'Judges' },
                        { key: 'trackleads', label: 'Track Leads' },
                        { key: 'mentors', label: 'Mentors' },
                        { key: 'hardware', label: 'Hardware Desk' },
                        { key: 'volunteers', label: 'Volunteers' },
                      ].map((role) => (
                        <button
                          key={role.key}
                          onClick={() => setActiveRole(role.key as any)}
                          className={`rounded-full px-5 py-2 font-body-base-bold transition-all cursor-pointer border-2 ${
                            activeRole === role.key
                              ? 'bg-primary-container text-on-surface border-on-surface shadow-sm'
                              : 'bg-on-surface text-lumen-cream border-fog/40 hover:border-lumen-cream'
                          }`}
                        >
                          {role.label}
                        </button>
                      ))}
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={() => setCurrentView('login')}
                        className="inline-flex items-center gap-2 bg-secondary text-pure-white border-2 border-lumen-cream rounded-xl px-6 py-3 font-body-base-bold hover:bg-secondary/90 transition-colors cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-lg">tune</span>
                        <span>{roleData[activeRole].cta}</span>
                      </button>
                    </div>
                  </div>

                  <div className="lg:col-span-6">
                    <div className="bg-on-surface rounded-[32px] p-6 md:p-8 border-2 border-fog/40 relative shadow-inner">
                      <div className="flex items-start justify-between gap-4 mb-6">
                        <div>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary-fixed text-on-secondary-fixed text-xs uppercase font-semibold">
                            ACTIVE PROTOCOL // {activeRole.toUpperCase()}
                          </span>
                          <h3 className="font-headline-sm text-2xl text-lumen-cream mt-2">
                            {roleData[activeRole].title}
                          </h3>
                          <p className="font-body-base text-sm text-fog mt-1">
                            {roleData[activeRole].desc}
                          </p>
                        </div>
                        <div className="w-16 h-16 md:w-20 md:h-20 shrink-0 bg-charcoal rounded-2xl border-2 border-lumen-cream/40 flex items-center justify-center overflow-hidden p-1 shadow">
                          <img
                            alt="Flowy smiling"
                            className="w-full h-full object-contain"
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBYKWjL-zTRTvfyw8q825dfPl9XTT00EAaZx0bPG_YbxhBaQ0ICt89xJxkRHA51L62TDlgWVzHJW3WTWv3NXEenUdLhmmDlxfpHUQ6pE-F1QZKWRuqNBTgLiVpAkOKXlfyAVJvRo_tHGaWstbHujI9BReExjMeeOnUYtGDn9uIRknFN5-pg0GL7DCrTCRCv8151idj9iBy-Ipm3s8MmGciWJJC2mPP66hEWlH6mhjIRc1CkO6yjCM8tB6mv1Cb2fLVZmlk"
                          />
                        </div>
                      </div>

                      <div className="space-y-3 font-body-base text-sm">
                        {roleData[activeRole].metrics.map((metric, idx) => (
                          <div key={idx} className="bg-charcoal p-4 rounded-xl border border-fog/20 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="material-symbols-outlined text-secondary-fixed">sensors</span>
                              <div>
                                <p className="font-body-base-bold text-lumen-cream">{metric.label}</p>
                                <p className="text-xs text-fog">{metric.desc}</p>
                              </div>
                            </div>
                            <span className={`${metric.color} text-xs bg-secondary/30 px-2.5 py-1 rounded font-semibold`}>
                              {metric.badge}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </section>

          {/* SECTION 4: DICTIONARY & FEATURE SPLIT */}
          <section className="w-full bg-background py-16">
            <div className="max-w-[1200px] mx-auto px-4 md:px-10">
              <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b-2 border-on-surface/20 pb-6">
                <div>
                  <span className="font-label-md text-xs uppercase tracking-wider text-primary font-semibold">CORE UTILITIES</span>
                  <h2 className="font-headline-md text-3xl md:text-4xl text-on-surface mt-1">
                    Rubric dictionary &amp; operational snippets.
                  </h2>
                </div>
                <p className="font-body-base text-base text-on-surface-variant max-w-md">
                  Flow automatically adapts to your hackathon tracks, criteria definitions, custom weighting algorithms, and judge notes.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-lumen-cream rounded-[32px] p-8 border-2 border-on-surface flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <span className="w-10 h-10 rounded-full bg-primary-container text-on-surface border-2 border-on-surface flex items-center justify-center font-bold">
                        01
                      </span>
                      <span className="font-label-sm text-xs bg-secondary-fixed text-on-secondary-fixed px-3 py-1 rounded-full border border-on-surface font-semibold">
                        DYNAMIC ADAPTATION
                      </span>
                    </div>
                    <h3 className="font-headline-sm text-2xl text-on-surface mb-2">
                      Personalized rubric dictionary
                    </h3>
                    <p className="font-body-base text-base text-on-surface-variant mb-6">
                      Mango listens to judge terminology and builds a localized dictionary for each track. Industry-specific jargon, API names, and hardware models are recognized with zero transcription error.
                    </p>

                    <div className="bg-charcoal text-lumen-cream rounded-2xl p-5 border-2 border-on-surface space-y-3">
                      <div className="flex items-center justify-between border-b border-fog/20 pb-2">
                        <span className="font-label-sm text-xs text-fog uppercase">Track: Web3 Infrastructure</span>
                        <span className="text-tertiary-fixed font-label-sm text-xs cursor-pointer hover:underline">+ Add Rule</span>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-2">
                        {["Zero-Knowledge Proofs", "Rollup Latency", "Smart Contract Audit", "EIP-4337"].map((tag, i) => (
                          <span key={i} className="bg-secondary text-pure-white text-xs px-3 py-1 rounded-full border border-secondary-fixed/40">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 flex items-center gap-2 text-on-surface font-body-base-bold cursor-pointer hover:text-primary transition-colors">
                    <span onClick={() => setCurrentView('login')}>Learn how dictionary learning works</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </div>
                </div>

                <div className="bg-lumen-cream rounded-[32px] p-8 border-2 border-on-surface flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <span className="w-10 h-10 rounded-full bg-secondary-fixed text-on-secondary-fixed border-2 border-on-surface flex items-center justify-center font-bold">
                        02
                      </span>
                      <span className="font-label-sm text-xs bg-tertiary-fixed text-on-tertiary-fixed px-3 py-1 rounded-full border border-on-surface font-semibold">
                        ONE-TAP DISPATCH
                      </span>
                    </div>
                    <h3 className="font-headline-sm text-2xl text-on-surface mb-2">
                      Reusable snippet library
                    </h3>
                    <p className="font-body-base text-base text-on-surface-variant mb-6">
                      Save recurring organizer announcements, mentor guidance, and judge feedback macros. Dispatch critical alerts across Discord, Slack, and the Hacker Dashboard in one strike.
                    </p>

                    <div className="bg-surface-container rounded-2xl p-5 border-2 border-on-surface space-y-3">
                      <div className="flex items-center justify-between border-b border-on-surface/10 pb-2">
                        <span className="font-label-sm text-xs text-on-surface-variant uppercase">Ready-to-fire macros</span>
                        <span className="text-primary font-label-sm text-xs">4 presets</span>
                      </div>
                      <div className="space-y-2 pt-1 font-body-base text-sm">
                        <div className="bg-pure-white p-2.5 rounded-lg border border-on-surface/20 flex items-center justify-between">
                          <span className="text-on-surface font-medium">"/submission-warning-15m"</span>
                          <span className="font-label-sm text-fog text-xs">All Tracks</span>
                        </div>
                        <div className="bg-pure-white p-2.5 rounded-lg border border-on-surface/20 flex items-center justify-between">
                          <span className="text-on-surface font-medium">"/judge-drift-alert-recalibrate"</span>
                          <span className="font-label-sm text-secondary text-xs">Lead Judges</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 flex items-center gap-2 text-on-surface font-body-base-bold cursor-pointer hover:text-primary transition-colors">
                    <span onClick={() => setCurrentView('login')}>Explore prebuilt template libraries</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </div>
                </div>

              </div>
            </div>
          </section>

          {/* SECTION 5: TESTIMONIALS */}
          <section className="w-full bg-background pt-8 pb-20">
            <div className="max-w-[1200px] mx-auto px-4 md:px-10">
              <div className="bg-charcoal text-lumen-cream rounded-[48px] md:rounded-[64px] pt-16 pb-12 px-6 md:px-12 border-2 border-on-surface relative overflow-hidden shadow-2xl">
                <div className="text-center max-w-2xl mx-auto mb-16 relative">
                  <div className="inline-block relative">
                    <h2 className="font-display text-4xl sm:text-6xl md:text-[72px] text-lumen-cream tracking-tight">
                      Love letters<br />
                      <span className="italic font-display">to Mango</span>
                    </h2>
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 w-48 h-6 flex justify-between pointer-events-none opacity-60">
                      <span className="w-0.5 h-6 bg-secondary-fixed rotate-[-25deg]"></span>
                      <span className="w-0.5 h-8 bg-tertiary-fixed -translate-y-2"></span>
                      <span className="w-0.5 h-6 bg-secondary-fixed rotate-[25deg]"></span>
                    </div>
                  </div>
                  <p className="font-body-base text-base text-fog mt-4">
                    Hear from the directors, evaluators, and leads who banished spreadsheet chaos forever.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
                  {[
                    {
                      quote: "Managing 140 teams across 4 tracks used to keep our committee up till 4 AM. With Mango, consensus deliberation wrapped in 45 minutes flat.",
                      name: "HackMIT Lead Organizer",
                      loc: "Cambridge, MA",
                      initials: "HL",
                      bg: "bg-primary-container"
                    },
                    {
                      quote: "Voice-dictated rubrics are revolutionary for judges. I spoke my feedback while watching live student demos and scores locked instantly.",
                      name: "Senior ML Judge",
                      loc: "Anthropic Guild",
                      initials: "ML",
                      bg: "bg-secondary-fixed"
                    },
                    {
                      quote: "The dual coordinator & judge live sync eliminated spreadsheet version desync completely. Zero duplicate award assignments.",
                      name: "Operations Director",
                      loc: "ETHGlobal",
                      initials: "EG",
                      bg: "bg-tertiary-fixed"
                    },
                    {
                      quote: "Mascot Flowy guided our first-time mentors flawlessly. Our sponsor mentors answered 300+ help requests in under 3 minutes each.",
                      name: "TreeHacks Ops Lead",
                      loc: "Stanford University",
                      initials: "TH",
                      bg: "bg-primary-fixed"
                    }
                  ].map((testi, idx) => (
                    <div
                      key={idx}
                      className="bg-lumen-cream text-on-surface rounded-t-[32px] rounded-b-xl p-6 border-2 border-on-surface flex flex-col justify-between shadow-lg"
                    >
                      <p className="font-body-base text-base text-on-surface leading-relaxed">
                        &ldquo;{testi.quote}&rdquo;
                      </p>
                      <div className="pt-6 border-t border-on-surface/10 mt-6 flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full ${testi.bg} border border-on-surface flex items-center justify-center font-bold text-on-surface text-sm shrink-0`}>
                          {testi.initials}
                        </div>
                        <div>
                          <p className="font-body-base-bold text-sm font-semibold">{testi.name}</p>
                          <p className="font-label-sm text-xs text-fog">{testi.loc}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-12 pt-8 border-t border-fog/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-secondary-fixed flex items-center justify-center text-on-surface">
                      <span className="material-symbols-outlined text-base font-bold">check</span>
                    </div>
                    <p className="font-body-base text-sm text-lumen-cream">
                      Deploy in under 10 minutes. Fully compatible with Devpost, GitHub, and custom auth.
                    </p>
                  </div>
                  <button
                    onClick={() => setCurrentView('register')}
                    className="inline-flex items-center gap-2 bg-primary-container text-on-surface border-2 border-lumen-cream rounded-xl px-6 py-3 font-body-base-bold hover:-translate-y-0.5 transition-transform cursor-pointer shadow"
                  >
                    <span>Set Up Your Hackathon</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

        </div>
      </main>

      {/* FOOTER */}
      <footer className="w-full bg-charcoal text-lumen-cream border-t-2 border-on-surface">
        <div className="max-w-[1200px] mx-auto px-4 md:px-10 py-16">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 pb-10 border-b border-fog/30">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-headline-sm text-2xl font-semibold text-lumen-cream">Mango OS</span>
                <span className="font-label-sm text-xs text-fog uppercase tracking-widest">// v2.4 Editorial</span>
              </div>
              <p className="font-body-base text-sm text-fog max-w-md">
                Deliberate hackathon operations, submission deliberation, and technical evaluation architecture.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 bg-on-surface rounded-full border border-lumen-stone/20 px-4 py-2">
                <span className="w-2.5 h-2.5 rounded-full bg-secondary-fixed"></span>
                <span className="font-label-sm text-xs text-lumen-cream uppercase tracking-wider">Nodes Operational</span>
              </div>
              <div className="flex items-center gap-2 bg-on-surface rounded-full border border-lumen-stone/20 px-4 py-2">
                <span className="w-2.5 h-2.5 rounded-full bg-tertiary-fixed"></span>
                <span className="font-label-sm text-xs text-lumen-cream uppercase tracking-wider">Judging Vault Active</span>
              </div>
            </div>
          </div>
          <div className="pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-fog text-xs">
            <p>© 2025 Mango OS Infrastructure. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <span className="hover:text-lumen-cream transition-colors cursor-pointer">Editorial Protocol</span>
              <span className="hover:text-lumen-cream transition-colors cursor-pointer">Encrypted Deliberation</span>
              <span className="hover:text-lumen-cream transition-colors cursor-pointer">Rubric Engine</span>
            </div>
          </div>
        </div>
      </footer>
      {renderJoinModal()}
    </div>
  );
}
