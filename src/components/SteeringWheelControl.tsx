import React, { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface SteeringWheelControlProps {
  /** Live normalized steering value from simulator: +1 = full left, -1 = full right */
  liveSteerNorm: number;
  badgeCode?: string;
  onSteerChange: (steer: number) => void;
  onCenterHornDown: () => void;
  onCenterHornUp: () => void;
}

/**
 * Larger glassy 3-spoke heavy-bus steering wheel with NO circular outer boundary,
 * shifted slightly downward for clear road visibility, rotary pointer-capture drag,
 * live keyboard sync, and glassy center horn boss.
 */
export const SteeringWheelControl: React.FC<SteeringWheelControlProps> = ({
  liveSteerNorm,
  badgeCode = 'HR',
  onSteerChange,
  onCenterHornDown,
  onCenterHornUp,
}) => {
  const [inputStyle, setInputStyle] = useState<'wheel' | 'arrows'>('wheel');
  const [dragging, setDragging] = useState(false);
  const [dragSteer, setDragSteer] = useState(0);

  const wheelRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const startAngleRef = useRef(0);
  const startXRef = useRef(0);
  const accumDegRef = useRef(0);
  const prevAngleRef = useRef(0);

  const activeSteer = dragging ? dragSteer : liveSteerNorm;
  const visualDeg = -activeSteer * 320;

  const computeAngleFromCenter = (clientX: number, clientY: number): number => {
    const el = wheelRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-horn-boss="true"]')) {
      return;
    }
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerIdRef.current = e.pointerId;
    const ang = computeAngleFromCenter(e.clientX, e.clientY);
    startAngleRef.current = ang;
    prevAngleRef.current = ang;
    startXRef.current = e.clientX;
    accumDegRef.current = -liveSteerNorm * 220;
    setDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || pointerIdRef.current !== e.pointerId) return;
    e.preventDefault();

    const el = wheelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const distFromCenter = Math.hypot(e.clientX - cx, e.clientY - cy);

    let nextSteer = 0;
    if (distFromCenter > 20) {
      const curAngle = computeAngleFromCenter(e.clientX, e.clientY);
      let delta = curAngle - prevAngleRef.current;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      prevAngleRef.current = curAngle;
      accumDegRef.current = Math.max(-220, Math.min(220, accumDegRef.current + delta));
      nextSteer = Math.max(-1, Math.min(1, -accumDegRef.current / 200));
    } else {
      const dx = e.clientX - startXRef.current;
      nextSteer = Math.max(-1, Math.min(1, -dx / 64));
    }

    setDragSteer(nextSteer);
    onSteerChange(nextSteer);
  };

  const releaseSteer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerIdRef.current !== e.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    pointerIdRef.current = null;
    setDragging(false);
    setDragSteer(0);
    onSteerChange(0);
  };

  return (
    <div className="flex flex-col items-center gap-0.5 select-none translate-y-1.5">
      {inputStyle === 'wheel' ? (
        <div
          ref={wheelRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={releaseSteer}
          onPointerCancel={releaseSteer}
          className="relative w-[138px] h-[138px] sm:w-[154px] sm:h-[154px] flex items-center justify-center touch-none cursor-grab active:cursor-grabbing"
          aria-label="Bus steering wheel — drag to steer"
          role="slider"
          aria-valuemin={-100}
          aria-valuemax={100}
          aria-valuenow={Math.round(-activeSteer * 100)}
        >
          {/* Rotating Glassy 3-Spoke Bus Steering Wheel SVG (NO outer circular boundary) */}
          <svg
            viewBox="0 0 120 120"
            className="w-full h-full pointer-events-none drop-shadow-[0_6px_14px_rgba(2,6,23,0.45)]"
            style={{
              transform: `rotate(${visualDeg.toFixed(1)}deg)`,
              transition: dragging ? 'none' : 'transform 85ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <defs>
              <linearGradient id="glassRimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.48)" />
                <stop offset="45%" stopColor="rgba(148,163,184,0.28)" />
                <stop offset="100%" stopColor="rgba(15,23,42,0.58)" />
              </linearGradient>
              <linearGradient id="glassSpokeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(241,245,249,0.38)" />
                <stop offset="100%" stopColor="rgba(30,41,59,0.52)" />
              </linearGradient>
            </defs>

            {/* Glassy Translucent Outer Wheel Rim */}
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="rgba(15,23,42,0.42)"
              strokeWidth="12.5"
            />
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke="url(#glassRimGrad)"
              strokeWidth="10.5"
            />
            {/* Luminous Frosted Inner & Outer Glass Edge Hairlines */}
            <circle
              cx="60"
              cy="60"
              r="55.2"
              fill="none"
              stroke="rgba(255,255,255,0.34)"
              strokeWidth="1"
            />
            <circle
              cx="60"
              cy="60"
              r="44.8"
              fill="none"
              stroke="rgba(255,255,255,0.28)"
              strokeWidth="1"
            />

            {/* Amber Top-Center Alignment Strip */}
            <rect x="56.5" y="4.5" width="7" height="10.5" rx="2" fill="rgba(250,204,21,0.9)" />

            {/* 3 Frosted Glass Spokes */}
            <path
              d="M 15 61 L 44 57.5 L 44 65.5 L 16 68.5 Z"
              fill="url(#glassSpokeGrad)"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="0.9"
            />
            <path
              d="M 105 61 L 76 57.5 L 76 65.5 L 104 68.5 Z"
              fill="url(#glassSpokeGrad)"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="0.9"
            />
            <path
              d="M 54 75 L 66 75 L 64 106 L 56 106 Z"
              fill="url(#glassSpokeGrad)"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="0.9"
            />
          </svg>

          {/* Glassy Center Tappable Horn Boss */}
          <button
            type="button"
            data-horn-boss="true"
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              onCenterHornDown();
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              onCenterHornUp();
            }}
            onPointerCancel={(e) => {
              e.stopPropagation();
              onCenterHornUp();
            }}
            className="absolute w-11 h-11 rounded-full bg-gradient-to-br from-sky-400/55 via-blue-600/45 to-slate-900/60 hover:from-sky-400/70 active:scale-95 border border-white/45 shadow-[inset_0_1px_1px_rgba(255,255,255,0.55),0_4px_12px_rgba(2,6,23,0.4)] flex flex-col items-center justify-center cursor-pointer transition-transform"
            title="Tap Center Boss for Air Horn"
            aria-label="Bus steering center horn"
          >
            <span className="font-display text-[11px] font-bold text-white leading-none tracking-tight drop-shadow">
              {badgeCode.slice(0, 4)}
            </span>
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 mb-2">
          <button
            type="button"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              onSteerChange(1);
            }}
            onPointerUp={() => onSteerChange(0)}
            onPointerCancel={() => onSteerChange(0)}
            className={`hud-compact w-13 h-12 rounded-xl flex items-center justify-center transition-colors cursor-pointer touch-none ${
              liveSteerNorm > 0.15
                ? 'bg-[#0B5ED7]/80 border-sky-300 text-white'
                : 'text-slate-100 hover:text-white'
            }`}
            aria-label="Steer Left"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              onSteerChange(-1);
            }}
            onPointerUp={() => onSteerChange(0)}
            onPointerCancel={() => onSteerChange(0)}
            className={`hud-compact w-13 h-12 rounded-xl flex items-center justify-center transition-colors cursor-pointer touch-none ${
              liveSteerNorm < -0.15
                ? 'bg-[#0B5ED7]/80 border-sky-300 text-white'
                : 'text-slate-100 hover:text-white'
            }`}
            aria-label="Steer Right"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Compact Glassy Steering Style Toggle */}
      <button
        type="button"
        onClick={() => setInputStyle((s) => (s === 'wheel' ? 'arrows' : 'wheel'))}
        className="hud-compact px-2 py-0.5 rounded text-[10px] font-medium text-slate-200 hover:text-white whitespace-nowrap cursor-pointer"
      >
        {inputStyle === 'wheel' ? 'Steer: Wheel' : 'Steer: Arrows'}
      </button>
    </div>
  );
};
