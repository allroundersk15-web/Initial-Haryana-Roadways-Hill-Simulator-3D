import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BUS_FLEET } from '../data/buses';
import { getRouteById, getTrackById } from '../data/routes';
import { IndianBusAudioEngine } from '../lib/audioEngine';
import type {
  BusControlInputs,
  BusFleetSpec,
  CameraMode,
  EndlessBiome,
  RouteId,
  SimMode,
  TelemetrySnapshot,
  TrackId,
  TrainingLiveState,
  TransmissionMode,
  WeatherPreset,
} from '../types/simulator';
import { buildHaryanaRoadwaysBus, type BusVisualRig, type ConductorMode } from './busBuilder';
import { buildEndlessMountainWorld, type EndlessWorldHandle } from './endlessWorldBuilder';
import { createSkyGradientDome, type LandslideZoneData } from './sceneryAndTraffic';
import { buildTrainingGroundArena, type TrainingArenaHandle } from './trainingBuilder';
import { buildHimachalMountainWorld, type HimachalWorldHandle } from './worldBuilder';

export interface BusSimController {
  toggleDoor: () => void;
  toggleHandbrake: () => void;
  cycleHeadlights: () => void;
  toggleCabinLight: () => void;
  setIndicator: (mode: 'off' | 'left' | 'right' | 'hazard') => void;
  toggleWipers: () => void;
  cycleCamera: () => void;
  resetCameraLook: () => void;
  toggleTransmission: () => void;
  shiftGear: (delta: 1 | -1) => void;
  setGear: (gear: number) => void;
  setAutoRange: (range: 'D' | 'N' | 'R') => void;
  setWeather: (w: WeatherPreset) => void;
  setTouchInput: (patch: Partial<BusControlInputs>) => void;
  setAudioMuted: (muted: boolean) => void;
  resetSession: () => void;
  startTrainingAttempt: () => void;
  clearLandslide: () => void;
}

interface BusSimulatorCanvasProps {
  mode: SimMode;
  routeId: RouteId;
  trackId: TrackId;
  busSpec?: BusFleetSpec;
  weather: WeatherPreset;
  initialTransmission: TransmissionMode;
  onTelemetry: (snap: TelemetrySnapshot) => void;
  onTollPaid?: (feeInr: number, plazaName: string) => void;
  onTrainingFinish?: (result: {
    trackId: TrackId;
    passed: boolean;
    score: number;
    timeSec: number;
    penalties: number;
  }) => void;
  onCareerFinish?: (result: {
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
  }) => void;
  controllerRef: React.RefObject<BusSimController | null>;
}

// Pre-allocated math helpers outside animation loop (zero GC churn)
const _camTargetPos = new THREE.Vector3();
const _camTargetLook = new THREE.Vector3();
const _busForward = new THREE.Vector3();
const _busRight = new THREE.Vector3();
const _doorLocal = new THREE.Vector3(1.55, 0.3, 4.12);
const _doorWorld = new THREE.Vector3();
const _busPosVec = new THREE.Vector3();
const _cornerVec = new THREE.Vector3();
const _lookDir = new THREE.Vector3();

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

const GEAR_MAX_SPEED_MS: Record<number, number> = {
  [-1]: 7.5,
  0: 0,
  1: 6.5,
  2: 11.2,
  3: 16.5,
  4: 21.8,
  5: 26.8,
  6: 31.5,
};

const STOP_HINDI_SHORT: Record<string, string> = {
  'panchkula-kalka': 'कालका',
  'dharampur-dhaba': 'धरमपुर',
  'barog-solan-market': 'सोलन',
  'tara-devi-mandir': 'तारा देवी',
  'shimla-kufri': 'शिमला कुफरी',
  'ambala-chd': 'अंबाला चंडीगढ़',
  'swarghat-dhaba': 'स्वारघाट',
  'mandi-market': 'मंडी',
  'hanogi-mandir-aut': 'हनोगी औट',
  'kullu-manali': 'कुल्लू मनाली',
  'ambala-una': 'अंबाला ऊना',
  'dehra-dhaba': 'देहरा',
  'jwalaji-mandir': 'ज्वाला जी',
  'kangra-market': 'कांगड़ा धर्मशाला',
  'mcleod-ganj': 'मैक्लोडगंज',
  'yamunanagar-paonta': 'यमुनानगर पांवटा',
  'narkanda-dhaba': 'नारकंडा',
  'rampur-market': 'रामपुर बुशहर',
  'jeori-mandir': 'ज्यूरी',
  'reckong-peo': 'रिकांग पिओ',
};

const REVERSE_HINDI_CUES = [
  'आने दो ड्राइवर साहब, आने दो! पीछे रास्ता खाली है!',
  'धीरे धीरे आने दो, सीधा पीछे लो!',
  'आने दो, आने दो, थोड़ा और पीछे!',
  'बढ़िया, आराम से पीछे लेते रहो!',
];

const WEATHER_SKY: Record<
  WeatherPreset,
  {
    bg: number;
    fog: number;
    fogDensity: number;
    sunColor: number;
    sunInt: number;
    hemiSky: number;
    hemiGround: number;
    hemiInt: number;
  }
> = {
  sunny: {
    bg: 0x9ac6eb,
    fog: 0xc2ddf2,
    fogDensity: 0.0017,
    sunColor: 0xfff5db,
    sunInt: 2.35,
    hemiSky: 0x93c5fd,
    hemiGround: 0x455838,
    hemiInt: 1.0,
  },
  mist: {
    bg: 0xbac8d6,
    fog: 0xc2d0dc,
    fogDensity: 0.0085,
    sunColor: 0xe2e8f0,
    sunInt: 1.25,
    hemiSky: 0xcbd5e1,
    hemiGround: 0x475569,
    hemiInt: 0.85,
  },
  rain: {
    bg: 0x5c6e82,
    fog: 0x627488,
    fogDensity: 0.0066,
    sunColor: 0xcbd5e1,
    sunInt: 0.98,
    hemiSky: 0x94a3b8,
    hemiGround: 0x2c363e,
    hemiInt: 0.74,
  },
  night: {
    bg: 0x081020,
    fog: 0x0b162b,
    fogDensity: 0.0046,
    sunColor: 0x8bb4e8,
    sunInt: 0.34,
    hemiSky: 0x1e3a5f,
    hemiGround: 0x0f172a,
    hemiInt: 0.36,
  },
};

export const BusSimulatorCanvas: React.FC<BusSimulatorCanvasProps> = ({
  mode,
  routeId,
  trackId,
  busSpec = BUS_FLEET[0],
  weather,
  initialTransmission,
  onTelemetry,
  onTollPaid,
  onTrainingFinish,
  onCareerFinish,
  controllerRef,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);

  const callbacksRef = useRef({ onTelemetry, onTollPaid, onTrainingFinish, onCareerFinish });
  callbacksRef.current = { onTelemetry, onTollPaid, onTrainingFinish, onCareerFinish };

  const propsRef = useRef({ mode, routeId, trackId, busSpec, weather, initialTransmission });
  propsRef.current = { mode, routeId, trackId, busSpec, weather, initialTransmission };

  const simRef = useRef({
    busX: 0,
    busY: 0,
    busZ: 0,
    busHeading: 0,
    busPitch: 0,
    busRoll: 0,
    speedMs: 0,
    steerAngle: 0,
    rpm: 750,
    gear: 1,
    autoRange: 'D' as 'D' | 'N' | 'R',
    shiftCutTimer: 0,
    reverseHoldTimer: 0,
    steerNorm: 0,
    throttleActive: 0,
    brakeActive: 0,
    shiftHint: null as 'up' | 'down' | null,
    transmission: initialTransmission as TransmissionMode,
    doorOpen: false,
    doorAnim: 0,
    handbrake: false,
    headlights: (weather === 'night' ? 2 : 0) as 0 | 1 | 2,
    cabinLight: weather === 'night',
    indicators: 'off' as 'off' | 'left' | 'right' | 'hazard',
    wipersOn: weather === 'rain',
    cameraMode: 'chase' as CameraMode,
    weather: weather as WeatherPreset,
    fuelPct: 96,
    airPressurePsi: 118,
    passengersOnBoard: 6,
    tripEarningsInr: 0,
    tollsPaidInr: 0,
    stopsCompleted: 0,
    distanceDrivenM: 0,
    damagePct: 0,
    tripElapsedSec: 0,
    tripCompleted: false,
    careerReported: false,
    boardingTimer: 0,
    activeStopIdx: -1,
    lastSplineT: 0.02,
    altitudeM: 656,
    slopePct: 0,
    endlessBiome: null as EndlessBiome | null,
    collisionCooldown: 0,
    // 360-degree finger/mouse free-look offsets (radians)
    lookYaw: 0,
    lookPitch: 0,
    isLookDragging: false,
    noticeText: null as string | null,
    noticeSeverity: 'info' as 'info' | 'success' | 'warning' | 'danger',
    noticeTimer: 0,
    keys: new Set<string>(),
    touch: {
      throttle: 0,
      brake: 0,
      steer: 0,
      hornMelody: false,
      hornAir: false,
    } as BusControlInputs,
    training: null as TrainingLiveState | null,
    rampHoldTimer: 0,
    rampStopZ: 0,
    trainingReported: false,
    orbitAngle: 0.65,
    nearLandslideId: null as string | null,
    nearLandslideLabel: null as string | null,
    landslideClearing: false,
    landslideClearPct: 0,
    conductorDoorAnim: 0,
    conductorCallStep: 0,
    conductorWhistleTimer: 0,
    conductorReverseCueIdx: 0,
    conductorSpokeThisStop: false,
    lastConductorMode: 'seated' as ConductorMode,
    needsWorldRebuild: true,
  });

  const audioRef = useRef<IndianBusAudioEngine | null>(null);
  const weatherUpdaterRef = useRef<((w: WeatherPreset) => void) | null>(null);
  const resetWorldFnRef = useRef<(() => void) | null>(null);
  const clearLandslideFnRef = useRef<(() => void) | null>(null);
  const busRigRef = useRef<BusVisualRig | null>(null);

  const showNotice = (
    text: string,
    severity: 'info' | 'success' | 'warning' | 'danger' = 'info',
    durationSec = 3.2
  ) => {
    simRef.current.noticeText = text;
    simRef.current.noticeSeverity = severity;
    simRef.current.noticeTimer = durationSec;
  };

  useImperativeHandle(controllerRef, () => ({
    toggleDoor() {
      const s = simRef.current;
      if (Math.abs(s.speedMs) > 2.2 && !s.doorOpen) {
        showNotice('Slow down below 8 km/h before opening passenger door', 'warning');
        return;
      }
      s.doorOpen = !s.doorOpen;
      audioRef.current?.playPneumaticHiss(0.5);
      showNotice(s.doorOpen ? 'Pneumatic front door opened' : 'Pneumatic front door closed', 'info', 2.0);
    },
    toggleHandbrake() {
      const s = simRef.current;
      s.handbrake = !s.handbrake;
      audioRef.current?.playPneumaticHiss(0.32);
      showNotice(s.handbrake ? 'Air Parking Handbrake ENGAGED' : 'Handbrake RELEASED', 'info', 1.8);
    },
    cycleHeadlights() {
      const s = simRef.current;
      s.headlights = ((s.headlights + 1) % 3) as 0 | 1 | 2;
      showNotice(
        s.headlights === 0 ? 'Headlights OFF' : s.headlights === 1 ? 'Low Beam ON' : 'High Beam ON',
        'info',
        1.6
      );
    },
    toggleCabinLight() {
      simRef.current.cabinLight = !simRef.current.cabinLight;
    },
    setIndicator(ind) {
      const s = simRef.current;
      s.indicators = s.indicators === ind ? 'off' : ind;
    },
    toggleWipers() {
      simRef.current.wipersOn = !simRef.current.wipersOn;
    },
    cycleCamera() {
      const order: CameraMode[] = ['chase', 'cabin', 'bumper', 'orbit'];
      const curIdx = order.indexOf(simRef.current.cameraMode);
      simRef.current.cameraMode = order[(curIdx + 1) % order.length];
      simRef.current.lookYaw = 0;
      simRef.current.lookPitch = 0;
      showNotice(
        simRef.current.cameraMode === 'cabin'
          ? 'Camera: CABIN — Drag screen to look 360° around cockpit'
          : `Camera: ${simRef.current.cameraMode.toUpperCase()}`,
        'info',
        2.2
      );
    },
    resetCameraLook() {
      simRef.current.lookYaw = 0;
      simRef.current.lookPitch = 0;
    },
    toggleTransmission() {
      const s = simRef.current;
      s.transmission = s.transmission === 'auto' ? 'manual' : 'auto';
      if (s.transmission === 'auto') {
        if (s.gear < 0) s.autoRange = 'R';
        else if (s.gear === 0) s.autoRange = 'N';
        else s.autoRange = 'D';
      } else if (s.gear === 0) {
        s.gear = 1;
      }
      audioRef.current?.playGearShift(false);
      showNotice(
        s.transmission === 'manual' ? 'Manual 6-Speed (Q/E or 1-6)' : 'Auto Gearbox (D / N / R)',
        'info',
        2.0
      );
    },
    shiftGear(delta) {
      const s = simRef.current;
      if (s.transmission === 'auto') {
        const order: Array<'R' | 'N' | 'D'> = ['R', 'N', 'D'];
        const cur = order.indexOf(s.autoRange);
        const nextIdx = THREE.MathUtils.clamp(cur + delta, 0, 2);
        const nextRange = order[nextIdx];
        if (nextRange !== s.autoRange) {
          s.autoRange = nextRange;
          s.gear = nextRange === 'R' ? -1 : nextRange === 'N' ? 0 : Math.max(1, s.gear);
          s.shiftCutTimer = 0.09;
          audioRef.current?.playGearShift(nextRange === 'R');
        }
        return;
      }
      const next = THREE.MathUtils.clamp(s.gear + delta, -1, 6);
      if (next !== s.gear) {
        if (next === -1 && s.speedMs > 2.6) {
          showNotice('Slow down before engaging Reverse (R)', 'warning', 1.8);
          return;
        }
        s.gear = next;
        s.shiftCutTimer = 0.11;
        audioRef.current?.playGearShift(next === -1);
      }
    },
    setGear(targetGear) {
      const s = simRef.current;
      const clamped = THREE.MathUtils.clamp(Math.round(targetGear), -1, 6);
      if (clamped === -1 && s.speedMs > 2.6) {
        showNotice('Slow down before engaging Reverse (R)', 'warning', 1.8);
        return;
      }
      if (s.transmission === 'auto') {
        s.transmission = 'manual';
      }
      if (clamped !== s.gear) {
        s.gear = clamped;
        s.shiftCutTimer = 0.11;
        audioRef.current?.playGearShift(clamped === -1);
      }
    },
    setAutoRange(range) {
      const s = simRef.current;
      if (range === 'R' && s.speedMs > 2.8) {
        showNotice('Slow down before shifting to Reverse (R)', 'warning', 1.8);
        return;
      }
      s.transmission = 'auto';
      if (s.autoRange !== range) {
        s.autoRange = range;
        s.gear = range === 'R' ? -1 : range === 'N' ? 0 : Math.max(1, s.gear);
        s.shiftCutTimer = 0.09;
        audioRef.current?.playGearShift(range === 'R');
      }
    },
    setWeather(w) {
      simRef.current.weather = w;
      simRef.current.wipersOn = w === 'rain';
      if (w === 'night') {
        simRef.current.headlights = 2;
        simRef.current.cabinLight = true;
      } else if (w === 'mist') {
        simRef.current.headlights = 1;
      }
      weatherUpdaterRef.current?.(w);
    },
    setTouchInput(patch) {
      audioRef.current?.init();
      Object.assign(simRef.current.touch, patch);
    },
    setAudioMuted(muted) {
      audioRef.current?.setMuted(muted);
    },
    resetSession() {
      resetWorldFnRef.current?.();
    },
    startTrainingAttempt() {
      const s = simRef.current;
      if (s.training) {
        s.training.phase = 'active';
        s.handbrake = false;
        showNotice('Official HSSC Test Started — Drive smoothly!', 'info', 2.6);
      }
    },
    clearLandslide() {
      clearLandslideFnRef.current?.();
    },
  }));

  // Trigger world rebuild whenever mode, routeId, or trackId changes
  useEffect(() => {
    simRef.current.needsWorldRebuild = true;
    simRef.current.weather = weather;
    simRef.current.wipersOn = weather === 'rain';
    simRef.current.headlights = weather === 'night' ? 2 : weather === 'mist' ? 1 : 0;
    simRef.current.cabinLight = weather === 'night';
    weatherUpdaterRef.current?.(weather);
  }, [mode, routeId, trackId, weather]);

  useEffect(() => {
    simRef.current.transmission = initialTransmission;
  }, [initialTransmission]);

  // Dynamically repaint 3D bus livery whenever user equips a different State Transport Bus!
  useEffect(() => {
    const rig = busRigRef.current;
    if (!rig) return;
    const route = getRouteById(routeId);
    const boardText =
      mode === 'endless'
        ? 'ENDLESS HIGHWAY EXPRESS'
        : mode === 'training'
          ? `IDTR TEST: ${getTrackById(trackId).title}`
          : route.title;
    rig.applyLivery(busSpec, boardText);
  }, [busSpec, mode, routeId, trackId]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError('WebGL2 hardware context is unavailable in this browser.');
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglError('3D WebGL context was paused by the browser. Click Reload View to restore.');
    };
    const handleContextRestored = () => {
      setWebglError(null);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    // 360-Degree Touch & Mouse Free-Look around Bus Interior & Exterior
    let lookPointerId: number | null = null;
    let lastLookX = 0;
    let lastLookY = 0;
    let lastTapTime = 0;

    const onCanvasPointerDown = (e: PointerEvent) => {
      if (lookPointerId !== null) return;
      const now = performance.now();
      if (now - lastTapTime < 280) {
        // Double-tap smoothly recenters 360° camera look forward
        simRef.current.lookYaw = 0;
        simRef.current.lookPitch = 0;
        lastTapTime = 0;
        return;
      }
      lastTapTime = now;
      lookPointerId = e.pointerId;
      lastLookX = e.clientX;
      lastLookY = e.clientY;
      simRef.current.isLookDragging = true;
      try {
        renderer.domElement.setPointerCapture(e.pointerId);
      } catch {
        // Ignore capture failure on synthetic events
      }
    };

    const onCanvasPointerMove = (e: PointerEvent) => {
      if (lookPointerId !== e.pointerId) return;
      const dx = e.clientX - lastLookX;
      const dy = e.clientY - lastLookY;
      lastLookX = e.clientX;
      lastLookY = e.clientY;

      const s = simRef.current;
      // Full unrestricted 360° horizontal yaw + comfortable vertical pitch
      s.lookYaw -= dx * 0.0068;
      s.lookPitch = THREE.MathUtils.clamp(s.lookPitch - dy * 0.0046, -0.58, 0.72);
      if (s.cameraMode === 'orbit') {
        s.orbitAngle -= dx * 0.0068;
      }
    };

    const onCanvasPointerUp = (e: PointerEvent) => {
      if (lookPointerId !== e.pointerId) return;
      lookPointerId = null;
      simRef.current.isLookDragging = false;
      try {
        if (renderer.domElement.hasPointerCapture(e.pointerId)) {
          renderer.domElement.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
    };

    renderer.domElement.addEventListener('pointerdown', onCanvasPointerDown);
    renderer.domElement.addEventListener('pointermove', onCanvasPointerMove);
    renderer.domElement.addEventListener('pointerup', onCanvasPointerUp);
    renderer.domElement.addEventListener('pointercancel', onCanvasPointerUp);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      58,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.16,
      1650
    );

    // Mandatory Studio PBR RoomEnvironment on every device
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();

    // Procedural Gradient Sky Dome for richer outdoor atmosphere
    const skyDome = createSkyGradientDome();
    scene.add(skyDome.mesh);

    // Upgraded 3-Point Outdoor Lighting Rig + crisp hardware shadows
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x455838, 1.0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfff5db, 2.35);
    sunLight.position.set(85, 130, 60);
    sunLight.castShadow = !isSoftwareGl;
    sunLight.shadow.mapSize.set(isSoftwareGl ? 512 : 1536, isSoftwareGl ? 512 : 1536);
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 360;
    const d = 82;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.00045;
    sunLight.shadow.normalBias = 0.025;
    scene.add(sunLight);
    scene.add(sunLight.target);

    const applyWeatherVisuals = (w: WeatherPreset) => {
      const cfg = WEATHER_SKY[w];
      scene.background = new THREE.Color(cfg.bg);
      scene.fog = new THREE.FogExp2(cfg.fog, cfg.fogDensity);
      sunLight.color.setHex(cfg.sunColor);
      sunLight.intensity = cfg.sunInt;
      hemiLight.color.setHex(cfg.hemiSky);
      hemiLight.groundColor.setHex(cfg.hemiGround);
      hemiLight.intensity = cfg.hemiInt;
      skyDome.updateWeather(w);
    };
    weatherUpdaterRef.current = applyWeatherVisuals;
    applyWeatherVisuals(simRef.current.weather);

    // Build Hero Indian State Transport Bus with Dynamic Livery & Detailed 3D Interior Cockpit
    const initRoute = getRouteById(propsRef.current.routeId);
    const bus: BusVisualRig = buildHaryanaRoadwaysBus(
      renderer,
      isSoftwareGl,
      initRoute.title,
      propsRef.current.busSpec.defaultPlate,
      propsRef.current.busSpec
    );
    busRigRef.current = bus;
    scene.add(bus.root);

    const audio = new IndianBusAudioEngine();
    audioRef.current = audio;

    let himachalWorld: HimachalWorldHandle | null = null;
    let endlessWorld: EndlessWorldHandle | null = null;
    let trainingArena: TrainingArenaHandle | null = null;

    const rebuildWorld = () => {
      if (himachalWorld) {
        scene.remove(himachalWorld.root);
        himachalWorld.dispose();
        himachalWorld = null;
      }
      if (endlessWorld) {
        scene.remove(endlessWorld.root);
        endlessWorld.dispose();
        endlessWorld = null;
      }
      if (trainingArena) {
        scene.remove(trainingArena.root);
        trainingArena.dispose();
        trainingArena = null;
      }

      const { mode: curMode, routeId: curRouteId, trackId: curTrackId, busSpec: curSpec } = propsRef.current;
      const s = simRef.current;

      s.speedMs = 0;
      s.steerAngle = 0;
      s.steerNorm = 0;
      s.throttleActive = 0;
      s.brakeActive = 0;
      s.shiftHint = null;
      s.rpm = 750;
      s.gear = 1;
      s.autoRange = 'D';
      s.shiftCutTimer = 0;
      s.reverseHoldTimer = 0;
      s.doorOpen = false;
      s.doorAnim = 0;
      s.handbrake = false;
      s.damagePct = 0;
      s.tripElapsedSec = 0;
      s.distanceDrivenM = 0;
      s.tripCompleted = false;
      s.careerReported = false;
      s.boardingTimer = 0;
      s.activeStopIdx = -1;
      s.tollsPaidInr = 0;
      s.endlessBiome = null;
      s.collisionCooldown = 0;
      s.lookYaw = 0;
      s.lookPitch = 0;
      s.rampHoldTimer = 0;
      s.rampStopZ = 0;
      s.trainingReported = false;
      s.nearLandslideId = null;
      s.nearLandslideLabel = null;
      s.landslideClearing = false;
      s.landslideClearPct = 0;
      s.conductorDoorAnim = 0;
      s.conductorCallStep = 0;
      s.conductorWhistleTimer = 0;
      s.conductorSpokeThisStop = false;
      s.lastConductorMode = 'seated';

      if (curMode === 'training') {
        const track = getTrackById(curTrackId);
        trainingArena = buildTrainingGroundArena(curTrackId);
        scene.add(trainingArena.root);

        s.busX = trainingArena.startPos.x;
        s.busY = trainingArena.startPos.y;
        s.busZ = trainingArena.startPos.z;
        s.busHeading = trainingArena.startHeading;
        s.busPitch = 0;
        s.busRoll = 0;
        s.altitudeM = 235;
        s.passengersOnBoard = 0;
        s.tripEarningsInr = 0;
        s.stopsCompleted = 0;
        s.cameraMode = 'chase';
        bus.applyLivery(curSpec, `IDTR TEST: ${track.title}`);

        s.training = {
          trackId: curTrackId,
          phase: 'briefing',
          elapsedSec: 0,
          checkpointsCleared: 0,
          totalCheckpoints: trainingArena.checkpoints.length,
          coneHits: 0,
          lineFaults: 0,
          rollbackCm: 0,
          rampStoppedConfirmed: false,
          bayAlignedPct: 0,
          score: 100,
          failureReason: null,
          instruction: track.summary,
        };
      } else if (curMode === 'endless') {
        endlessWorld = buildEndlessMountainWorld(renderer);
        scene.add(endlessWorld.root);

        s.busX = endlessWorld.startPos.x;
        s.busY = endlessWorld.startPos.y;
        s.busZ = endlessWorld.startPos.z;
        s.busHeading = endlessWorld.startHeading;
        s.busPitch = 0;
        s.busRoll = 0;
        s.altitudeM = 720;
        s.endlessBiome = 'mountain';
        s.passengersOnBoard = 32;
        s.tripEarningsInr = 0;
        s.stopsCompleted = 0;
        s.training = null;
        s.cameraMode = 'chase';
        bus.applyLivery(curSpec, 'ENDLESS HIGHWAY EXPRESS');
        showNotice('Endless Highway Mode — Mountains, Foothills & Plains (No Tolls!)', 'success', 4.0);
      } else {
        const route = getRouteById(curRouteId);
        himachalWorld = buildHimachalMountainWorld(route, renderer);
        scene.add(himachalWorld.root);

        const startT = 0.012;
        const startPt = himachalWorld.curve.getPointAt(startT);
        const startTan = himachalWorld.curve.getTangentAt(startT).normalize();
        const startRight = new THREE.Vector3().crossVectors(startTan, new THREE.Vector3(0, 1, 0)).normalize();
        const laneStart = startPt.clone().addScaledVector(startRight, -2.55);

        s.busX = laneStart.x;
        s.busY = laneStart.y;
        s.busZ = laneStart.z;
        s.busHeading = Math.atan2(startTan.x, startTan.z);
        s.busPitch = Math.asin(THREE.MathUtils.clamp(startTan.y, -0.4, 0.4));
        s.busRoll = 0;
        s.lastSplineT = startT;
        s.altitudeM = route.stops[0]?.altitudeM ?? 656;
        s.passengersOnBoard = 8;
        s.tripEarningsInr = 0;
        s.stopsCompleted = 0;
        s.training = null;
        s.cameraMode = curMode === 'showcase' ? 'orbit' : 'chase';
        bus.applyLivery(curSpec, route.title);
        if (curMode === 'career') {
          showNotice(`Departing ${route.origin} — Pull into the first bay & open door (O)`, 'info', 4.0);
        }
      }

      bus.root.position.set(s.busX, s.busY, s.busZ);
      bus.root.rotation.set(0, s.busHeading, 0);
      camera.position.set(s.busX - Math.sin(s.busHeading) * 14, s.busY + 6.5, s.busZ - Math.cos(s.busHeading) * 14);
      camera.lookAt(s.busX, s.busY + 2.0, s.busZ);

      s.needsWorldRebuild = false;
    };

    const triggerClearLandslide = () => {
      const s = simRef.current;
      const curMode = propsRef.current.mode;
      const landslides: LandslideZoneData[] =
        curMode === 'career' && himachalWorld
          ? himachalWorld.landslides
          : curMode === 'endless' && endlessWorld
            ? endlessWorld.getLandslides()
            : [];
      let best: LandslideZoneData | null = null;
      let bestDist = 40;
      for (const ls of landslides) {
        if (ls.cleared) continue;
        const d = Math.hypot(s.busX - ls.position.x, s.busZ - ls.position.z);
        if (d < bestDist) {
          bestDist = d;
          best = ls;
        }
      }
      if (!best) return;
      if (best.clearing) return;
      best.clearing = true;
      audio.init();
      audio.playRockClear(1.4);
      audio.triggerHindiCrowdVoice('landslide', 3500);
      showNotice(`JCB clearing ${best.label}... Hold steady!`, 'info', 2.8);
    };

    resetWorldFnRef.current = rebuildWorld;
    clearLandslideFnRef.current = triggerClearLandslide;
    rebuildWorld();

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Keyboard Event Listeners
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      const code = e.code;
      audio.init();
      simRef.current.keys.add(code);

      if (propsRef.current.mode === 'showcase') return;

      if (code === 'Space') {
        e.preventDefault();
        controllerRef.current?.toggleHandbrake();
      } else if (code === 'KeyO') {
        controllerRef.current?.toggleDoor();
      } else if (code === 'KeyL') {
        controllerRef.current?.cycleHeadlights();
      } else if (code === 'KeyC') {
        controllerRef.current?.cycleCamera();
      } else if (code === 'KeyM') {
        controllerRef.current?.toggleTransmission();
      } else if (code === 'KeyE') {
        controllerRef.current?.shiftGear(1);
      } else if (code === 'KeyQ') {
        controllerRef.current?.shiftGear(-1);
      } else if (code === 'KeyN') {
        if (simRef.current.transmission === 'auto') {
          controllerRef.current?.setAutoRange('N');
        } else {
          controllerRef.current?.setGear(0);
        }
      } else if (code === 'Digit1') {
        controllerRef.current?.setGear(1);
      } else if (code === 'Digit2') {
        controllerRef.current?.setGear(2);
      } else if (code === 'Digit3') {
        controllerRef.current?.setGear(3);
      } else if (code === 'Digit4') {
        controllerRef.current?.setGear(4);
      } else if (code === 'Digit5') {
        controllerRef.current?.setGear(5);
      } else if (code === 'Digit6') {
        controllerRef.current?.setGear(6);
      } else if (code === 'KeyZ') {
        controllerRef.current?.setIndicator('left');
      } else if (code === 'KeyX') {
        controllerRef.current?.setIndicator('right');
      } else if (code === 'KeyB') {
        controllerRef.current?.setIndicator('hazard');
      } else if (code === 'KeyV') {
        controllerRef.current?.toggleWipers();
      } else if (code === 'KeyJ') {
        controllerRef.current?.clearLandslide();
      } else if (code === 'KeyR') {
        controllerRef.current?.resetSession();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      simRef.current.keys.delete(e.code);
    };

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('resize', onResize);
    document.addEventListener('fullscreenchange', onResize);
    document.addEventListener('webkitfullscreenchange', onResize);

    // Solid OBB-style bus-vs-traffic physical collision & separation so bus NEVER passes through vehicles!
    const resolveBusTrafficCollisions = (
      trafficList: Array<{
        mesh: THREE.Group;
        halfWidth: number;
        halfLength: number;
      }>
    ) => {
      const s = simRef.current;
      const sinH = Math.sin(s.busHeading);
      const cosH = Math.cos(s.busHeading);
      const busHalfW = 1.28;
      const busHalfL = 5.45;

      for (const tv of trafficList) {
        const dx = s.busX - tv.mesh.position.x;
        const dz = s.busZ - tv.mesh.position.z;
        // Quick broadphase skip
        if (dx * dx + dz * dz > 144) continue;

        // Transform offset into bus-local frame (forward = (sinH, cosH), right = (cosH, -sinH))
        const localLong = dx * sinH + dz * cosH;
        const localLat = dx * cosH - dz * sinH;

        const sumW = busHalfW + tv.halfWidth;
        const sumL = busHalfL + tv.halfLength;

        if (Math.abs(localLat) < sumW && Math.abs(localLong) < sumL) {
          const penLat = sumW - Math.abs(localLat);
          const penLong = sumL - Math.abs(localLong);

          if (penLat < penLong) {
            // Side scrape / lateral separation
            const sign = localLat >= 0 ? 1 : -1;
            const push = penLat + 0.04;
            s.busX += cosH * sign * push;
            s.busZ -= sinH * sign * push;
            s.speedMs *= 0.78;
          } else {
            // Front / rear solid bumper stop — physically prevent bus passing through vehicle!
            const sign = localLong >= 0 ? 1 : -1;
            const push = penLong + 0.06;
            s.busX += sinH * sign * push;
            s.busZ += cosH * sign * push;
            // Cancel velocity component driving into the vehicle
            if ((sign < 0 && s.speedMs > 0) || (sign > 0 && s.speedMs < 0)) {
              s.speedMs = -Math.sign(s.speedMs) * Math.min(1.1, Math.abs(s.speedMs) * 0.16);
            }
          }

          if (s.collisionCooldown <= 0) {
            s.collisionCooldown = 0.75;
            s.damagePct = Math.min(100, s.damagePct + 3.5);
            audio.playBump();
            showNotice('Vehicle contact! Maintain lane clearance.', 'danger', 2.0);
          }
        }
      }
    };

    // Paced Animation Loop (Software-WebGL Safe with fenceSync)
    let frameId = 0;
    let disposed = false;
    let lastTime = performance.now();
    let elapsed = 0;
    let hudEmitTimer = 0;
    let blinkTimer = 0;
    let blinkOn = false;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const stepSimulation = (dt: number) => {
      const s = simRef.current;
      if (s.needsWorldRebuild) {
        rebuildWorld();
      }

      const curMode = propsRef.current.mode;
      const curRoute = getRouteById(propsRef.current.routeId);
      const curTrack = getTrackById(propsRef.current.trackId);

      if (s.noticeTimer > 0) {
        s.noticeTimer -= dt;
        if (s.noticeTimer <= 0) {
          s.noticeText = null;
        }
      }
      if (s.collisionCooldown > 0) {
        s.collisionCooldown = Math.max(0, s.collisionCooldown - dt);
      }

      blinkTimer += dt;
      if (blinkTimer >= 0.45) {
        blinkTimer = 0;
        blinkOn = !blinkOn;
        if (s.indicators !== 'off' && curMode !== 'showcase') {
          audio.playIndicatorClick();
        }
      }

      // Showcase Idle Orbit Mode on Landing Hub
      if (curMode === 'showcase') {
        if (!s.isLookDragging) {
          s.orbitAngle += dt * 0.22;
        }
        bus.setDoorOpenAmount(0.18 + Math.sin(elapsed * 0.6) * 0.12);
        bus.updateDriverAndConductor(dt, elapsed, Math.sin(elapsed * 0.45) * 0.1, 0, 1, 'seated', false);
        bus.updateLights(1, false, false, 'off', true, blinkOn);
        bus.updateWipers(elapsed, false);
        audio.updateEngine(760, 0, false);
        audio.updateCrowdAmbience(0, elapsed);

        const r = 15.5;
        camera.position.set(
          s.busX + Math.sin(s.orbitAngle) * r,
          s.busY + 4.4,
          s.busZ + Math.cos(s.orbitAngle) * r
        );
        camera.lookAt(s.busX, s.busY + 1.8, s.busZ + 0.8);
        skyDome.mesh.position.copy(camera.position);
        if (himachalWorld) {
          _busPosVec.set(s.busX, s.busY, s.busZ);
          himachalWorld.updateWorld(dt, elapsed, _busPosVec, s.busHeading, 0, _busPosVec, false, s.weather === 'rain');
        }
        return;
      }

      // Read keyboard + touch inputs
      const k = s.keys;
      const throttleIn = Math.max(k.has('KeyW') || k.has('ArrowUp') ? 1 : 0, s.touch.throttle);
      const brakeIn = Math.max(k.has('KeyS') || k.has('ArrowDown') ? 1 : 0, s.touch.brake);
      const steerLeft = k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0;
      const steerRight = k.has('KeyD') || k.has('ArrowRight') ? 1 : 0;
      const steerIn = THREE.MathUtils.clamp(steerLeft - steerRight + s.touch.steer, -1, 1);
      const hornMelody = k.has('KeyH') || s.touch.hornMelody;
      const hornAir = k.has('KeyG') || s.touch.hornAir;

      // Air horn & melody horn are strictly player's choice — NEVER slows bus or triggers nagging warnings!
      audio.setMelodyHorn(hornMelody);
      audio.setAirHorn(hornAir);

      const trainingFrozen =
        curMode === 'training' && s.training !== null && s.training.phase !== 'active';

      // Sample ground elevation & slope
      let groundY = s.busY;
      let slopeRad = 0;
      let careerRoadSample: ReturnType<HimachalWorldHandle['sampleRoadAt']> | null = null;
      let endlessRoadSample: ReturnType<EndlessWorldHandle['sampleRoadAt']> | null = null;

      if (curMode === 'career' && himachalWorld) {
        _busPosVec.set(s.busX, s.busY, s.busZ);
        careerRoadSample = himachalWorld.sampleRoadAt(_busPosVec, s.lastSplineT);
        s.lastSplineT = careerRoadSample.t;
        groundY = careerRoadSample.point.y;
        const headingAlign =
          Math.sin(s.busHeading) * careerRoadSample.tangent.x +
          Math.cos(s.busHeading) * careerRoadSample.tangent.z;
        slopeRad = careerRoadSample.slopeRad * headingAlign;
        s.altitudeM = careerRoadSample.elevationM;
      } else if (curMode === 'endless' && endlessWorld) {
        _busPosVec.set(s.busX, s.busY, s.busZ);
        endlessRoadSample = endlessWorld.sampleRoadAt(_busPosVec);
        groundY = endlessRoadSample.point.y;
        const headingAlign =
          Math.sin(s.busHeading) * endlessRoadSample.tangent.x +
          Math.cos(s.busHeading) * endlessRoadSample.tangent.z;
        slopeRad = endlessRoadSample.slopeRad * headingAlign;
        s.altitudeM = endlessRoadSample.elevationM;
        s.endlessBiome = endlessRoadSample.biome;
      } else if (curMode === 'training' && trainingArena) {
        const gs = trainingArena.getGroundHeightAndSlope(s.busX, s.busZ);
        groundY = gs.y;
        slopeRad = gs.slopeRad * Math.cos(s.busHeading);
      }

      s.slopePct = Math.round(Math.tan(slopeRad) * 100);
      s.throttleActive = throttleIn;
      s.brakeActive = brakeIn;
      if (s.shiftCutTimer > 0) {
        s.shiftCutTimer = Math.max(0, s.shiftCutTimer - dt);
      }

      let activeDrive = 0;
      let activeBrake = 0;

      if (!trainingFrozen) {
        if (s.transmission === 'auto') {
          if (s.autoRange === 'N') {
            s.gear = 0;
            activeBrake = brakeIn;
            s.reverseHoldTimer = 0;
          } else if (s.autoRange === 'R') {
            s.gear = -1;
            activeBrake = brakeIn;
            if (throttleIn > 0.05) {
              if (s.speedMs > 0.35) {
                activeBrake = Math.max(activeBrake, throttleIn);
              } else {
                activeDrive = -throttleIn * 0.78;
              }
            }
          } else {
            if (throttleIn > 0.05) {
              s.reverseHoldTimer = 0;
              if (s.speedMs < -0.3) {
                activeBrake = throttleIn;
              } else {
                if (s.gear <= 0) s.gear = 1;
                activeDrive = throttleIn;
              }
            } else if (brakeIn > 0.05) {
              if (s.speedMs > 0.35) {
                activeBrake = brakeIn;
                s.reverseHoldTimer = 0;
              } else {
                s.reverseHoldTimer += dt;
                if (s.reverseHoldTimer > 0.32) {
                  s.gear = -1;
                  activeDrive = -brakeIn * 0.65;
                } else {
                  activeBrake = brakeIn;
                }
              }
            } else {
              s.reverseHoldTimer = 0;
              if (s.gear < 1 && Math.abs(s.speedMs) < 0.2) s.gear = 1;
            }

            if (s.gear >= 1) {
              const absSpd = Math.abs(s.speedMs);
              const uphillLoad = slopeRad > 0.055 ? 1.4 : 0;
              const upThresholds = [0, 5.8, 10.6, 15.6, 20.8, 25.8, 99];
              const downThresholds = [0, 0, 4.1, 8.6, 13.4, 18.4, 23.2];
              if (s.gear < 6 && absSpd > upThresholds[s.gear] + uphillLoad && throttleIn > 0.1) {
                s.gear++;
                s.shiftCutTimer = 0.07;
                audio.playGearShift(false);
              } else if (s.gear > 1 && absSpd < downThresholds[s.gear] + uphillLoad) {
                s.gear--;
                s.shiftCutTimer = 0.06;
                audio.playGearShift(false);
              }
            }
          }
        } else {
          activeBrake = brakeIn;
          if (s.gear === -1) {
            activeDrive = -throttleIn * 0.8;
          } else if (s.gear >= 1) {
            activeDrive = throttleIn;
          }
        }

        if (s.shiftCutTimer > 0) {
          activeDrive *= 0.15;
        }

        const gearIdx = Math.abs(s.gear);
        const gearMaxSpd = GEAR_MAX_SPEED_MS[s.gear] ?? 0;
        const torqueBoost =
          gearIdx === 1
            ? 6.9
            : gearIdx === 2
              ? 5.5
              : gearIdx === 3
                ? 4.4
                : gearIdx === 4
                  ? 3.7
                  : gearIdx === 5
                    ? 3.1
                    : 2.6;

        let accel = 0;
        if (s.handbrake) {
          if (Math.abs(s.speedMs) < 0.35) {
            s.speedMs = 0;
          } else {
            accel -= Math.sign(s.speedMs) * 14.5;
          }
        } else {
          const gravityPull = -9.81 * Math.sin(slopeRad) * 1.12;
          accel += gravityPull;

          if (activeDrive !== 0 && gearMaxSpd > 0) {
            const dir = Math.sign(activeDrive);
            const withinGear = dir > 0 ? s.speedMs < gearMaxSpd : -s.speedMs < gearMaxSpd;
            if (withinGear) {
              const lugFactor =
                s.transmission === 'manual' && gearIdx >= 3 && Math.abs(s.speedMs) < gearMaxSpd * 0.22
                  ? 0.52
                  : 1;
              accel += activeDrive * torqueBoost * lugFactor;
            }
          }

          if (s.gear >= 1 && s.speedMs > gearMaxSpd + 0.6) {
            accel -= (s.speedMs - gearMaxSpd) * 1.35;
          } else if (s.gear >= 1 && activeDrive === 0 && s.speedMs > 1.2) {
            accel -= (7 - gearIdx) * 0.12;
          }

          if (activeBrake > 0) {
            if (Math.abs(s.speedMs) < 0.25) {
              s.speedMs = 0;
              accel = 0;
            } else {
              accel -= Math.sign(s.speedMs) * activeBrake * 13.4;
            }
          }

          accel -= s.speedMs * 0.14 + Math.sign(s.speedMs) * 0.22;
        }

        s.speedMs += accel * dt;
        s.speedMs = THREE.MathUtils.clamp(s.speedMs, -8.5, 31.5);
        if (Math.abs(s.speedMs) < 0.06 && activeDrive === 0 && Math.abs(slopeRad) < 0.025) {
          s.speedMs = 0;
        }

        if (s.doorOpen && Math.abs(s.speedMs) > 3.2 && s.noticeTimer <= 0) {
          showNotice('Warning: Front passenger door is OPEN! Press O to close.', 'warning', 2.2);
        }

        const maxSteer = 0.56;
        const speedFactor = 1 / (1 + Math.abs(s.speedMs) * 0.055);
        const targetSteer = steerIn * maxSteer * speedFactor;
        s.steerAngle = THREE.MathUtils.damp(s.steerAngle, targetSteer, steerIn !== 0 ? 7.5 : 5.5, dt);
        s.steerNorm = THREE.MathUtils.clamp(s.steerAngle / Math.max(0.18, maxSteer * speedFactor), -1, 1);

        const wheelbase = 6.1;
        const distMove = s.speedMs * dt;
        const angularVel = (s.speedMs / wheelbase) * Math.tan(s.steerAngle);
        s.busHeading += angularVel * dt;
        s.busX += Math.sin(s.busHeading) * distMove;
        s.busZ += Math.cos(s.busHeading) * distMove;
        s.busY = THREE.MathUtils.damp(s.busY, groundY, 14, dt);
        s.distanceDrivenM += Math.abs(distMove);

        // Highway shoulder guardrails in Career & Endless modes
        const activeSample = careerRoadSample || endlessRoadSample;
        const activeRoadW = himachalWorld?.roadWidth ?? endlessWorld?.roadWidth ?? 11.2;
        if ((curMode === 'career' || curMode === 'endless') && activeSample) {
          const maxLat = activeRoadW * 0.5 - 1.15;
          if (Math.abs(activeSample.lateralOffset) > maxLat) {
            const clampedLat = Math.sign(activeSample.lateralOffset) * maxLat;
            const correction = clampedLat - activeSample.lateralOffset;
            s.busX += activeSample.right.x * correction;
            s.busZ += activeSample.right.z * correction;
            if (Math.abs(s.speedMs) > 5.0 && s.collisionCooldown <= 0) {
              s.collisionCooldown = 0.8;
              s.speedMs *= 0.78;
              s.damagePct = Math.min(100, s.damagePct + 2.0);
              audio.playBump();
              showNotice('Highway shoulder guardrail scrape! Keep inside lanes.', 'warning', 1.8);
            }
          }
        }

        if (curMode === 'training') {
          s.busX = THREE.MathUtils.clamp(s.busX, -66, 66);
          s.busZ = THREE.MathUtils.clamp(s.busZ, -78, 78);
        }

        // Engine RPM, shift hint & fuel
        const gearTop = GEAR_MAX_SPEED_MS[s.gear] || 10;
        const ratio = s.gear === 0 ? 0 : Math.min(1.12, Math.abs(s.speedMs) / gearTop);
        const neutralRev = s.gear === 0 ? throttleIn * 1450 : 0;
        const targetRpm = 720 + ratio * 1650 + throttleIn * 360 + neutralRev;
        s.rpm = THREE.MathUtils.damp(s.rpm, targetRpm, 7.5, dt);
        s.fuelPct = Math.max(5, s.fuelPct - (0.004 + throttleIn * 0.015) * dt);
        s.airPressurePsi = THREE.MathUtils.clamp(
          s.airPressurePsi - activeBrake * 6 * dt + 2.4 * dt,
          82,
          122
        );

        if (s.transmission === 'manual' && s.gear >= 1) {
          if (s.gear < 6 && s.rpm > 2240 && Math.abs(s.speedMs) > gearTop * 0.82) {
            s.shiftHint = 'up';
          } else if (
            s.gear > 1 &&
            throttleIn > 0.25 &&
            s.rpm < 1120 &&
            (slopeRad > 0.045 || Math.abs(s.speedMs) < gearTop * 0.3)
          ) {
            s.shiftHint = 'down';
          } else {
            s.shiftHint = null;
          }
        } else {
          s.shiftHint = null;
        }

        bus.spinWheels(distMove);
        const targetPitch = -slopeRad - activeBrake * Math.sign(s.speedMs) * 0.025 + throttleIn * 0.015;
        const targetRoll = -angularVel * Math.abs(s.speedMs) * 0.014;
        s.busPitch = THREE.MathUtils.damp(s.busPitch, targetPitch, 8, dt);
        s.busRoll = THREE.MathUtils.damp(s.busRoll, THREE.MathUtils.clamp(targetRoll, -0.09, 0.09), 7, dt);
      } else {
        s.rpm = THREE.MathUtils.damp(s.rpm, 740, 6, dt);
      }

      // Animate 3D Bus Cockpit Controls, Driver Hands & Exterior
      s.doorAnim = THREE.MathUtils.damp(s.doorAnim, s.doorOpen ? 1 : 0, 6.5, dt);
      bus.setSteeringAngle(s.steerAngle);
      bus.setGearStick(s.gear);
      bus.updateWipers(elapsed, s.wipersOn);
      bus.updateLights(
        s.headlights,
        activeBrake > 0.1 || s.handbrake,
        s.gear === -1,
        s.indicators,
        s.cabinLight,
        blinkOn
      );

      // Update world + solid vehicle collisions BEFORE final bus transform commit
      if (curMode === 'career' && himachalWorld) {
        s.tripElapsedSec += dt;
        _busPosVec.set(s.busX, s.busY, s.busZ);
        bus.root.position.copy(_busPosVec);
        bus.root.rotation.set(0, s.busHeading, 0);
        bus.root.updateMatrixWorld();
        _doorWorld.copy(_doorLocal).applyMatrix4(bus.root.matrixWorld);

        himachalWorld.updateWorld(
          dt,
          elapsed,
          _busPosVec,
          s.busHeading,
          s.speedMs,
          _doorWorld,
          hornMelody || hornAir,
          s.weather === 'rain'
        );

        // Solid physical collision resolution (bus NEVER clips through cars/buses/trucks!)
        resolveBusTrafficCollisions(himachalWorld.traffic);

        // Career-ONLY NHAI Toll Plazas (deducts ₹400–₹500 once per toll pass)
        for (const tl of himachalWorld.tolls) {
          if (tl.paid) continue;
          const distToll = Math.hypot(s.busX - tl.position.x, s.busZ - tl.position.z);
          if (distToll < 7.8) {
            tl.paid = true;
            s.tollsPaidInr += tl.feeInr;
            s.tripEarningsInr -= tl.feeInr;
            audio.playConductorBell();
            showNotice(`${tl.name}: ₹${tl.feeInr} FASTag Toll Deducted`, 'warning', 3.4);
            callbacksRef.current.onTollPaid?.(tl.feeInr, tl.name);
          }
        }

        // Check Stop Bay Parking & Passenger Boarding
        let foundStopIdx = -1;
        for (let i = 0; i < himachalWorld.stops.length; i++) {
          const st = himachalWorld.stops[i];
          if (st.completed) continue;
          const dBay = Math.hypot(s.busX - st.bayCenter.x, s.busZ - st.bayCenter.z);
          if (dBay < 9.5) {
            foundStopIdx = i;
            break;
          }
        }
        s.activeStopIdx = foundStopIdx;

        if (foundStopIdx >= 0) {
          const st = himachalWorld.stops[foundStopIdx];
          const isTerminal = foundStopIdx === himachalWorld.stops.length - 1;
          const stopped = Math.abs(s.speedMs) < 0.85;

          if (!stopped && s.noticeTimer <= 0) {
            showNotice(`Approaching ${st.stop.name} — Stop inside bay & press O`, 'info', 2.0);
          } else if (stopped && !s.doorOpen) {
            if (s.noticeTimer <= 0) {
              showNotice(
                isTerminal
                  ? `Arrived at ${st.stop.name}! Open Door (O) to disembark & finish trip`
                  : `Stopped at ${st.stop.name} — Press O to open door & board passengers`,
                'success',
                2.0
              );
            }
          } else if (stopped && s.doorOpen) {
            const stopPassengers = himachalWorld.passengers.filter(
              (p) => p.stopIndex === foundStopIdx && !p.boarded
            );
            if (stopPassengers.length > 0) {
              const activeBoarding = stopPassengers.find((p) => p.boarding);
              if (!activeBoarding) {
                stopPassengers[0].boarding = true;
              }
              s.boardingTimer += dt;
              if (s.boardingTimer >= 0.85) {
                s.boardingTimer = 0;
                const first = stopPassengers[0];
                first.boarded = true;
                first.mesh.visible = false;
                st.boardedCount++;
                s.passengersOnBoard = Math.min(54, s.passengersOnBoard + 1);
                s.tripEarningsInr += st.stop.fareInr;
              }
            } else {
              st.completed = true;
              s.stopsCompleted++;
              audio.playConductorBell();
              if (isTerminal) {
                s.tripCompleted = true;
                s.tripEarningsInr += st.stop.fareInr * Math.max(1, Math.floor(s.passengersOnBoard / 2));
                const netFare = Math.max(0, s.tripEarningsInr);
                showNotice(
                  `Trip Complete at ${st.stop.name}! Net Fare ₹${netFare} (Tolls ₹${s.tollsPaidInr})`,
                  'success',
                  6.0
                );
                if (!s.careerReported) {
                  s.careerReported = true;
                  const safety = Math.max(1, Number((5 - s.damagePct / 22).toFixed(1)));
                  callbacksRef.current.onCareerFinish?.({
                    routeId: curRoute.id,
                    routeTitle: curRoute.title,
                    origin: curRoute.origin,
                    destination: curRoute.destination,
                    passengersBoarded: s.passengersOnBoard,
                    fareCollectedInr: netFare,
                    safetyRating: safety,
                    weather: s.weather,
                    durationSec: Math.max(5, Math.round(s.tripElapsedSec)),
                    distanceDrivenKm: Number((s.distanceDrivenM / 1000).toFixed(1)),
                  });
                }
              } else {
                showNotice(
                  `All passengers boarded at ${st.stop.name}! Close door (O) & proceed.`,
                  'success',
                  3.6
                );
              }
            }
          }
        }
      } else if (curMode === 'endless' && endlessWorld) {
        s.tripElapsedSec += dt;
        _busPosVec.set(s.busX, s.busY, s.busZ);
        endlessWorld.updateWorld(
          dt,
          elapsed,
          _busPosVec,
          s.busHeading,
          s.speedMs,
          hornMelody || hornAir,
          s.weather === 'rain'
        );
        // Solid vehicle collisions in Endless Mode too (ZERO tolls!)
        resolveBusTrafficCollisions(endlessWorld.traffic);
      }

      // Half-Road Landslide Collision, Proximity Prompt & JCB Manual Clearance Bonus (Career & Endless)
      const activeLandslides: LandslideZoneData[] =
        curMode === 'career' && himachalWorld
          ? himachalWorld.landslides
          : curMode === 'endless' && endlessWorld
            ? endlessWorld.getLandslides()
            : [];

      if (s.landslideClearing && s.nearLandslideId) {
        const finished = activeLandslides.find((l) => l.id === s.nearLandslideId && l.cleared);
        if (finished) {
          if (curMode === 'career') {
            s.tripEarningsInr += 250;
            showNotice(`Landslide cleared at ${finished.label}! Road open (+₹250 BRO bonus)`, 'success', 3.6);
          } else {
            showNotice(`Landslide cleared at ${finished.label}! Highway open.`, 'success', 3.4);
          }
          audio.playConductorBell();
        }
      }

      let nearestLs: LandslideZoneData | null = null;
      let nearestLsDist = 36;
      for (const ls of activeLandslides) {
        if (ls.cleared) continue;

        // Solid boulder collision on the blocked uphill left half-road (open right half remains passable)
        if (ls.clearProgress < 0.72) {
          const dx = s.busX - ls.blockCenter.x;
          const dz = s.busZ - ls.blockCenter.z;
          if (dx * dx + dz * dz < 169) {
            const lsLong = dx * ls.tangent.x + dz * ls.tangent.z;
            const lsLat = dx * ls.right.x + dz * ls.right.z;
            const sumW = ls.halfWidth + 1.24;
            const sumL = ls.halfLength + 4.85;
            if (Math.abs(lsLat) < sumW && Math.abs(lsLong) < sumL) {
              const penLat = sumW - Math.abs(lsLat);
              const penLong = sumL - Math.abs(lsLong);
              if (penLat < penLong) {
                const sign = lsLat >= 0 ? 1 : -1;
                const push = penLat + 0.05;
                s.busX += ls.right.x * sign * push;
                s.busZ += ls.right.z * sign * push;
                s.speedMs *= 0.72;
              } else {
                const sign = lsLong >= 0 ? 1 : -1;
                const push = penLong + 0.06;
                s.busX += ls.tangent.x * sign * push;
                s.busZ += ls.tangent.z * sign * push;
                s.speedMs = -Math.sign(s.speedMs) * Math.min(0.9, Math.abs(s.speedMs) * 0.14);
              }
              if (s.collisionCooldown <= 0) {
                s.collisionCooldown = 0.85;
                s.damagePct = Math.min(100, s.damagePct + 2.5);
                audio.playBump();
                showNotice('Landslide boulders on left lane! Squeeze right or press J to clear.', 'warning', 2.4);
              }
            }
          }
        }

        const dCenter = Math.hypot(s.busX - ls.position.x, s.busZ - ls.position.z);
        if (dCenter < nearestLsDist) {
          nearestLsDist = dCenter;
          nearestLs = ls;
        }
      }

      if (nearestLs) {
        s.nearLandslideId = nearestLs.id;
        s.nearLandslideLabel = nearestLs.label;
        s.landslideClearing = nearestLs.clearing;
        s.landslideClearPct = Math.round(nearestLs.clearProgress * 100);
        if (!nearestLs.clearing && nearestLsDist < 32) {
          audio.triggerHindiCrowdVoice('landslide', 15500);
        }
      } else {
        s.nearLandslideId = null;
        s.nearLandslideLabel = null;
        s.landslideClearing = false;
        s.landslideClearPct = 0;
      }

      // Update 3D Driver Hands (single/two-hand random steering) & Conductor (seated / calling stop / reverse whistle!)
      const isReversingNow = s.gear === -1 || s.speedMs < -0.25;
      const isStoppedAtBusStop =
        (curMode === 'career' && s.activeStopIdx >= 0 && Math.abs(s.speedMs) < 1.15 && !s.tripCompleted) ||
        (curMode === 'endless' && s.doorOpen && Math.abs(s.speedMs) < 0.9);
      const conductorMode: ConductorMode = isReversingNow
        ? 'guiding_reverse'
        : isStoppedAtBusStop
          ? 'calling_stop'
          : 'seated';

      const { conductorDoorNeed, conductorReadyOutside } = bus.updateDriverAndConductor(
        dt,
        elapsed,
        s.steerAngle,
        s.speedMs,
        s.gear,
        conductorMode,
        s.shiftCutTimer > 0
      );
      s.conductorDoorAnim = THREE.MathUtils.damp(s.conductorDoorAnim, conductorDoorNeed, 7.5, dt);
      bus.setDoorOpenAmount(Math.max(s.doorAnim, s.conductorDoorAnim));

      // Conductor Audio & Hindi Callouts when stepping out at Bus Stops or Guiding Reverse with Whistle
      if (conductorMode === 'calling_stop' && conductorReadyOutside) {
        let way1 = 'कालका';
        let way2 = 'शिमला';
        let isTerminalStop = false;

        if (curMode === 'career' && s.activeStopIdx >= 0) {
          const curSt = curRoute.stops[s.activeStopIdx];
          const destSt = curRoute.stops[curRoute.stops.length - 1];
          isTerminalStop = s.activeStopIdx === curRoute.stops.length - 1;
          way1 = STOP_HINDI_SHORT[curSt.id] ?? curSt.hindiName;
          way2 = STOP_HINDI_SHORT[destSt.id] ?? destSt.hindiName;
        } else if (curMode === 'endless') {
          if (s.endlessBiome === 'plains') {
            way1 = 'अंबाला';
            way2 = 'चंडीगढ़';
          } else if (s.endlessBiome === 'foothills') {
            way1 = 'कालका';
            way2 = 'सोलन';
          } else {
            way1 = 'शिमला';
            way2 = 'मनाली';
          }
        }

        const stopPhrases = isTerminalStop
          ? [
              `आ गया ${way2} भाई! सब यात्री अपना सामान लेकर आराम से उतर जाओ!`,
              `${way2} बस अड्डा आ गया, आराम से उतरो भाई साहब!`,
            ]
          : [
              `आ जाओ भाई आ जाओ! ${way1} से ${way2}, ${way1} से ${way2}! जल्दी चढ़ो!`,
              `आ जाओ भाई आ जाओ, ${way1} से सीधा ${way2} जाएगी! सीट खाली है भाई साहब!`,
              `चलो भाई चलो! ${way1} से ${way2} वाली बस तैयार है, जल्दी बैठो!`,
            ];
        const phrase = stopPhrases[s.conductorCallStep % stopPhrases.length];
        const firstCallout = !s.conductorSpokeThisStop;
        const spoke = audio.speakConductorHindi(
          phrase,
          firstCallout ? 500 : 6800,
          firstCallout
        );
        if (spoke) {
          s.conductorSpokeThisStop = true;
          s.conductorCallStep++;
          if (!isTerminalStop && s.noticeTimer <= 0.2) {
            showNotice(`Conductor: "आ जाओ भाई आ जाओ! ${way1} से ${way2}!"`, 'info', 2.8);
          }
        }
      } else if (conductorMode === 'guiding_reverse') {
        s.conductorSpokeThisStop = false;
        s.conductorWhistleTimer -= dt;
        const activelyBacking = s.speedMs < -0.25;
        if (conductorReadyOutside && s.conductorWhistleTimer <= 0) {
          const whistleStyle =
            Math.abs(s.speedMs) > 3.1
              ? 'urgent'
              : Math.abs(s.steerAngle) > 0.26
                ? 'double'
                : 'guide';
          audio.playConductorWhistle(whistleStyle);
          s.conductorWhistleTimer = activelyBacking
            ? whistleStyle === 'urgent'
              ? 0.85
              : 1.15
            : 2.35;

          const cue = REVERSE_HINDI_CUES[s.conductorReverseCueIdx % REVERSE_HINDI_CUES.length];
          if (audio.speakConductorHindi(cue, 5600, false)) {
            s.conductorReverseCueIdx++;
          }
        } else if (s.lastConductorMode !== 'guiding_reverse') {
          audio.playConductorWhistle('double');
          s.conductorWhistleTimer = 1.0;
          if (s.noticeTimer <= 0.2) {
            showNotice('Conductor guiding reverse outside with whistle (सीटी)!', 'info', 2.6);
          }
        }
      } else {
        s.conductorSpokeThisStop = false;
        s.conductorWhistleTimer = 0;
      }
      s.lastConductorMode = conductorMode;

      // Commit final post-collision Bus Transform
      bus.root.position.set(s.busX, s.busY, s.busZ);
      bus.root.rotation.set(0, s.busHeading, 0);
      bus.bodyGroup.rotation.set(s.busPitch, 0, s.busRoll);
      bus.root.updateMatrixWorld();

      // Keep sun shadow frustum centered near bus
      sunLight.position.set(s.busX + 65, s.busY + 110, s.busZ + 45);
      sunLight.target.position.set(s.busX, s.busY, s.busZ);

      // Update audio engine + authentic Hindi crowd ambience & chatter
      audio.updateEngine(s.rpm, throttleIn, true);
      if (curMode === 'career' || curMode === 'endless') {
        let nearStopCrowd = false;
        if (curMode === 'career' && himachalWorld) {
          for (const st of himachalWorld.stops) {
            const dStop = Math.hypot(s.busX - st.bayCenter.x, s.busZ - st.bayCenter.z);
            if (dStop < 38) {
              nearStopCrowd = true;
              break;
            }
          }
        }
        let crowdIntensity = Math.min(0.55, (s.passengersOnBoard / 48) * 0.45);
        if (s.cameraMode === 'cabin') crowdIntensity += 0.22;
        if (s.doorOpen) crowdIntensity += 0.2;
        if (nearStopCrowd) crowdIntensity = Math.min(1, crowdIntensity + 0.48);
        audio.updateCrowdAmbience(crowdIntensity, elapsed);

        if (conductorMode === 'seated') {
          if (nearStopCrowd || (s.activeStopIdx >= 0 && s.doorOpen)) {
            audio.triggerHindiCrowdVoice('bus_stop', 9500);
          } else if (s.passengersOnBoard >= 6) {
            audio.triggerHindiCrowdVoice('onboard', 22000);
          }
        }
      } else {
        audio.updateCrowdAmbience(0, elapsed);
      }

      // Training Mode: Official HSSC Referee Evaluation
      if (curMode === 'training' && trainingArena && s.training && s.training.phase === 'active') {
        const tr = s.training;
        tr.elapsedSec += dt;

        const sinH = Math.sin(s.busHeading);
        const cosH = Math.cos(s.busHeading);
        const sampleOffsets = [
          [-1.25, 5.2],
          [1.25, 5.2],
          [-1.25, 0],
          [1.25, 0],
          [-1.25, -5.2],
          [1.25, -5.2],
        ];

        for (const cone of trainingArena.cones) {
          if (cone.hit) continue;
          for (const [lx, lz] of sampleOffsets) {
            const wx = s.busX + lx * cosH + lz * sinH;
            const wz = s.busZ - lx * sinH + lz * cosH;
            if (Math.hypot(wx - cone.pos.x, wz - cone.pos.z) < 0.72) {
              cone.hit = true;
              cone.mesh.rotation.x = Math.PI / 2.2;
              cone.mesh.position.y = 0.22;
              tr.coneHits++;
              tr.score = Math.max(0, tr.score - 22);
              audio.playBump();
              showNotice(
                `Penalty! Bus overhang hit cone (${tr.coneHits}/${curTrack.maxAllowedFaults} max)`,
                'danger',
                2.5
              );
              if (tr.coneHits > curTrack.maxAllowedFaults) {
                tr.phase = 'failed';
                tr.failureReason = `Exceeded maximum cone strikes (${tr.coneHits} cones hit).`;
              }
              break;
            }
          }
        }

        if (tr.phase === 'active') {
          const nextCpIdx = tr.checkpointsCleared;
          const nextCp = trainingArena.checkpoints[nextCpIdx];

          if (nextCp) {
            const mat = nextCp.ring.material as THREE.MeshBasicMaterial;
            mat.color.setHex(0xfacc15);

            const distCp = Math.hypot(s.busX - nextCp.pos.x, s.busZ - nextCp.pos.z);

            if (curTrack.id === 'gradientRamp' && nextCpIdx === 0 && trainingArena.rampSpec) {
              const insideBox =
                Math.abs(s.busX) < 3.4 &&
                s.busZ >= trainingArena.rampSpec.stopBoxZMin &&
                s.busZ <= trainingArena.rampSpec.stopBoxZMax;
              if (insideBox && Math.abs(s.speedMs) < 0.3) {
                s.rampHoldTimer += dt;
                tr.instruction = `Holding on incline... ${Math.min(1.5, s.rampHoldTimer).toFixed(1)}s / 1.5s`;
                if (s.rampHoldTimer >= 1.5) {
                  tr.rampStoppedConfirmed = true;
                  s.rampStopZ = s.busZ;
                  nextCp.cleared = true;
                  mat.color.setHex(0x22c55e);
                  tr.checkpointsCleared++;
                  audio.playConductorBell();
                  showNotice(
                    'Dead-stop confirmed! Accelerate smoothly over summit with ZERO rollback!',
                    'success',
                    3.2
                  );
                }
              } else if (insideBox) {
                tr.instruction = 'Come to a complete DEAD STOP inside the red ramp box!';
              } else {
                tr.instruction = 'Drive up the concrete incline and stop inside the red STOP box.';
              }
            } else if (curTrack.id === 'hBayReverse' && nextCpIdx === 1 && trainingArena.bayBox) {
              const bay = trainingArena.bayBox;
              const dx = Math.abs(s.busX - bay.center.x);
              const dz = Math.abs(s.busZ - bay.center.z);
              const alignPct = Math.round(
                THREE.MathUtils.clamp((1 - (dx / 4.5 + dz / 9.5) * 0.5) * 100, 0, 100)
              );
              tr.bayAlignedPct = alignPct;
              tr.instruction = `Reverse cleanly into the yellow Dug Bay (${alignPct}% aligned) and stop.`;
              if (dx < 1.35 && dz < 2.2 && Math.abs(s.speedMs) < 0.5) {
                nextCp.cleared = true;
                mat.color.setHex(0x22c55e);
                tr.checkpointsCleared++;
                audio.playConductorBell();
              }
            } else if (distCp < nextCp.radius + 1.4) {
              nextCp.cleared = true;
              mat.color.setHex(0x22c55e);
              tr.checkpointsCleared++;
              audio.playConductorBell();
              if (tr.checkpointsCleared < trainingArena.checkpoints.length) {
                tr.instruction = `Next: ${trainingArena.checkpoints[tr.checkpointsCleared].label}`;
              }
            } else {
              tr.instruction = `Head to: ${nextCp.label}`;
            }
          }

          if (curTrack.id === 'gradientRamp' && tr.rampStoppedConfirmed && tr.checkpointsCleared === 1) {
            const rollBackM = Math.max(0, s.rampStopZ - s.busZ);
            tr.rollbackCm = Math.max(tr.rollbackCm, Math.round(rollBackM * 100));
            if (tr.rollbackCm > 45) {
              tr.phase = 'failed';
              tr.failureReason = `Rolled back ${tr.rollbackCm} cm on incline (max allowed: 45 cm). Use Handbrake (Space)!`;
            }
          }

          if (tr.elapsedSec > curTrack.targetTimeSec) {
            tr.phase = 'failed';
            tr.failureReason = `Exceeded official time limit (${curTrack.targetTimeSec}s).`;
          }

          if (tr.phase === 'active' && tr.checkpointsCleared >= trainingArena.checkpoints.length) {
            tr.phase = 'passed';
            tr.score = Math.max(60, 100 - tr.coneHits * 15 - Math.floor(tr.rollbackCm / 10) * 3);
            showNotice(`PASSED ${curTrack.title}! Score: ${tr.score}/100`, 'success', 5.0);
          }
        }

        if ((tr.phase === 'passed' || tr.phase === 'failed') && !s.trainingReported) {
          s.trainingReported = true;
          callbacksRef.current.onTrainingFinish?.({
            trackId: curTrack.id,
            passed: tr.phase === 'passed',
            score: tr.phase === 'passed' ? tr.score : Math.min(45, tr.score),
            timeSec: Math.max(1, Number(tr.elapsedSec.toFixed(1))),
            penalties: tr.coneHits + tr.lineFaults,
          });
        }
      }

      // Smooth Camera Choreography + Full 360° Finger/Mouse Look-Around
      _busForward.set(Math.sin(s.busHeading), 0, Math.cos(s.busHeading));
      _busRight.set(Math.cos(s.busHeading), 0, -Math.sin(s.busHeading));

      if (s.cameraMode === 'chase') {
        const orbitYaw = s.busHeading + Math.PI + s.lookYaw;
        const dist = 13.6;
        const camY = s.busY + 5.1 + Math.sin(-s.lookPitch) * 4.5;
        _camTargetPos.set(
          s.busX + Math.sin(orbitYaw) * dist,
          Math.max(s.busY + 1.5, camY),
          s.busZ + Math.cos(orbitYaw) * dist
        );
        _camTargetLook.set(s.busX, s.busY + 2.2, s.busZ).addScaledVector(_busForward, 6.0);
        camera.position.lerp(_camTargetPos, 1 - Math.exp(-7.5 * dt));
        camera.lookAt(_camTargetLook);
        const targetFov = 58 + Math.min(10, Math.abs(s.speedMs) * 0.36);
        camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 4, dt);
        camera.updateProjectionMatrix();
      } else if (s.cameraMode === 'cabin') {
        // Upgraded Indian RHD Driver Eye Position: Steering Wheel, Floor Gear Stick, FM Stereo Radio & Gauges all clearly visible!
        // Plus full 360° finger/mouse drag look-around inside the bus!
        _cornerVec.set(-0.62, 2.26, 3.88).applyMatrix4(bus.root.matrixWorld);
        camera.position.copy(_cornerVec);

        const totalYaw = s.busHeading + s.lookYaw;
        const totalPitch = THREE.MathUtils.clamp(-0.15 + s.lookPitch + s.busPitch * 0.65, -0.78, 0.72);
        const cosP = Math.cos(totalPitch);
        _lookDir.set(Math.sin(totalYaw) * cosP, Math.sin(totalPitch), Math.cos(totalYaw) * cosP);
        _camTargetLook.copy(_cornerVec).addScaledVector(_lookDir, 22);
        camera.lookAt(_camTargetLook);
        camera.fov = THREE.MathUtils.damp(camera.fov, 72, 6, dt);
        camera.updateProjectionMatrix();
      } else if (s.cameraMode === 'bumper') {
        _cornerVec.set(0, 1.35, 5.72).applyMatrix4(bus.root.matrixWorld);
        camera.position.copy(_cornerVec);
        const totalYaw = s.busHeading + s.lookYaw;
        const cosP = Math.cos(s.lookPitch);
        _lookDir.set(Math.sin(totalYaw) * cosP, Math.sin(s.lookPitch), Math.cos(totalYaw) * cosP);
        _camTargetLook.copy(_cornerVec).addScaledVector(_lookDir, 28);
        camera.lookAt(_camTargetLook);
        camera.fov = THREE.MathUtils.damp(camera.fov, 62, 6, dt);
        camera.updateProjectionMatrix();
      } else {
        if (!s.isLookDragging) {
          s.orbitAngle += dt * 0.28;
        }
        camera.position.set(
          s.busX + Math.sin(s.orbitAngle) * 14.5,
          Math.max(s.busY + 1.8, s.busY + 4.8 + Math.sin(-s.lookPitch) * 5.0),
          s.busZ + Math.cos(s.orbitAngle) * 14.5
        );
        camera.lookAt(s.busX, s.busY + 1.9, s.busZ);
      }

      // Keep procedural gradient sky dome centered on camera
      skyDome.mesh.position.copy(camera.position);
    };

    const emitHudSnapshot = () => {
      const s = simRef.current;
      const curMode = propsRef.current.mode;
      const curRoute = getRouteById(propsRef.current.routeId);

      let nextStopName = curMode === 'endless' ? 'Endless Highway' : curRoute.destination;
      let nextStopDistM = 0;
      let atStopName: string | null = null;
      let atStopType: TelemetrySnapshot['atStopType'] = null;
      let waitingAtCurrentStop = 0;
      let boardingProgress = 0;

      if (curMode === 'career' && himachalWorld) {
        const nextUnfinished = himachalWorld.stops.find((st) => !st.completed);
        if (nextUnfinished) {
          nextStopName = nextUnfinished.stop.name;
          nextStopDistM = Math.round(
            Math.hypot(s.busX - nextUnfinished.bayCenter.x, s.busZ - nextUnfinished.bayCenter.z)
          );
        }
        if (s.activeStopIdx >= 0) {
          const st = himachalWorld.stops[s.activeStopIdx];
          atStopName = st.stop.name;
          atStopType = st.stop.landmarkType;
          const remaining = himachalWorld.passengers.filter(
            (p) => p.stopIndex === s.activeStopIdx && !p.boarded
          ).length;
          waitingAtCurrentStop = remaining;
          const totalW = Math.max(1, st.stop.waitingCount);
          boardingProgress = st.completed ? 1 : (totalW - remaining) / totalW;
        }
      }

      const k = s.keys;
      const hornActive =
        k.has('KeyG') || s.touch.hornAir
          ? 'air'
          : k.has('KeyH') || s.touch.hornMelody
            ? 'melody'
            : 'none';

      callbacksRef.current.onTelemetry({
        speedKmh: Math.round(Math.abs(s.speedMs) * 3.6),
        rpm: Math.round(s.rpm),
        gear: s.gear,
        transmission: s.transmission,
        doorOpen: s.doorOpen,
        doorAnim: s.doorAnim,
        handbrake: s.handbrake,
        headlights: s.headlights,
        cabinLight: s.cabinLight,
        indicators: s.indicators,
        wipersOn: s.wipersOn,
        hornActive,
        altitudeM: s.altitudeM,
        slopePct: s.slopePct,
        fuelPct: Math.round(s.fuelPct),
        airPressurePsi: Math.round(s.airPressurePsi),
        passengersOnBoard: s.passengersOnBoard,
        busCapacity: 54,
        waitingAtCurrentStop,
        atStopName,
        atStopType,
        boardingProgress,
        tripEarningsInr: s.tripEarningsInr,
        tollsPaidInr: s.tollsPaidInr,
        stopsCompleted: s.stopsCompleted,
        totalStops: curRoute.stops.length,
        nextStopName,
        nextStopDistM,
        routeProgressPct: curMode === 'career' ? Math.round(s.lastSplineT * 100) : 0,
        distanceDrivenKm: Number((s.distanceDrivenM / 1000).toFixed(2)),
        damagePct: Math.round(s.damagePct),
        cameraMode: s.cameraMode,
        weather: s.weather,
        endlessBiome: s.endlessBiome,
        noticeText: s.noticeText,
        noticeSeverity: s.noticeSeverity,
        tripCompleted: s.tripCompleted,
        tripDurationSec: Math.round(s.tripElapsedSec),
        safetyRating: Math.max(1, Number((5 - s.damagePct / 22).toFixed(1))),
        busX: s.busX,
        busZ: s.busZ,
        busHeading: s.busHeading,
        steerNorm: s.steerNorm,
        throttleActive: s.throttleActive,
        brakeActive: s.brakeActive,
        shiftHint: s.shiftHint,
        autoRange: s.autoRange,
        nearLandslideId: s.nearLandslideId,
        nearLandslideLabel: s.nearLandslideLabel,
        landslideClearing: s.landslideClearing,
        landslideClearPct: s.landslideClearPct,
        training: s.training ? { ...s.training } : null,
      });
    };

    const tick = () => {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      elapsed += dt;

      stepSimulation(dt);
      renderer.render(scene, camera);

      hudEmitTimer += dt;
      if (hudEmitTimer >= 0.04) {
        hudEmitTimer = 0;
        emitHudSnapshot();
      }

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('fullscreenchange', onResize);
      document.removeEventListener('webkitfullscreenchange', onResize);
      renderer.domElement.removeEventListener('pointerdown', onCanvasPointerDown);
      renderer.domElement.removeEventListener('pointermove', onCanvasPointerMove);
      renderer.domElement.removeEventListener('pointerup', onCanvasPointerUp);
      renderer.domElement.removeEventListener('pointercancel', onCanvasPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      audio.dispose();
      himachalWorld?.dispose();
      endlessWorld?.dispose();
      trainingArena?.dispose();
      skyDome.mesh.geometry.dispose();
      (skyDome.mesh.material as THREE.Material).dispose();
      envRT.dispose();
      renderer.dispose();
    };
  }, []);

  if (webglError) {
    return (
      <div className="relative w-full h-full min-h-[480px] flex items-center justify-center bg-[#0B111A] overflow-hidden">
        <img
          src="/src/assets/images/himachal_depot_backdrop_1795494857599.jpg"
          alt="Himachal mountain highway vista"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-35"
        />
        <div className="relative z-10 max-w-md mx-4 p-6 rounded-xl bg-[#111A28] border border-slate-700 text-center">
          <h2 className="font-display text-xl font-bold text-white mb-2">3D Viewport Unavailable</h2>
          <p className="text-sm text-slate-300 mb-5">{webglError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-[#0B5ED7] hover:bg-[#094DB2] text-white text-sm font-semibold whitespace-nowrap"
          >
            Reload Simulator
          </button>
        </div>
      </div>
    );
  }

  return <div ref={mountRef} className="w-full h-full relative select-none" />;
};
