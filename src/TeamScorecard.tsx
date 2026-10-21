import React from 'react';
import { HackathonTeam } from './TeamsHub';
import { JudgeScore } from './JudgeScoringPortal';

interface TeamScorecardProps {
  team: HackathonTeam;
  hackathonTitle: string;
  hackathonId: string;
  scores: JudgeScore[];
  allTeams: HackathonTeam[];
  onBack: () => void;
  onSwitchTeam: (teamId: string) => void;
  onTriggerPptUpload?: (teamId: string) => void;
}

export default function TeamScorecard({
  team,
  hackathonTitle,
  hackathonId: _hackathonId,
  scores,
  allTeams,
  onBack,
  onSwitchTeam,
  onTriggerPptUpload,
}: TeamScorecardProps) {
  // Scores for this specific team
  const teamScores = scores.filter((s) => s.teamId === team.id);

  // Compute averages
  const hasScores = teamScores.length > 0;
  const avgOverall = hasScores
    ? (teamScores.reduce((acc, s) => acc + s.totalScore, 0) / teamScores.length).toFixed(2)
    : 'Pending';
  const avgTechnical = hasScores
    ? (teamScores.reduce((acc, s) => acc + s.technical, 0) / teamScores.length).toFixed(1)
    : '—';
  const avgInnovation = hasScores
    ? (teamScores.reduce((acc, s) => acc + s.innovation, 0) / teamScores.length).toFixed(1)
    : '—';
  const avgPresentation = hasScores
    ? (teamScores.reduce((acc, s) => acc + s.presentation, 0) / teamScores.length).toFixed(1)
    : '—';
  const avgFeasibility = hasScores
    ? (teamScores.reduce((acc, s) => acc + s.feasibility, 0) / teamScores.length).toFixed(1)
    : '—';

  // Compute standings among all teams
  const teamStandings = allTeams.map((t) => {
    const tScores = scores.filter((s) => s.teamId === t.id);
    const avg = tScores.length > 0
      ? tScores.reduce((acc, s) => acc + s.totalScore, 0) / tScores.length
      : 0;
    return {
      id: t.id,
      teamName: t.teamName,
      track: t.track,
      avgScore: avg,
      reviewCount: tScores.length,
    };
  }).sort((a, b) => b.avgScore - a.avgScore);

  const currentRank = teamStandings.findIndex((t) => t.id === team.id) + 1;

  return (
    <div className="min-h-screen bg-lumen-cream text-charcoal font-sans flex flex-col justify-between selection:bg-secondary-container">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-lumen-stone px-6 lg:px-10 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-2xl bg-lumen-cream border border-lumen-stone hover:bg-white flex items-center justify-center text-charcoal transition cursor-pointer shadow-sm"
            title="Return"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-primary-container text-on-primary-container text-xs font-bold uppercase tracking-wider">
                Student / Team Console
              </span>
              <span className="text-fog text-xs">•</span>
              <span className="text-xs text-fog font-medium">{hackathonTitle}</span>
            </div>
            <h1 className="font-serif text-2xl font-normal text-charcoal leading-tight">
              Live Scorecard &amp; Judge Deliberation Stream
            </h1>
          </div>
        </div>

        {/* Live sync pulse */}
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
            <span>WebSocket Live Sync Active</span>
          </div>
          {/* Quick Team Switcher */}
          <select
            value={team.id}
            onChange={(e) => onSwitchTeam(e.target.value)}
            className="text-xs font-bold p-2 rounded-xl bg-surface border border-lumen-stone text-charcoal outline-none cursor-pointer"
          >
            {allTeams.map((t) => (
              <option key={t.id} value={t.id}>
                Switch: {t.teamName}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col gap-8">
        {/* TEAM HERO BANNER */}
        <section className="p-8 rounded-[36px] bg-charcoal text-lumen-cream border-2 border-charcoal shadow-xl relative overflow-hidden">
          <div className="absolute -right-24 -top-24 w-80 h-80 bg-secondary/30 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex flex-col gap-2 max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full bg-secondary text-white text-xs uppercase font-bold tracking-wider">
                  {team.track || 'Track Entrant'}
                </span>
                <span className="text-fog text-xs">•</span>
                <span className="text-xs text-secondary-fixed font-semibold">
                  {team.notes || 'Table Stage Ready'}
                </span>
              </div>
              <h2 className="font-serif text-4xl sm:text-5xl font-normal text-white tracking-tight">
                {team.teamName}
              </h2>
              <p className="text-sm text-fog">
                Team Leader: <strong className="text-white">{team.leaderName}</strong> • {team.totalMembers || team.members?.length || 4} Members • Live Scorecard Feed
              </p>
            </div>

            {/* Live Score & Rank Badges */}
            <div className="flex items-center gap-4 flex-wrap">
              {/* Average Score */}
              <div className="px-6 py-4 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 text-center flex flex-col items-center shadow-lg">
                <span className="text-[11px] font-bold uppercase tracking-wider text-secondary-fixed block">
                  Live Average Score
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="font-serif text-4xl sm:text-5xl font-bold text-white">
                    {avgOverall}
                  </span>
                  <span className="text-sm text-fog font-medium">{hasScores && Number(avgOverall) > 10 ? '/ 100' : '/ 10'}</span>
                </div>
                <span className="text-[10px] text-fog mt-1">
                  {teamScores.length} {teamScores.length === 1 ? 'Judge Scored' : 'Judges Scored'}
                </span>
              </div>

              {/* Current Standing */}
              <div className="px-6 py-4 rounded-3xl bg-secondary-container/30 border border-secondary/40 text-center flex flex-col items-center">
                <span className="text-[11px] font-bold uppercase tracking-wider text-secondary-fixed block">
                  Standing Rank
                </span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="font-serif text-4xl sm:text-5xl font-bold text-secondary-fixed">
                    #{currentRank > 0 ? currentRank : '—'}
                  </span>
                  <span className="text-xs text-fog font-medium">of {allTeams.length}</span>
                </div>
                <span className="text-[10px] text-emerald-300 mt-1">
                  {currentRank === 1 ? '🏆 Current Leader' : 'Deliberation Active'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 4 RUBRIC PILLARS SUMMARY CARDS */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl bg-surface border border-lumen-stone shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold uppercase text-fog tracking-wider">
              1. Technical Execution
            </span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="font-serif text-3xl font-bold text-secondary">{avgTechnical}</span>
              <span className="text-xs text-fog font-mono">{hasScores && Number(avgTechnical) > 10 ? '/ 25' : '/ 10'}</span>
            </div>
            <p className="text-[11px] text-fog mt-1">Architecture, code depth, low latency</p>
          </div>

          <div className="p-5 rounded-2xl bg-surface border border-lumen-stone shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold uppercase text-fog tracking-wider">
              2. Innovation &amp; Novelty
            </span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="font-serif text-3xl font-bold text-primary">{avgInnovation}</span>
              <span className="text-xs text-fog font-mono">{hasScores && Number(avgInnovation) > 10 ? '/ 25' : '/ 10'}</span>
            </div>
            <p className="text-[11px] text-fog mt-1">Uniqueness, differentiation, IP</p>
          </div>

          <div className="p-5 rounded-2xl bg-surface border border-lumen-stone shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold uppercase text-fog tracking-wider">
              3. Presentation Polish
            </span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="font-serif text-3xl font-bold text-tertiary">{avgPresentation}</span>
              <span className="text-xs text-fog font-mono">{hasScores && Number(avgPresentation) > 10 ? '/ 25' : '/ 10'}</span>
            </div>
            <p className="text-[11px] text-fog mt-1">Live demo execution &amp; pitch clarity</p>
          </div>

          <div className="p-5 rounded-2xl bg-surface border border-lumen-stone shadow-sm flex flex-col justify-between">
            <span className="text-xs font-bold uppercase text-fog tracking-wider">
              4. Feasibility &amp; Impact
            </span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="font-serif text-3xl font-bold text-charcoal">{avgFeasibility}</span>
              <span className="text-xs text-fog font-mono">{hasScores && Number(avgFeasibility) > 10 ? '/ 25' : '/ 10'}</span>
            </div>
            <p className="text-[11px] text-fog mt-1">Viability, market potential, scale</p>
          </div>
        </section>

        {/* TWO-COLUMN DETAILS: LIVE SCORES STREAM vs SUBMISSION & ROSTER */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Live Judge Scores & Qualitative Remarks */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="p-6 md:p-8 rounded-[32px] bg-surface border border-lumen-stone shadow-sm flex flex-col gap-5">
              <div className="flex items-center justify-between pb-3 border-b border-lumen-stone">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-xl">gavel</span>
                  <h3 className="font-serif text-2xl font-normal text-charcoal">
                    Judges' Evaluations &amp; Live Feedback
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-fog">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                  <span className="font-semibold text-emerald-700">Real-Time WebSocket Feed</span>
                </div>
              </div>

              {teamScores.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center justify-center gap-3 bg-lumen-cream/50 rounded-2xl border border-dashed border-lumen-stone">
                  <div className="w-12 h-12 rounded-full bg-lumen-cream border border-lumen-stone flex items-center justify-center text-fog">
                    <span className="material-symbols-outlined text-2xl">pending</span>
                  </div>
                  <h4 className="font-serif text-lg font-medium text-charcoal">Awaiting Judge Evaluation</h4>
                  <p className="text-xs text-fog max-w-sm">
                    Judges are currently reviewing pitch presentations. As soon as a judge submits their rubric scores, they will pop up right here in real time without refreshing!
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {teamScores.map((score, idx) => (
                    <article
                      key={score.id || idx}
                      className="p-6 rounded-2xl bg-lumen-cream/80 border border-lumen-stone flex flex-col gap-4 shadow-sm hover:border-secondary/50 transition"
                    >
                      {/* Judge header */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-lumen-stone/80">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-charcoal text-white flex items-center justify-center font-serif font-bold text-sm">
                            {score.judgeName.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-charcoal">{score.judgeName}</h4>
                            <p className="text-[11px] text-fog">{score.judgeEmail} • Verified Juror</p>
                          </div>
                        </div>

                        {/* Overall score given by this judge */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-fog font-medium">Deliberation Score:</span>
                          <span className="px-3 py-1 rounded-xl bg-secondary text-white font-mono font-bold text-sm shadow-sm">
                            {score.totalScore.toFixed(2)} / 10
                          </span>
                        </div>
                      </div>

                      {/* Criteria breakdown */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-surface border border-lumen-stone">
                          <span className="text-[10px] text-fog uppercase block">Technical Depth</span>
                          <span className="font-bold text-charcoal">{score.technical} / 10</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-surface border border-lumen-stone">
                          <span className="text-[10px] text-fog uppercase block">Innovation</span>
                          <span className="font-bold text-charcoal">{score.innovation} / 10</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-surface border border-lumen-stone">
                          <span className="text-[10px] text-fog uppercase block">Presentation</span>
                          <span className="font-bold text-charcoal">{score.presentation} / 10</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-surface border border-lumen-stone">
                          <span className="text-[10px] text-fog uppercase block">Feasibility</span>
                          <span className="font-bold text-charcoal">{score.feasibility} / 10</span>
                        </div>
                      </div>

                      {/* Judge remarks */}
                      <div className="p-4 rounded-xl bg-surface border border-lumen-stone/90 flex flex-col gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">
                          Juror Critique &amp; Recommendations
                        </span>
                        <p className="text-xs text-charcoal leading-relaxed">
                          "{score.feedback}"
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-fog pt-1">
                        <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                          <span className="material-symbols-outlined text-xs">verified</span>
                          Official Normalized Rubric Score
                        </span>
                        <span>Recorded at {score.submittedAt}</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Submission Deck & Team Roster */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            {/* Pitch Deck Card */}
            <div className="p-6 rounded-[30px] bg-surface border border-lumen-stone shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between pb-2 border-b border-lumen-stone">
                <h4 className="font-serif text-lg font-normal text-charcoal">Submission Deck</h4>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    team.pptStatus === 'submitted'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {team.pptStatus === 'submitted' ? 'Ready' : 'Not Uploaded'}
                </span>
              </div>

              {team.pptFile ? (
                <div className="p-4 rounded-2xl bg-lumen-cream border border-lumen-stone flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-secondary-container text-secondary flex items-center justify-center">
                      <span className="material-symbols-outlined text-xl">description</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className="font-bold text-xs text-charcoal truncate">{team.pptFile.fileName}</h5>
                      <span className="text-[11px] text-fog">{team.pptFile.fileSize} • {team.pptFile.uploadedAt}</span>
                    </div>
                  </div>
                  {onTriggerPptUpload && (
                    <button
                      type="button"
                      onClick={() => onTriggerPptUpload(team.id)}
                      className="w-full py-2 px-3 rounded-xl bg-surface border border-lumen-stone hover:bg-white text-xs font-semibold text-charcoal transition cursor-pointer"
                    >
                      Update / Replace Deck PDF
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 flex flex-col items-center gap-2 text-center">
                  <span className="material-symbols-outlined text-rose-600 text-2xl">upload_file</span>
                  <span className="text-xs font-semibold text-rose-900">No pitch deck uploaded yet</span>
                  {onTriggerPptUpload && (
                    <button
                      type="button"
                      onClick={() => onTriggerPptUpload(team.id)}
                      className="mt-1 px-4 py-2 rounded-xl bg-charcoal text-white text-xs font-bold hover:bg-black transition cursor-pointer"
                    >
                      Upload Pitch Deck
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Team Roster List */}
            <div className="p-6 rounded-[30px] bg-surface border border-lumen-stone shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-lumen-stone">
                <h4 className="font-serif text-lg font-normal text-charcoal">Team Members</h4>
                <span className="text-xs font-bold text-fog">
                  {team.totalMembers || team.members?.length || 4} Total
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {team.members && team.members.length > 0 ? (
                  team.members.map((m, idx) => (
                    <div
                      key={m.id || idx}
                      className="p-3 rounded-xl bg-lumen-cream/70 border border-lumen-stone flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-surface border border-lumen-stone text-charcoal font-bold flex items-center justify-center text-[11px]">
                          {m.name.charAt(0)}
                        </div>
                        <div>
                          <span className="font-bold text-charcoal block">{m.name}</span>
                          <span className="text-[10px] text-fog">{m.email || 'No email provided'}</span>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          m.role === 'Leader'
                            ? 'bg-secondary-container text-secondary'
                            : 'bg-surface text-fog border border-lumen-stone'
                        }`}
                      >
                        {m.role}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-xs text-fog italic py-2">
                    {team.leaderName} (Leader)
                  </div>
                )}
              </div>
            </div>

            {/* Mini Leaderboard preview */}
            <div className="p-6 rounded-[30px] bg-surface border border-lumen-stone shadow-sm flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-lumen-stone">
                <h4 className="font-serif text-lg font-normal text-charcoal">Contest Leaderboard</h4>
                <span className="text-[11px] text-secondary font-bold">Top Deliberations</span>
              </div>
              <div className="flex flex-col gap-2">
                {teamStandings.map((t, rankIdx) => (
                  <div
                    key={t.id}
                    className={`p-2.5 rounded-xl border flex items-center justify-between text-xs ${
                      t.id === team.id
                        ? 'bg-secondary-container/40 border-secondary font-bold text-charcoal'
                        : 'bg-lumen-cream/60 border-lumen-stone text-on-surface-variant'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 font-mono text-center text-xs font-bold text-fog">
                        #{rankIdx + 1}
                      </span>
                      <span className="truncate max-w-[130px]">{t.teamName}</span>
                    </div>
                    <span className="font-mono font-bold text-secondary">
                      {t.avgScore > 0 ? `${t.avgScore.toFixed(2)}/10` : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
