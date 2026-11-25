import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  DepotName,
  DriverProfile,
  LicenseTestRecord,
  RouteId,
  TrackId,
  TransmissionMode,
  TripLog,
  WeatherPreset,
} from '../types/simulator';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

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

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
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
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
void testConnection();

const VALID_DEPOTS: DepotName[] = [
  'Panchkula',
  'Ambala',
  'Chandigarh',
  'Yamunanagar',
  'Kalka',
  'Rohtak',
];

function sanitizeString(input: string, fallback: string, minLen: number, maxLen: number): string {
  const cleaned = input.trim().slice(0, maxLen);
  if (cleaned.length < minLen) return fallback;
  return cleaned;
}

function clampNum(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, val));
}

export async function signInWithGoogleDriver(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  await ensureDriverProfile(result.user);
  return result.user;
}

export async function signOutDriver(): Promise<void> {
  await signOut(auth);
}

export function subscribeAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

export async function ensureDriverProfile(user: User): Promise<DriverProfile> {
  const driverPath = `drivers/${user.uid}`;
  const ref = doc(db, 'drivers', user.uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as DriverProfile;
    }
    const newProfile = {
      uid: user.uid,
      displayName: sanitizeString(user.displayName || 'HR Roadways Driver', 'HR Roadways Driver', 1, 80),
      depotHome: 'Panchkula' as DepotName,
      totalEarningsInr: 0,
      totalKmDriven: 0,
      totalPassengersCarried: 0,
      htvLicenseEarned: false,
      preferredTransmission: 'auto' as TransmissionMode,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, newProfile);
    return newProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, driverPath);
  }
}

export function subscribeDriverProfile(
  uid: string,
  onData: (profile: DriverProfile | null) => void
): () => void {
  const driverPath = `drivers/${uid}`;
  const ref = doc(db, 'drivers', uid);
  return onSnapshot(
    ref,
    (snap) => {
      onData(snap.exists() ? (snap.data() as DriverProfile) : null);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, driverPath);
    }
  );
}

export function subscribeLicenseTests(
  uid: string,
  onData: (records: Record<TrackId, LicenseTestRecord>) => void
): () => void {
  const path = `drivers/${uid}/licenseTests`;
  const q = query(collection(db, path), where('driverId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const map = {} as Record<TrackId, LicenseTestRecord>;
      snap.forEach((docSnap) => {
        const rec = docSnap.data() as LicenseTestRecord;
        map[rec.trackId] = rec;
      });
      onData(map);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeTripLogs(
  uid: string,
  onData: (trips: TripLog[]) => void
): () => void {
  const path = `drivers/${uid}/tripLogs`;
  const q = query(
    collection(db, path),
    where('driverId', '==', uid),
    orderBy('completedAt', 'desc'),
    limit(20)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list: TripLog[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...(docSnap.data() as Omit<TripLog, 'id'>) });
      });
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function updateDriverSettings(
  uid: string,
  settings: {
    displayName: string;
    depotHome: DepotName;
    preferredTransmission: TransmissionMode;
  }
): Promise<void> {
  const path = `drivers/${uid}`;
  const safeDepot = VALID_DEPOTS.includes(settings.depotHome) ? settings.depotHome : 'Panchkula';
  try {
    await updateDoc(doc(db, 'drivers', uid), {
      displayName: sanitizeString(settings.displayName, 'HR Roadways Driver', 1, 80),
      depotHome: safeDepot,
      preferredTransmission: settings.preferredTransmission === 'manual' ? 'manual' : 'auto',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveLicenseTestResult(
  uid: string,
  trackId: TrackId,
  result: {
    passed: boolean;
    score: number;
    timeSec: number;
    penalties: number;
  },
  existingRecords: Record<TrackId, LicenseTestRecord>,
  currentProfile: DriverProfile | null
): Promise<void> {
  const testPath = `drivers/${uid}/licenseTests/${trackId}`;
  const ref = doc(db, 'drivers', uid, 'licenseTests', trackId);
  const prev = existingRecords[trackId];
  const nextPassed = Boolean(prev?.passed || result.passed);
  const nextScore = Math.max(prev?.bestScore ?? 0, Math.round(clampNum(result.score, 0, 100)));
  const nextTime =
    prev?.bestTimeSec && prev.passed && result.passed
      ? Math.min(prev.bestTimeSec, clampNum(result.timeSec, 1, 3600))
      : clampNum(result.timeSec, 1, 3600);
  const nextPenalties = Math.round(clampNum(result.penalties, 0, 100));

  try {
    if (prev) {
      await updateDoc(ref, {
        passed: nextPassed,
        bestScore: nextScore,
        bestTimeSec: Number(nextTime.toFixed(1)),
        penalties: nextPenalties,
        completedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        driverId: uid,
        trackId,
        passed: nextPassed,
        bestScore: nextScore,
        bestTimeSec: Number(nextTime.toFixed(1)),
        penalties: nextPenalties,
        completedAt: serverTimestamp(),
      });
    }

    // Check if all 4 official HSSC tracks are now passed
    const allTrackIds: TrackId[] = ['figure8', 'hBayReverse', 'zigZag', 'gradientRamp'];
    const allPassed = allTrackIds.every((id) =>
      id === trackId ? nextPassed : Boolean(existingRecords[id]?.passed)
    );

    if (allPassed && currentProfile && !currentProfile.htvLicenseEarned) {
      await updateDoc(doc(db, 'drivers', uid), {
        totalEarningsInr: clampNum(currentProfile.totalEarningsInr, 0, 100000000),
        totalKmDriven: clampNum(currentProfile.totalKmDriven, 0, 10000000),
        totalPassengersCarried: clampNum(currentProfile.totalPassengersCarried, 0, 10000000),
        htvLicenseEarned: true,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, testPath);
  }
}

export async function recordCompletedTrip(
  uid: string,
  trip: {
    routeId: RouteId;
    routeTitle: string;
    origin: string;
    destination: string;
    passengersBoarded: number;
    fareCollectedInr: number;
    safetyRating: number;
    weather: WeatherPreset;
    durationSec: number;
    distanceDrivenKm: number;
  },
  currentProfile: DriverProfile | null
): Promise<void> {
  const tripId = `trip_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const tripPath = `drivers/${uid}/tripLogs/${tripId}`;
  try {
    await setDoc(doc(db, 'drivers', uid, 'tripLogs', tripId), {
      driverId: uid,
      routeId: trip.routeId,
      routeTitle: sanitizeString(trip.routeTitle, 'Haryana to Himachal', 3, 100),
      origin: sanitizeString(trip.origin, 'Haryana Depot', 2, 60),
      destination: sanitizeString(trip.destination, 'Himachal Terminal', 2, 60),
      passengersBoarded: Math.round(clampNum(trip.passengersBoarded, 0, 300)),
      fareCollectedInr: Math.round(clampNum(trip.fareCollectedInr, 0, 100000)),
      safetyRating: Number(clampNum(trip.safetyRating, 0, 5).toFixed(1)),
      weather: trip.weather,
      durationSec: Math.round(clampNum(trip.durationSec, 1, 86400)),
      completedAt: serverTimestamp(),
    });

    if (currentProfile) {
      await updateDoc(doc(db, 'drivers', uid), {
        totalEarningsInr: Math.round(
          clampNum(currentProfile.totalEarningsInr + trip.fareCollectedInr, 0, 100000000)
        ),
        totalKmDriven: Number(
          clampNum(currentProfile.totalKmDriven + Math.max(1, trip.distanceDrivenKm), 0, 10000000).toFixed(1)
        ),
        totalPassengersCarried: Math.round(
          clampNum(currentProfile.totalPassengersCarried + trip.passengersBoarded, 0, 10000000)
        ),
        htvLicenseEarned: Boolean(currentProfile.htvLicenseEarned),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, tripPath);
  }
}
