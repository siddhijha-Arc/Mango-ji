import React, { useState, useMemo } from 'react';
import { HackathonTeam } from './TeamsHub';
import { socket } from './socket';
import { saveScoreToFirestore } from './firebase';

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
  verdict?: 'Recommend Finalist' | 'Strong Contender' | 'Needs Revision';
  submittedAt: string;
}

interface JudgeScoringPortalProps {
  hackathonTitle: string;
  hackathonId: string;
  teams: HackathonTeam[];
  scores: JudgeScore[];
  onBack: () => void;
  onViewTeamScorecard: (teamId: string) => void;
  onScoreSubmitted?: (newScore: JudgeScore) => void;
}

interface TeamEvaluationState {
  technical: number;
  utility: number;
  architecture: number;
  presentation: number;
  feedback: string;
  verdict: 'Recommend Finalist' | 'Strong Contender' | 'Needs Revision';
}

export default function JudgeScoringPortal({
  hackathonTitle,
  hackathonId,
  teams,
  scores,
  onBack,
  onViewTeamScorecard,
  onScoreSubmitted,
}: JudgeScoringPortalProps) {
  // Current active filter: 'all' | 'pending' | 'completed'
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  
  // Judge profile
  const [judgeName] = useState<string>('Dr. Aris Thorne');
  const [judgeRole] = useState<string>('Panel 1 Judge');

  // Track expanded accordion team ID (default first team open)
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>('codesharks');

  // Track local form state for all teams
  const [evaluations, setEvaluations] = useState<Record<string, TeamEvaluationState>>({
    codesharks: {
      technical: 24,
      utility: 23,
      architecture: 22,
      presentation: 23,
      feedback: 'Impressive zk-rollup throughput verified during live testnet call. Clean consensus fallback logic.',
      verdict: 'Recommend Finalist',
    },
    four_leos: {
      technical: 23,
      utility: 22,
      architecture: 21,
      presentation: 23,
      feedback: 'Exceptional routing mechanism, slight latency on state validation.',
      verdict: 'Strong Contender',
    },
    'team-1': {
      technical: 24,
      utility: 24,
      architecture: 23,
      presentation: 23,
      feedback: 'Outstanding sub-40ms acoustic model inference and edge audio synthesis demo.',
      verdict: 'Recommend Finalist',
    },
  });

  // Track locally submitted team IDs
  const [submittedTeamIds, setSubmittedTeamIds] = useState<Record<string, boolean>>({
    four_leos: true,
    codeblooded: true,
    bogosorts: true,
    secrethd: true,
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Combine default mockup teams with dynamic teams registered by users
  const combinedTeams = useMemo(() => {
    // Default list from the user's template
    const templateTeams: Array<{
      id: string;
      teamName: string;
      tagline: string;
      status: 'pitching' | 'ready' | 'queue' | 'completed';
      initialScore?: number;
      defaultVerdict?: 'Recommend Finalist' | 'Strong Contender' | 'Needs Revision';
      initialFeedback?: string;
    }> = [
      {
        id: 'codesharks',
        teamName: 'CodeSharks',
        tagline: 'Autonomous Zero-Knowledge Oracle Agent',
        status: 'pitching',
        initialScore: 92,
        defaultVerdict: 'Recommend Finalist',
        initialFeedback: 'Impressive zk-rollup throughput verified during live testnet call. Clean consensus fallback logic.',
      },
      {
        id: 'four_leos',
        teamName: 'Four_Leos',
        tagline: 'Cross-Chain Intent Solvers',
        status: 'completed',
        initialScore: 89,
        defaultVerdict: 'Strong Contender',
        initialFeedback: 'Exceptional routing mechanism, slight latency on state validation.',
      },
      {
        id: 'debugdivas',
        teamName: 'DebugDivas',
        tagline: 'Multimodal Voice Agents for On-Chain Governance',
        status: 'queue',
      },
      {
        id: 'khannavaishnav7',
        teamName: 'khannavaishnav7',
        tagline: 'Decentralized Spatial Intelligence Protocol',
        status: 'queue',
      },
      {
        id: 'codeblooded',
        teamName: 'Code Blooded',
        tagline: 'Cross-L2 Liquidity Synthesizer',
        status: 'completed',
        initialScore: 94,
        defaultVerdict: 'Recommend Finalist',
      },
      {
        id: 'variants',
        teamName: 'variants',
        tagline: 'Synthesized Gene-Drive Tokenomics',
        status: 'queue',
      },
      {
        id: 'bogosorts',
        teamName: 'the bogosorts',
        tagline: 'Probabilistic Quantum Shuffle Sharding',
        status: 'completed',
        initialScore: 78,
        defaultVerdict: 'Needs Revision',
      },
      {
        id: 'thearcanist',
        teamName: 'The Arcanist',
        tagline: 'Encrypted Knowledge Graphs via FHE',
        status: 'queue',
      },
      {
        id: 'snipher',
        teamName: 'Snipher',
        tagline: 'Real-time MEV Shielding Extensions',
        status: 'ready',
      },
      {
        id: 'secrethd',
        teamName: 'Secret.HD',
        tagline: 'High-Fidelity Neural Code Obfuscation',
        status: 'completed',
        initialScore: 91,
        defaultVerdict: 'Recommend Finalist',
      },
      {
        id: 'paradox',
        teamName: 'PARADOX',
        tagline: 'Non-Deterministic State Machine Verification',
        status: 'queue',
      },
    ];

    // Merge registered teams from app state if not already in list
    const existingIds = new Set(templateTeams.map((t) => t.id));
    const registered = teams.filter((t) => !existingIds.has(t.id)).map((t, idx) => ({
      id: t.id,
      teamName: t.teamName,
      tagline: t.notes || t.track || `Registered Team #${idx + 1} • Leader: ${t.leaderName}`,
      status: (scores.some((s) => s.teamId === t.id) ? 'completed' : 'ready') as 'pitching' | 'ready' | 'queue' | 'completed',
      initialScore: scores.find((s) => s.teamId === t.id)?.totalScore,
    }));

    return [...templateTeams, ...registered];
  }, [teams, scores]);

  // Sync external scores into submitted state
  const isTeamScored = (teamId: string) => {
    return submittedTeamIds[teamId] || scores.some((s) => s.teamId === teamId);
  };

  const getTeamScoreValue = (teamId: string, defaultScore = 92) => {
    const existing = scores.find((s) => s.teamId === teamId);
    if (existing) return existing.totalScore;
    const local = evaluations[teamId];
    if (local) {
      return local.technical + local.utility + local.architecture + local.presentation;
    }
    return defaultScore;
  };

  // Stats calculation
  const totalTeamsCount = combinedTeams.length;
  const gradedTeamsCount = combinedTeams.filter((t) => isTeamScored(t.id)).length;
  const pendingTeamsCount = totalTeamsCount - gradedTeamsCount;

  // Filtered teams list
  const filteredTeams = useMemo(() => {
    if (filter === 'all') return combinedTeams;
    if (filter === 'completed') return combinedTeams.filter((t) => isTeamScored(t.id));
    if (filter === 'pending') return combinedTeams.filter((t) => !isTeamScored(t.id));
    return combinedTeams;
  }, [combinedTeams, filter, submittedTeamIds, scores]);

  const getEvaluationForTeam = (teamId: string): TeamEvaluationState => {
    if (evaluations[teamId]) return evaluations[teamId];
    return {
      technical: 20,
      utility: 20,
      architecture: 20,
      presentation: 20,
      feedback: '',
      verdict: 'Strong Contender',
    };
  };

  const handleScoreChange = (teamId: string, field: 'technical' | 'utility' | 'architecture' | 'presentation', value: number) => {
    const clamped = Math.max(0, Math.min(25, isNaN(value) ? 0 : value));
    setEvaluations((prev) => {
      const current = prev[teamId] || getEvaluationForTeam(teamId);
      return {
        ...prev,
        [teamId]: {
          ...current,
          [field]: clamped,
        },
      };
    });
  };

  const handleFeedbackChange = (teamId: string, text: string) => {
    setEvaluations((prev) => {
      const current = prev[teamId] || getEvaluationForTeam(teamId);
      return {
        ...prev,
        [teamId]: {
          ...current,
          feedback: text,
        },
      };
    });
  };

  const handleVerdictChange = (teamId: string, verdict: 'Recommend Finalist' | 'Strong Contender' | 'Needs Revision') => {
    setEvaluations((prev) => {
      const current = prev[teamId] || getEvaluationForTeam(teamId);
      return {
        ...prev,
        [teamId]: {
          ...current,
          verdict,
        },
      };
    });
  };

  const toggleTeam = (teamId: string) => {
    setExpandedTeamId((prev) => (prev === teamId ? null : teamId));
  };

  const submitEvaluation = async (teamId: string, teamName: string) => {
    const evalData = getEvaluationForTeam(teamId);
    const total = evalData.technical + evalData.utility + evalData.architecture + evalData.presentation;

    const payload: JudgeScore = {
      id: `score-${Date.now()}`,
      hackathonId: hackathonId || 'hack-voice-2026',
      teamId,
      teamName,
      judgeName,
      judgeEmail: 'aris.thorne@oxford-research.org',
      technical: evalData.technical,
      innovation: evalData.utility,
      presentation: evalData.presentation,
      feasibility: evalData.architecture,
      totalScore: total,
      feedback: evalData.feedback || 'Evaluation confirmed across rubric criteria.',
      verdict: evalData.verdict,
      submittedAt: 'Just now',
    };

    // 1. Emit via WebSocket
    socket.emit('submit_judge_score', payload);

    // 2. Persist via REST
    fetch('/api/scores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch((e) => console.warn('POST /api/scores error', e));

    // 3. Persist to real Firebase Firestore database
    saveScoreToFirestore(payload);

    // 4. Update local states
    setSubmittedTeamIds((prev) => ({ ...prev, [teamId]: true }));
    onScoreSubmitted?.(payload);

    setToastMessage(`✨ Score of ${total}/100 broadcasted in real-time to ${teamName}!`);
    setTimeout(() => setToastMessage(null), 4000);

    // Collapse the card
    setExpandedTeamId(null);
  };

  return (
    <div className="bg-lumen-cream font-body-base text-on-surface antialiased min-h-screen selection:bg-primary-container selection:text-on-primary-container flex flex-col justify-between">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-charcoal text-white px-6 py-3 rounded-2xl shadow-2xl border border-secondary flex items-center gap-3 animate-bounce">
          <span className="material-symbols-outlined text-secondary text-xl">sensors</span>
          <span className="font-bold text-xs">{toastMessage}</span>
        </div>
      )}

      {/* HEADER */}
      <header className="fixed top-0 left-0 w-full z-50 bg-lumen-cream/95 backdrop-blur-md shadow-[0_1px_8px_rgba(0,0,0,0.03)] border-b border-charcoal/5">
        <div className="h-20 w-full px-4 sm:px-6 lg:px-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 cursor-pointer" onClick={onBack}>
              <div className="w-10 h-10 rounded-xl bg-tertiary-container flex items-center justify-center shadow-sm">
                <span className="material-symbols-outlined text-on-tertiary-container text-[24px]">smart_toy</span>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-serif text-2xl text-on-surface leading-none font-medium">Mango OS</span>
                  <span className="font-label-sm text-xs text-fog uppercase tracking-wider hidden sm:inline">
                    / {hackathonTitle || 'Global AI 2026'}
                  </span>
                </div>
              </div>
            </div>
            <div className="h-6 w-px bg-lumen-stone hidden md:block"></div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high border border-charcoal/10">
              <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span>
              <span className="font-label-sm text-xs text-on-surface font-semibold tracking-wider uppercase">LIVE</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <nav className="hidden lg:flex items-center gap-1.5 p-1 rounded-xl bg-surface-container-low border border-charcoal/10 text-xs">
              <button
                type="button"
                onClick={onBack}
                className="px-4 py-2 rounded-lg text-on-surface-variant hover:text-on-surface font-medium transition-colors cursor-pointer"
              >
                Discovery Feed
              </button>
              <button
                type="button"
                className="px-4 py-2 transition-colors bg-primary-container text-on-primary-container font-bold rounded-lg shadow-sm"
              >
                Judge Chamber
              </button>
              <button
                type="button"
                onClick={() => onViewTeamScorecard(combinedTeams[0]?.id || 'codesharks')}
                className="px-4 py-2 rounded-lg text-on-surface-variant hover:text-on-surface font-medium transition-colors cursor-pointer"
              >
                Team Scorecard
              </button>
            </nav>

            <div className="h-8 w-px bg-lumen-stone hidden lg:block"></div>

            <div className="flex items-center gap-2.5 pl-2">
              <div className="flex flex-col text-right hidden sm:flex">
                <span className="font-bold text-xs text-on-surface leading-tight">{judgeName}</span>
                <span className="text-[11px] text-fog">{judgeRole}</span>
              </div>
              <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs shadow-sm">
                <span className="material-symbols-outlined text-[18px]">person</span>
              </div>
              <button
                type="button"
                onClick={onBack}
                className="ml-1 px-3 py-1.5 rounded-xl border border-charcoal/20 bg-surface text-charcoal hover:bg-surface-variant text-xs font-bold transition cursor-pointer"
                title="Return to Main Menu"
              >
                Exit
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN EVALUATION CHAMBER */}
      <main className="w-full pt-28 bg-lumen-cream flex-1 pb-16">
        <div className="w-full max-w-[1180px] mx-auto px-4 sm:px-6 md:px-10 flex flex-col gap-6">
          {/* Top Minimal Banner */}
          <section className="bg-surface-container-lowest rounded-[28px] p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-end justify-between gap-6 border border-charcoal/10">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-2.5 h-2.5 rounded-full bg-secondary"></span>
                <span className="font-label-sm text-xs text-secondary uppercase tracking-widest font-bold">
                  Live Scoring Session
                </span>
                <span className="font-label-sm text-xs text-fog">•</span>
                <span className="font-label-sm text-xs text-on-surface-variant font-medium">
                  Panel 1 · Multimodal &amp; Web3
                </span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl text-on-surface font-normal tracking-tight">
                Evaluation Chamber
              </h1>
              <p className="text-xs text-fog">
                {totalTeamsCount} Assigned Teams · <span className="text-on-surface font-semibold">{gradedTeamsCount} Graded</span> · {pendingTeamsCount} Remaining
              </p>
            </div>

            {/* Quick Filter Segmented Control */}
            <div className="inline-flex p-1 rounded-2xl bg-surface-container-high self-start md:self-auto gap-1 border border-charcoal/10 text-xs">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`filter-btn px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                  filter === 'all'
                    ? 'bg-lumen-cream text-on-surface shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                All ({totalTeamsCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('pending')}
                className={`filter-btn px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                  filter === 'pending'
                    ? 'bg-lumen-cream text-on-surface shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Pending ({pendingTeamsCount})
              </button>
              <button
                type="button"
                onClick={() => setFilter('completed')}
                className={`filter-btn px-4 py-2 rounded-xl font-bold transition-all cursor-pointer ${
                  filter === 'completed'
                    ? 'bg-lumen-cream text-on-surface shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Graded ({gradedTeamsCount})
              </button>
            </div>
          </section>

          {/* TEAM SCORING LIST ACCORDION */}
          <div className="flex flex-col gap-3.5">
            {filteredTeams.map((team, idx) => {
              const isExpanded = expandedTeamId === team.id;
              const isScored = isTeamScored(team.id);
              const scoreVal = getTeamScoreValue(team.id, team.initialScore || 92);
              const evalState = getEvaluationForTeam(team.id);
              const liveScoreTotal = evalState.technical + evalState.utility + evalState.architecture + evalState.presentation;

              // Format index 01, 02...
              const numStr = (idx + 1).toString().padStart(2, '0');

              return (
                <article
                  key={team.id}
                  className="bg-surface-container-lowest rounded-[28px] overflow-hidden shadow-sm transition-all duration-300 border border-charcoal/10"
                >
                  {/* Collapsible Row Trigger */}
                  <button
                    type="button"
                    onClick={() => toggleTeam(team.id)}
                    className="w-full text-left p-5 md:p-6 flex items-center justify-between gap-4 group cursor-pointer hover:bg-surface-container-lowest/80 transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 font-serif text-[20px] font-medium ${
                        isScored ? 'bg-secondary-container text-on-secondary-container' : 'bg-tertiary-container/60 text-on-tertiary-container'
                      }`}>
                        {numStr}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-serif text-[22px] md:text-2xl text-on-surface font-normal">
                            {team.teamName}
                          </span>
                          {team.status === 'pitching' && !isScored && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-secondary/10 text-secondary text-[11px] uppercase font-bold tracking-wide">
                              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping"></span>
                              Pitching Now
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-fog truncate mt-0.5">{team.tagline}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {isScored ? (
                        <span className="px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container text-xs font-bold flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px]">check</span>
                          Scored ({scoreVal}/100)
                        </span>
                      ) : team.status === 'pitching' || team.status === 'ready' ? (
                        <span className="px-3 py-1 rounded-full bg-surface-container-high text-on-surface text-xs font-semibold">
                          Ready to Score
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full bg-surface-container-high text-fog text-xs font-medium">
                          In Queue
                        </span>
                      )}

                      <span
                        className={`material-symbols-outlined text-fog group-hover:text-on-surface transition-transform duration-300 ${
                          isExpanded ? 'rotate-180 text-charcoal' : ''
                        }`}
                      >
                        keyboard_arrow_down
                      </span>
                    </div>
                  </button>

                  {/* Accordion Content */}
                  {isExpanded && (
                    <div className="px-5 md:px-8 pb-8 pt-2 animate-fade-in border-t border-lumen-stone/50">
                      {isScored ? (
                        /* Completed State Breakdown */
                        <div className="pt-4 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                          <div className="lg:col-span-7 flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-fog uppercase font-bold tracking-wider">Recorded Breakdown</span>
                              <span className="font-serif text-xl text-secondary font-bold">{scoreVal} / 100</span>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                              <div className="p-3 bg-surface-container-low rounded-xl border border-charcoal/5">
                                <div className="text-[11px] text-fog font-medium">Innovation</div>
                                <div className="font-serif text-[20px] font-bold text-charcoal">{evalState.technical}</div>
                              </div>
                              <div className="p-3 bg-surface-container-low rounded-xl border border-charcoal/5">
                                <div className="text-[11px] text-fog font-medium">Utility</div>
                                <div className="font-serif text-[20px] font-bold text-charcoal">{evalState.utility}</div>
                              </div>
                              <div className="p-3 bg-surface-container-low rounded-xl border border-charcoal/5">
                                <div className="text-[11px] text-fog font-medium">Architecture</div>
                                <div className="font-serif text-[20px] font-bold text-charcoal">{evalState.architecture}</div>
                              </div>
                              <div className="p-3 bg-surface-container-low rounded-xl border border-charcoal/5">
                                <div className="text-[11px] text-fog font-medium">Presentation</div>
                                <div className="font-serif text-[20px] font-bold text-charcoal">{evalState.presentation}</div>
                              </div>
                            </div>
                          </div>

                          <div className="lg:col-span-5 bg-surface-container-low p-4 rounded-2xl border border-charcoal/5 flex flex-col justify-between gap-3">
                            <p className="text-xs text-on-surface-variant italic leading-relaxed">
                              &ldquo;{evalState.feedback || 'High caliber technical execution and architectural clarity.'}&rdquo;
                            </p>
                            <div className="mt-2 flex items-center justify-between pt-2 border-t border-charcoal/10">
                              <span className="px-2.5 py-1 rounded-md bg-secondary-container text-on-secondary-container text-xs font-bold">
                                {evalState.verdict}
                              </span>
                              <div className="flex items-center gap-3">
                                <button
                                  type="button"
                                  onClick={() => onViewTeamScorecard(team.id)}
                                  className="text-xs text-secondary hover:underline font-bold cursor-pointer"
                                >
                                  View Live Scorecard →
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setSubmittedTeamIds((prev) => ({ ...prev, [team.id]: false }))}
                                  className="text-xs text-primary underline font-bold cursor-pointer"
                                >
                                  Revise
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Scoring Deck Chamber */
                        <div className="pt-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
                          {/* Left Matrix: Rubric Inputs */}
                          <div className="lg:col-span-7 flex flex-col gap-4">
                            <div className="flex items-center justify-between pb-1">
                              <span className="text-xs text-fog uppercase tracking-wider font-bold">Evaluation Rubric</span>
                              <div className="flex items-baseline gap-1">
                                <span className="text-xs text-fog font-medium">Live Score:</span>
                                <span className="font-serif text-3xl text-primary font-bold leading-none">
                                  {liveScoreTotal}
                                </span>
                                <span className="text-xs text-fog font-medium">/ 100</span>
                              </div>
                            </div>

                            {/* Criterion 1 */}
                            <div className="bg-surface-container-low p-4 rounded-2xl flex items-center justify-between gap-4 border border-charcoal/5">
                              <div className="min-w-0">
                                <div className="font-bold text-xs text-on-surface">Technical Innovation</div>
                                <div className="text-[11px] text-fog">Novel architecture, novel primitives (max 25)</div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <input
                                  type="number"
                                  min="0"
                                  max="25"
                                  value={evalState.technical}
                                  onChange={(e) => handleScoreChange(team.id, 'technical', parseInt(e.target.value) || 0)}
                                  className="w-16 h-12 rounded-xl bg-lumen-cream text-center font-serif text-xl text-on-surface border border-charcoal/15 focus:ring-2 focus:ring-primary outline-none shadow-inner font-bold"
                                />
                                <span className="text-xs text-fog font-medium">/ 25</span>
                              </div>
                            </div>

                            {/* Criterion 2 */}
                            <div className="bg-surface-container-low p-4 rounded-2xl flex items-center justify-between gap-4 border border-charcoal/5">
                              <div className="min-w-0">
                                <div className="font-bold text-xs text-on-surface">Practical Utility &amp; Execution</div>
                                <div className="text-[11px] text-fog">Real adoption feasibility, live demo (max 25)</div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <input
                                  type="number"
                                  min="0"
                                  max="25"
                                  value={evalState.utility}
                                  onChange={(e) => handleScoreChange(team.id, 'utility', parseInt(e.target.value) || 0)}
                                  className="w-16 h-12 rounded-xl bg-lumen-cream text-center font-serif text-xl text-on-surface border border-charcoal/15 focus:ring-2 focus:ring-primary outline-none shadow-inner font-bold"
                                />
                                <span className="text-xs text-fog font-medium">/ 25</span>
                              </div>
                            </div>

                            {/* Criterion 3 */}
                            <div className="bg-surface-container-low p-4 rounded-2xl flex items-center justify-between gap-4 border border-charcoal/5">
                              <div className="min-w-0">
                                <div className="font-bold text-xs text-on-surface">Architecture &amp; Code Quality</div>
                                <div className="text-[11px] text-fog">Scalability, test coverage, repo health (max 25)</div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <input
                                  type="number"
                                  min="0"
                                  max="25"
                                  value={evalState.architecture}
                                  onChange={(e) => handleScoreChange(team.id, 'architecture', parseInt(e.target.value) || 0)}
                                  className="w-16 h-12 rounded-xl bg-lumen-cream text-center font-serif text-xl text-on-surface border border-charcoal/15 focus:ring-2 focus:ring-primary outline-none shadow-inner font-bold"
                                />
                                <span className="text-xs text-fog font-medium">/ 25</span>
                              </div>
                            </div>

                            {/* Criterion 4 */}
                            <div className="bg-surface-container-low p-4 rounded-2xl flex items-center justify-between gap-4 border border-charcoal/5">
                              <div className="min-w-0">
                                <div className="font-bold text-xs text-on-surface">Presentation &amp; Pitch</div>
                                <div className="text-[11px] text-fog">Clarity of thought, defense during Q&amp;A (max 25)</div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <input
                                  type="number"
                                  min="0"
                                  max="25"
                                  value={evalState.presentation}
                                  onChange={(e) => handleScoreChange(team.id, 'presentation', parseInt(e.target.value) || 0)}
                                  className="w-16 h-12 rounded-xl bg-lumen-cream text-center font-serif text-xl text-on-surface border border-charcoal/15 focus:ring-2 focus:ring-primary outline-none shadow-inner font-bold"
                                />
                                <span className="text-xs text-fog font-medium">/ 25</span>
                              </div>
                            </div>
                          </div>

                          {/* Right Column: Notes & Submission */}
                          <div className="lg:col-span-5 flex flex-col justify-between gap-5 bg-surface-container-low/50 p-5 rounded-2xl border border-charcoal/10">
                            <div className="flex flex-col gap-3">
                              <div className="flex items-center justify-between">
                                <label className="text-xs text-on-surface-variant font-bold uppercase tracking-wider">
                                  Judge Critique &amp; Notes
                                </label>
                                <span className="text-[11px] text-fog">Internal Panel Record</span>
                              </div>
                              <textarea
                                value={evalState.feedback}
                                onChange={(e) => handleFeedbackChange(team.id, e.target.value)}
                                placeholder="Add feedback or private remarks for the team..."
                                rows={5}
                                className="w-full p-3.5 rounded-xl bg-lumen-cream text-on-surface text-xs placeholder:text-fog focus:ring-2 focus:ring-primary focus:outline-none resize-none shadow-inner leading-relaxed border border-charcoal/15"
                              />

                              <div className="flex flex-col gap-2 pt-1">
                                <span className="text-xs text-fog font-bold">Verdict Recommendation</span>
                                <div className="flex flex-wrap gap-2">
                                  {(['Recommend Finalist', 'Strong Contender', 'Needs Revision'] as const).map((vrd) => (
                                    <button
                                      key={vrd}
                                      type="button"
                                      onClick={() => handleVerdictChange(team.id, vrd)}
                                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        evalState.verdict === vrd
                                          ? 'bg-primary-container text-on-primary-container border border-primary/20 shadow-sm'
                                          : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
                                      }`}
                                    >
                                      {vrd}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Submit Action Button */}
                            <div className="pt-2">
                              <button
                                type="button"
                                onClick={() => submitEvaluation(team.id, team.teamName)}
                                className="w-full py-3.5 px-6 rounded-xl bg-primary-container text-on-surface font-bold text-xs hover:brightness-95 active:scale-[0.99] transition-all flex items-center justify-center gap-2 shadow-sm border border-charcoal/15 cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-[18px]">verified</span>
                                <span>Confirm &amp; Record Score</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="w-full bg-surface-container-low py-6 border-t border-charcoal/10">
        <div className="w-full max-w-[1180px] mx-auto px-4 sm:px-6 md:px-10 flex flex-col md:flex-row items-center justify-between gap-4 text-on-surface-variant text-xs">
          <div className="flex items-center gap-2">
            <span className="font-serif text-lg font-medium text-on-surface">Mango OS</span>
            <span className="text-fog">— Global AI 2026 Deliberation Engine</span>
          </div>
          <div className="text-fog">© 2026 Mango OS. Curated for Hackathon Evaluation Panels.</div>
        </div>
      </footer>
    </div>
  );
}
