import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  ChevronDown,
  ChevronUp,
  CloudRain,
  DoorOpen,
  Eye,
  EyeOff,
  Lightbulb,
  LogOut,
  MapPin,
  Octagon,
  RotateCcw,
  Users,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { BusSimController } from '../three/BusSimulatorCanvas';
import type { SimMode, TelemetrySnapshot } from '../types/simulator';
import { SteeringWheelControl } from './SteeringWheelControl';

interface CockpitHudProps {
  mode: SimMode;
  telemetry: TelemetrySnapshot;
  routeTitle: string;
  trackTitle: string;
  busBadgeCode?: string;
  controllerRef: React.RefObject<BusSimController | null>;
  onExitDriving: () => void;
  onNextTrainingTrack?: () => void;
}

const MANUAL_GEARS = [-1, 0, 1, 2, 3, 4, 5, 6] as const;

export const CockpitHud: React.FC<CockpitHudProps> = ({
  mode,
  telemetry,
  routeTitle,
  trackTitle,
  busBadgeCode = 'HR',
  controllerRef,
  onExitDriving,
  onNextTrainingTrack,
}) => {
  const [controlsVisible, setControlsVisible] = useState(true);
  const [gearGateOpen, setGearGateOpen] = useState(false);
  const [muted, setMuted] = useState(false);

  const gearLabel =
    telemetry.gear === -1 ? 'R' : telemetry.gear === 0 ? 'N' : String(telemetry.gear);

  const autoDisplayLabel =
    telemetry.autoRange === 'D'
      ? `D${Math.max(1, telemetry.gear)}`
      : telemetry.autoRange;

  const handleToggleMute = () => {
    const next = !muted;
    setMuted(next);
    controllerRef.current?.setAudioMuted(next);
  };

  const rpmPct = Math.min(100, Math.max(6, ((telemetry.rpm - 650) / 2150) * 100));
  const gasPressed = telemetry.throttleActive > 0.08;
  const brakePressed = telemetry.brakeActive > 0.08;
  const leftIndActive = telemetry.indicators === 'left' || telemetry.indicators === 'hazard';
  const rightIndActive = telemetry.indicators === 'right' || telemetry.indicators === 'hazard';

  const biomeLabel =
    telemetry.endlessBiome === 'plains'
      ? 'North India Plains'
      : telemetry.endlessBiome === 'foothills'
        ? 'Shivalik Foothills'
        : 'Himalayan Mountains';

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between select-none">
      {/* TOP PERIMETER STRIP: Ultra-compact glassy corner telemetry + slim top-center instrument cluster */}
      <div className="flex items-start justify-between gap-2 px-2.5 pt-2.5 md:px-3.5 md:pt-3">
        {/* Top-Left Compact Route / Endless / Exam Telemetry */}
        <div className="pointer-events-auto hud-compact rounded-xl px-3 py-1.5 max-w-[310px] sm:max-w-[355px]">
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-xs font-bold text-white truncate">
              {mode === 'training' ? trackTitle : mode === 'endless' ? 'Endless Highway Drive' : routeTitle}
            </span>
            <span className="font-mono text-[11px] text-sky-300 tabular-nums whitespace-nowrap shrink-0">
              {telemetry.altitudeM}m · {telemetry.slopePct >= 0 ? `+${telemetry.slopePct}%` : `${telemetry.slopePct}%`}
            </span>
          </div>

          {mode === 'career' ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-200 font-mono tabular-nums mt-0.5">
              <span className="inline-flex items-center gap-1 text-amber-300 truncate max-w-[165px]">
                <MapPin className="w-3 h-3 shrink-0" />
                <span className="truncate">{telemetry.nextStopName}</span>
                <span>({telemetry.nextStopDistM}m)</span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-0.5 text-emerald-300">
                <Users className="w-3 h-3" />
                {telemetry.passengersOnBoard}
              </span>
              <span aria-hidden="true">·</span>
              <span className="text-white font-semibold">₹{telemetry.tripEarningsInr}</span>
              {telemetry.tollsPaidInr > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-300">Tolls -₹{telemetry.tollsPaidInr}</span>
                </>
              )}
            </div>
          ) : mode === 'endless' ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-200 font-mono tabular-nums mt-0.5">
              <span className="text-emerald-300 font-semibold">{biomeLabel}</span>
              <span aria-hidden="true">·</span>
              <span className="text-white">{telemetry.distanceDrivenKm.toFixed(1)} km</span>
              <span aria-hidden="true">·</span>
              <span className="text-sky-300">Toll-Free</span>
            </div>
          ) : telemetry.training ? (
            <div className="mt-0.5 space-y-0.5">
              <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums text-slate-200">
                <span>
                  Gates {telemetry.training.checkpointsCleared}/{telemetry.training.totalCheckpoints}
                </span>
                <span aria-hidden="true">·</span>
                <span className={telemetry.training.coneHits > 0 ? 'text-red-400' : 'text-emerald-400'}>
                  Cones {telemetry.training.coneHits}
                </span>
                <span aria-hidden="true">·</span>
                <span>{telemetry.training.elapsedSec.toFixed(1)}s</span>
                {telemetry.training.trackId === 'gradientRamp' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className={telemetry.training.rollbackCm > 25 ? 'text-red-400' : 'text-sky-300'}>
                      Roll {telemetry.training.rollbackCm}cm
                    </span>
                  </>
                )}
              </div>
              <p className="text-[11px] text-amber-300 leading-tight line-clamp-2">
                {telemetry.training.instruction}
              </p>
            </div>
          ) : null}
        </div>

        {/* Top-Center Slim Digital Speed / RPM / Gear Cluster (leaves road & bus 100% open) */}
        <div className="hidden md:flex pointer-events-auto hud-compact rounded-xl px-3 py-1.5 items-center gap-3">
          <span className={`text-xs font-bold ${leftIndActive ? 'text-amber-400' : 'text-slate-600'}`}>
            ◀
          </span>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-xl font-bold text-white leading-none tabular-nums">
              {telemetry.speedKmh}
            </span>
            <span className="text-[10px] font-mono text-slate-400">km/h</span>
          </div>

          <div className="w-24">
            <div className="w-full h-1.5 bg-slate-800/90 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-75 ${
                  rpmPct > 84 ? 'bg-red-500' : rpmPct > 66 ? 'bg-amber-400' : 'bg-sky-400'
                }`}
                style={{ width: `${rpmPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 mt-0.5 tabular-nums">
              <span>{telemetry.rpm} RPM</span>
              <span>{telemetry.airPressurePsi} PSI</span>
            </div>
          </div>

          <div className="flex items-center gap-1 border-l border-slate-700/70 pl-2.5">
            <span className="font-mono text-sm font-bold text-amber-400 tabular-nums min-w-[24px] text-center">
              {telemetry.transmission === 'auto' ? autoDisplayLabel : gearLabel}
            </span>
            {telemetry.handbrake && (
              <span className="text-[10px] font-mono font-bold text-red-400">P</span>
            )}
          </div>
          <span className={`text-xs font-bold ${rightIndActive ? 'text-amber-400' : 'text-slate-600'}`}>
            ▶
          </span>
        </div>

        {/* Top-Right Sleek Bus Switch & Utility Bar */}
        <div className="pointer-events-auto flex items-center gap-1 flex-wrap justify-end">
          {/* Pneumatic Door */}
          <button
            type="button"
            onClick={() => controllerRef.current?.toggleDoor()}
            title="Pneumatic Door (O)"
            className={`hud-compact h-8 px-2 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors ${
              telemetry.doorOpen
                ? 'bg-emerald-600/90 border-emerald-400/60 text-white'
                : 'text-slate-200 hover:text-white'
            }`}
          >
            <DoorOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Door</span>
          </button>

          {/* Headlights */}
          <button
            type="button"
            onClick={() => controllerRef.current?.cycleHeadlights()}
            title="Headlights Off / Low / High (L)"
            className={`hud-compact h-8 px-2 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors ${
              telemetry.headlights > 0
                ? 'bg-sky-600/90 border-sky-400/60 text-white'
                : 'text-slate-200 hover:text-white'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {telemetry.headlights === 2 ? 'Hi' : telemetry.headlights === 1 ? 'Lo' : 'Off'}
            </span>
          </button>

          {/* Wipers */}
          <button
            type="button"
            onClick={() => controllerRef.current?.toggleWipers()}
            title="Windshield Wipers (V)"
            aria-label="Toggle wipers"
            className={`hud-compact w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
              telemetry.wipersOn
                ? 'bg-sky-600/90 border-sky-400/60 text-white'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <CloudRain className="w-3.5 h-3.5" />
          </button>

          {/* Camera */}
          <button
            type="button"
            onClick={() => controllerRef.current?.cycleCamera()}
            title="Cycle Camera View (C)"
            className="hud-compact h-8 px-2 rounded-lg text-[11px] font-semibold text-slate-200 hover:text-white inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden lg:inline capitalize">{telemetry.cameraMode}</span>
          </button>

          {/* Audio Mute */}
          <button
            type="button"
            onClick={handleToggleMute}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            title={muted ? 'Unmute audio' : 'Mute audio'}
            className="hud-compact w-8 h-8 rounded-lg flex items-center justify-center text-slate-200 hover:text-white cursor-pointer"
          >
            {muted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-sky-400" />}
          </button>

          {/* Show/Hide Driving Controls */}
          <button
            type="button"
            onClick={() => setControlsVisible((v) => !v)}
            title={controlsVisible ? 'Hide driving controls for clean view' : 'Show driving controls'}
            aria-label={controlsVisible ? 'Hide driving controls' : 'Show driving controls'}
            className="hud-compact w-8 h-8 rounded-lg flex items-center justify-center text-slate-200 hover:text-white cursor-pointer"
          >
            {controlsVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5 text-amber-400" />}
          </button>

          {/* Reset */}
          <button
            type="button"
            onClick={() => controllerRef.current?.resetSession()}
            title="Reset Bus Position (R)"
            aria-label="Reset bus position"
            className="hud-compact w-8 h-8 rounded-lg flex items-center justify-center text-slate-200 hover:text-white cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Exit to Depot */}
          <button
            type="button"
            onClick={onExitDriving}
            title="Exit to Depot"
            className="hud-compact h-8 px-2.5 rounded-lg text-[11px] font-semibold text-slate-200 hover:text-white inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Depot</span>
          </button>
        </div>
      </div>

      {/* CENTER NON-OCCLUDING STATUS NOTICES / MODALS */}
      <div className="flex flex-col items-center px-3 pointer-events-none">
        {telemetry.noticeText && (
          <div
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border shadow-md mb-2 ${
              telemetry.noticeSeverity === 'danger'
                ? 'bg-red-950/90 border-red-500/60 text-red-100'
                : telemetry.noticeSeverity === 'warning'
                  ? 'bg-amber-950/90 border-amber-500/60 text-amber-100'
                  : telemetry.noticeSeverity === 'success'
                    ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-100'
                    : 'bg-[#0F172A]/88 border-sky-500/50 text-slate-100'
            }`}
          >
            {telemetry.noticeText}
          </div>
        )}

        {/* Active Bus Stand Boarding Prompt */}
        {mode === 'career' && telemetry.atStopName && !telemetry.tripCompleted && (
          <div className="pointer-events-auto hud-panel rounded-xl px-3.5 py-2 flex items-center gap-3 border-amber-500/40">
            <div>
              <div className="text-xs font-semibold text-amber-300">{telemetry.atStopName}</div>
              <div className="text-[11px] text-slate-300 font-mono tabular-nums">
                {telemetry.doorOpen
                  ? telemetry.waitingAtCurrentStop > 0
                    ? `Boarding… (${telemetry.waitingAtCurrentStop} waiting)`
                    : 'Boarding complete — Close door (O)'
                  : 'Stop bus & open pneumatic door (O)'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => controllerRef.current?.toggleDoor()}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer ${
                telemetry.doorOpen
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[#0B5ED7] hover:bg-[#094DB2] text-white'
              }`}
            >
              {telemetry.doorOpen ? 'Close Door' : 'Open Door'}
            </button>
          </div>
        )}

        {/* Training Briefing Modal */}
        {mode === 'training' && telemetry.training?.phase === 'briefing' && (
          <div className="pointer-events-auto hud-panel rounded-2xl p-5 max-w-md text-center border-sky-500/40">
            <p className="text-xs font-semibold text-sky-400 mb-1">Haryana Roadways IDTR Exam</p>
            <h2 className="font-display text-lg font-bold text-white mb-2">{trackTitle}</h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed mb-4">
              {telemetry.training.instruction}
            </p>
            <button
              type="button"
              onClick={() => controllerRef.current?.startTrainingAttempt()}
              className="px-5 py-2 rounded-lg bg-[#0B5ED7] hover:bg-[#094DB2] text-white text-sm font-semibold whitespace-nowrap cursor-pointer"
            >
              Start Official Test
            </button>
          </div>
        )}

        {/* Training Result Card */}
        {mode === 'training' &&
          (telemetry.training?.phase === 'passed' || telemetry.training?.phase === 'failed') && (
            <div className="pointer-events-auto hud-panel rounded-2xl p-5 max-w-md text-center border-slate-600">
              <div
                className={`font-display text-xl font-bold mb-1 ${
                  telemetry.training.phase === 'passed' ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {telemetry.training.phase === 'passed' ? 'STAGE PASSED' : 'TEST FAILED'}
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mb-3">
                {telemetry.training.phase === 'passed'
                  ? `Heavy-bus precision score ${telemetry.training.score}/100 in ${telemetry.training.elapsedSec.toFixed(1)}s.`
                  : telemetry.training.failureReason || 'Try again with smoother steering.'}
              </p>
              <div className="flex items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={() => controllerRef.current?.resetSession()}
                  className="px-3.5 py-2 rounded-lg bg-[#1E293B] hover:bg-slate-700 text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
                >
                  Retry Track
                </button>
                {telemetry.training.phase === 'passed' && onNextTrainingTrack && (
                  <button
                    type="button"
                    onClick={onNextTrainingTrack}
                    className="px-3.5 py-2 rounded-lg bg-[#0B5ED7] hover:bg-[#094DB2] text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
                  >
                    Next Exam Stage
                  </button>
                )}
                <button
                  type="button"
                  onClick={onExitDriving}
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold whitespace-nowrap cursor-pointer"
                >
                  All Tracks
                </button>
              </div>
            </div>
          )}

        {/* Career Trip Complete Card */}
        {mode === 'career' && telemetry.tripCompleted && (
          <div className="pointer-events-auto hud-panel rounded-2xl p-5 max-w-md text-center border-emerald-500/40">
            <p className="text-xs font-semibold text-emerald-400 mb-1">Himachal Terminal Reached</p>
            <h2 className="font-display text-xl font-bold text-white mb-2">Trip Manifest Closed</h2>
            <div className="grid grid-cols-4 gap-2 my-3 text-center font-mono tabular-nums">
              <div className="p-2 rounded-lg bg-slate-900/50 border border-white/15">
                <div className="text-sm font-bold text-emerald-400">₹{Math.max(0, telemetry.tripEarningsInr)}</div>
                <div className="text-[10px] text-slate-300">Net Fare</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/50 border border-white/15">
                <div className="text-sm font-bold text-amber-300">₹{telemetry.tollsPaidInr}</div>
                <div className="text-[10px] text-slate-300">Tolls</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/50 border border-white/15">
                <div className="text-sm font-bold text-sky-400">{telemetry.passengersOnBoard}</div>
                <div className="text-[10px] text-slate-300">Pax</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/50 border border-white/15">
                <div className="text-sm font-bold text-amber-400">{telemetry.safetyRating}/5</div>
                <div className="text-[10px] text-slate-300">Safety</div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => controllerRef.current?.resetSession()}
                className="px-4 py-2 rounded-lg bg-[#1E293B] text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                Drive Again
              </button>
              <button
                type="button"
                onClick={onExitDriving}
                className="px-4 py-2 rounded-lg bg-[#0B5ED7] hover:bg-[#094DB2] text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                Next Route
              </button>
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM CORNER-DOCKED CONTROLS: 100% Clear Center Viewport for the 3D Bus & Highway */}
      {controlsVisible ? (
        <div className="flex items-end justify-between gap-2 px-3 pb-2 md:px-4 md:pb-2.5 pointer-events-none">
          {/* BOTTOM-LEFT: Compact Indicators + Horns + Larger Glassy Steering Wheel */}
          <div className="pointer-events-auto flex flex-col items-start gap-1">
            {/* Compact Indicator & Indian Horn Micro-Cluster */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => controllerRef.current?.setIndicator('left')}
                title="Left Indicator (Z)"
                aria-label="Left indicator"
                className={`hud-compact w-7 h-7 rounded-md flex items-center justify-center cursor-pointer transition-colors ${
                  leftIndActive ? 'bg-amber-500 border-amber-300 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => controllerRef.current?.setIndicator('hazard')}
                title="Hazard Lights (B)"
                aria-label="Hazard flashers"
                className={`hud-compact w-7 h-7 rounded-md flex items-center justify-center cursor-pointer transition-colors ${
                  telemetry.indicators === 'hazard'
                    ? 'bg-red-600 border-red-400 text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => controllerRef.current?.setIndicator('right')}
                title="Right Indicator (X)"
                aria-label="Right indicator"
                className={`hud-compact w-7 h-7 rounded-md flex items-center justify-center cursor-pointer transition-colors ${
                  rightIndActive ? 'bg-amber-500 border-amber-300 text-slate-950' : 'text-slate-300 hover:text-white'
                }`}
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  controllerRef.current?.setTouchInput({ hornMelody: true });
                }}
                onPointerUp={() => controllerRef.current?.setTouchInput({ hornMelody: false })}
                onPointerCancel={() => controllerRef.current?.setTouchInput({ hornMelody: false })}
                title="Multi-Tone Melody Horn (H)"
                className={`hud-compact h-7 px-2 rounded-md text-[10px] font-semibold whitespace-nowrap cursor-pointer touch-none transition-colors ${
                  telemetry.hornActive === 'melody'
                    ? 'bg-amber-500 border-amber-300 text-slate-950'
                    : 'text-amber-300 hover:text-amber-200'
                }`}
              >
                Melody (H)
              </button>

              <button
                type="button"
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  controllerRef.current?.setTouchInput({ hornAir: true });
                }}
                onPointerUp={() => controllerRef.current?.setTouchInput({ hornAir: false })}
                onPointerCancel={() => controllerRef.current?.setTouchInput({ hornAir: false })}
                title="Twin Air Pressure Horn (G)"
                className={`hud-compact h-7 px-2 rounded-md text-[10px] font-semibold whitespace-nowrap cursor-pointer touch-none transition-colors ${
                  telemetry.hornActive === 'air'
                    ? 'bg-red-500 border-red-300 text-white'
                    : 'text-slate-200 hover:text-white'
                }`}
              >
                Air (G)
              </button>
            </div>

            {/* Interactive Rotary Steering Wheel + Mobile Compact Speed Readout */}
            <div className="flex items-end gap-2.5">
              <SteeringWheelControl
                liveSteerNorm={telemetry.steerNorm}
                badgeCode={busBadgeCode}
                onSteerChange={(steer) => controllerRef.current?.setTouchInput({ steer })}
                onCenterHornDown={() => controllerRef.current?.setTouchInput({ hornAir: true })}
                onCenterHornUp={() => controllerRef.current?.setTouchInput({ hornAir: false })}
              />

              {/* Compact Mobile-Only Mini Speed Readout (hidden on md+ since top-center shows it) */}
              <div className="md:hidden hud-compact rounded-lg px-2.5 py-1.5 mb-5">
                <div className="font-mono text-base font-bold text-white leading-none tabular-nums">
                  {telemetry.speedKmh}
                  <span className="text-[9px] text-slate-400 ml-0.5">km/h</span>
                </div>
                <div className="w-14 h-1 bg-slate-800 rounded-full overflow-hidden mt-1">
                  <div
                    className={`h-full ${rpmPct > 84 ? 'bg-red-500' : rpmPct > 66 ? 'bg-amber-400' : 'bg-sky-400'}`}
                    style={{ width: `${rpmPct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM-RIGHT: Compact Upgraded Gear Shifter + Handbrake + Realistic Metallic Pedals */}
          <div className="pointer-events-auto flex items-end gap-2.5">
            {/* Upgraded Interactive Gearbox Console */}
            <div className="hud-compact rounded-xl p-2 flex flex-col items-center gap-1.5 min-w-[92px]">
              {/* Mode Toggle: AUTO vs MANUAL */}
              <div className="flex items-center gap-1 w-full">
                <button
                  type="button"
                  onClick={() => controllerRef.current?.toggleTransmission()}
                  title="Switch Auto / Manual Transmission (M)"
                  className={`flex-1 px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide transition-colors whitespace-nowrap cursor-pointer ${
                    telemetry.transmission === 'manual'
                      ? 'bg-amber-500/20 border border-amber-400/50 text-amber-300'
                      : 'bg-sky-500/20 border border-sky-400/50 text-sky-300'
                  }`}
                >
                  {telemetry.transmission === 'auto' ? 'AUTO (M)' : '6-MT (M)'}
                </button>
              </div>

              {telemetry.transmission === 'auto' ? (
                /* Automatic D / N / R Selector Gate */
                <div className="flex items-center gap-1 w-full">
                  {(['R', 'N', 'D'] as const).map((range) => {
                    const active = telemetry.autoRange === range;
                    return (
                      <button
                        key={range}
                        type="button"
                        onClick={() => controllerRef.current?.setAutoRange(range)}
                        className={`flex-1 h-7 rounded-md font-mono text-xs font-bold transition-colors cursor-pointer ${
                          active
                            ? range === 'R'
                              ? 'bg-red-600/85 border border-red-300/60 text-white'
                              : range === 'N'
                                ? 'bg-slate-500/75 border border-white/40 text-white'
                                : 'bg-[#0B5ED7]/85 border border-sky-300/60 text-white'
                            : 'bg-white/10 border border-white/15 text-slate-200 hover:bg-white/20 hover:text-white'
                        }`}
                      >
                        {range === 'D' && active ? `D${Math.max(1, telemetry.gear)}` : range}
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* Manual 6-Speed Sequential Paddles + Expandable Direct Gear Gate */
                <>
                  <div className="flex items-center gap-1.5 w-full justify-between">
                    <button
                      type="button"
                      onClick={() => controllerRef.current?.shiftGear(-1)}
                      title="Shift Down (Q)"
                      aria-label="Shift down"
                      className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                        telemetry.shiftHint === 'down'
                          ? 'bg-amber-500/90 text-slate-950'
                          : 'bg-white/12 border border-white/20 hover:bg-white/20 text-slate-100'
                      }`}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setGearGateOpen((o) => !o)}
                      title="Click to open direct R-N-1..6 gear selector"
                      className="min-w-[30px] h-7 px-1.5 rounded-md bg-slate-950/45 border border-white/25 flex items-center justify-center font-mono text-sm font-bold text-amber-300 cursor-pointer"
                    >
                      {gearLabel}
                    </button>

                    <button
                      type="button"
                      onClick={() => controllerRef.current?.shiftGear(1)}
                      title="Shift Up (E)"
                      aria-label="Shift up"
                      className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                        telemetry.shiftHint === 'up'
                          ? 'bg-emerald-500/90 text-slate-950'
                          : 'bg-white/12 border border-white/20 hover:bg-white/20 text-slate-100'
                      }`}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Direct 1-Tap R / N / 1..6 Shift Strip */}
                  {gearGateOpen ? (
                    <div className="grid grid-cols-4 gap-1 w-full pt-0.5">
                      {MANUAL_GEARS.map((g) => {
                        const label = g === -1 ? 'R' : g === 0 ? 'N' : String(g);
                        const active = telemetry.gear === g;
                        return (
                          <button
                            key={g}
                            type="button"
                            onClick={() => controllerRef.current?.setGear(g)}
                            className={`h-6 rounded font-mono text-[10px] font-bold transition-colors cursor-pointer ${
                              active
                                ? g === -1
                                  ? 'bg-red-600/85 text-white'
                                  : 'bg-[#0B5ED7]/85 text-white'
                                : 'bg-white/12 border border-white/15 text-slate-200 hover:bg-white/22'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full text-[9px] font-mono text-slate-400 px-0.5">
                      <span>Q− / E+</span>
                      <button
                        type="button"
                        onClick={() => setGearGateOpen(true)}
                        className={`cursor-pointer hover:text-white ${
                          telemetry.shiftHint === 'up'
                            ? 'text-emerald-400 font-bold'
                            : telemetry.shiftHint === 'down'
                              ? 'text-amber-400 font-bold'
                              : 'text-sky-400'
                        }`}
                      >
                        {telemetry.shiftHint === 'up'
                          ? 'SHIFT ▲'
                          : telemetry.shiftHint === 'down'
                            ? 'SHIFT ▼'
                            : '1–6 Gate'}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Realistic Heavy-Bus Metallic Pedals + Air Parking Handbrake */}
            <div className="flex flex-col items-end gap-1.5">
              {/* Compact Air Handbrake Switch */}
              <button
                type="button"
                onClick={() => controllerRef.current?.toggleHandbrake()}
                title="Air Parking Handbrake (Space)"
                className={`hud-compact h-7 px-2.5 rounded-lg text-[10px] font-semibold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors ${
                  telemetry.handbrake
                    ? 'bg-red-600/95 border-red-400 text-white'
                    : 'text-slate-200 hover:text-white'
                }`}
              >
                <Octagon className="w-3 h-3" />
                <span>{telemetry.handbrake ? 'P-BRAKE ON' : 'P-Brake'}</span>
              </button>

              {/* Brake & Accelerator Commercial Bus Pedals */}
              <div className="flex items-end gap-2">
                {/* Wide Heavy Rubber-Tread Brake Pedal */}
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    controllerRef.current?.setTouchInput({ brake: 1 });
                  }}
                  onPointerUp={() => controllerRef.current?.setTouchInput({ brake: 0 })}
                  onPointerCancel={() => controllerRef.current?.setTouchInput({ brake: 0 })}
                  aria-label="Brake pedal"
                  title="Brake Pedal (S / Down)"
                  className={`pedal-shell relative w-[50px] h-[64px] rounded-xl flex flex-col items-center justify-between py-2 px-1.5 cursor-pointer touch-none ${
                    brakePressed ? 'pedal-pressed-brake' : ''
                  }`}
                >
                  {/* Steel Tread Grooves */}
                  <div className="w-full space-y-1.5 pointer-events-none">
                    <div className="h-1 rounded-full bg-slate-950/90 border-b border-slate-500/30" />
                    <div className="h-1 rounded-full bg-slate-950/90 border-b border-slate-500/30" />
                    <div className="h-1 rounded-full bg-slate-950/90 border-b border-slate-500/30" />
                  </div>
                  <span
                    className={`font-display text-[10px] font-bold tracking-wide pointer-events-none ${
                      brakePressed ? 'text-red-300' : 'text-red-400/90'
                    }`}
                  >
                    BRAKE
                  </span>
                  <div
                    className={`w-7 h-1 rounded-full pointer-events-none ${
                      brakePressed ? 'bg-red-400' : 'bg-red-500/35'
                    }`}
                  />
                </button>

                {/* Tall Vertical Brushed-Steel Accelerator (Gas) Pedal */}
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    controllerRef.current?.setTouchInput({ throttle: 1 });
                  }}
                  onPointerUp={() => controllerRef.current?.setTouchInput({ throttle: 0 })}
                  onPointerCancel={() => controllerRef.current?.setTouchInput({ throttle: 0 })}
                  aria-label="Accelerator gas pedal"
                  title="Accelerator / Gas Pedal (W / Up)"
                  className={`pedal-shell relative w-[44px] h-[82px] rounded-xl flex flex-col items-center justify-between py-2 px-1.5 cursor-pointer touch-none ${
                    gasPressed ? 'pedal-pressed-gas' : ''
                  }`}
                >
                  {/* Vertical Anti-Slip Machined Slots */}
                  <div className="flex items-center justify-center gap-1.5 h-8 w-full pointer-events-none">
                    <div className="w-1.5 h-full rounded-full bg-slate-950/90 border-r border-slate-500/30" />
                    <div className="w-1.5 h-full rounded-full bg-slate-950/90 border-r border-slate-500/30" />
                    <div className="w-1.5 h-full rounded-full bg-slate-950/90 border-r border-slate-500/30" />
                  </div>
                  <span
                    className={`font-display text-[10px] font-bold tracking-wide pointer-events-none ${
                      gasPressed ? 'text-emerald-300' : 'text-emerald-400/90'
                    }`}
                  >
                    GAS
                  </span>
                  <div
                    className={`w-6 h-1 rounded-full pointer-events-none ${
                      gasPressed ? 'bg-emerald-400' : 'bg-emerald-500/35'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-3" />
      )}
    </div>
  );
};
