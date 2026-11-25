export type SimView = 'hub' | 'career-map' | 'training-select' | 'driving' | 'logbook';

export type SimMode = 'showcase' | 'career' | 'training';

export type WeatherPreset = 'sunny' | 'mist' | 'rain' | 'night';

export type TransmissionMode = 'auto' | 'manual';

export type CameraMode = 'chase' | 'cabin' | 'bumper' | 'orbit';

export type RouteId =
  | 'kalka-shimla'
  | 'ambala-manali'
  | 'ambala-dharamshala'
  | 'yamunanagar-reckong-peo';

export type TrackId = 'figure8' | 'hBayReverse' | 'zigZag' | 'gradientRamp';

export type LandmarkType = 'bus_stand' | 'mandir' | 'market' | 'dhaba' | 'tunnel';

export type DepotName =
  | 'Panchkula'
  | 'Ambala'
  | 'Chandigarh'
  | 'Yamunanagar'
  | 'Kalka'
  | 'Rohtak';

export interface RouteStopSpec {
  id: string;
  name: string;
  hindiName: string;
  mapQuery: string;
  landmarkType: LandmarkType;
  progressT: number; // 0..1 position along the 3D highway spline
  altitudeM: number;
  waitingCount: number;
  fareInr: number;
  signageTitle: string;
}

export interface CareerRouteSpec {
  id: RouteId;
  title: string;
  hindiBoard: string;
  highwayCode: string;
  origin: string;
  destination: string;
  depotPlate: string;
  depotHome: DepotName;
  difficulty: 'Moderate' | 'Challenging' | 'Steep Ghats' | 'Extreme Cliffside';
  approxDistanceKm: number;
  maxAltitudeM: number;
  estimatedDurationLabel: string;
  description: string;
  stops: RouteStopSpec[];
  splineSeed: number;
  cliffTightness: number;
  baseClimbRate: number;
}

export interface LicenseTrackSpec {
  id: TrackId;
  order: number;
  title: string;
  hindiTitle: string;
  venue: string;
  summary: string;
  officialRule: string;
  targetTimeSec: number;
  maxAllowedFaults: number;
  coachingTip: string;
}

export interface TrainingLiveState {
  trackId: TrackId;
  phase: 'briefing' | 'active' | 'passed' | 'failed';
  elapsedSec: number;
  checkpointsCleared: number;
  totalCheckpoints: number;
  coneHits: number;
  lineFaults: number;
  rollbackCm: number;
  rampStoppedConfirmed: boolean;
  bayAlignedPct: number;
  score: number;
  failureReason: string | null;
  instruction: string;
}

export interface TelemetrySnapshot {
  speedKmh: number;
  rpm: number;
  gear: number; // -1 = R, 0 = N, 1..6 = forward
  transmission: TransmissionMode;
  doorOpen: boolean;
  doorAnim: number; // 0..1
  handbrake: boolean;
  headlights: 0 | 1 | 2;
  cabinLight: boolean;
  indicators: 'off' | 'left' | 'right' | 'hazard';
  wipersOn: boolean;
  hornActive: 'none' | 'melody' | 'air';
  altitudeM: number;
  slopePct: number;
  fuelPct: number;
  airPressurePsi: number;
  passengersOnBoard: number;
  busCapacity: number;
  waitingAtCurrentStop: number;
  atStopName: string | null;
  atStopType: LandmarkType | null;
  boardingProgress: number; // 0..1
  tripEarningsInr: number;
  stopsCompleted: number;
  totalStops: number;
  nextStopName: string;
  nextStopDistM: number;
  routeProgressPct: number;
  distanceDrivenKm: number;
  damagePct: number;
  cameraMode: CameraMode;
  weather: WeatherPreset;
  noticeText: string | null;
  noticeSeverity: 'info' | 'success' | 'warning' | 'danger';
  tripCompleted: boolean;
  tripDurationSec: number;
  safetyRating: number;
  busX: number;
  busZ: number;
  busHeading: number;
  steerNorm: number; // -1 (full right) .. +1 (full left)
  throttleActive: number; // 0..1
  brakeActive: number; // 0..1
  shiftHint: 'up' | 'down' | null;
  autoRange: 'D' | 'N' | 'R';
  training: TrainingLiveState | null;
}

export interface BusControlInputs {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1 (left) .. 1 (right)
  hornMelody: boolean;
  hornAir: boolean;
}

export interface DriverProfile {
  uid: string;
  displayName: string;
  depotHome: DepotName;
  totalEarningsInr: number;
  totalKmDriven: number;
  totalPassengersCarried: number;
  htvLicenseEarned: boolean;
  preferredTransmission: TransmissionMode;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface LicenseTestRecord {
  driverId: string;
  trackId: TrackId;
  passed: boolean;
  bestScore: number;
  bestTimeSec: number;
  penalties: number;
  completedAt?: unknown;
}

export interface TripLog {
  id: string;
  driverId: string;
  routeId: RouteId;
  routeTitle: string;
  origin: string;
  destination: string;
  passengersBoarded: number;
  fareCollectedInr: number;
  safetyRating: number;
  weather: WeatherPreset;
  durationSec: number;
  completedAt?: unknown;
}
