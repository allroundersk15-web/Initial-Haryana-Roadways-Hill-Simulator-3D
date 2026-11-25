import React, { useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

interface SteeringWheelControlProps {
  /** Live normalized steering value from simulator: +1 = full left, -1 = full right */
  liveSteerNorm: number;
  onSteerChange: (steer: number) => void;
  onCenterHornDown: () => void;
  onCenterHornUp: () => void;
}

/**
 * Compact interactive heavy-bus 3-spoke steering wheel with pointer-capture rotary drag,
 * live keyboard sync, tappable Haryana Roadways center horn boss, and optional L/R arrow toggle.
 */
export const SteeringWheelControl: React.FC<SteeringWheelControlProps> = ({
  liveSteerNorm,
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
  // Clockwise (+deg) = steer right (-1), Counter-clockwise (-deg) = steer left (+1)
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
    // Allow center horn button clicks without grabbing steering
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
    if (distFromCenter > 18) {
      // Smooth rotary wheel tracking with wrap-around protection
      const curAngle = computeAngleFromCenter(e.clientX, e.clientY);
      let delta = curAngle - prevAngleRef.current;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      prevAngleRef.current = curAngle;
      accumDegRef.current = Math.max(-220, Math.min(220, accumDegRef.current + delta));
      // Clockwise (+deg) => right (-1), counter-clockwise (-deg) => left (+1)
      nextSteer = Math.max(-1, Math.min(1, -accumDegRef.current / 200));
    } else {
      // Fallback horizontal scrub if pointer crosses wheel hub
      const dx = e.clientX - startXRef.current;
      nextSteer = Math.max(-1, Math.min(1, -dx / 58));
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
    <div className="flex flex-col items-center gap-1 select-none">
      {inputStyle === 'wheel' ? (
        <div
          ref={wheelRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={releaseSteer}
          onPointerCancel={releaseSteer}
          className={`relative w-[108px] h-[108px] sm:w-[116px] sm:h-[116px] rounded-full flex items-center justify-center touch-none cursor-grab active:cursor-grabbing ${
            dragging ? 'ring-2 ring-sky-400/70' : ''
          }`}
          aria-label="Bus steering wheel — drag to steer"
          role="slider"
          aria-valuemin={-100}
          aria-valuemax={100}
          aria-valuenow={Math.round(-activeSteer * 100)}
        >
          {/* Outer subtle radial shadow halo */}
          <div className="absolute inset-0 rounded-full bg-[#0B111A]/60 border border-slate-700/50 shadow-lg pointer-events-none" />

          {/* Rotating 3-Spoke Commercial Bus Steering Wheel SVG */}
          <svg
            viewBox="0 0 120 120"
            className="w-full h-full pointer-events-none"
            style={{
              transform: `rotate(${visualDeg.toFixed(1)}deg)`,
              transition: dragging ? 'none' : 'transform 85ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Heavy Rubberized Outer Rim */}
            <circle
              cx="60"
              cy="60"
              r="49"
              fill="none"
              stroke="#1E293B"
              strokeWidth="12"
            />
            <circle
              cx="60"
              cy="60"
              r="49"
              fill="none"
              stroke="#334155"
              strokeWidth="9.5"
              strokeDasharray="18 3"
            />
            <circle
              cx="60"
              cy="60"
              r="44.2"
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="1"
            />

            {/* Top Center Alignment Marker */}
            <rect x="56.5" y="5.5" width="7" height="10.5" rx="2" fill="#F59E0B" />

            {/* 3 Brushed Alloy Commercial Spokes */}
            <path
              d="M 16 62 L 45 58 L 45 66 L 17 69 Z"
              fill="#475569"
              stroke="#64748B"
              strokeWidth="0.9"
            />
            <path
              d="M 104 62 L 75 58 L 75 66 L 103 69 Z"
              fill="#475569"
              stroke="#64748B"
              strokeWidth="0.9"
            />
            <path
              d="M 54 75 L 66 75 L 64 106 L 56 106 Z"
              fill="#475569"
              stroke="#64748B"
              strokeWidth="0.9"
            />

            {/* Thumb Grip Grooves */}
            <circle cx="22" cy="52" r="2.2" fill="#0F172A" />
            <circle cx="98" cy="52" r="2.2" fill="#0F172A" />
          </svg>

          {/* Center Haryana Roadways Tappable Horn Boss */}
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
            className="absolute w-9 h-9 rounded-full bg-[#0B5ED7] hover:bg-[#1D6FE2] active:scale-95 border-2 border-slate-200/80 shadow-md flex flex-col items-center justify-center cursor-pointer transition-transform"
            title="Tap Center Boss for Air Horn"
            aria-label="Bus steering center horn"
          >
            <span className="font-display text-[10px] font-bold text-white leading-none tracking-tight">
              HR
            </span>
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              onSteerChange(1);
            }}
            onPointerUp={() => onSteerChange(0)}
            onPointerCancel={() => onSteerChange(0)}
            className={`hud-compact w-12 h-11 rounded-xl flex items-center justify-center transition-colors cursor-pointer touch-none ${
              liveSteerNorm > 0.15
                ? 'bg-[#0B5ED7] border-sky-400 text-white'
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
            className={`hud-compact w-12 h-11 rounded-xl flex items-center justify-center transition-colors cursor-pointer touch-none ${
              liveSteerNorm < -0.15
                ? 'bg-[#0B5ED7] border-sky-400 text-white'
                : 'text-slate-100 hover:text-white'
            }`}
            aria-label="Steer Right"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Tiny Steering Style Toggle */}
      <button
        type="button"
        onClick={() => setInputStyle((s) => (s === 'wheel' ? 'arrows' : 'wheel'))}
        className="hud-compact px-2 py-0.5 rounded text-[10px] font-medium text-slate-300 hover:text-white whitespace-nowrap cursor-pointer"
      >
        {inputStyle === 'wheel' ? 'Steer: Wheel' : 'Steer: Arrows'}
      </button>
    </div>
  );
};
