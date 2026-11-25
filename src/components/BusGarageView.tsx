import React, { useState } from 'react';
import { Bus, CheckCircle2, Lock, Play, ShieldCheck, Wallet } from 'lucide-react';
import { BUS_FLEET } from '../data/buses';
import type { BusFleetSpec, BusLiveryId } from '../types/simulator';

interface BusGarageViewProps {
  walletBalanceInr: number;
  ownedBusIds: BusLiveryId[];
  selectedBusId: BusLiveryId;
  onBuyBus: (bus: BusFleetSpec) => Promise<void> | void;
  onSelectBus: (busId: BusLiveryId) => Promise<void> | void;
  onLaunchDrive: () => void;
}

export const BusGarageView: React.FC<BusGarageViewProps> = ({
  walletBalanceInr,
  ownedBusIds,
  selectedBusId,
  onBuyBus,
  onSelectBus,
  onLaunchDrive,
}) => {
  const [busyId, setBusyId] = useState<BusLiveryId | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleBuy = async (bus: BusFleetSpec) => {
    if (walletBalanceInr < bus.priceInr) {
      setFeedback(`Need ₹${bus.priceInr - walletBalanceInr} more — complete Career trips to earn fares!`);
      return;
    }
    setBusyId(bus.id);
    setFeedback(null);
    try {
      await onBuyBus(bus);
      setFeedback(`Purchased & equipped ${bus.operatorName}!`);
    } catch {
      setFeedback('Could not save purchase right now. Try again.');
    } finally {
      setBusyId(null);
    }
  };

  const handleEquip = async (bus: BusFleetSpec) => {
    setBusyId(bus.id);
    setFeedback(null);
    try {
      await onSelectBus(bus.id);
      setFeedback(`Active coach set to ${bus.operatorName}.`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen w-full pt-20 pb-12 px-4 md:px-8 max-w-6xl mx-auto">
      {/* Header + Live Driver Wallet */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold text-amber-300 tracking-wide mb-1">
            INTERSTATE ROADWAYS DEPOT · MULTI-STATE FLEET SHOWROOM
          </p>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-white">
            Indian State Transport Bus Garage
          </h1>
          <p className="text-sm text-slate-300 mt-1 max-w-2xl">
            Unlock and drive authentic state roadways coaches from Haryana, Himachal Pradesh (HRTC),
            Punjab (PUNBUS), Uttar Pradesh (UPSRTC Lal Pari), Rajasthan (RSRTC), Uttarakhand (UTC),
            and Delhi (DTC AC).
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hud-panel-solid rounded-xl px-4 py-2.5 flex items-center gap-2.5">
            <Wallet className="w-4 h-4 text-emerald-400" />
            <div>
              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Driver Wallet</div>
              <div className="font-mono text-lg font-bold text-emerald-300 leading-tight tabular-nums">
                ₹{walletBalanceInr.toLocaleString('en-IN')}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onLaunchDrive}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-[#0B5ED7] hover:bg-[#094DB2] text-white text-xs sm:text-sm font-semibold whitespace-nowrap cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            Drive Equipped Bus
          </button>
        </div>
      </div>

      {feedback && (
        <div className="mb-5 px-4 py-2.5 rounded-xl bg-[#162336] border border-sky-500/40 text-xs sm:text-sm text-sky-100 flex items-center justify-between">
          <span>{feedback}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white ml-3 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 7-Bus Authentic State Transport Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {BUS_FLEET.map((bus) => {
          const owned = ownedBusIds.includes(bus.id);
          const equipped = selectedBusId === bus.id;
          const canAfford = walletBalanceInr >= bus.priceInr;
          const stateCode = bus.defaultPlate.slice(0, 2);

          return (
            <div
              key={bus.id}
              className={`rounded-2xl overflow-hidden flex flex-col justify-between transition-colors ${
                equipped
                  ? 'bg-[#132036] border-2 border-sky-400 shadow-[0_0_24px_rgba(56,189,248,0.18)]'
                  : 'hud-panel-solid border border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                {/* Authentic Side-Profile State Bus Livery Banner Preview */}
                <div className="relative h-32 w-full bg-[#0A101B] p-4 flex flex-col justify-between overflow-hidden">
                  <div className="relative mx-auto w-full max-w-[260px] h-20 rounded-xl overflow-hidden border border-white/20 shadow-lg flex flex-col">
                    {/* Upper roof/body + dark panoramic window band */}
                    <div
                      className="h-[46%] w-full flex items-center justify-between px-2.5"
                      style={{ backgroundColor: bus.roofColor }}
                    >
                      <div className="w-[82%] h-5 rounded-sm bg-slate-900/90 border border-slate-600/60 flex items-center justify-around px-1">
                        <span className="w-px h-full bg-slate-700" />
                        <span className="w-px h-full bg-slate-700" />
                        <span className="w-px h-full bg-slate-700" />
                        <span className="w-px h-full bg-slate-700" />
                      </div>
                      <span className="text-[9px] font-mono font-bold px-1 rounded bg-slate-950/85 text-amber-300">
                        {stateCode}
                      </span>
                    </div>
                    {/* Authentic Accent Stripe */}
                    <div className="h-[12%] w-full" style={{ backgroundColor: bus.stripeColor }} />
                    {/* Lower State Transport Primary Band */}
                    <div
                      className="h-[42%] w-full flex items-center justify-between px-3"
                      style={{ backgroundColor: bus.primaryColor }}
                    >
                      <span className="font-display text-[11px] font-bold text-white drop-shadow">
                        {bus.operatorName}
                      </span>
                      <span className="font-mono text-[9px] font-bold text-slate-950 bg-amber-300 px-1.5 py-0.5 rounded-sm">
                        {bus.defaultPlate}
                      </span>
                    </div>
                  </div>

                  {/* Ownership Status */}
                  <div className="flex items-center justify-between text-[11px] mt-1">
                    <span className="text-slate-400 font-medium">{bus.stateName}</span>
                    {equipped ? (
                      <span className="inline-flex items-center gap-1 text-sky-300 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Equipped
                      </span>
                    ) : owned ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Owned
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-300 font-mono font-bold">
                        <Lock className="w-3 h-3" />₹{bus.priceInr.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Bus Details */}
                <div className="p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="font-display text-base font-bold text-white">{bus.operatorName}</h2>
                    <span className="text-[10px] text-amber-300 font-medium truncate max-w-[140px]">
                      {bus.stateName}
                    </span>
                  </div>
                  <p className="text-xs text-sky-300/90 font-medium mt-0.5">{bus.subtitle}</p>
                  <p className="text-xs text-slate-400 leading-relaxed mt-2">{bus.description}</p>
                </div>
              </div>

              {/* Action Footer */}
              <div className="px-4 pb-4 pt-1">
                {equipped ? (
                  <button
                    type="button"
                    onClick={onLaunchDrive}
                    className="w-full py-2.5 rounded-xl bg-sky-600/25 border border-sky-400/50 text-sky-200 hover:bg-sky-600/35 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Bus className="w-3.5 h-3.5" />
                    Active Fleet Coach — Drive Now
                  </button>
                ) : owned ? (
                  <button
                    type="button"
                    disabled={busyId === bus.id}
                    onClick={() => handleEquip(bus)}
                    className="w-full py-2.5 rounded-xl bg-[#0B5ED7] hover:bg-[#094DB2] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
                  >
                    {busyId === bus.id ? 'Equipping...' : 'Equip Coach'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busyId === bus.id}
                    onClick={() => handleBuy(bus)}
                    className={`w-full py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                      canAfford
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    {busyId === bus.id
                      ? 'Purchasing...'
                      : `Buy ${stateCode} Coach · ₹${bus.priceInr.toLocaleString('en-IN')}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
