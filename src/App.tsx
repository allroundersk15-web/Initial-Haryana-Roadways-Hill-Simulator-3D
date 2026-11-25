import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  Award,
  Bus,
  Compass,
  GraduationCap,
  LogIn,
  Map as MapIcon,
  Play,
  UserCheck,
} from 'lucide-react';
import { CockpitHud } from './components/CockpitHud';
import { DriverLogbookView } from './components/DriverLogbookView';
import { GoogleMapsDispatch } from './components/GoogleMapsDispatch';
import { TrainingSelectView } from './components/TrainingSelectView';
import { CAREER_ROUTES, LICENSE_TRACKS, getRouteById, getTrackById } from './data/routes';
import {
  ensureDriverProfile,
  recordCompletedTrip,
  saveLicenseTestResult,
  signInWithGoogleDriver,
  signOutDriver,
  subscribeAuth,
  subscribeDriverProfile,
  subscribeLicenseTests,
  subscribeTripLogs,
  updateDriverSettings,
} from './lib/firebase';
import { BusSimulatorCanvas, type BusSimController } from './three/BusSimulatorCanvas';
import type {
  DepotName,
  DriverProfile,
  LicenseTestRecord,
  RouteId,
  SimMode,
  SimView,
  TelemetrySnapshot,
  TrackId,
  TransmissionMode,
  TripLog,
  WeatherPreset,
} from './types/simulator';

const DEFAULT_GUEST_PROFILE: DriverProfile = {
  uid: 'guest',
  displayName: 'Guest Roadways Driver',
  depotHome: 'Panchkula',
  totalEarningsInr: 0,
  totalKmDriven: 0,
  totalPassengersCarried: 0,
  htvLicenseEarned: false,
  preferredTransmission: 'auto',
};

const INITIAL_TELEMETRY: TelemetrySnapshot = {
  speedKmh: 0,
  rpm: 750,
  gear: 1,
  transmission: 'auto',
  doorOpen: false,
  doorAnim: 0,
  handbrake: false,
  headlights: 0,
  cabinLight: false,
  indicators: 'off',
  wipersOn: false,
  hornActive: 'none',
  altitudeM: 656,
  slopePct: 0,
  fuelPct: 96,
  airPressurePsi: 118,
  passengersOnBoard: 8,
  busCapacity: 54,
  waitingAtCurrentStop: 0,
  atStopName: null,
  atStopType: null,
  boardingProgress: 0,
  tripEarningsInr: 0,
  stopsCompleted: 0,
  totalStops: 5,
  nextStopName: 'Panchkula / Kalka Bus Stand',
  nextStopDistM: 45,
  routeProgressPct: 0,
  distanceDrivenKm: 0,
  damagePct: 0,
  cameraMode: 'chase',
  weather: 'sunny',
  noticeText: null,
  noticeSeverity: 'info',
  tripCompleted: false,
  tripDurationSec: 0,
  safetyRating: 5,
  busX: 0,
  busZ: 0,
  busHeading: 0,
  steerNorm: 0,
  throttleActive: 0,
  brakeActive: 0,
  shiftHint: null,
  autoRange: 'D',
  training: null,
};

export default function App() {
  const [view, setView] = useState<SimView>('hub');
  const [simMode, setSimMode] = useState<SimMode>('showcase');
  const [selectedRouteId, setSelectedRouteId] = useState<RouteId>('kalka-shimla');
  const [selectedTrackId, setSelectedTrackId] = useState<TrackId>('figure8');
  const [weather, setWeather] = useState<WeatherPreset>('sunny');
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>(INITIAL_TELEMETRY);

  // Firebase Auth + Cloud Career State (graceful guest fallback when not signed in)
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<DriverProfile>(DEFAULT_GUEST_PROFILE);
  const [licenseRecords, setLicenseRecords] = useState<Partial<Record<TrackId, LicenseTestRecord>>>({});
  const [tripLogs, setTripLogs] = useState<TripLog[]>([]);
  const [authError, setAuthError] = useState<string | null>(null);

  // Google Maps Platform Demo Key Quota Banner State
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  const controllerRef = useRef<BusSimController | null>(null);

  useEffect(() => {
    const onQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  // Subscribe to Firebase Auth & Firestore collections
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let unsubTests: (() => void) | null = null;
    let unsubTrips: (() => void) | null = null;

    const unsubAuth = subscribeAuth(async (user) => {
      setAuthUser(user);
      unsubProfile?.();
      unsubTests?.();
      unsubTrips?.();

      if (user) {
        try {
          await ensureDriverProfile(user);
          unsubProfile = subscribeDriverProfile(user.uid, (p) => {
            if (p) setProfile(p);
          });
          unsubTests = subscribeLicenseTests(user.uid, (recs) => {
            setLicenseRecords(recs);
          });
          unsubTrips = subscribeTripLogs(user.uid, (logs) => {
            setTripLogs(logs);
          });
        } catch (err) {
          console.error('Firebase sync initialization warning:', err);
        }
      } else {
        setProfile(DEFAULT_GUEST_PROFILE);
      }
    });

    return () => {
      unsubAuth();
      unsubProfile?.();
      unsubTests?.();
      unsubTrips?.();
    };
  }, []);

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogleDriver();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sign-in cancelled.';
      if (!msg.includes('popup-closed-by-user')) {
        setAuthError(msg);
      }
    }
  };

  const handleSignOut = async () => {
    await signOutDriver();
  };

  const handleSaveProfileSettings = async (settings: {
    displayName: string;
    depotHome: DepotName;
    preferredTransmission: TransmissionMode;
  }) => {
    if (authUser) {
      await updateDriverSettings(authUser.uid, settings);
    } else {
      setProfile((prev) => ({ ...prev, ...settings }));
    }
  };

  const handleTrainingFinish = useCallback(
    (result: {
      trackId: TrackId;
      passed: boolean;
      score: number;
      timeSec: number;
      penalties: number;
    }) => {
      // Update local state immediately
      setLicenseRecords((prev) => {
        const existing = prev[result.trackId];
        const nextRec: LicenseTestRecord = {
          driverId: authUser?.uid || 'guest',
          trackId: result.trackId,
          passed: Boolean(existing?.passed || result.passed),
          bestScore: Math.max(existing?.bestScore ?? 0, result.score),
          bestTimeSec:
            existing?.passed && result.passed
              ? Math.min(existing.bestTimeSec, result.timeSec)
              : result.timeSec,
          penalties: result.penalties,
        };
        const updated = { ...prev, [result.trackId]: nextRec };
        const allPassed = LICENSE_TRACKS.every((t) => updated[t.id]?.passed);
        if (allPassed) {
          setProfile((p) => ({ ...p, htvLicenseEarned: true }));
        }
        return updated;
      });

      if (authUser) {
        void saveLicenseTestResult(
          authUser.uid,
          result.trackId,
          result,
          licenseRecords as Record<TrackId, LicenseTestRecord>,
          profile
        );
      }
    },
    [authUser, licenseRecords, profile]
  );

  const handleCareerFinish = useCallback(
    (result: {
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
    }) => {
      if (!authUser) {
        setTripLogs((prev) => [
          {
            id: `local_${Date.now()}`,
            driverId: 'guest',
            routeId: result.routeId,
            routeTitle: result.routeTitle,
            origin: result.origin,
            destination: result.destination,
            passengersBoarded: result.passengersBoarded,
            fareCollectedInr: result.fareCollectedInr,
            safetyRating: result.safetyRating,
            weather: result.weather,
            durationSec: result.durationSec,
          },
          ...prev,
        ]);
        setProfile((p) => ({
          ...p,
          totalEarningsInr: p.totalEarningsInr + result.fareCollectedInr,
          totalPassengersCarried: p.totalPassengersCarried + result.passengersBoarded,
          totalKmDriven: Number((p.totalKmDriven + Math.max(1, result.distanceDrivenKm)).toFixed(1)),
        }));
      } else {
        void recordCompletedTrip(authUser.uid, result, profile);
      }
    },
    [authUser, profile]
  );

  const launchCareerDrive = () => {
    setSimMode('career');
    setView('driving');
  };

  const launchTrainingTrack = (trackId: TrackId) => {
    setSelectedTrackId(trackId);
    setSimMode('training');
    setView('driving');
  };

  const exitDriving = () => {
    const prevWasTraining = simMode === 'training';
    setSimMode('showcase');
    setView(prevWasTraining ? 'training-select' : 'career-map');
  };

  const handleNextTrainingTrack = () => {
    const idx = LICENSE_TRACKS.findIndex((t) => t.id === selectedTrackId);
    const next = LICENSE_TRACKS[(idx + 1) % LICENSE_TRACKS.length];
    launchTrainingTrack(next.id);
  };

  const activeRoute = getRouteById(selectedRouteId);
  const activeTrack = getTrackById(selectedTrackId);
  const show3DCanvas = view === 'hub' || view === 'driving';

  return (
    <div className="min-h-screen w-full bg-[#0B111A] text-slate-100 relative overflow-x-hidden">
      {/* Persistent Top Navigation Header (hidden during active 3D driving for maximum scenic visibility) */}
      {view !== 'driving' && (
      <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-[#0B111A]/95 border-b border-slate-800/90 px-4 md:px-6 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => {
            setSimMode('showcase');
            setView('hub');
          }}
          className="flex items-center gap-2.5 text-left cursor-pointer shrink-0"
        >
          <span className="w-8 h-8 rounded-lg bg-[#0B5ED7] flex items-center justify-center text-white shrink-0">
            <Bus className="w-4 h-4" />
          </span>
          <div className="leading-tight">
            <div className="font-display text-sm md:text-base font-bold text-white whitespace-nowrap">
              HARYANA ROADWAYS 3D
            </div>
            <div className="text-[10px] text-amber-300 font-medium hidden sm:block whitespace-nowrap">
              हरियाणा रोडवेज · हिमाचल पहाड़ी सिम्युलेटर
            </div>
          </div>
        </button>

        {/* Primary Single-Row Navigation */}
        <nav className="flex items-center gap-1 md:gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setSimMode('showcase');
              setView('career-map');
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              view === 'career-map'
                ? 'bg-[#0B5ED7] text-white'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <MapIcon className="w-3.5 h-3.5" />
            <span>Career Routes</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSimMode('showcase');
              setView('training-select');
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              view === 'training-select'
                ? 'bg-[#0B5ED7] text-white'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            <span>License School</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSimMode('showcase');
              setView('logbook');
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              view === 'logbook'
                ? 'bg-[#0B5ED7] text-white'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Logbook</span>
          </button>
        </nav>

        {/* Auth / Cloud Driver Action */}
        <div className="flex items-center gap-2 shrink-0">
          {authUser ? (
            <button
              type="button"
              onClick={() => {
                setSimMode('showcase');
                setView('logbook');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#162336] border border-slate-700 text-xs font-semibold text-emerald-300 whitespace-nowrap cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline max-w-[120px] truncate">{profile.displayName}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#162336] hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-white whitespace-nowrap cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 text-sky-400" />
              <span>Cloud Sign In</span>
            </button>
          )}
        </div>
      </header>
      )}

      {/* Mandatory Tier-2 Google Maps Demo Key Quota Banner */}
      {quotaExceeded && (
        <div
          className={`fixed left-0 right-0 z-50 bg-amber-100 border-b border-amber-300 text-amber-950 px-4 py-2.5 text-xs md:text-sm flex items-center justify-between shadow-sm ${
            view === 'driving' ? 'top-0' : 'top-14'
          }`}
        >
          <span>
            <strong>Google Maps Platform free tier quota exceeded.</strong> To continue using live Maps
            features, please{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold"
            >
              upgrade to your own Cloud project API key
            </a>
            .
          </span>
          <button
            type="button"
            onClick={() => setQuotaExceeded(false)}
            className="ml-4 font-bold hover:opacity-75 cursor-pointer"
            aria-label="Dismiss quota notice"
          >
            ✕
          </button>
        </div>
      )}

      {authError && (
        <div className="fixed top-16 right-4 z-50 px-4 py-2 rounded-lg bg-red-950 border border-red-600/60 text-xs text-red-100">
          {authError}
        </div>
      )}

      {/* Full-Viewport 3D Simulator Canvas (Mounted cleanly for Hub Showcase & Live Driving) */}
      {show3DCanvas && (
        <div className="fixed inset-0 z-10 w-full h-full">
          <BusSimulatorCanvas
            mode={simMode}
            routeId={selectedRouteId}
            trackId={selectedTrackId}
            weather={weather}
            initialTransmission={profile.preferredTransmission}
            onTelemetry={setTelemetry}
            onTrainingFinish={handleTrainingFinish}
            onCareerFinish={handleCareerFinish}
            controllerRef={controllerRef}
          />
        </div>
      )}

      {/* LANDING HUB OVERLAY (Framing the live sunlit 3D Haryana Roadways bus cleanly at bottom-left) */}
      {view === 'hub' && (
        <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-end p-5 md:p-10 pb-8 md:pb-12">
          <div className="pointer-events-auto max-w-xl hud-panel rounded-2xl p-6 border-slate-700/80">
            <p className="text-xs font-semibold text-amber-300 tracking-wide mb-1.5">
              हरियाणा राज्य परिवहन · Himachal Pradesh Mountain Highways
            </p>
            <h1 className="font-display text-3xl md:text-4xl font-bold text-white leading-tight mb-2.5">
              Haryana Roadways Hill Bus Simulator 3D
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed mb-5">
              Command the iconic blue BS-VI coach from Haryana plains up into Shimla, Manali,
              Dharamshala, and Kinnaur. Sound multi-tone Indian air horns on blind hairpins, open
              pneumatic doors at hill bus stands, mandirs, markets, and dhabas, or pass the official
              4-stage HSSC HTV License Exam.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={launchCareerDrive}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#0B5ED7] hover:bg-[#094DB2] text-white text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                Quick Drive: Kalka → Shimla
              </button>

              <button
                type="button"
                onClick={() => setView('career-map')}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-[#182436] hover:bg-slate-700 text-white text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                <Compass className="w-4 h-4 text-sky-400" />
                Google Maps Routes ({CAREER_ROUTES.length})
              </button>

              <button
                type="button"
                onClick={() => setView('training-select')}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-lg bg-[#182436] hover:bg-slate-700 text-amber-300 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                <GraduationCap className="w-4 h-4" />
                HTV License Test
              </button>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-400">
              <span>WASD / Arrows: Drive</span>
              <span>H / G: Melody &amp; Air Horns</span>
              <span>O: Pneumatic Door</span>
              <span>M / Q / E: Auto &amp; Manual Gears</span>
              <span>Space: Handbrake</span>
              <span>C: Camera</span>
            </div>
          </div>
        </div>
      )}

      {/* LIVE DRIVING COCKPIT HUD */}
      {view === 'driving' && (
        <CockpitHud
          mode={simMode}
          telemetry={telemetry}
          routeTitle={activeRoute.title}
          trackTitle={activeTrack.title}
          controllerRef={controllerRef}
          onExitDriving={exitDriving}
          onNextTrainingTrack={simMode === 'training' ? handleNextTrainingTrack : undefined}
        />
      )}

      {/* LIVE GOOGLE MAPS ROUTE DISPATCH VIEW */}
      {view === 'career-map' && (
        <GoogleMapsDispatch
          selectedRouteId={selectedRouteId}
          weather={weather}
          onSelectRoute={setSelectedRouteId}
          onSelectWeather={setWeather}
          onLaunchDrive={launchCareerDrive}
        />
      )}

      {/* HSSC / HARYANA ROADWAYS LICENSE TRAINING VIEW */}
      {view === 'training-select' && (
        <TrainingSelectView
          records={licenseRecords}
          htvLicenseEarned={profile.htvLicenseEarned}
          onStartTrack={launchTrainingTrack}
        />
      )}

      {/* CLOUD DRIVER LOGBOOK & LICENSE CERTIFICATE VIEW */}
      {view === 'logbook' && (
        <DriverLogbookView
          userEmail={authUser?.email ?? null}
          profile={profile}
          licenseRecords={licenseRecords}
          tripLogs={tripLogs}
          isSignedIn={Boolean(authUser)}
          onSignIn={handleGoogleSignIn}
          onSignOut={handleSignOut}
          onSaveProfile={handleSaveProfileSettings}
        />
      )}
    </div>
  );
}
