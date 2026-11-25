import React from 'react';
import { Award, CheckCircle2, Clock, Play, ShieldAlert } from 'lucide-react';
import { LICENSE_TRACKS } from '../data/routes';
import type { LicenseTestRecord, TrackId } from '../types/simulator';

interface TrainingSelectViewProps {
  records: Partial<Record<TrackId, LicenseTestRecord>>;
  htvLicenseEarned: boolean;
  onStartTrack: (trackId: TrackId) => void;
}

export const TrainingSelectView: React.FC<TrainingSelectViewProps> = ({
  records,
  htvLicenseEarned,
  onStartTrack,
}) => {
  const passedCount = LICENSE_TRACKS.filter((t) => records[t.id]?.passed).length;

  return (
    <div className="w-full max-w-[1200px] mx-auto px-4 md:px-6 pt-20 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-medium text-sky-400 tracking-wide mb-1">
            Haryana Roadways IDTR · Official HSSC Heavy Vehicle Skill Assessment
          </p>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-white">
            HTV Bus Driver License Training School
          </h1>
          <p className="text-sm text-slate-400 mt-1.5 max-w-2xl">
            Complete all four real Haryana Roadways &amp; HSSC driving tracks — Figure-8, H-Bay Dug Reverse,
            Zig-Zag Slalom, and Steep Ramp Hill-Start — to earn your official HTV Roadways License.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#111A28] border border-slate-800 flex items-center gap-3.5 shrink-0">
          <Award className={`w-7 h-7 ${htvLicenseEarned ? 'text-emerald-400' : 'text-amber-400'}`} />
          <div>
            <div className="text-xs font-semibold text-white">
              {htvLicenseEarned ? 'HTV License Certified' : `Certification Progress: ${passedCount}/4`}
            </div>
            <div className="text-xs text-slate-400 font-mono tabular-nums">
              {htvLicenseEarned
                ? 'Authorized for Upper Himachal Ghats'
                : `${4 - passedCount} exam stage${4 - passedCount === 1 ? '' : 's'} remaining`}
            </div>
          </div>
        </div>
      </div>

      {/* 4 Official HSSC Track Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {LICENSE_TRACKS.map((track) => {
          const rec = records[track.id];
          const passed = Boolean(rec?.passed);

          return (
            <div
              key={track.id}
              className={`rounded-2xl p-5 border flex flex-col justify-between transition-colors ${
                passed
                  ? 'bg-[#111E2E] border-emerald-500/40'
                  : 'bg-[#111A28] border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <div className="text-xs font-mono text-sky-400 mb-0.5">
                      Stage 0{track.order} · {track.venue}
                    </div>
                    <h2 className="font-display text-lg font-bold text-white">{track.title}</h2>
                    <div className="text-xs text-amber-300 mt-0.5">{track.hindiTitle}</div>
                  </div>
                  {passed ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 whitespace-nowrap shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                      Passed ({rec?.bestScore}/100)
                    </span>
                  ) : (
                    <span className="text-xs font-mono text-slate-400 whitespace-nowrap shrink-0">
                      Pending
                    </span>
                  )}
                </div>

                <p className="text-sm text-slate-300 leading-relaxed mb-3">{track.summary}</p>

                <div className="space-y-2 mb-4 text-xs">
                  <div className="p-2.5 rounded-lg bg-[#0B111A] border border-slate-800 text-slate-300 flex items-start gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-slate-100">HSSC Criteria:</strong> {track.officialRule}
                    </span>
                  </div>
                  <div className="text-slate-400">
                    <strong className="text-slate-300">Instructor Tip:</strong> {track.coachingTip}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
                <div className="flex items-center gap-3 text-xs font-mono text-slate-400 tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-sky-400" />
                    Limit {track.targetTimeSec}s
                  </span>
                  {rec && (
                    <span>Best: {rec.bestTimeSec}s</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onStartTrack(track.id)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0B5ED7] hover:bg-[#094DB2] text-white text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  {passed ? 'Practice Track' : 'Take License Test'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
