import React, { useState } from 'react';
import { Award, CheckCircle2, Cloud, LogIn, LogOut, MapPin, Save, ShieldCheck, Users } from 'lucide-react';
import { LICENSE_TRACKS } from '../data/routes';
import type {
  DepotName,
  DriverProfile,
  LicenseTestRecord,
  TrackId,
  TransmissionMode,
  TripLog,
} from '../types/simulator';

interface DriverLogbookViewProps {
  userEmail: string | null;
  profile: DriverProfile;
  licenseRecords: Partial<Record<TrackId, LicenseTestRecord>>;
  tripLogs: TripLog[];
  isSignedIn: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onSaveProfile: (settings: {
    displayName: string;
    depotHome: DepotName;
    preferredTransmission: TransmissionMode;
  }) => Promise<void>;
}

const DEPOTS: DepotName[] = ['Panchkula', 'Ambala', 'Chandigarh', 'Yamunanagar', 'Kalka', 'Rohtak'];

export const DriverLogbookView: React.FC<DriverLogbookViewProps> = ({
  userEmail,
  profile,
  licenseRecords,
  tripLogs,
  isSignedIn,
  onSignIn,
  onSignOut,
  onSaveProfile,
}) => {
  const [name, setName] = useState(profile.displayName);
  const [depot, setDepot] = useState<DepotName>(profile.depotHome);
  const [transmission, setTransmission] = useState<TransmissionMode>(profile.preferredTransmission);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(null);
    try {
      await onSaveProfile({
        displayName: name.trim() || 'HR Roadways Driver',
        depotHome: depot,
        preferredTransmission: transmission,
      });
      setSavedMsg(isSignedIn ? 'Synced to Firebase Cloud.' : 'Saved for current session.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 pt-20 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-medium text-sky-400 tracking-wide mb-1">
            Haryana State Transport · Driver Service Record &amp; Firebase Cloud Sync
          </p>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-white">
            Driver Logbook &amp; HTV License
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {isSignedIn ? (
            <>
              <div className="text-xs text-slate-300 font-mono hidden sm:block">
                <span className="text-emerald-400">Cloud Synced</span> · {userEmail}
              </div>
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#182436] hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onSignIn}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#0B5ED7] hover:bg-[#094DB2] text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <LogIn className="w-4 h-4" />
              Sign In with Google to Cloud Sync
            </button>
          )}
        </div>
      </div>

      {/* Top Row: Official HTV License Card + Career KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
        {/* Official Haryana Roadways HTV License Badge */}
        <div className="lg:col-span-5 rounded-2xl p-5 bg-[#0F1E36] border border-[#0B5ED7]/60 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-sky-500/20 pb-3 mb-4">
              <div>
                <div className="text-[11px] font-mono text-amber-300 uppercase tracking-wider">
                  Transport Dept. Govt. of Haryana
                </div>
                <div className="font-display text-lg font-bold text-white">
                  HARYANA ROADWAYS HTV LICENSE
                </div>
              </div>
              <ShieldCheck
                className={`w-8 h-8 ${profile.htvLicenseEarned ? 'text-emerald-400' : 'text-slate-500'}`}
              />
            </div>

            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-slate-400">Driver Name</span>
                <span className="font-semibold text-white">{profile.displayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Home Depot</span>
                <span className="font-mono text-sky-300">{profile.depotHome} Depot (HR)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">License Status</span>
                <span
                  className={`font-semibold ${
                    profile.htvLicenseEarned ? 'text-emerald-400' : 'text-amber-300'
                  }`}
                >
                  {profile.htvLicenseEarned ? 'CERTIFIED HTV HILL DRIVER' : 'LEARNER PERMIT (PASS 4 TRACKS)'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-3 border-t border-sky-500/20">
            {LICENSE_TRACKS.map((t) => {
              const passed = Boolean(licenseRecords[t.id]?.passed);
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-1.5 text-xs text-slate-300"
                >
                  <CheckCircle2
                    className={`w-3.5 h-3.5 shrink-0 ${passed ? 'text-emerald-400' : 'text-slate-600'}`}
                  />
                  <span className="truncate">{t.title}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Career Totals & Profile Preferences Form */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl bg-[#111A28] border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">Total Fare Earnings</div>
              <div className="font-mono text-2xl font-bold text-emerald-400 tabular-nums">
                ₹{profile.totalEarningsInr.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-[#111A28] border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">Passengers Carried</div>
              <div className="font-mono text-2xl font-bold text-sky-400 tabular-nums">
                {profile.totalPassengersCarried}
              </div>
            </div>
            <div className="p-4 rounded-xl bg-[#111A28] border border-slate-800">
              <div className="text-xs text-slate-400 mb-1">Distance Logged</div>
              <div className="font-mono text-2xl font-bold text-amber-400 tabular-nums">
                {profile.totalKmDriven} km
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="p-5 rounded-2xl bg-[#111A28] border border-slate-800 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-white">Driver Settings</h2>
              <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                <Cloud className="w-3.5 h-3.5 text-sky-400" />
                {isSignedIn ? 'Firestore Sync Active' : 'Guest Session Mode'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1" htmlFor="driver-name-input">
                  Driver Name
                </label>
                <input
                  id="driver-name-input"
                  type="text"
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B111A] border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1" htmlFor="depot-select">
                  Home Haryana Depot
                </label>
                <select
                  id="depot-select"
                  value={depot}
                  onChange={(e) => setDepot(e.target.value as DepotName)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B111A] border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
                >
                  {DEPOTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1" htmlFor="gearbox-select">
                  Default Gearbox
                </label>
                <select
                  id="gearbox-select"
                  value={transmission}
                  onChange={(e) => setTransmission(e.target.value as TransmissionMode)}
                  className="w-full px-3 py-2 rounded-lg bg-[#0B111A] border border-slate-700 text-sm text-white focus:outline-none focus:border-sky-500"
                >
                  <option value="auto">Automatic</option>
                  <option value="manual">Manual 6-Speed</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-emerald-400">{savedMsg || ''}</span>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B5ED7] hover:bg-[#094DB2] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving…' : 'Save Preferences'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Recent Career Trip Manifests */}
      <div className="rounded-2xl bg-[#111A28] border border-slate-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-white">Completed Himachal Trip Manifests</h2>
          <span className="text-xs font-mono text-slate-400 tabular-nums">
            {tripLogs.length} trip{tripLogs.length === 1 ? '' : 's'} recorded
          </span>
        </div>

        {tripLogs.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400">
            No completed Himachal highway runs yet. Dispatch a bus from Career Routes and reach the
            hill terminal to log your first manifest!
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {tripLogs.map((trip) => (
              <div
                key={trip.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="text-sm font-semibold text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-sky-400 shrink-0" />
                    <span>{trip.routeTitle}</span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5 tabular-nums">
                    {trip.origin} → {trip.destination} · {trip.weather} · {Math.round(trip.durationSec)}s
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
                  <span className="inline-flex items-center gap-1 text-sky-300">
                    <Users className="w-3.5 h-3.5" />
                    {trip.passengersBoarded} pax
                  </span>
                  <span className="inline-flex items-center gap-1 text-amber-300">
                    <Award className="w-3.5 h-3.5" />
                    {trip.safetyRating}/5
                  </span>
                  <span className="font-bold text-emerald-400">₹{trip.fareCollectedInr}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
