import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, User as FirebaseUser } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  setDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { HackathonTeam } from './TeamsHub';
import { JudgeScore } from './JudgeScoringPortal';

// 1. Initialize Firebase App and Services
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// CRITICAL: Must pass firestoreDatabaseId from firebase-applet-config.json
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Error Handling Infrastructure mandated by Firebase Integration Skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Error Context:', JSON.stringify(errInfo));
  return errInfo;
}

// 2. Validate Connection to Firestore on boot (mandated by skill)
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline note: checking config readiness.');
    }
  }
}

// Execute connection test
testConnection();

// 3. Authentication Helpers
export async function signInWithGoogle(): Promise<FirebaseUser | null> {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    if (result.user) {
      // Store or update profile in Firestore users collection
      const userRef = doc(db, 'users', result.user.uid);
      await setDoc(
        userRef,
        {
          uid: result.user.uid,
          email: result.user.email || '',
          displayName: result.user.displayName || 'Hacker',
          photoURL: result.user.photoURL || '',
          lastLoginAt: new Date().toISOString(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      ).catch((e) => handleFirestoreError(e, OperationType.WRITE, `users/${result.user.uid}`));
    }
    return result.user;
  } catch (err) {
    console.warn('Google sign-in popup error/cancellation:', err);
    return null;
  }
}

export async function logOutFirebase(): Promise<void> {
  await signOut(auth);
}

// 4. Firestore Database Sync APIs

// Save Hackathon to Firestore
export async function saveHackathonToFirestore(hackathon: {
  id: string;
  title: string;
  tagline: string;
  prizePool: string;
  location?: string;
  passwords: { head: string; member: string; judge: string };
  createdAt: string;
  status?: string;
  track?: string;
  organizerEmail?: string;
}) {
  const path = `hackathons/${hackathon.id}`;
  try {
    const hackRef = doc(db, 'hackathons', hackathon.id);
    await setDoc(
      hackRef,
      {
        ...hackathon,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Save Team to Firestore
export async function saveTeamToFirestore(team: HackathonTeam & { hackathonId?: string }) {
  const path = `teams/${team.id}`;
  try {
    const teamRef = doc(db, 'teams', team.id);
    await setDoc(
      teamRef,
      {
        id: team.id,
        teamName: team.teamName,
        leaderName: team.leaderName,
        leaderEmail: team.leaderEmail || '',
        leaderPhone: team.leaderPhone || '',
        totalMembers: team.totalMembers || team.members?.length || 1,
        track: team.track || 'Voice AI & Autonomous Systems',
        notes: team.notes || '',
        pptStatus: team.pptStatus || 'not_submitted',
        assignedPanel: team.assignedPanel || '',
        members: team.members || [],
        hackathonId: team.hackathonId || 'hack-voice-2026',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// Save Score to Firestore
export async function saveScoreToFirestore(score: JudgeScore) {
  const path = `scores/${score.id}`;
  try {
    const scoreRef = doc(db, 'scores', score.id);
    await setDoc(
      scoreRef,
      {
        ...score,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}
