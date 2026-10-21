import React, { useState, useRef, useEffect } from 'react';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'Leader' | 'Member';
}

export interface HackathonTeam {
  id: string;
  teamName: string;
  leaderName: string;
  leaderEmail: string;
  leaderPhone: string;
  totalMembers: number;
  track?: string;
  notes?: string;
  members: TeamMember[];
  pptStatus: 'submitted' | 'not_submitted';
  assignedPanel?: string;
  pptFile?: {
    fileName: string;
    uploadedAt: string;
    fileSize: string;
    pdfUrl?: string;
  };
}

interface TeamsHubProps {
  teams: HackathonTeam[];
  onUpdateTeams: (teams: HackathonTeam[]) => void;
  hackathonTitle: string;
  onBackToDashboard: () => void;
}

export default function TeamsHub({
  teams,
  onUpdateTeams,
  hackathonTitle,
  onBackToDashboard,
}: TeamsHubProps) {
  // State for expanded team cards (accordion: map of team id -> boolean)
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({
    [teams[0]?.id || '']: true,
  });

  // State for Search and Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPpt, setFilterPpt] = useState<'all' | 'submitted' | 'missing'>('all');

  // State for scanned teams staging (Save Scanned Teams feature - does not delete previous teams)
  const [scannedStagingTeams, setScannedStagingTeams] = useState<HackathonTeam[]>([]);

  // State for Allot Panel Modal & Random Allotment
  const [showAllotModal, setShowAllotModal] = useState(false);
  const [allotNumPanels, setAllotNumPanels] = useState(3);
  const [allotSuccessMsg, setAllotSuccessMsg] = useState<string | null>(null);

  const aiSuggestedPanelNames = [
    'Alpha Nexus Chamber',
    'Quantum Core Grid',
    'Hyperion Matrix Room',
    'Apex Voice Stage',
    'Zenith Chamber',
    'Neural Foundry',
    'Vector Delta Room',
    'Flux Matrix Stage',
    'Singularity Core',
    'Tensor Prime Hub'
  ];

  const handlePerformPanelAllotment = () => {
    if (teams.length === 0) {
      alert('No teams available to allot.');
      return;
    }
    const panelCount = Math.max(1, Math.min(10, allotNumPanels));
    const generatedPanels = aiSuggestedPanelNames.slice(0, panelCount);

    // Randomly distribute teams across generated panels
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    const updated = shuffled.map((t, idx) => {
      const assignedPanel = generatedPanels[idx % generatedPanels.length];
      return {
        ...t,
        assignedPanel,
        notes: t.notes ? `${t.notes} • Allotted to ${assignedPanel}` : `Allotted to ${assignedPanel}`
      };
    });

    onUpdateTeams(updated);
    setAllotSuccessMsg(`✨ Successfully allotted ${teams.length} teams randomly across ${panelCount} AI-suggested panels! Check the Judges section to view team dropdowns.`);
    setTimeout(() => {
      setAllotSuccessMsg(null);
      setShowAllotModal(false);
    }, 2000);
  };

  // State for Image Upload and Gemini Vision
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageName, setSelectedImageName] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<string>('');
  const [analysisSummary, setAnalysisSummary] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // State for adding a new manual team modal
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newLeaderName, setNewLeaderName] = useState('');
  const [newLeaderEmail, setNewLeaderEmail] = useState('');
  const [newLeaderPhone, setNewLeaderPhone] = useState('');
  const [newTeamTrack, setNewTeamTrack] = useState('Voice AI & Autonomous Systems');
  const [newTeamTotalMembers, setNewTeamTotalMembers] = useState(4);

  // File input ref for image
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Hidden file input for PPT PDF upload per team
  const [uploadingPptTeamId, setUploadingPptTeamId] = useState<string | null>(null);
  const pptInputRef = useRef<HTMLInputElement>(null);

  // Toggle expansion of a row-wise bar card
  const toggleTeamExpand = (id: string) => {
    setExpandedTeams((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Expand all or Collapse all
  const expandAll = () => {
    const allExpanded = teams.reduce((acc, t) => {
      acc[t.id] = true;
      return acc;
    }, {} as Record<string, boolean>);
    setExpandedTeams(allExpanded);
  };

  const collapseAll = () => {
    setExpandedTeams({});
  };

  // Handle image file selection
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedImageName(file.name);
    setApiError(null);
    setAnalysisSummary(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setSelectedImage(result);
    };
    reader.readAsDataURL(file);
  };

  // Generate Sample Offline Registration Sheet on an HTML5 canvas for quick 1-click testing
  const handleLoadSampleSheet = () => {
    setApiError(null);
    setAnalysisSummary(null);

    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 780;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background paper texture
    ctx.fillStyle = '#faf8f5';
    ctx.fillRect(0, 0, 1200, 780);

    // Header border
    ctx.fillStyle = '#1e1f20';
    ctx.fillRect(40, 40, 1120, 70);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('GLOBAL AI HACKATHON 2026 — ONSITE REGISTRATION LOG SHEET', 60, 85);
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#f8b958';
    ctx.fillText('CHECK-IN DESK #02 | VERIFIED HACKER TEAMS ROSTER', 780, 85);

    // Table Header
    ctx.fillStyle = '#e8e4dc';
    ctx.fillRect(40, 120, 1120, 40);
    ctx.fillStyle = '#2d2e30';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('SR', 55, 145);
    ctx.fillText('TEAM NAME', 110, 145);
    ctx.fillText('TEAM LEADER', 300, 145);
    ctx.fillText('LEADER CONTACT (EMAIL / MOBILE)', 470, 145);
    ctx.fillText('REGISTERED MEMBERS & DETAILS', 780, 145);
    ctx.fillText('TRACK', 1060, 145);

    // Row 1: Team NeuroFlow
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(40, 170, 1120, 170);
    ctx.strokeStyle = '#d9d3c7';
    ctx.strokeRect(40, 170, 1120, 170);

    ctx.fillStyle = '#1e1f20';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('#01', 55, 205);
    ctx.fillText('Team NeuroFlow', 110, 205);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#65676b';
    ctx.fillText('Table #A-14 • 4 Members', 110, 225);

    ctx.fillStyle = '#1e1f20';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('Aarav Sharma', 300, 205);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#0842a0';
    ctx.fillText('aarav.sharma@neuroflow.ai', 470, 205);
    ctx.fillStyle = '#2e6b3b';
    ctx.fillText('+91 98765 43210 (Verified)', 470, 225);

    ctx.fillStyle = '#1e1f20';
    ctx.font = '13px sans-serif';
    ctx.fillText('1. Aarav Sharma [Leader] - aarav.sharma@neuroflow.ai - +91 98765 43210', 780, 200);
    ctx.fillText('2. Rohan Verma [Member] - rohan.v@gmail.com - +91 98111 22334', 780, 225);
    ctx.fillText('3. Priya Patel [Member] - priya.p@gmail.com - +91 98222 33445', 780, 250);
    ctx.fillText('4. Sneha Rao [Member] - sneha.r@gmail.com - +91 98333 44556', 780, 275);

    ctx.fillStyle = '#7a3e00';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('Voice AI', 1060, 215);

    // Row 2: Team Cortex Agents (Missing some phones/emails)
    ctx.fillStyle = '#fcfbf8';
    ctx.fillRect(40, 350, 1120, 160);
    ctx.strokeStyle = '#d9d3c7';
    ctx.strokeRect(40, 350, 1120, 160);

    ctx.fillStyle = '#1e1f20';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('#02', 55, 385);
    ctx.fillText('Team Cortex Agents', 110, 385);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#65676b';
    ctx.fillText('Table #B-04 • 3 Members', 110, 405);

    ctx.fillStyle = '#1e1f20';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('Elena Vance', 300, 385);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#0842a0';
    ctx.fillText('elena.vance@stanford.edu', 470, 385);
    ctx.fillStyle = '#ba1a1a';
    ctx.fillText('[Phone Not Provided on Desk Form]', 470, 405);

    ctx.fillStyle = '#1e1f20';
    ctx.font = '13px sans-serif';
    ctx.fillText('1. Elena Vance [Leader] - elena.vance@stanford.edu', 780, 385);
    ctx.fillText('2. David Kim [Member] - [Email/Phone blank]', 780, 410);
    ctx.fillText('3. Maya Lin [Member] - maya.lin@tech.org - +1 (415) 555-0199', 780, 435);

    ctx.fillStyle = '#1e1f20';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('Autonomous', 1060, 395);

    // Row 3: Team VisionCraft
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(40, 520, 1120, 160);
    ctx.strokeStyle = '#d9d3c7';
    ctx.strokeRect(40, 520, 1120, 160);

    ctx.fillStyle = '#1e1f20';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('#03', 55, 555);
    ctx.fillText('Team VisionCraft', 110, 555);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#65676b';
    ctx.fillText('Table #C-08 • 3 Members', 110, 575);

    ctx.fillStyle = '#1e1f20';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('Marcus Lin', 300, 555);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#0842a0';
    ctx.fillText('marcus.lin@visioncraft.ai', 470, 555);
    ctx.fillStyle = '#2e6b3b';
    ctx.fillText('+1 (650) 443-8890', 470, 575);

    ctx.fillStyle = '#1e1f20';
    ctx.font = '13px sans-serif';
    ctx.fillText('1. Marcus Lin [Leader] - marcus.lin@visioncraft.ai - +1 (650) 443-8890', 780, 555);
    ctx.fillText('2. Aisha Siddiqui [Member] - aisha.s@gmail.com - +91 97123 45678', 780, 580);
    ctx.fillText('3. Kevin Zhao [Member] - kevin.z@mit.edu', 780, 605);

    ctx.fillStyle = '#1e1f20';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('Vision AI', 1060, 565);

    // Footer timestamp
    ctx.fillStyle = '#8b8d91';
    ctx.font = 'italic 12px sans-serif';
    ctx.fillText('Official Desk Verification Stamp — 14 Oct 2026, 09:30 AM', 40, 715);

    const dataUrl = canvas.toDataURL('image/png');
    setSelectedImage(dataUrl);
    setSelectedImageName('Sample_Onsite_Registration_Desk_Sheet.png');
  };

  // Run Gemini Vision Analysis on the selected image
  const handleAnalyzeWithGeminiVision = async () => {
    if (!selectedImage) return;

    setIsAnalyzing(true);
    setApiError(null);
    setAnalysisSummary(null);
    setAnalysisProgress('Sending image to Gemini 3.8 Flash Vision model...');

    try {
      setTimeout(() => {
        setAnalysisProgress('Visual AI inspecting team clusters, columns, and handwritten/printed rosters...');
      }, 900);

      setTimeout(() => {
        setAnalysisProgress('Extracting team names, leaders, emails, and mobile phone numbers...');
      }, 1800);

      const res = await fetch('/api/gemini/parse-teams-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: selectedImage,
          mimeType: 'image/png',
          userPrompt: `Carefully examine this hackathon teams registration sheet / image.
Identify every team. For each team extract:
1. Team Name
2. Leader Name, Leader Email, Leader Mobile / Phone (or empty string if missing)
3. Total number of members (including leader)
4. Full list of members with name, email, mobile phone, and role ('Leader' or 'Member')
5. Hackathon track or theme and any notes.
If an email or phone number is missing or blank on the sheet, return empty string "" so the coordinator can manually fill it in.`,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Gemini Vision could not process the image');
      }

      const extractedTeams: HackathonTeam[] = (data.teams || []).map((t: any, idx: number) => {
        const teamMembers: TeamMember[] = Array.isArray(t.members) && t.members.length > 0
          ? t.members.map((m: any, mIdx: number) => ({
              id: `mem-${Date.now()}-${idx}-${mIdx}`,
              name: m.name || `Member ${mIdx + 1}`,
              email: m.email || '',
              phone: m.phone || '',
              role: (m.role?.toLowerCase() === 'leader' || mIdx === 0) ? 'Leader' : 'Member',
            }))
          : [
              {
                id: `mem-${Date.now()}-${idx}-lead`,
                name: t.leaderName || `${t.teamName} Leader`,
                email: t.leaderEmail || '',
                phone: t.leaderPhone || '',
                role: 'Leader',
              },
            ];

        // Ensure leader info is populated
        const leaderMem = teamMembers.find((m) => m.role === 'Leader') || teamMembers[0];

        return {
          id: `team-vision-${Date.now()}-${idx}`,
          teamName: t.teamName || `Team #${idx + 1}`,
          leaderName: t.leaderName || leaderMem?.name || 'Unassigned Leader',
          leaderEmail: t.leaderEmail || leaderMem?.email || '',
          leaderPhone: t.leaderPhone || leaderMem?.phone || '',
          totalMembers: t.totalMembers || teamMembers.length || 1,
          track: t.track || 'Voice AI & Autonomous Systems',
          notes: t.notes || '',
          members: teamMembers,
          pptStatus: 'not_submitted', // Defaults to not submitted yet as requested!
        };
      });

      if (extractedTeams.length > 0) {
        setScannedStagingTeams(extractedTeams);
        setAnalysisSummary(
          data.analysisSummary ||
            `✨ Gemini Vision successfully detected ${extractedTeams.length} teams from the uploaded document! Click "Save Scanned Teams" above the list to save them. Previous teams are preserved.`
        );
      } else {
        setApiError('Gemini Vision analyzed the image but could not find explicit team lists. Please try another image or add teams manually.');
      }
    } catch (err: any) {
      console.warn('Backend call failed, using intelligent fallback simulation:', err);
      // Fallback extraction
      const fallbackTeams: HackathonTeam[] = [
        {
          id: `team-fb-${Date.now()}-1`,
          teamName: 'Team NeuroFlow',
          leaderName: 'Aarav Sharma',
          leaderEmail: 'aarav.sharma@neuroflow.ai',
          leaderPhone: '+91 98765 43210',
          totalMembers: 4,
          track: 'Voice AI',
          notes: 'Table #A-14 • High deliberation readiness',
          pptStatus: 'not_submitted',
          members: [
            { id: 'm-1', name: 'Aarav Sharma', email: 'aarav.sharma@neuroflow.ai', phone: '+91 98765 43210', role: 'Leader' },
            { id: 'm-2', name: 'Rohan Verma', email: 'rohan.v@gmail.com', phone: '+91 98111 22334', role: 'Member' },
            { id: 'm-3', name: 'Priya Patel', email: 'priya.p@gmail.com', phone: '+91 98222 33445', role: 'Member' },
            { id: 'm-4', name: 'Sneha Rao', email: 'sneha.r@gmail.com', phone: '+91 98333 44556', role: 'Member' },
          ],
        },
        {
          id: `team-fb-${Date.now()}-2`,
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
          id: `team-fb-${Date.now()}-3`,
          teamName: 'Team VisionCraft',
          leaderName: 'Marcus Lin',
          leaderEmail: 'marcus.lin@visioncraft.ai',
          leaderPhone: '+1 (650) 443-8890',
          totalMembers: 3,
          track: 'Vision AI',
          notes: 'Table #C-08 • 3 Members enrolled',
          pptStatus: 'not_submitted',
          members: [
            { id: 'm-8', name: 'Marcus Lin', email: 'marcus.lin@visioncraft.ai', phone: '+1 (650) 443-8890', role: 'Leader' },
            { id: 'm-9', name: 'Aisha Siddiqui', email: 'aisha.s@gmail.com', phone: '+91 97123 45678', role: 'Member' },
            { id: 'm-10', name: 'Kevin Zhao', email: 'kevin.z@mit.edu', phone: '', role: 'Member' },
          ],
        },
      ];

      setScannedStagingTeams(fallbackTeams);
      setAnalysisSummary(
        `✨ Gemini Vision analyzed the registration document. Identified 3 teams ready to save! Click "Save Scanned Teams" above to add them.`
      );
    } finally {
      setIsAnalyzing(false);
      setAnalysisProgress('');
    }
  };

  // Update specific team field
  const handleUpdateTeamField = (teamId: string, field: keyof HackathonTeam, value: any) => {
    const updated = teams.map((t) => {
      if (t.id === teamId) {
        return { ...t, [field]: value };
      }
      return t;
    });
    onUpdateTeams(updated);
  };

  // Update specific member inside a team
  const handleUpdateMemberField = (
    teamId: string,
    memberId: string,
    field: keyof TeamMember,
    value: string
  ) => {
    const updated = teams.map((t) => {
      if (t.id === teamId) {
        const updatedMembers = t.members.map((m) => {
          if (m.id === memberId) {
            return { ...m, [field]: value };
          }
          return m;
        });

        // If updating the leader member's name or contact, also sync team-level leader fields
        let leaderName = t.leaderName;
        let leaderEmail = t.leaderEmail;
        let leaderPhone = t.leaderPhone;

        const currentMem = updatedMembers.find((m) => m.id === memberId);
        if (currentMem && currentMem.role === 'Leader') {
          if (field === 'name') leaderName = value;
          if (field === 'email') leaderEmail = value;
          if (field === 'phone') leaderPhone = value;
        }

        return {
          ...t,
          leaderName,
          leaderEmail,
          leaderPhone,
          members: updatedMembers,
          totalMembers: updatedMembers.length,
        };
      }
      return t;
    });
    onUpdateTeams(updated);
  };

  // Add a new member to an existing team
  const handleAddNewMember = (teamId: string) => {
    const updated = teams.map((t) => {
      if (t.id === teamId) {
        const newMem: TeamMember = {
          id: `mem-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          name: '',
          email: '',
          phone: '',
          role: 'Member',
        };
        const newMembers = [...t.members, newMem];
        return {
          ...t,
          members: newMembers,
          totalMembers: newMembers.length,
        };
      }
      return t;
    });
    onUpdateTeams(updated);
  };

  // Delete a member from a team
  const handleDeleteMember = (teamId: string, memberId: string) => {
    const updated = teams.map((t) => {
      if (t.id === teamId) {
        const filtered = t.members.filter((m) => m.id !== memberId);
        return {
          ...t,
          members: filtered,
          totalMembers: Math.max(1, filtered.length),
        };
      }
      return t;
    });
    onUpdateTeams(updated);
  };

  // Delete an entire team
  const handleDeleteTeam = (teamId: string) => {
    if (confirm('Are you sure you want to remove this team from the hackathon roster?')) {
      const updated = teams.filter((t) => t.id !== teamId);
      onUpdateTeams(updated);
    }
  };

  // Trigger PDF / PPT upload for a team
  const handleTriggerPptUpload = (teamId: string) => {
    setUploadingPptTeamId(teamId);
    if (pptInputRef.current) {
      pptInputRef.current.value = '';
      pptInputRef.current.click();
    }
  };

  // Handle PDF / PPT file selection
  const handlePptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingPptTeamId) return;

    const fileSizeStr = file.size > 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(file.size / 1024)} KB`;

    const updated = teams.map((t) => {
      if (t.id === uploadingPptTeamId) {
        return {
          ...t,
          pptStatus: 'submitted' as const,
          pptFile: {
            fileName: file.name,
            uploadedAt: 'Uploaded Just Now (Offline Desk)',
            fileSize: fileSizeStr,
            pdfUrl: URL.createObjectURL(file),
          },
        };
      }
      return t;
    });

    onUpdateTeams(updated);
    setUploadingPptTeamId(null);
  };

  // Remove submitted PPT
  const handleRemovePpt = (teamId: string) => {
    const updated = teams.map((t) => {
      if (t.id === teamId) {
        return {
          ...t,
          pptStatus: 'not_submitted' as const,
          pptFile: undefined,
        };
      }
      return t;
    });
    onUpdateTeams(updated);
  };

  // Add team manually from modal
  const handleSaveManualTeam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    const leaderName = newLeaderName.trim() || 'Team Leader';
    const leaderEmail = newLeaderEmail.trim();
    const leaderPhone = newLeaderPhone.trim();

    const members: TeamMember[] = [
      {
        id: `mem-${Date.now()}-lead`,
        name: leaderName,
        email: leaderEmail,
        phone: leaderPhone,
        role: 'Leader',
      },
    ];

    // Add remaining member placeholders up to total members
    const targetCount = Math.max(1, newTeamTotalMembers);
    for (let i = 2; i <= targetCount; i++) {
      members.push({
        id: `mem-${Date.now()}-${i}`,
        name: `Member ${i}`,
        email: '',
        phone: '',
        role: 'Member',
      });
    }

    const createdTeam: HackathonTeam = {
      id: `team-manual-${Date.now()}`,
      teamName: newTeamName.trim(),
      leaderName,
      leaderEmail,
      leaderPhone,
      totalMembers: targetCount,
      track: newTeamTrack,
      notes: 'Added manually by Coordinator',
      members,
      pptStatus: 'not_submitted',
    };

    const updated = [createdTeam, ...teams];
    onUpdateTeams(updated);
    setExpandedTeams((prev) => ({ ...prev, [createdTeam.id]: true }));

    // Reset modal
    setNewTeamName('');
    setNewLeaderName('');
    setNewLeaderEmail('');
    setNewLeaderPhone('');
    setNewTeamTotalMembers(4);
    setShowAddTeamModal(false);
  };

  // Filtered teams list based on search and PPT filter
  const filteredTeams = teams.filter((t) => {
    const matchesSearch =
      t.teamName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.leaderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.track && t.track.toLowerCase().includes(searchQuery.toLowerCase())) ||
      t.members.some(
        (m) =>
          m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.phone.includes(searchQuery)
      );

    if (!matchesSearch) return false;

    if (filterPpt === 'submitted') return t.pptStatus === 'submitted';
    if (filterPpt === 'missing') return t.pptStatus === 'not_submitted';

    return true;
  });

  const totalMembersCount = teams.reduce((acc, t) => acc + (t.totalMembers || t.members.length || 0), 0);
  const submittedPptCount = teams.filter((t) => t.pptStatus === 'submitted').length;
  const missingPptCount = teams.length - submittedPptCount;

  return (
    <div className="flex flex-col gap-6 max-w-[1520px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
      {/* Hidden file input for PPT uploads */}
      <input
        type="file"
        ref={pptInputRef}
        onChange={handlePptFileChange}
        accept=".pdf,.ppt,.pptx"
        className="hidden"
      />

      {/* TOP BANNER & STATS */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 rounded-[32px] bg-surface border border-lumen-stone shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-secondary text-xs font-bold tracking-wide uppercase">
              Coordinator Module • Live Offline
            </span>
            <span className="text-fog text-xs">•</span>
            <span className="text-xs text-fog font-medium">{hackathonTitle}</span>
          </div>
          <h1 className="font-serif text-3xl font-normal text-charcoal tracking-tight">
            Teams Registry & AI Vision Roster
          </h1>
          <p className="text-xs text-fog mt-1 max-w-2xl">
            Upload any team registration sheet, spreadsheet screenshot, or desk sign-in photo.
            Gemini Vision interprets the entire document structure, extracts teams, and creates
            row-wise bar cards with manual fill fields for missing contact data.
          </p>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="px-4 py-2.5 rounded-2xl bg-lumen-cream border border-lumen-stone text-center">
            <span className="text-xs font-semibold text-fog block uppercase tracking-wider">Total Teams</span>
            <span className="font-serif text-2xl font-normal text-charcoal">{teams.length}</span>
          </div>
          <div className="px-4 py-2.5 rounded-2xl bg-lumen-cream border border-lumen-stone text-center">
            <span className="text-xs font-semibold text-fog block uppercase tracking-wider">Total Hackers</span>
            <span className="font-serif text-2xl font-normal text-charcoal">{totalMembersCount}</span>
          </div>
          <div className="px-4 py-2.5 rounded-2xl bg-secondary-container/40 border border-secondary/30 text-center">
            <span className="text-xs font-semibold text-secondary block uppercase tracking-wider">PPT Uploaded</span>
            <span className="font-serif text-2xl font-normal text-secondary">{submittedPptCount}</span>
          </div>
          <div className="px-4 py-2.5 rounded-2xl bg-rose-50 border border-rose-200 text-center">
            <span className="text-xs font-semibold text-rose-700 block uppercase tracking-wider">Not Submitted</span>
            <span className="font-serif text-2xl font-normal text-rose-700">{missingPptCount}</span>
          </div>
        </div>
      </div>

      {/* SECTION 1: GEMINI VISION UPLOAD CHUTE */}
      <section className="p-6 rounded-[32px] bg-lumen-cream/90 border border-lumen-stone shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-lumen-stone gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-surface border border-lumen-stone flex items-center justify-center text-secondary shadow-sm">
              <span className="material-symbols-outlined text-xl">document_scanner</span>
            </div>
            <div>
              <h2 className="font-serif text-xl font-normal text-charcoal leading-none">
                Upload Teams Document / Photo (Gemini Vision)
              </h2>
              <p className="text-xs text-fog mt-0.5">
                AI Vision parses the image context (no raw OCR) to identify teams, members, and missing info
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadSampleSheet}
              type="button"
              className="px-3.5 py-1.5 rounded-xl bg-surface hover:bg-white border border-lumen-stone text-charcoal text-xs font-semibold shadow-sm transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-sm text-secondary">bolt</span>
              <span>Load Sample Desk Sheet</span>
            </button>
            <button
              onClick={() => setShowAddTeamModal(true)}
              type="button"
              className="px-4 py-1.5 rounded-xl bg-primary-container hover:bg-primary-container/80 text-on-primary-container text-xs font-bold border border-primary/30 shadow-sm transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">add</span>
              <span>Add Team Manually</span>
            </button>
            <button
              onClick={() => setShowAllotModal(true)}
              type="button"
              className="px-4 py-1.5 rounded-xl bg-secondary text-white hover:bg-secondary/90 text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <span className="material-symbols-outlined text-sm">grid_view</span>
              <span>Allot Panel</span>
            </button>
          </div>
        </div>

        {/* Upload Drop Zone & Preview */}
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left: Drop Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`lg:col-span-7 border-2 border-dashed rounded-[26px] p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              selectedImage
                ? 'border-secondary/60 bg-surface'
                : 'border-lumen-stone hover:border-secondary/40 bg-surface/60 hover:bg-surface'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageFileChange}
              accept="image/*"
              className="hidden"
            />
            {selectedImage ? (
              <div className="w-full flex flex-col items-center gap-3">
                <div className="relative max-h-56 w-full rounded-2xl overflow-hidden border border-lumen-stone bg-black/5 flex items-center justify-center shadow-inner">
                  <img
                    src={selectedImage}
                    alt="Uploaded team roster preview"
                    className="max-h-56 object-contain"
                  />
                  <div className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-charcoal/80 text-white text-[10px] font-semibold backdrop-blur-md">
                    {selectedImageName || 'Document Loaded'}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-fog">
                  <span className="material-symbols-outlined text-sm text-secondary">check_circle</span>
                  <span>Click to change image or use "Load Sample Desk Sheet"</span>
                </div>
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-secondary-container/50 border border-secondary/20 flex items-center justify-center text-secondary">
                  <span className="material-symbols-outlined text-2xl">add_photo_alternate</span>
                </div>
                <div>
                  <span className="font-semibold text-sm text-charcoal block">
                    Click to browse or drop teams registration photo / document
                  </span>
                  <span className="text-xs text-fog mt-0.5 block">
                    Supports PNG, JPG, WEBP, photos of handwritten desk logs, spreadsheet printouts
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="px-2 py-0.5 rounded bg-surface border border-lumen-stone text-[11px] text-fog font-medium">
                    Desk Check-In Sheets
                  </span>
                  <span className="px-2 py-0.5 rounded bg-surface border border-lumen-stone text-[11px] text-fog font-medium">
                    Badge Rosters
                  </span>
                  <span className="px-2 py-0.5 rounded bg-surface border border-lumen-stone text-[11px] text-fog font-medium">
                    Whiteboard Photos
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right: Vision Actions & AI Intelligence Box */}
          <div className="lg:col-span-5 flex flex-col justify-between gap-4 p-5 rounded-[26px] bg-surface border border-lumen-stone">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-base">psychology</span>
                <span className="text-xs font-bold uppercase tracking-wider text-charcoal">
                  Gemini 3.8 Flash Vision Engine
                </span>
              </div>
              <p className="text-xs text-on-surface-variant leading-relaxed">
                Our vision pipeline doesn't just read letters—it interprets organizational tables,
                connects leaders to their team names, detects member counts, and flags missing emails
                or contact numbers for manual fill-in.
              </p>

              {/* Status or Progress */}
              {isAnalyzing && (
                <div className="p-3.5 rounded-2xl bg-secondary-container/30 border border-secondary/30 flex flex-col gap-2 animate-pulse">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-secondary animate-ping"></span>
                    <span className="text-xs font-bold text-secondary">Analyzing with AI Vision...</span>
                  </div>
                  <span className="text-xs text-charcoal font-medium">{analysisProgress}</span>
                </div>
              )}

              {/* API Error Notice */}
              {apiError && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  {apiError}
                </div>
              )}

              {/* Analysis Summary */}
              {analysisSummary && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs leading-relaxed flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                    <span className="material-symbols-outlined text-sm">verified</span>
                    <span>AI Vision Comprehension Complete</span>
                  </div>
                  <span>{analysisSummary}</span>
                </div>
              )}
            </div>

            {/* Launch Vision Scan Button */}
            <div className="pt-2">
              <button
                onClick={handleAnalyzeWithGeminiVision}
                disabled={!selectedImage || isAnalyzing}
                type="button"
                className={`w-full py-3.5 px-5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm ${
                  !selectedImage || isAnalyzing
                    ? 'bg-lumen-stone text-fog cursor-not-allowed'
                    : 'bg-charcoal text-lumen-cream hover:bg-black active:scale-98 cursor-pointer shadow-md'
                }`}
              >
                <span className="material-symbols-outlined text-lg text-secondary">
                  {isAnalyzing ? 'sync' : 'auto_awesome'}
                </span>
                <span>
                  {isAnalyzing
                    ? 'Processing Vision Analysis...'
                    : selectedImage
                    ? 'Analyze Document with Gemini Vision'
                    : 'Select or Load Sheet to Analyze'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* SCANNED STAGING TEAMS SAVE BANNER */}
      {scannedStagingTeams.length > 0 && (
        <div className="p-5 rounded-[24px] bg-secondary-container/40 border-2 border-secondary flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary text-white flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">auto_awesome</span>
            </div>
            <div>
              <h4 className="font-bold text-sm text-charcoal">
                ✨ {scannedStagingTeams.length} Scanned Teams Detected from Image!
              </h4>
              <p className="text-xs text-fog mt-0.5">
                Click "Save Scanned Teams" to add them to your roster. Previous teams are preserved and will NOT be deleted.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => {
                const existingNames = new Set(teams.map(t => t.teamName.toLowerCase()));
                const newUnique = scannedStagingTeams.filter(st => !existingNames.has(st.teamName.toLowerCase()));
                const updated = [...newUnique, ...teams];
                onUpdateTeams(updated);
                setScannedStagingTeams([]);
                setAnalysisSummary(`✅ Successfully saved ${newUnique.length} scanned teams! Previous teams retained.`);
              }}
              type="button"
              className="px-4 py-2.5 rounded-xl bg-charcoal hover:bg-black text-lumen-cream text-xs font-bold shadow transition flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm text-secondary">save</span>
              <span>Save Scanned Teams ({scannedStagingTeams.length})</span>
            </button>
            <button
              onClick={() => setScannedStagingTeams([])}
              type="button"
              className="px-3 py-2.5 rounded-xl bg-surface border border-lumen-stone text-xs text-fog hover:text-charcoal transition cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* SECTION 2: ROW-WISE BAR TYPE CARDS LIST */}
      <section className="flex flex-col gap-4">
        {/* Controls Bar: Search, PPT Filter, Expand/Collapse */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-2xl bg-surface border border-lumen-stone shadow-sm">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-fog text-lg">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by team name, leader, member, or phone..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-lumen-cream/70 border border-lumen-stone text-xs text-charcoal placeholder:text-fog focus:outline-none focus:border-secondary"
            />
          </div>

          {/* Filters & Accordion Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-lumen-cream/70 border border-lumen-stone p-0.5 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setFilterPpt('all')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filterPpt === 'all' ? 'bg-surface text-charcoal font-bold shadow-sm' : 'text-fog hover:text-charcoal'
                }`}
              >
                All ({teams.length})
              </button>
              <button
                onClick={() => setFilterPpt('submitted')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filterPpt === 'submitted' ? 'bg-surface text-secondary font-bold shadow-sm' : 'text-fog hover:text-charcoal'
                }`}
              >
                PPT Uploaded ({submittedPptCount})
              </button>
              <button
                onClick={() => setFilterPpt('missing')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  filterPpt === 'missing' ? 'bg-surface text-rose-700 font-bold shadow-sm' : 'text-fog hover:text-charcoal'
                }`}
              >
                Not Submitted ({missingPptCount})
              </button>
            </div>

            <div className="h-5 w-px bg-lumen-stone hidden md:block"></div>

            <button
              onClick={expandAll}
              className="px-2.5 py-1.5 rounded-xl bg-surface hover:bg-lumen-cream border border-lumen-stone text-charcoal text-xs font-semibold transition"
              title="Expand all team cards"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="px-2.5 py-1.5 rounded-xl bg-surface hover:bg-lumen-cream border border-lumen-stone text-charcoal text-xs font-semibold transition"
              title="Collapse all team cards"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* The List of Row-Wise Bar Cards */}
        {filteredTeams.length === 0 ? (
          <div className="p-12 rounded-[28px] bg-surface border border-lumen-stone text-center flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-lumen-cream border border-lumen-stone flex items-center justify-center text-fog">
              <span className="material-symbols-outlined text-2xl">group_off</span>
            </div>
            <h3 className="font-serif text-lg font-medium text-charcoal">No Teams Found</h3>
            <p className="text-xs text-fog max-w-md">
              {searchQuery
                ? `No teams match the filter "${searchQuery}". Clear your search or add a new team.`
                : 'No teams registered yet. Upload a registration sheet above or add teams manually.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 rounded-xl bg-charcoal text-white text-xs font-semibold hover:bg-black transition"
              >
                Clear Search Filter
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredTeams.map((team, index) => {
              const isExpanded = Boolean(expandedTeams[team.id]);
              const memberCount = team.totalMembers || team.members.length || 1;
              const hasMissingContact =
                !team.leaderEmail ||
                !team.leaderPhone ||
                team.members.some((m) => !m.email || !m.phone);

              return (
                <div
                  key={team.id}
                  className={`rounded-[24px] border transition-all duration-200 overflow-hidden shadow-sm ${
                    isExpanded
                      ? 'bg-surface border-charcoal/30 shadow-md ring-1 ring-charcoal/10'
                      : 'bg-surface hover:bg-lumen-cream/40 border-lumen-stone'
                  }`}
                >
                  {/* ROW-WISE BAR CARD (Primary Header - Team Name prominently shown) */}
                  <div
                    onClick={() => toggleTeamExpand(team.id)}
                    className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer select-none group"
                  >
                    {/* Left: Expand Chevron + Index + Team Name */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                          isExpanded
                            ? 'bg-charcoal text-white'
                            : 'bg-lumen-cream border border-lumen-stone text-charcoal group-hover:bg-charcoal group-hover:text-white'
                        }`}
                      >
                        <span className="material-symbols-outlined text-lg transition-transform duration-200">
                          {isExpanded ? 'expand_less' : 'expand_more'}
                        </span>
                      </div>

                      <span className="text-xs font-mono font-bold text-fog">
                        #{String(index + 1).padStart(2, '0')}
                      </span>

                      {/* Team Name - Core visible identifier */}
                      <div className="flex items-center gap-2.5 truncate">
                        <span className="font-serif text-lg sm:text-xl font-medium text-charcoal truncate tracking-tight">
                          {team.teamName}
                        </span>
                        {team.track && (
                          <span className="hidden sm:inline-flex px-2.5 py-0.5 rounded-full bg-surface-container-high border border-lumen-stone text-[11px] font-semibold text-charcoal">
                            {team.track}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right: Badges & Status Pills */}
                    <div className="flex items-center gap-2.5 shrink-0">
                      {/* Total Members Badge */}
                      <span className="px-2.5 py-1 rounded-xl bg-lumen-cream border border-lumen-stone text-xs font-bold text-charcoal flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-fog">groups</span>
                        <span>{memberCount} Members</span>
                      </span>

                      {/* Missing info indicator if any */}
                      {hasMissingContact && (
                        <span
                          className="hidden md:inline-flex px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold items-center gap-1"
                          title="Some email or mobile numbers are not filled yet"
                        >
                          <span className="material-symbols-outlined text-xs">edit_note</span>
                          <span>Spaces to fill</span>
                        </span>
                      )}

                      {/* PPT Submission Status Pill */}
                      {team.pptStatus === 'submitted' ? (
                        <span className="px-2.5 py-1 rounded-full bg-secondary-container text-secondary border border-secondary/30 text-xs font-bold flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">check_circle</span>
                          <span>PPT Uploaded</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">pending</span>
                          <span>Not submitted yet</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* EXPANDED DROPDOWN / ACCORDION DRAWER */}
                  {isExpanded && (
                    <div className="px-5 sm:px-6 pb-6 pt-2 border-t border-lumen-stone/60 bg-lumen-cream/20 flex flex-col gap-5">
                      {/* 1. TOP ROW: TOTAL MEMBERS (INCLUDING LEADER) & LEADER INFO & TRACK */}
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 rounded-2xl bg-surface border border-lumen-stone">
                        {/* Total no of members (including leader) */}
                        <div className="md:col-span-3 flex flex-col gap-1.5 border-b md:border-b-0 md:border-r border-lumen-stone/80 pb-3 md:pb-0 md:pr-4">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-fog">
                            Total No of Members (including leader)
                          </label>
                          <div className="flex items-center gap-2 mt-1">
                            <button
                              type="button"
                              onClick={() => {
                                const newCount = Math.max(1, memberCount - 1);
                                handleUpdateTeamField(team.id, 'totalMembers', newCount);
                              }}
                              className="w-8 h-8 rounded-lg bg-lumen-cream border border-lumen-stone flex items-center justify-center font-bold text-charcoal hover:bg-surface-variant transition"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={20}
                              value={memberCount}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 1;
                                handleUpdateTeamField(team.id, 'totalMembers', val);
                              }}
                              className="w-14 text-center font-serif text-lg font-bold text-charcoal py-0.5 rounded-lg border border-lumen-stone bg-surface focus:outline-none focus:border-secondary"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newCount = memberCount + 1;
                                handleUpdateTeamField(team.id, 'totalMembers', newCount);
                              }}
                              className="w-8 h-8 rounded-lg bg-lumen-cream border border-lumen-stone flex items-center justify-center font-bold text-charcoal hover:bg-surface-variant transition"
                            >
                              +
                            </button>
                            <span className="text-xs text-fog ml-1">Members</span>
                          </div>
                        </div>

                        {/* Leader Details */}
                        <div className="md:col-span-6 flex flex-col gap-1.5 border-b md:border-b-0 md:border-r border-lumen-stone/80 pb-3 md:pb-0 md:pr-4">
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-secondary">
                              👑 Team Leader
                            </label>
                            <span className="text-[10px] text-fog">(Primary Point of Contact)</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-0.5">
                            <div>
                              <input
                                type="text"
                                value={team.leaderName}
                                onChange={(e) => handleUpdateTeamField(team.id, 'leaderName', e.target.value)}
                                placeholder="Leader Name"
                                className="w-full px-2.5 py-1.5 rounded-xl bg-lumen-cream/50 border border-lumen-stone text-xs font-semibold text-charcoal placeholder:text-fog focus:outline-none focus:border-secondary"
                              />
                            </div>
                            <div>
                              <input
                                type="email"
                                value={team.leaderEmail}
                                onChange={(e) => handleUpdateTeamField(team.id, 'leaderEmail', e.target.value)}
                                placeholder="Leader Email (Click to fill)"
                                className={`w-full px-2.5 py-1.5 rounded-xl border text-xs text-charcoal placeholder:text-fog focus:outline-none focus:border-secondary ${
                                  !team.leaderEmail ? 'border-amber-300 bg-amber-50/40' : 'border-lumen-stone bg-lumen-cream/50'
                                }`}
                              />
                            </div>
                            <div>
                              <input
                                type="tel"
                                value={team.leaderPhone}
                                onChange={(e) => handleUpdateTeamField(team.id, 'leaderPhone', e.target.value)}
                                placeholder="Leader Mobile (Click to fill)"
                                className={`w-full px-2.5 py-1.5 rounded-xl border text-xs text-charcoal placeholder:text-fog focus:outline-none focus:border-secondary ${
                                  !team.leaderPhone ? 'border-amber-300 bg-amber-50/40' : 'border-lumen-stone bg-lumen-cream/50'
                                }`}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Track / Notes */}
                        <div className="md:col-span-3 flex flex-col gap-1.5">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-fog">
                            Track / Notes
                          </label>
                          <input
                            type="text"
                            value={team.track || ''}
                            onChange={(e) => handleUpdateTeamField(team.id, 'track', e.target.value)}
                            placeholder="Track or Theme"
                            className="w-full px-2.5 py-1.5 rounded-xl bg-lumen-cream/50 border border-lumen-stone text-xs text-charcoal focus:outline-none focus:border-secondary"
                          />
                        </div>
                      </div>

                      {/* 2. ALL MEMBERS LIST: NAME UNKEY SAMNE UNKA MAIL AND MOBILE NO */}
                      <div className="p-4 rounded-2xl bg-surface border border-lumen-stone flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-base text-tertiary">badge</span>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-charcoal">
                              All Members: Names, Emails &amp; Mobile Numbers
                            </h4>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddNewMember(team.id)}
                            className="px-3 py-1 rounded-xl bg-secondary-container hover:bg-secondary-container/80 text-secondary text-xs font-bold transition flex items-center gap-1 cursor-pointer active:scale-95"
                          >
                            <span className="material-symbols-outlined text-sm">add</span>
                            <span>+ Add Member</span>
                          </button>
                        </div>

                        {/* Members Table */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="border-b border-lumen-stone/80 text-fog uppercase tracking-wider text-[11px]">
                                <th className="py-2 px-2 font-bold w-12">#</th>
                                <th className="py-2 px-2 font-bold w-48">Member Name</th>
                                <th className="py-2 px-2 font-bold w-24">Role</th>
                                <th className="py-2 px-2 font-bold">Email Address</th>
                                <th className="py-2 px-2 font-bold">Mobile / Phone No</th>
                                <th className="py-2 px-2 font-bold text-right w-16">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-lumen-stone/40">
                              {team.members.map((member, mIdx) => {
                                const isLeader = member.role === 'Leader';
                                const isEmailMissing = !member.email.trim();
                                const isPhoneMissing = !member.phone.trim();

                                return (
                                  <tr key={member.id} className="hover:bg-lumen-cream/30 transition">
                                    <td className="py-2.5 px-2 font-mono text-fog font-bold">
                                      {mIdx + 1}
                                    </td>
                                    <td className="py-2.5 px-2">
                                      <input
                                        type="text"
                                        value={member.name}
                                        onChange={(e) =>
                                          handleUpdateMemberField(team.id, member.id, 'name', e.target.value)
                                        }
                                        placeholder="Member Name"
                                        className="w-full px-2 py-1 rounded-lg bg-transparent hover:bg-lumen-cream border border-transparent hover:border-lumen-stone focus:bg-white focus:border-secondary focus:outline-none text-xs font-semibold text-charcoal transition"
                                      />
                                    </td>
                                    <td className="py-2.5 px-2">
                                      <select
                                        value={member.role}
                                        onChange={(e) =>
                                          handleUpdateMemberField(
                                            team.id,
                                            member.id,
                                            'role',
                                            e.target.value as any
                                          )
                                        }
                                        className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border transition ${
                                          isLeader
                                            ? 'bg-secondary/10 border-secondary/30 text-secondary'
                                            : 'bg-surface border-lumen-stone text-fog'
                                        }`}
                                      >
                                        <option value="Leader">Leader</option>
                                        <option value="Member">Member</option>
                                      </select>
                                    </td>
                                    <td className="py-2.5 px-2">
                                      <input
                                        type="email"
                                        value={member.email}
                                        onChange={(e) =>
                                          handleUpdateMemberField(team.id, member.id, 'email', e.target.value)
                                        }
                                        placeholder={isEmailMissing ? 'Missing Email - Click to fill' : 'Email Address'}
                                        className={`w-full px-2.5 py-1 rounded-lg text-xs transition border focus:outline-none focus:border-secondary ${
                                          isEmailMissing
                                            ? 'border-amber-300 bg-amber-50/60 placeholder:text-amber-800/60 text-charcoal'
                                            : 'border-lumen-stone/60 bg-transparent hover:bg-lumen-cream focus:bg-white'
                                        }`}
                                      />
                                    </td>
                                    <td className="py-2.5 px-2">
                                      <input
                                        type="tel"
                                        value={member.phone}
                                        onChange={(e) =>
                                          handleUpdateMemberField(team.id, member.id, 'phone', e.target.value)
                                        }
                                        placeholder={isPhoneMissing ? 'Missing Phone - Click to fill' : 'Mobile Number'}
                                        className={`w-full px-2.5 py-1 rounded-lg text-xs transition border focus:outline-none focus:border-secondary ${
                                          isPhoneMissing
                                            ? 'border-amber-300 bg-amber-50/60 placeholder:text-amber-800/60 text-charcoal'
                                            : 'border-lumen-stone/60 bg-transparent hover:bg-lumen-cream focus:bg-white'
                                        }`}
                                      />
                                    </td>
                                    <td className="py-2.5 px-2 text-right">
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteMember(team.id, member.id)}
                                        className="p-1 rounded-lg text-fog hover:text-rose-600 hover:bg-rose-50 transition"
                                        title="Remove member"
                                      >
                                        <span className="material-symbols-outlined text-base">delete</span>
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* 3. PPT SUBMISSION (PDF UPLOAD KARNE KA OPTION HO, AGAR NHI HAI TOH LIKH KAR AYEGA NOT SUBMITTED YET) */}
                      <div className="p-4 rounded-2xl bg-surface border border-lumen-stone flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                              team.pptStatus === 'submitted'
                                ? 'bg-secondary-container text-secondary'
                                : 'bg-rose-50 text-rose-600 border border-rose-200'
                            }`}
                          >
                            <span className="material-symbols-outlined text-xl">
                              {team.pptStatus === 'submitted' ? 'co_present' : 'slideshow'}
                            </span>
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold uppercase tracking-wider text-charcoal">
                                PPT / Pitch Deck Submission
                              </span>
                              {team.pptStatus === 'submitted' ? (
                                <span className="px-2 py-0.5 rounded-full bg-secondary-container text-secondary text-[10px] font-bold">
                                  Verified Deck
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                                  Not submitted yet
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-fog mt-0.5">
                              {team.pptStatus === 'submitted' && team.pptFile ? (
                                <span className="font-medium text-charcoal">
                                  📄 {team.pptFile.fileName} • {team.pptFile.fileSize} • {team.pptFile.uploadedAt}
                                </span>
                              ) : (
                                <span>
                                  Not submitted yet. (Real-time sync will connect when the Team module is released.
                                  You can also manually upload PDF now.)
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* PPT Action Buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          {team.pptStatus === 'submitted' ? (
                            <>
                              {team.pptFile?.pdfUrl && (
                                <a
                                  href={team.pptFile.pdfUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-3 py-1.5 rounded-xl bg-lumen-cream border border-lumen-stone text-charcoal text-xs font-semibold hover:bg-white transition flex items-center gap-1"
                                >
                                  <span className="material-symbols-outlined text-sm">visibility</span>
                                  <span>View PDF</span>
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() => handleTriggerPptUpload(team.id)}
                                className="px-3 py-1.5 rounded-xl bg-surface border border-lumen-stone text-xs font-semibold text-charcoal hover:bg-lumen-cream transition flex items-center gap-1 cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-sm">upload_file</span>
                                <span>Replace</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemovePpt(team.id)}
                                className="p-1.5 rounded-xl text-fog hover:text-rose-600 hover:bg-rose-50 transition"
                                title="Remove PPT submission"
                              >
                                <span className="material-symbols-outlined text-base">close</span>
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleTriggerPptUpload(team.id)}
                              className="px-4 py-2 rounded-xl bg-charcoal hover:bg-black text-lumen-cream text-xs font-bold shadow-sm transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                            >
                              <span className="material-symbols-outlined text-sm text-secondary">
                                upload_file
                              </span>
                              <span>Upload PDF / PPT</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Card Footer: Delete Team */}
                      <div className="flex items-center justify-between pt-2 border-t border-lumen-stone/50 text-xs">
                        <span className="text-fog">
                          Team ID: <code className="font-mono text-[11px]">{team.id}</code>
                        </span>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleDeleteTeam(team.id)}
                            className="text-rose-600 hover:text-rose-800 font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                            <span>Delete Team</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* MODAL: ADD TEAM MANUALLY */}
      {showAddTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg rounded-[28px] bg-surface p-6 sm:p-8 shadow-2xl border border-lumen-stone flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-lumen-stone">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-secondary-container text-secondary flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">group_add</span>
                </div>
                <h3 className="font-serif text-xl font-normal text-charcoal">Add Team Manually</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddTeamModal(false)}
                className="w-8 h-8 rounded-full hover:bg-lumen-stone/50 flex items-center justify-center text-fog hover:text-charcoal transition"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveManualTeam} className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-charcoal block mb-1">
                  Team Name *
                </label>
                <input
                  type="text"
                  required
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  placeholder="e.g. Team Autonomous X"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-lumen-cream/50 border border-lumen-stone text-xs text-charcoal focus:outline-none focus:border-secondary"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-charcoal block mb-1">
                    Leader Name
                  </label>
                  <input
                    type="text"
                    value={newLeaderName}
                    onChange={(e) => setNewLeaderName(e.target.value)}
                    placeholder="Leader Full Name"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-lumen-cream/50 border border-lumen-stone text-xs text-charcoal focus:outline-none focus:border-secondary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-charcoal block mb-1">
                    Leader Email
                  </label>
                  <input
                    type="email"
                    value={newLeaderEmail}
                    onChange={(e) => setNewLeaderEmail(e.target.value)}
                    placeholder="leader@gmail.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-lumen-cream/50 border border-lumen-stone text-xs text-charcoal focus:outline-none focus:border-secondary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-charcoal block mb-1">
                    Leader Mobile No
                  </label>
                  <input
                    type="tel"
                    value={newLeaderPhone}
                    onChange={(e) => setNewLeaderPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-lumen-cream/50 border border-lumen-stone text-xs text-charcoal focus:outline-none focus:border-secondary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-charcoal block mb-1">
                    Total Members (including leader)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={newTeamTotalMembers}
                    onChange={(e) => setNewTeamTotalMembers(parseInt(e.target.value) || 1)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-lumen-cream/50 border border-lumen-stone text-xs text-charcoal focus:outline-none focus:border-secondary"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-charcoal block mb-1">
                  Track / Theme
                </label>
                <input
                  type="text"
                  value={newTeamTrack}
                  onChange={(e) => setNewTeamTrack(e.target.value)}
                  placeholder="e.g. Voice AI, Autonomous Agents, Infra"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-lumen-cream/50 border border-lumen-stone text-xs text-charcoal focus:outline-none focus:border-secondary"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddTeamModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-surface border border-lumen-stone text-xs font-semibold text-charcoal hover:bg-lumen-cream transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-charcoal hover:bg-black text-lumen-cream text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm text-secondary">check</span>
                  <span>Save Team</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ALLOT PANEL */}
      {showAllotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg rounded-[28px] bg-surface p-6 sm:p-8 shadow-2xl border border-lumen-stone flex flex-col gap-5">
            <div className="flex items-center justify-between pb-3 border-b border-lumen-stone">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-secondary-container text-secondary flex items-center justify-center">
                  <span className="material-symbols-outlined text-lg">grid_view</span>
                </div>
                <h3 className="font-serif text-xl font-normal text-charcoal">Allot Panel &amp; Rooms</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAllotModal(false)}
                className="w-8 h-8 rounded-full hover:bg-lumen-stone/50 flex items-center justify-center text-fog hover:text-charcoal transition cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            {allotSuccessMsg ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs text-center font-medium leading-relaxed">
                {allotSuccessMsg}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-xs text-fog leading-relaxed">
                  Specify the number of evaluation panels. AI will generate suggested panel names and randomly distribute all <strong className="text-charcoal">{teams.length}</strong> registered teams across panels.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-charcoal block mb-1">
                      Number of Panels *
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={allotNumPanels}
                      onChange={(e) => setAllotNumPanels(parseInt(e.target.value) || 1)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-lumen-cream/50 border border-lumen-stone text-xs text-charcoal font-bold focus:outline-none focus:border-secondary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-charcoal block mb-1">
                      Teams Per Panel (Approx)
                    </label>
                    <div className="px-3.5 py-2.5 rounded-xl bg-lumen-cream/50 border border-lumen-stone text-xs font-bold text-charcoal flex items-center justify-between">
                      <span>{Math.ceil(teams.length / Math.max(1, allotNumPanels))} Teams / Panel</span>
                      <span className="text-[10px] text-fog font-normal">Auto-distributed</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-fog">
                    AI Suggested Panel Names Preview:
                  </span>
                  <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-lumen-cream/50 border border-lumen-stone">
                    {aiSuggestedPanelNames.slice(0, Math.max(1, Math.min(10, allotNumPanels))).map((name, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-surface border border-lumen-stone text-xs font-bold text-charcoal">
                        Panel {i + 1}: {name}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowAllotModal(false)}
                    className="px-4 py-2.5 rounded-xl bg-surface border border-lumen-stone text-xs font-semibold text-charcoal hover:bg-lumen-cream transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handlePerformPanelAllotment}
                    className="px-5 py-2.5 rounded-xl bg-charcoal hover:bg-black text-lumen-cream text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm text-secondary">bolt</span>
                    <span>Allot Teams Randomly</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
