import * as THREE from 'three';
import { BUS_FLEET } from '../data/buses';
import type { BusFleetSpec } from '../types/simulator';

export type ConductorMode = 'seated' | 'calling_stop' | 'guiding_reverse';

export interface BusVisualRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  frontLeftPivot: THREE.Group;
  frontRightPivot: THREE.Group;
  wheelMeshes: THREE.Object3D[];
  doorLeaf1: THREE.Group;
  doorLeaf2: THREE.Group;
  steeringWheel: THREE.Group;
  gearStickPivot: THREE.Group;
  wiperLeft: THREE.Group;
  wiperRight: THREE.Group;
  headlightBeams: THREE.SpotLight[];
  headlightMats: THREE.MeshStandardMaterial[];
  brakeLightMat: THREE.MeshStandardMaterial;
  reverseLightMat: THREE.MeshStandardMaterial;
  leftIndMat: THREE.MeshStandardMaterial;
  rightIndMat: THREE.MeshStandardMaterial;
  cabinLight: THREE.PointLight;
  ledBoardCanvas: HTMLCanvasElement;
  ledBoardTexture: THREE.CanvasTexture;
  updateRouteBoard: (routeText: string, plateText: string) => void;
  applyLivery: (spec: BusFleetSpec, routeText: string) => void;
  setDoorOpenAmount: (t: number) => void;
  setSteeringAngle: (angleRad: number) => void;
  setGearStick: (gear: number) => void;
  spinWheels: (distDelta: number) => void;
  updateWipers: (time: number, on: boolean, isRaining?: boolean, dt?: number) => void;
  setMirrorTextures: (rearTex: THREE.Texture | null, rightWingTex: THREE.Texture | null) => void;
  updateDriverAndConductor: (
    dt: number,
    elapsed: number,
    steerAngle: number,
    speedMs: number,
    gear: number,
    conductorMode: ConductorMode,
    isShifting: boolean
  ) => { conductorDoorNeed: number; conductorReadyOutside: boolean };
  updateLights: (
    headlights: 0 | 1 | 2,
    braking: boolean,
    reversing: boolean,
    indicators: 'off' | 'left' | 'right' | 'hazard',
    cabinOn: boolean,
    blinkOn: boolean
  ) => void;
}

// Pre-allocated math helpers outside animation loop (zero GC churn)
const _armStart = new THREE.Vector3();
const _armMid = new THREE.Vector3();
const _armEnd = new THREE.Vector3();
const _armDir = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _handLeftTarget = new THREE.Vector3();
const _handRightTarget = new THREE.Vector3();
const _gearKnobTarget = new THREE.Vector3();
const _windowRestTarget = new THREE.Vector3();
const _wheelTiltCos = Math.cos(0.58);
const _wheelTiltSin = Math.sin(0.58);

function computeWheelRimPoint(
  rimAngleRad: number,
  wheelSpinRad: number,
  out: THREE.Vector3
): THREE.Vector3 {
  const theta = rimAngleRad + wheelSpinRad;
  const r = 0.258;
  const lx = Math.cos(theta) * r;
  const ly = Math.sin(theta) * r;
  const lz = -0.022;
  const ry = ly * _wheelTiltCos - lz * _wheelTiltSin;
  const rz = ly * _wheelTiltSin + lz * _wheelTiltCos;
  return out.set(-0.68 + lx, 1.86 + ry, 4.52 + rz);
}

function orientCylinderSegment(
  mesh: THREE.Object3D,
  from: THREE.Vector3,
  to: THREE.Vector3,
  baseLength: number
): void {
  _armDir.subVectors(to, from);
  const len = Math.max(0.02, _armDir.length());
  mesh.position.copy(from).addScaledVector(_armDir, 0.5);
  _armDir.divideScalar(len);
  mesh.quaternion.setFromUnitVectors(_upAxis, _armDir);
  mesh.scale.set(1, len / baseLength, 1);
}

/**
 * Draws a dignified stylized editorial statesman portrait inside a circular medallion
 * for Haryana Roadways official civic welfare bus wrap panels.
 */
function drawStatesmanMedallion(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  variant: 'pm' | 'cm',
  titleLine: string,
  subLine: string
) {
  ctx.save();

  const ringGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  ringGrad.addColorStop(0, '#FF9933');
  ringGrad.addColorStop(0.5, '#FFFFFF');
  ringGrad.addColorStop(1, '#138808');
  ctx.beginPath();
  ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
  ctx.fillStyle = ringGrad;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  const bgGrad = ctx.createRadialGradient(cx, cy - r * 0.2, r * 0.1, cx, cy, r);
  bgGrad.addColorStop(0, variant === 'pm' ? '#FEF3C7' : '#DBEAFE');
  bgGrad.addColorStop(1, variant === 'pm' ? '#D97706' : '#1D4ED8');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  ctx.fillStyle = variant === 'pm' ? '#F59E0B' : '#1E3A8A';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.85, r * 0.78, r * 0.56, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.22, cy + r * 0.35);
  ctx.lineTo(cx, cy + r * 0.75);
  ctx.lineTo(cx + r * 0.22, cy + r * 0.35);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#D99B72';
  ctx.fillRect(cx - r * 0.16, cy + r * 0.18, r * 0.32, r * 0.24);

  ctx.fillStyle = '#E5AD84';
  ctx.beginPath();
  ctx.ellipse(cx, cy - r * 0.06, r * 0.34, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  if (variant === 'pm') {
    ctx.fillStyle = '#F1F5F9';
    ctx.beginPath();
    ctx.ellipse(cx, cy - r * 0.36, r * 0.34, r * 0.16, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.06, r * 0.33, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = Math.max(1.5, r * 0.035);
    ctx.strokeRect(cx - r * 0.24, cy - r * 0.16, r * 0.2, r * 0.12);
    ctx.strokeRect(cx + r * 0.04, cy - r * 0.16, r * 0.2, r * 0.12);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.04, cy - r * 0.1);
    ctx.lineTo(cx + r * 0.04, cy - r * 0.1);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.ellipse(cx, cy - r * 0.37, r * 0.34, r * 0.17, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.09, r * 0.14, r * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#1E293B';
  ctx.beginPath();
  ctx.arc(cx - r * 0.13, cy - r * 0.1, r * 0.035, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.13, cy - r * 0.1, r * 0.035, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#7C2D12';
  ctx.lineWidth = Math.max(1.5, r * 0.035);
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.11, r * 0.1, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  ctx.restore();

  ctx.save();
  ctx.fillStyle = 'rgba(7, 29, 73, 0.92)';
  const pillW = r * 2.55;
  const pillH = 34;
  ctx.fillRect(cx - pillW / 2, cy + r + 10, pillW, pillH);
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - pillW / 2, cy + r + 10, pillW, pillH);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(titleLine, cx, cy + r + 25);
  ctx.fillStyle = '#FDE68A';
  ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(subLine, cx, cy + r + 39);
  ctx.restore();
}

function drawSideLiveryCanvas(
  canvas: HTMLCanvasElement,
  spec: BusFleetSpec,
  side: 'left' | 'right'
) {
  const ctx = canvas.getContext('2d')!;
  const w = canvas.width;
  const h = canvas.height;

  // Authentic upper band + state primary lower livery
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, spec.roofColor);
  grad.addColorStop(0.24, '#F8FAFC');
  grad.addColorStop(0.26, spec.secondaryColor);
  grad.addColorStop(0.7, spec.primaryColor);
  grad.addColorStop(1, '#0F172A');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Express speed stripes along window beltline
  ctx.fillStyle = spec.stripeColor;
  ctx.fillRect(0, 136, w, 20);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 156, w, 12);

  // Dynamic diagonal express swoosh on rear flank for non-Haryana states
  if (!spec.showCivicMedallions) {
    ctx.save();
    ctx.fillStyle = spec.stripeColor;
    ctx.beginPath();
    ctx.moveTo(1360, 442);
    ctx.lineTo(1560, 168);
    ctx.lineTo(1720, 168);
    ctx.lineTo(1520, 442);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.moveTo(1560, 442);
    ctx.lineTo(1760, 168);
    ctx.lineTo(1835, 168);
    ctx.lineTo(1635, 442);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Tricolor accent lower trim
  ctx.fillStyle = '#FF9933';
  ctx.fillRect(0, 442, w, 16);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 458, w, 14);
  ctx.fillStyle = '#138808';
  ctx.fillRect(0, 472, w, 16);

  // Bold bilingual state operator lettering
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 72px "Chakra Petch", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(spec.operatorName, 110, 255);

  ctx.fillStyle = '#FDE047';
  ctx.font = '700 40px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(spec.hindiName, 110, 315);

  ctx.fillStyle = '#E2E8F0';
  ctx.font = '600 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(spec.slogan, 110, 366);

  if (spec.showCivicMedallions) {
    const panelX = side === 'left' ? 1230 : 1210;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
    ctx.fillRect(panelX, 178, 720, 250);
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 6;
    ctx.strokeRect(panelX, 178, 720, 250);

    ctx.fillStyle = '#073B8C';
    ctx.fillRect(panelX, 178, 720, 46);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('विकसित भारत • विकसित हरियाणा — जन कल्याण यात्रा', panelX + 360, 208);

    drawStatesmanMedallion(ctx, panelX + 140, 305, 62, 'pm', "Hon'ble PM of India", 'माननीय प्रधानमंत्री');
    drawStatesmanMedallion(ctx, panelX + 580, 305, 62, 'cm', "Hon'ble CM Haryana", 'माननीय मुख्यमंत्री');

    ctx.fillStyle = '#0F172A';
    ctx.font = '800 24px "Chakra Petch", sans-serif';
    ctx.fillText('HARYANA SHAKTI', panelX + 360, 286);
    ctx.fillStyle = '#0B5ED7';
    ctx.font = '700 20px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('सबका साथ, सबका विकास', panelX + 360, 320);
    ctx.fillStyle = '#475569';
    ctx.font = '600 16px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('State Transport Haryana', panelX + 360, 352);
    ctx.fillText('Safe Hill Mobility', panelX + 360, 376);
  } else {
    // State emblem badge on rear side flank
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(1690, 235, 290, 145);
    ctx.strokeStyle = spec.stripeColor;
    ctx.lineWidth = 5;
    ctx.strokeRect(1690, 235, 290, 145);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 34px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(spec.stateName.toUpperCase(), 1835, 298);
    ctx.fillStyle = '#FDE047';
    ctx.font = '700 22px "JetBrains Mono", monospace';
    ctx.fillText('BS-VI HILL EXPRESS', 1835, 344);
  }

  // Subtle metallic panel seams
  ctx.strokeStyle = 'rgba(2, 6, 23, 0.25)';
  ctx.lineWidth = 3;
  for (let x = 240; x < w; x += 260) {
    ctx.beginPath();
    ctx.moveTo(x, 170);
    ctx.lineTo(x, 495);
    ctx.stroke();
  }
}

function drawRearLiveryCanvas(
  canvas: HTMLCanvasElement,
  spec: BusFleetSpec,
  plateText: string
) {
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, spec.roofColor);
  grad.addColorStop(0.14, spec.secondaryColor);
  grad.addColorStop(0.75, spec.primaryColor);
  grad.addColorStop(1, '#0F172A');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1024);

  ctx.fillStyle = '#FDE047';
  ctx.font = '800 54px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(spec.operatorName, 512, 92);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 32px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(spec.hindiName.slice(0, 36), 512, 138);

  if (spec.showCivicMedallions) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
    ctx.fillRect(72, 178, 880, 440);
    ctx.strokeStyle = '#FF9933';
    ctx.lineWidth = 8;
    ctx.strokeRect(72, 178, 880, 440);

    ctx.fillStyle = '#FF9933';
    ctx.fillRect(72, 178, 880, 22);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(72, 200, 880, 20);
    ctx.fillStyle = '#138808';
    ctx.fillRect(72, 220, 880, 22);

    ctx.fillStyle = '#073B8C';
    ctx.font = '800 30px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('विकसित भारत • विकसित हरियाणा', 512, 282);

    drawStatesmanMedallion(ctx, 275, 415, 92, 'pm', "Hon'ble Prime Minister", 'भारत सरकार');
    drawStatesmanMedallion(ctx, 749, 415, 92, 'cm', "Hon'ble Chief Minister", 'हरियाणा सरकार');

    ctx.fillStyle = '#0B4FA8';
    ctx.font = '800 28px "Chakra Petch", sans-serif';
    ctx.fillText('JAN KALYAN', 512, 410);
    ctx.fillStyle = '#138808';
    ctx.font = '700 24px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('हरियाणा गौरव', 512, 452);
  } else {
    // State rear window & tourism emblem panel
    ctx.fillStyle = '#0F172A';
    ctx.fillRect(104, 190, 816, 255);
    ctx.strokeStyle = spec.stripeColor;
    ctx.lineWidth = 8;
    ctx.strokeRect(104, 190, 816, 255);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 54px "Chakra Petch", sans-serif';
    ctx.fillText(`${spec.stateName.toUpperCase()} EXPRESS`, 512, 315);
    ctx.fillStyle = spec.stripeColor;
    ctx.font = '700 28px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('ALL INDIA INTER-STATE PERMIT • BS-VI', 512, 380);

    ctx.fillStyle = spec.stripeColor;
    ctx.fillRect(88, 495, 848, 22);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(88, 517, 848, 18);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 30px "Plus Jakarta Sans", sans-serif';
    ctx.fillText('USE DIPPER AT NIGHT • DRIVE SAFE', 512, 594);
  }

  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(88, 652, 848, 86);
  ctx.fillStyle = '#0F172A';
  ctx.font = '800 50px "Chakra Petch", sans-serif';
  ctx.fillText('HORN  OK  PLEASE', 512, 712);

  ctx.fillStyle = '#E2E8F0';
  ctx.font = '700 26px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('KEEP SAFE DISTANCE • सुरक्षित दूरी बनाए रखें', 512, 788);

  ctx.fillStyle = '#FACC15';
  ctx.fillRect(322, 822, 380, 84);
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 6;
  ctx.strokeRect(322, 822, 380, 84);
  ctx.fillStyle = '#0F172A';
  ctx.font = '800 42px "JetBrains Mono", monospace';
  ctx.fillText(plateText, 512, 878);

  for (let x = 0; x < 1024; x += 64) {
    ctx.fillStyle = (x / 64) % 2 === 0 ? '#EF4444' : '#F8FAFC';
    ctx.fillRect(x, 948, 64, 34);
  }
}

function drawLedDestinationCanvas(
  canvas: HTMLCanvasElement,
  routeText: string,
  plateText: string,
  operatorName: string
) {
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#090D16';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#1E293B';
  for (let x = 0; x < canvas.width; x += 8) {
    ctx.fillRect(x, 0, 1, canvas.height);
  }
  ctx.fillStyle = '#F59E0B';
  ctx.font = '700 44px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(routeText.slice(0, 32).toUpperCase(), canvas.width / 2, 62);

  ctx.fillStyle = '#38BDF8';
  ctx.font = '600 26px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(`${operatorName}  •  ${plateText}`, canvas.width / 2, 108);
}

function createDashClusterTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0A0F1A';
  ctx.fillRect(0, 0, 1024, 256);

  const drawDial = (cx: number, cy: number, r: number, label: string, color: string, maxNum: number) => {
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 10, Math.PI * 0.78, Math.PI * 2.22);
    ctx.stroke();

    for (let i = 0; i <= 8; i++) {
      const ang = Math.PI * 0.78 + (i / 8) * Math.PI * 1.44;
      const x1 = cx + Math.cos(ang) * (r - 22);
      const y1 = cy + Math.sin(ang) * (r - 22);
      const x2 = cx + Math.cos(ang) * (r - 8);
      const y2 = cy + Math.sin(ang) * (r - 8);
      ctx.strokeStyle = i >= 7 ? '#EF4444' : '#E2E8F0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Needle
    ctx.strokeStyle = '#F97316';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - r * 0.48, cy - r * 0.32);
    ctx.stroke();

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 22px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, cy + r * 0.56);
    ctx.fillStyle = '#94A3B8';
    ctx.font = '600 15px "JetBrains Mono", monospace';
    ctx.fillText(`0–${maxNum}`, cx, cy + r * 0.76);
  };

  drawDial(210, 128, 96, 'KM/H', '#38BDF8', 120);
  drawDial(512, 128, 96, 'RPM x100', '#F59E0B', 30);
  drawDial(760, 128, 66, 'AIR PSI', '#22C55E', 140);
  drawDial(916, 128, 66, 'FUEL', '#EAB308', 100);

  // Glowing center digital MID display
  ctx.fillStyle = '#0F1E36';
  ctx.fillRect(340, 178, 72, 48);
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 2;
  ctx.strokeRect(340, 178, 72, 48);
  ctx.fillStyle = '#38BDF8';
  ctx.font = '700 20px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('BS6', 376, 208);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createRadioStereoTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, 512, 192);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 8;
  ctx.strokeRect(4, 4, 504, 184);

  // Glowing LCD display
  ctx.fillStyle = '#082F49';
  ctx.fillRect(92, 24, 300, 96);
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 3;
  ctx.strokeRect(92, 24, 300, 96);

  ctx.fillStyle = '#38BDF8';
  ctx.font = '700 24px "JetBrains Mono", monospace';
  ctx.textAlign = 'left';
  ctx.fillText('FM 98.3 HIMACHAL', 108, 62);
  ctx.fillStyle = '#FACC15';
  ctx.font = '600 18px "JetBrains Mono", monospace';
  ctx.fillText('BT AUDIO • VOL 22', 108, 96);

  // Equalizer bars
  for (let i = 0; i < 8; i++) {
    const bh = 12 + ((i * 19) % 34);
    ctx.fillStyle = i > 5 ? '#F59E0B' : '#22D3EE';
    ctx.fillRect(322 + i * 8, 108 - bh, 5, bh);
  }

  // Rotary volume knob circle on left
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(48, 86, 26, 0, Math.PI * 2);
  ctx.stroke();

  // Preset buttons bottom strip
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i === 1 ? '#0EA5E9' : '#1E293B';
    ctx.fillRect(92 + i * 50, 134, 42, 32);
    ctx.fillStyle = '#E2E8F0';
    ctx.font = '700 16px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), 113 + i * 50, 156);
  }

  // USB port on right
  ctx.fillStyle = '#EF4444';
  ctx.fillRect(422, 68, 52, 24);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 14px "JetBrains Mono", monospace';
  ctx.fillText('USB', 448, 85);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(128, 256, 20, 128, 256, 124);
  grad.addColorStop(0, 'rgba(0,0,0,0.62)');
  grad.addColorStop(0.7, 'rgba(0,0,0,0.34)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 512);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function buildWheelAssembly(dualRear: boolean, hubMat: THREE.MeshStandardMaterial): THREE.Group {
  const group = new THREE.Group();
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x1a1e24,
    roughness: 0.9,
    metalness: 0.05,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.28,
    metalness: 0.82,
  });

  const makeSingle = (xOff: number) => {
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.32, 22), tireMat);
    tire.rotation.z = Math.PI / 2;
    tire.position.x = xOff;
    tire.castShadow = true;
    group.add(tire);

    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.34, 16), rimMat);
    rim.rotation.z = Math.PI / 2;
    rim.position.x = xOff;
    group.add(rim);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.36, 12), hubMat);
    hub.rotation.z = Math.PI / 2;
    hub.position.x = xOff;
    group.add(hub);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.36, 6), rimMat);
      bolt.rotation.z = Math.PI / 2;
      bolt.position.set(xOff, Math.sin(a) * 0.21, Math.cos(a) * 0.21);
      group.add(bolt);
    }
  };

  if (dualRear) {
    makeSingle(-0.17);
    makeSingle(0.17);
  } else {
    makeSingle(0);
  }
  return group;
}

export function buildHaryanaRoadwaysBus(
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean,
  initialBoard: string,
  initialPlate: string,
  initialSpec: BusFleetSpec = BUS_FLEET[0]
): BusVisualRig {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  let currentSpec = initialSpec;
  let currentBoard = initialBoard;

  // Grounded contact shadow
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 12.6),
    new THREE.MeshBasicMaterial({
      map: createContactShadowTexture(),
      transparent: true,
      depthWrite: false,
      opacity: 0.6,
    })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.03;
  root.add(contactShadow);

  // PBR Materials (updated dynamically when switching state transport liveries)
  const primaryPaintMat = new THREE.MeshPhysicalMaterial({
    color: currentSpec.primaryHex,
    roughness: 0.26,
    metalness: 0.36,
    clearcoat: 0.88,
    clearcoatRoughness: 0.14,
  });
  const roofPaintMat = new THREE.MeshStandardMaterial({
    color: currentSpec.roofHex,
    roughness: 0.34,
    metalness: 0.42,
  });
  const chassisDarkMat = new THREE.MeshStandardMaterial({
    color: 0x161c24,
    roughness: 0.82,
    metalness: 0.24,
  });
  const dashMat = new THREE.MeshStandardMaterial({
    color: 0x1e2633,
    roughness: 0.72,
    metalness: 0.12,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.12,
    metalness: 0.94,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x203c56,
    roughness: 0.07,
    metalness: 0.08,
    transparent: true,
    opacity: isSoftwareGl ? 0.32 : 0.24,
    clearcoat: 1.0,
    depthWrite: false,
  });
  const yellowRailMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.35,
    metalness: 0.3,
  });
  const interiorSeatMat = new THREE.MeshStandardMaterial({
    color: currentSpec.seatHex,
    roughness: 0.85,
    metalness: 0.05,
  });
  const wheelHubMat = new THREE.MeshStandardMaterial({
    color: currentSpec.primaryHex,
    roughness: 0.35,
    metalness: 0.65,
  });

  // Dynamic livery canvases so switching state bus in Garage re-renders instantly
  const leftSideCanvas = document.createElement('canvas');
  leftSideCanvas.width = 2048;
  leftSideCanvas.height = 512;
  drawSideLiveryCanvas(leftSideCanvas, currentSpec, 'left');
  const leftSideTex = new THREE.CanvasTexture(leftSideCanvas);
  leftSideTex.colorSpace = THREE.SRGBColorSpace;
  leftSideTex.anisotropy = maxAniso;

  const rightSideCanvas = document.createElement('canvas');
  rightSideCanvas.width = 2048;
  rightSideCanvas.height = 512;
  drawSideLiveryCanvas(rightSideCanvas, currentSpec, 'right');
  const rightSideTex = new THREE.CanvasTexture(rightSideCanvas);
  rightSideTex.colorSpace = THREE.SRGBColorSpace;
  rightSideTex.anisotropy = maxAniso;

  const rearCanvas = document.createElement('canvas');
  rearCanvas.width = 1024;
  rearCanvas.height = 1024;
  drawRearLiveryCanvas(rearCanvas, currentSpec, initialPlate || currentSpec.defaultPlate);
  const rearPromoTex = new THREE.CanvasTexture(rearCanvas);
  rearPromoTex.colorSpace = THREE.SRGBColorSpace;
  rearPromoTex.anisotropy = maxAniso;

  const leftSideMat = new THREE.MeshPhysicalMaterial({
    map: leftSideTex,
    roughness: 0.3,
    metalness: 0.2,
    clearcoat: 0.68,
    clearcoatRoughness: 0.18,
  });
  const rightSideMat = new THREE.MeshPhysicalMaterial({
    map: rightSideTex,
    roughness: 0.3,
    metalness: 0.2,
    clearcoat: 0.68,
    clearcoatRoughness: 0.18,
  });
  const rearMat = new THREE.MeshPhysicalMaterial({
    map: rearPromoTex,
    roughness: 0.32,
    metalness: 0.16,
    clearcoat: 0.52,
  });

  // 1. Undercarriage chassis frame
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.34, 10.9), chassisDarkMat);
  chassis.position.set(0, 0.64, 0);
  chassis.castShadow = true;
  bodyGroup.add(chassis);

  // 2. Lower body shell (Passenger doorway open on Indian LEFT curb side +X)
  const rightLowerWall = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.24, 11.0), rightSideMat);
  rightLowerWall.position.set(-1.22, 1.38, 0);
  rightLowerWall.castShadow = true;
  rightLowerWall.receiveShadow = true;
  bodyGroup.add(rightLowerWall);

  const leftLowerWall = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.24, 8.95), leftSideMat);
  leftLowerWall.position.set(1.22, 1.38, -1.02);
  leftLowerWall.castShadow = true;
  leftLowerWall.receiveShadow = true;
  bodyGroup.add(leftLowerWall);

  const leftFrontLower = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.24, 0.8), primaryPaintMat);
  leftFrontLower.position.set(1.21, 1.38, 5.12);
  bodyGroup.add(leftFrontLower);

  // 3. Front nose cowl + chrome radiator grille + steel bumpers
  const frontLower = new THREE.Mesh(new THREE.BoxGeometry(2.54, 1.18, 0.35), primaryPaintMat);
  frontLower.position.set(0, 1.35, 5.42);
  frontLower.castShadow = true;
  bodyGroup.add(frontLower);

  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.52, 0.12), chassisDarkMat);
  grille.position.set(0, 1.16, 5.58);
  bodyGroup.add(grille);

  for (let i = 0; i < 4; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.045, 0.14), chromeMat);
    slat.position.set(0, 0.99 + i * 0.11, 5.59);
    bodyGroup.add(slat);
  }

  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.3, 0.32), chassisDarkMat);
  frontBumper.position.set(0, 0.68, 5.54);
  bodyGroup.add(frontBumper);

  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.32, 0.28), chassisDarkMat);
  rearBumper.position.set(0, 0.68, -5.56);
  bodyGroup.add(rearBumper);

  const frontPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.18, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 })
  );
  frontPlate.position.set(0, 0.69, 5.71);
  bodyGroup.add(frontPlate);

  // 4. Rear promotional wall
  const rearWall = new THREE.Mesh(new THREE.BoxGeometry(2.54, 2.38, 0.18), rearMat);
  rearWall.position.set(0, 1.98, -5.48);
  rearWall.castShadow = true;
  bodyGroup.add(rearWall);

  // 5. Roof Crown + Luggage Rack + Twin Chrome Air Horns
  const roofShell = new THREE.Mesh(new THREE.BoxGeometry(2.56, 0.24, 11.15), roofPaintMat);
  roofShell.position.set(0, 3.16, -0.02);
  roofShell.castShadow = true;
  bodyGroup.add(roofShell);

  const roofCrown = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.14, 10.6), primaryPaintMat);
  roofCrown.position.set(0, 3.31, -0.1);
  bodyGroup.add(roofCrown);

  const rackRailGeo = new THREE.BoxGeometry(0.06, 0.22, 5.8);
  const rackLeft = new THREE.Mesh(rackRailGeo, chromeMat);
  rackLeft.position.set(-1.05, 3.46, -2.0);
  bodyGroup.add(rackLeft);
  const rackRight = new THREE.Mesh(rackRailGeo, chromeMat);
  rackRight.position.set(1.05, 3.46, -2.0);
  bodyGroup.add(rackRight);
  const rackFront = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.22, 0.06), chromeMat);
  rackFront.position.set(0, 3.46, 0.9);
  bodyGroup.add(rackFront);
  const rackBack = new THREE.Mesh(new THREE.BoxGeometry(2.16, 0.22, 0.06), chromeMat);
  rackBack.position.set(0, 3.46, -4.9);
  bodyGroup.add(rackBack);

  const bagColors = [0xb91c1c, 0x0f766e, 0xd97706, 0x1e3a8a, 0x475569];
  for (let i = 0; i < 6; i++) {
    const bag = new THREE.Mesh(
      new THREE.BoxGeometry(0.76, 0.34, 0.95),
      new THREE.MeshStandardMaterial({
        color: bagColors[i % bagColors.length],
        roughness: 0.78,
        metalness: 0.08,
      })
    );
    bag.position.set(i % 2 === 0 ? -0.45 : 0.45, 3.52, -0.2 - Math.floor(i / 2) * 1.4);
    bodyGroup.add(bag);
  }

  for (const xPos of [-0.62, 0.62]) {
    const hornTube = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.025, 0.65, 12), chromeMat);
    hornTube.rotation.x = Math.PI / 2;
    hornTube.position.set(xPos, 3.44, 4.35);
    bodyGroup.add(hornTube);
  }

  // 6. Front LED Destination Board
  const ledBoardCanvas = document.createElement('canvas');
  ledBoardCanvas.width = 1024;
  ledBoardCanvas.height = 140;
  drawLedDestinationCanvas(
    ledBoardCanvas,
    initialBoard,
    initialPlate || currentSpec.defaultPlate,
    currentSpec.operatorName
  );
  const ledBoardTexture = new THREE.CanvasTexture(ledBoardCanvas);
  ledBoardTexture.colorSpace = THREE.SRGBColorSpace;
  ledBoardTexture.anisotropy = maxAniso;

  const ledBoard = new THREE.Mesh(
    new THREE.PlaneGeometry(1.96, 0.28),
    new THREE.MeshStandardMaterial({
      map: ledBoardTexture,
      emissiveMap: ledBoardTexture,
      emissive: 0xffffff,
      emissiveIntensity: 0.85,
      roughness: 0.25,
    })
  );
  ledBoard.position.set(0, 3.04, 5.56);
  bodyGroup.add(ledBoard);

  // 7. Split Panoramic Front Windshield, Interactive Raindrop Wipe Layer & Side Window Pillars
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.42, 1.12, 0.06), glassMat);
  windshield.position.set(0, 2.46, 5.47);
  windshield.rotation.x = -0.08;
  windshield.renderOrder = 3;
  bodyGroup.add(windshield);

  // Dynamic Windshield Raindrop Canvas Layer (visibly wiped clean in real time by the wipers in rain!)
  const rainGlassCanvas = document.createElement('canvas');
  rainGlassCanvas.width = 512;
  rainGlassCanvas.height = 256;
  const rainGlassCtx = rainGlassCanvas.getContext('2d')!;
  const rainGlassTex = new THREE.CanvasTexture(rainGlassCanvas);
  const rainGlassMat = new THREE.MeshBasicMaterial({
    map: rainGlassTex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const rainGlassMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.38, 1.08), rainGlassMat);
  rainGlassMesh.position.set(0, 2.46, 5.43);
  rainGlassMesh.rotation.x = -0.08;
  rainGlassMesh.rotation.y = Math.PI;
  rainGlassMesh.renderOrder = 4;
  rainGlassMesh.visible = false;
  bodyGroup.add(rainGlassMesh);

  interface RainDrop {
    x: number;
    y: number;
    r: number;
    vy: number;
    alpha: number;
  }
  const glassDrops: RainDrop[] = [];
  for (let i = 0; i < 160; i++) {
    glassDrops.push({
      x: Math.random() * 512,
      y: Math.random() * 256,
      r: 1.6 + Math.random() * 2.8,
      vy: 36 + Math.random() * 75,
      alpha: 0.45 + Math.random() * 0.45,
    });
  }
  let rainGlassTimer = 0;
  let currentWiperAngle = -0.78;
  let prevWiperAngle = -0.78;
  let rainGlassWetness = 0;

  const centerMullion = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.18, 0.12), chassisDarkMat);
  centerMullion.position.set(0, 2.46, 5.47);
  bodyGroup.add(centerMullion);

  for (const sx of [-1.24, 1.24]) {
    for (let pz = -5.4; pz <= 5.4; pz += 1.8) {
      if (sx > 0 && pz > 3.2 && pz < 4.9) continue; // doorway on +X left curb
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.16, 0.14), primaryPaintMat);
      pillar.position.set(sx, 2.52, pz);
      bodyGroup.add(pillar);
    }
    const sideGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 1.06, sx > 0 ? 8.85 : 10.65),
      glassMat
    );
    sideGlass.position.set(sx, 2.52, sx > 0 ? -1.0 : 0.0);
    sideGlass.renderOrder = 3;
    bodyGroup.add(sideGlass);
  }

  // 8. Detailed Interior Cabin & Rich Driver Cockpit (Visible in Cabin Camera + 360° Look!)
  const floorDeck = new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.08, 10.7), chassisDarkMat);
  floorDeck.position.set(0, 0.92, -0.05);
  bodyGroup.add(floorDeck);

  // Interior headliner ceiling
  const ceilingPanel = new THREE.Mesh(
    new THREE.BoxGeometry(2.38, 0.06, 10.7),
    new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.85 })
  );
  ceilingPanel.position.set(0, 3.02, -0.05);
  bodyGroup.add(ceilingPanel);

  // Entry steps on +X curb side
  for (let s = 0; s < 3; s++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.07, 1.08), chassisDarkMat);
    step.position.set(0.98 - s * 0.14, 0.56 + s * 0.18, 4.12);
    bodyGroup.add(step);
  }
  const grabRail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.75, 8), yellowRailMat);
  grabRail.position.set(1.02, 1.85, 3.55);
  bodyGroup.add(grabRail);

  // Overhead yellow aisle handrail
  const aisleRail = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 8.2, 8), yellowRailMat);
  aisleRail.rotation.x = Math.PI / 2;
  aisleRail.position.set(0.15, 2.74, -0.8);
  bodyGroup.add(aisleRail);

  // Passenger seat rows (left 2-seater, right 3-seater)
  for (let row = 0; row < 8; row++) {
    const zPos = 2.6 - row * 1.02;
    const leftSeat = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.72, 0.45), interiorSeatMat);
    leftSeat.position.set(0.74, 1.38, zPos);
    bodyGroup.add(leftSeat);

    const rightSeat = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.72, 0.45), interiorSeatMat);
    rightSeat.position.set(-0.64, 1.38, zPos);
    bodyGroup.add(rightSeat);
  }

  // Driver high-back seat behind cabin eye point
  const driverSeatBase = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.22, 0.54), interiorSeatMat);
  driverSeatBase.position.set(-0.68, 1.48, 3.82);
  bodyGroup.add(driverSeatBase);
  const driverSeatBack = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.78, 0.14), interiorSeatMat);
  driverSeatBack.position.set(-0.68, 1.92, 3.56);
  bodyGroup.add(driverSeatBack);

  // Conductor Front Jump-Seat beside driver (for conductor when travelling between bus stops)
  const condSeatBase = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.18, 0.48), interiorSeatMat);
  condSeatBase.position.set(0.42, 1.38, 4.02);
  condSeatBase.rotation.y = -0.15;
  bodyGroup.add(condSeatBase);
  const condSeatBack = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.64, 0.12), interiorSeatMat);
  condSeatBack.position.set(0.46, 1.76, 3.79);
  condSeatBack.rotation.y = -0.15;
  bodyGroup.add(condSeatBack);
  const condSeatPedestal = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.36), chassisDarkMat);
  condSeatPedestal.position.set(0.42, 1.14, 4.02);
  bodyGroup.add(condSeatPedestal);

  // Sculpted Wrap-Around Bus Dashboard Console
  const dashBase = new THREE.Mesh(new THREE.BoxGeometry(2.36, 0.56, 0.76), dashMat);
  dashBase.position.set(0, 1.5, 4.98);
  bodyGroup.add(dashBase);

  const dashTopTrim = new THREE.Mesh(new THREE.BoxGeometry(2.34, 0.08, 0.78), chassisDarkMat);
  dashTopTrim.position.set(0, 1.81, 4.98);
  bodyGroup.add(dashTopTrim);

  // Driver Instrument Binnacle Hood + Glowing Speed/RPM/Air/Fuel Gauges
  const binnacleHood = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.24, 0.34), chassisDarkMat);
  binnacleHood.position.set(-0.68, 1.9, 4.96);
  bodyGroup.add(binnacleHood);

  const clusterTex = createDashClusterTexture(maxAniso);
  const clusterPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(0.72, 0.2),
    new THREE.MeshStandardMaterial({
      map: clusterTex,
      emissiveMap: clusterTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.85,
      roughness: 0.2,
    })
  );
  clusterPanel.position.set(-0.68, 1.88, 4.785);
  clusterPanel.rotation.y = Math.PI;
  clusterPanel.rotation.x = 0.28;
  bodyGroup.add(clusterPanel);

  // Center Console FM Radio / Indian Bus Stereo Deck + Speakers
  const radioHousing = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.24, 0.28), chassisDarkMat);
  radioHousing.position.set(-0.04, 1.88, 4.94);
  bodyGroup.add(radioHousing);

  const radioTex = createRadioStereoTexture(maxAniso);
  const radioFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.48, 0.18),
    new THREE.MeshStandardMaterial({
      map: radioTex,
      emissiveMap: radioTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.9,
      roughness: 0.22,
    })
  );
  radioFace.position.set(-0.04, 1.88, 4.795);
  radioFace.rotation.y = Math.PI;
  radioFace.rotation.x = 0.22;
  bodyGroup.add(radioFace);

  // Illuminated Dashboard Rocker Switch Bank (Hazard, Door, Lights, Wipers, Horn)
  const switchColors = [0xef4444, 0x22c55e, 0x38bdf8, 0xf59e0b, 0xa855f7, 0x0ea5e9];
  for (let i = 0; i < switchColors.length; i++) {
    const sw = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, 0.065, 0.03),
      new THREE.MeshStandardMaterial({
        color: switchColors[i],
        emissive: switchColors[i],
        emissiveIntensity: 0.55,
        roughness: 0.35,
      })
    );
    sw.position.set(-0.24 + i * 0.072, 1.72, 4.66);
    sw.rotation.x = 0.35;
    bodyGroup.add(sw);
  }

  // Twin Dashboard Speakers
  for (const spx of [-1.06, 0.56]) {
    const spk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 12), chassisDarkMat);
    spk.position.set(spx, 1.85, 5.05);
    bodyGroup.add(spk);
  }

  // Overhead Sun Visor & Interior Rear-View Mirror + Saffron Dashboard Charm
  const sunVisor = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.14, 0.03), chassisDarkMat);
  sunVisor.position.set(-0.68, 2.86, 5.26);
  sunVisor.rotation.x = 0.2;
  bodyGroup.add(sunVisor);

  // Real-Time Working Interior Rear-View Mirror (angled cleanly toward RHD driver)
  const cabinMirrorGroup = new THREE.Group();
  cabinMirrorGroup.position.set(-0.34, 2.66, 5.12);
  cabinMirrorGroup.rotation.y = -0.18;
  cabinMirrorGroup.rotation.x = 0.05;
  const cabinMirrorFrame = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.15, 0.04), chassisDarkMat);
  cabinMirrorGroup.add(cabinMirrorFrame);
  const cabinMirrorStem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.24, 8), chassisDarkMat);
  cabinMirrorStem.position.set(0, 0.18, 0.02);
  cabinMirrorGroup.add(cabinMirrorStem);
  const cabinMirrorMat = new THREE.MeshBasicMaterial({ color: 0xcbd5e1 });
  const cabinMirrorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.12), cabinMirrorMat);
  cabinMirrorGlass.position.set(0, 0, -0.024);
  cabinMirrorGlass.rotation.y = Math.PI;
  cabinMirrorGroup.add(cabinMirrorGlass);
  bodyGroup.add(cabinMirrorGroup);

  // Decorative Marigold / Saffron Dashboard Idol & Garland Accent
  const idolBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.07, 0.03, 10),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.7 })
  );
  idolBase.position.set(-0.18, 1.87, 5.14);
  bodyGroup.add(idolBase);
  const idolFig = new THREE.Mesh(
    new THREE.ConeGeometry(0.042, 0.11, 8),
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.25, metalness: 0.85 })
  );
  idolFig.position.set(-0.18, 1.94, 5.14);
  bodyGroup.add(idolFig);

  // Detailed RHD Steering Column & 3-Spoke Steering Wheel (clearly visible in Cabin View!)
  const steeringCol = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.72, 12), chassisDarkMat);
  steeringCol.position.set(-0.68, 1.56, 4.66);
  steeringCol.rotation.x = -0.52;
  bodyGroup.add(steeringCol);

  const steeringWheel = new THREE.Group();
  steeringWheel.position.set(-0.68, 1.86, 4.52);
  steeringWheel.rotation.x = 0.58;

  const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.03, 12, 28), chassisDarkMat);
  steeringWheel.add(wheelRing);
  // Top amber alignment band on cockpit wheel
  const topStripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.065, 0.065),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35 })
  );
  topStripe.position.set(0, 0.26, 0);
  steeringWheel.add(topStripe);

  const spokeHoriz = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.045, 0.03), chromeMat);
  steeringWheel.add(spokeHoriz);
  const spokeVert = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.24, 0.03), chromeMat);
  spokeVert.position.set(0, -0.12, 0);
  steeringWheel.add(spokeVert);

  const wheelHub = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 16), primaryPaintMat);
  wheelHub.rotation.x = Math.PI / 2;
  steeringWheel.add(wheelHub);
  bodyGroup.add(steeringWheel);

  // Physical Floor-Mounted Heavy Bus Gear Lever (Beside driver's left hand at x = -0.22, z = 4.38)
  const gearBoot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.11, 0.14, 12), chassisDarkMat);
  gearBoot.position.set(-0.22, 1.02, 4.38);
  bodyGroup.add(gearBoot);

  const gearStickPivot = new THREE.Group();
  gearStickPivot.position.set(-0.22, 1.05, 4.38);
  const stickRod = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.72, 10), chromeMat);
  stickRod.position.y = 0.36;
  gearStickPivot.add(stickRod);
  const shiftKnob = new THREE.Mesh(
    new THREE.SphereGeometry(0.052, 14, 14),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.25, metalness: 0.35 })
  );
  shiftKnob.position.y = 0.74;
  gearStickPivot.add(shiftKnob);
  const shiftCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036, 0.036, 0.012, 12),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.35 })
  );
  shiftCap.position.y = 0.79;
  gearStickPivot.add(shiftCap);
  bodyGroup.add(gearStickPivot);

  // 8B. Visible 3D Driver Hands, Wrists & Forearms in Cockpit View (follows steering tilt + random 1-hand / 2-hand grip)
  const driverSkinMat = new THREE.MeshStandardMaterial({
    color: 0xc88b61,
    roughness: 0.76,
    metalness: 0.02,
  });
  const khakhiUniformMat = new THREE.MeshStandardMaterial({
    color: 0xb69a6b,
    roughness: 0.86,
    metalness: 0.04,
  });
  const khakhiTrouserMat = new THREE.MeshStandardMaterial({
    color: 0x6f5c3e,
    roughness: 0.88,
    metalness: 0.04,
  });
  const leatherMat = new THREE.MeshStandardMaterial({
    color: 0x3b2314,
    roughness: 0.65,
    metalness: 0.08,
  });

  const buildDriverHandMesh = (isLeft: boolean): THREE.Group => {
    const hand = new THREE.Group();
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.04, 0.086), driverSkinMat);
    palm.castShadow = true;
    hand.add(palm);

    // 4 curled fingers wrapping cleanly over the steering rim
    for (let f = 0; f < 4; f++) {
      const fx = -0.028 + f * 0.019;
      const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0085, 0.062, 8), driverSkinMat);
      finger.position.set(fx, -0.008, 0.046);
      finger.rotation.x = 1.05;
      hand.add(finger);
    }

    // Opposable thumb gripping the inner rim
    const thumb = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.0095, 0.052, 8), driverSkinMat);
    thumb.position.set(isLeft ? -0.046 : 0.046, -0.002, 0.018);
    thumb.rotation.z = isLeft ? 0.85 : -0.85;
    thumb.rotation.x = 0.45;
    hand.add(thumb);

    // Wrist & stainless steel watch on driver's left wrist
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.035, 0.055, 10), driverSkinMat);
    wrist.rotation.x = Math.PI / 2;
    wrist.position.set(0, 0, -0.058);
    hand.add(wrist);

    if (isLeft) {
      const watchStrap = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.022, 12), chromeMat);
      watchStrap.rotation.x = Math.PI / 2;
      watchStrap.position.set(0, 0, -0.062);
      hand.add(watchStrap);
      const watchDial = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.012, 12),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.7 })
      );
      watchDial.position.set(0, 0.033, -0.062);
      hand.add(watchDial);
    }
    return hand;
  };

  const leftHandGroup = buildDriverHandMesh(true);
  const rightHandGroup = buildDriverHandMesh(false);
  bodyGroup.add(leftHandGroup);
  bodyGroup.add(rightHandGroup);

  const leftUpperSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.34, 10), khakhiUniformMat);
  const leftForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.046, 0.32, 10), driverSkinMat);
  const rightUpperSleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.34, 10), khakhiUniformMat);
  const rightForearm = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.046, 0.32, 10), driverSkinMat);
  bodyGroup.add(leftUpperSleeve, leftForearm, rightUpperSleeve, rightForearm);

  const leftShoulderAnchor = new THREE.Vector3(-0.44, 1.84, 3.92);
  const rightShoulderAnchor = new THREE.Vector3(-0.92, 1.84, 3.92);
  const leftHandCurr = computeWheelRimPoint(0.16, 0, new THREE.Vector3());
  const rightHandCurr = computeWheelRimPoint(Math.PI - 0.16, 0, new THREE.Vector3());

  type DriveGripStyle = 'both' | 'right_only' | 'left_only';
  let gripStyle: DriveGripStyle = 'both';
  let gripStyleTimer = 7.5;
  let shiftReachTimer = 0;

  // 8C. Animated 3D Indian Roadways Conductor (sits beside driver, steps out at stops & guides reverse with whistle!)
  const conductorGroup = new THREE.Group();
  const condPelvis = new THREE.Group();
  condPelvis.position.set(0, 0.92, 0);
  conductorGroup.add(condPelvis);

  // Articulated Legs (hip -> thigh + shin -> shoe)
  const buildConductorLeg = (xOff: number) => {
    const hip = new THREE.Group();
    hip.position.set(xOff, 0, 0);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.082, 0.072, 0.44, 10), khakhiTrouserMat);
    thigh.position.y = -0.22;
    thigh.castShadow = true;
    hip.add(thigh);

    const knee = new THREE.Group();
    knee.position.set(0, -0.44, 0);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.056, 0.42, 10), khakhiTrouserMat);
    shin.position.y = -0.21;
    shin.castShadow = true;
    knee.add(shin);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.24), chassisDarkMat);
    shoe.position.set(0, -0.44, 0.05);
    knee.add(shoe);

    hip.add(knee);
    condPelvis.add(hip);
    return { hip, knee };
  };
  const condLeftLeg = buildConductorLeg(0.11);
  const condRightLeg = buildConductorLeg(-0.11);

  // Torso + Haryana Roadways Khakhi Shirt + Leather Ticket Cash Bag + Belt
  const condTorso = new THREE.Group();
  condTorso.position.set(0, 0.04, 0);
  const torsoMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.54, 0.23), khakhiUniformMat);
  torsoMesh.position.y = 0.27;
  torsoMesh.castShadow = true;
  condTorso.add(torsoMesh);

  const beltMesh = new THREE.Mesh(new THREE.BoxGeometry(0.415, 0.055, 0.245), leatherMat);
  beltMesh.position.y = 0.03;
  condTorso.add(beltMesh);

  const beltBuckle = new THREE.Mesh(
    new THREE.BoxGeometry(0.075, 0.05, 0.03),
    new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.8 })
  );
  beltBuckle.position.set(0, 0.03, 0.125);
  condTorso.add(beltBuckle);

  // Iconic Conductor Leather Ticket-Cash Satchel across shoulder
  const satchelStrap = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.62, 0.25), leatherMat);
  satchelStrap.position.set(0.02, 0.28, 0);
  satchelStrap.rotation.z = -0.46;
  condTorso.add(satchelStrap);
  const ticketBag = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.24, 0.24), leatherMat);
  ticketBag.position.set(0.24, 0.08, 0.04);
  condTorso.add(ticketBag);

  // Head + Hair + Classic Mustache + Collar
  const condHead = new THREE.Group();
  condHead.position.set(0, 0.58, 0);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.062, 0.09, 10), driverSkinMat);
  neck.position.y = 0.02;
  condHead.add(neck);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.125, 14, 14), driverSkinMat);
  skull.position.y = 0.14;
  skull.scale.set(0.92, 1.04, 0.96);
  skull.castShadow = true;
  condHead.add(skull);
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(0.128, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.56),
    chassisDarkMat
  );
  hairCap.position.y = 0.155;
  hairCap.scale.set(0.94, 1.0, 0.98);
  condHead.add(hairCap);
  const mustache = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.018, 0.024), chassisDarkMat);
  mustache.position.set(0, 0.105, 0.116);
  condHead.add(mustache);
  condTorso.add(condHead);

  // Articulated Conductor Arms (Right arm waves passengers & guides reverse; Left arm holds metallic whistle!)
  const buildConductorArm = (xOff: number, withWhistle: boolean) => {
    const sh = new THREE.Group();
    sh.position.set(xOff, 0.48, 0);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.052, 0.28, 10), khakhiUniformMat);
    upper.position.y = -0.14;
    sh.add(upper);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.28, 0);
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.036, 0.26, 10), driverSkinMat);
    fore.position.y = -0.13;
    elbow.add(fore);
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.046, 10, 10), driverSkinMat);
    palm.position.y = -0.27;
    elbow.add(palm);

    if (withWhistle) {
      // Shiny silver pea-whistle held in left hand for reverse guiding!
      const whistle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.065, 10), chromeMat);
      whistle.rotation.z = Math.PI / 2;
      whistle.position.set(-0.02, -0.27, 0.04);
      elbow.add(whistle);
    } else {
      // Yellow Roadways ticket roll pad in right hand when calling stops
      const ticketPad = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.1, 0.02),
        new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.6 })
      );
      ticketPad.position.set(0, -0.29, 0.04);
      elbow.add(ticketPad);
    }
    sh.add(elbow);
    condTorso.add(sh);
    return { sh, elbow };
  };

  const condLeftArm = buildConductorArm(0.24, true);
  const condRightArm = buildConductorArm(-0.24, false);
  condPelvis.add(condTorso);

  // Start conductor seated on his front jump seat next to the driver
  conductorGroup.position.set(0.42, 0.56, 4.02);
  conductorGroup.rotation.y = -0.15;
  root.add(conductorGroup);

  // Conductor smooth locomotion state
  const condState = {
    x: 0.42,
    y: 0.56,
    z: 4.02,
    rotY: -0.15,
    seatedBlend: 1,
    walkPhase: 0,
  };

  // 9. Animated Pneumatic Bi-Fold Passenger Door on Indian LEFT Curb Side (+X)
  const doorLeaf1 = new THREE.Group();
  doorLeaf1.position.set(1.22, 0.72, 3.58);
  const leafGeo = new THREE.BoxGeometry(0.08, 2.24, 0.54);
  const leafGlassGeo = new THREE.BoxGeometry(0.09, 0.96, 0.42);
  const leaf1Body = new THREE.Mesh(leafGeo, primaryPaintMat);
  leaf1Body.position.set(0, 1.12, 0.27);
  doorLeaf1.add(leaf1Body);
  const leaf1Glass = new THREE.Mesh(leafGlassGeo, glassMat);
  leaf1Glass.position.set(0, 1.66, 0.27);
  doorLeaf1.add(leaf1Glass);
  bodyGroup.add(doorLeaf1);

  const doorLeaf2 = new THREE.Group();
  doorLeaf2.position.set(1.22, 0.72, 4.68);
  const leaf2Body = new THREE.Mesh(leafGeo, primaryPaintMat);
  leaf2Body.position.set(0, 1.12, -0.27);
  doorLeaf2.add(leaf2Body);
  const leaf2Glass = new THREE.Mesh(leafGlassGeo, glassMat);
  leaf2Glass.position.set(0, 1.66, -0.27);
  doorLeaf2.add(leaf2Glass);
  bodyGroup.add(doorLeaf2);

  // 10. Twin Extended Real-Time Side Wing Mirrors (Right driver-side mirror angled clearly into cockpit view!)
  const leftWingMirrorMat = new THREE.MeshBasicMaterial({ color: 0xcbd5e1 });
  const rightWingMirrorMat = new THREE.MeshBasicMaterial({ color: 0xcbd5e1 });
  for (const sx of [-1, 1]) {
    const mirrorUnit = new THREE.Group();
    mirrorUnit.position.set(sx * 1.46, 2.34, 5.34);
    mirrorUnit.rotation.y = sx < 0 ? 0.18 : -0.18;

    const armTop = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.036, 0.036), chassisDarkMat);
    armTop.position.set(-sx * 0.15, 0.16, -0.04);
    mirrorUnit.add(armTop);
    const armBot = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.036, 0.036), chassisDarkMat);
    armBot.position.set(-sx * 0.15, -0.16, -0.04);
    mirrorUnit.add(armBot);

    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.46, 0.07), chassisDarkMat);
    mirrorUnit.add(housing);

    const mirrorGlass = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15, 0.41),
      sx < 0 ? rightWingMirrorMat : leftWingMirrorMat
    );
    mirrorGlass.position.set(0, 0, -0.039);
    mirrorGlass.rotation.y = Math.PI;
    mirrorUnit.add(mirrorGlass);
    bodyGroup.add(mirrorUnit);
  }

  // 11. Upgraded Articulated Pantograph Windshield Wipers (clearly visible from inside cockpit & exterior)
  const wiperRubberMat = new THREE.MeshStandardMaterial({ color: 0x0b0f17, roughness: 0.78 });
  const buildPantographWiper = (xPos: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(xPos, 1.92, 5.52);
    pivot.rotation.x = -0.08;

    // Pivot boss mount
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.038, 0.05, 10), chassisDarkMat);
    boss.rotation.x = Math.PI / 2;
    pivot.add(boss);

    // Main wiper arm + parallel pantograph strut
    const mainArm = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.62, 0.022), chassisDarkMat);
    mainArm.position.set(0, 0.31, 0.015);
    pivot.add(mainArm);
    const subArm = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.56, 0.014), chassisDarkMat);
    subArm.position.set(0.026, 0.29, 0.018);
    pivot.add(subArm);

    // Wide heavy-bus rubber squeegee blade
    const bladeCarrier = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.58, 0.024), wiperRubberMat);
    bladeCarrier.position.set(0, 0.62, 0.008);
    pivot.add(bladeCarrier);

    return pivot;
  };

  const wiperLeft = buildPantographWiper(0.56);
  bodyGroup.add(wiperLeft);

  const wiperRight = buildPantographWiper(-0.56);
  bodyGroup.add(wiperRight);

  // 12. Functional Lights
  const headlightMats: THREE.MeshStandardMaterial[] = [];
  const headlightBeams: THREE.SpotLight[] = [];

  for (const sx of [-0.92, 0.92]) {
    const hlMat = new THREE.MeshStandardMaterial({
      color: 0xfffbeb,
      emissive: 0xfef08a,
      emissiveIntensity: 0.25,
      roughness: 0.15,
    });
    headlightMats.push(hlMat);
    const hlMesh = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.2, 0.08), hlMat);
    hlMesh.position.set(sx, 1.12, 5.59);
    bodyGroup.add(hlMesh);

    const spot = new THREE.SpotLight(0xfff5d6, 0, 65, Math.PI / 5.0, 0.45, 1.35);
    spot.position.set(sx, 1.15, 5.65);
    spot.target.position.set(sx * 0.6, 0.2, 28);
    bodyGroup.add(spot);
    bodyGroup.add(spot.target);
    headlightBeams.push(spot);
  }

  const leftIndMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    emissive: 0xf59e0b,
    emissiveIntensity: 0,
  });
  const rightIndMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    emissive: 0xf59e0b,
    emissiveIntensity: 0,
  });
  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    emissive: 0xef4444,
    emissiveIntensity: 0.2,
  });
  const reverseLightMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    emissive: 0xffffff,
    emissiveIntensity: 0,
  });

  for (const zPos of [5.59, -5.58]) {
    const lInd = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.08), leftIndMat);
    lInd.position.set(1.14, 1.12, zPos);
    bodyGroup.add(lInd);
    const rInd = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.08), rightIndMat);
    rInd.position.set(-1.14, 1.12, zPos);
    bodyGroup.add(rInd);
  }

  for (const sx of [-0.94, 0.94]) {
    const brk = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.08), brakeLightMat);
    brk.position.set(sx, 1.06, -5.58);
    bodyGroup.add(brk);
    const rev = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.08), reverseLightMat);
    rev.position.set(sx * 0.72, 1.06, -5.58);
    bodyGroup.add(rev);
  }

  const cabinLight = new THREE.PointLight(0xfff4d4, 0.6, 8.5);
  cabinLight.position.set(-0.2, 2.75, 3.2);
  bodyGroup.add(cabinLight);

  // 13. Front Steerable & Rear Dual Wheels
  const frontLeftPivot = new THREE.Group();
  frontLeftPivot.position.set(1.16, 0.52, 3.15);
  const flWheel = buildWheelAssembly(false, wheelHubMat);
  frontLeftPivot.add(flWheel);
  root.add(frontLeftPivot);

  const frontRightPivot = new THREE.Group();
  frontRightPivot.position.set(-1.16, 0.52, 3.15);
  const frWheel = buildWheelAssembly(false, wheelHubMat);
  frontRightPivot.add(frWheel);
  root.add(frontRightPivot);

  const rearLeft = buildWheelAssembly(true, wheelHubMat);
  rearLeft.position.set(1.06, 0.52, -2.95);
  root.add(rearLeft);

  const rearRight = buildWheelAssembly(true, wheelHubMat);
  rearRight.position.set(-1.06, 0.52, -2.95);
  root.add(rearRight);

  const wheelMeshes = [flWheel, frWheel, rearLeft, rearRight];

  return {
    root,
    bodyGroup,
    frontLeftPivot,
    frontRightPivot,
    wheelMeshes,
    doorLeaf1,
    doorLeaf2,
    steeringWheel,
    gearStickPivot,
    wiperLeft,
    wiperRight,
    headlightBeams,
    headlightMats,
    brakeLightMat,
    reverseLightMat,
    leftIndMat,
    rightIndMat,
    cabinLight,
    ledBoardCanvas,
    ledBoardTexture,
    updateRouteBoard(routeText: string, plateText: string) {
      currentBoard = routeText;
      const plate = plateText || currentSpec.defaultPlate;
      drawLedDestinationCanvas(ledBoardCanvas, routeText, plate, currentSpec.operatorName);
      ledBoardTexture.needsUpdate = true;
    },
    applyLivery(spec: BusFleetSpec, routeText: string) {
      currentSpec = spec;
      currentBoard = routeText || currentBoard;
      primaryPaintMat.color.setHex(spec.primaryHex);
      roofPaintMat.color.setHex(spec.roofHex);
      interiorSeatMat.color.setHex(spec.seatHex);
      wheelHubMat.color.setHex(spec.primaryHex);

      drawSideLiveryCanvas(leftSideCanvas, spec, 'left');
      leftSideTex.needsUpdate = true;
      drawSideLiveryCanvas(rightSideCanvas, spec, 'right');
      rightSideTex.needsUpdate = true;
      drawRearLiveryCanvas(rearCanvas, spec, spec.defaultPlate);
      rearPromoTex.needsUpdate = true;
      drawLedDestinationCanvas(ledBoardCanvas, currentBoard, spec.defaultPlate, spec.operatorName);
      ledBoardTexture.needsUpdate = true;
    },
    setDoorOpenAmount(t: number) {
      const clamped = Math.max(0, Math.min(1, t));
      doorLeaf1.rotation.y = clamped * 1.45;
      doorLeaf2.rotation.y = -clamped * 1.45;
    },
    setSteeringAngle(angleRad: number) {
      frontLeftPivot.rotation.y = angleRad;
      frontRightPivot.rotation.y = angleRad;
      steeringWheel.rotation.z = -angleRad * 4.4;
    },
    setGearStick(gear: number) {
      // Realistic H-pattern physical gear lever throw inside the cabin!
      const positions: Record<number, [number, number]> = {
        [-1]: [-0.26, -0.24],
        0: [0, 0],
        1: [0.24, 0.22],
        2: [-0.24, 0.22],
        3: [0.24, 0],
        4: [-0.24, 0],
        5: [0.24, -0.2],
        6: [-0.24, -0.2],
      };
      const [rx, rz] = positions[gear] ?? [0, 0];
      gearStickPivot.rotation.x = rx;
      gearStickPivot.rotation.z = rz;
    },
    spinWheels(distDelta: number) {
      const dRot = distDelta / 0.52;
      for (const w of wheelMeshes) {
        w.rotation.x += dRot;
      }
    },
    setMirrorTextures(rearTex: THREE.Texture | null, rightWingTex: THREE.Texture | null) {
      cabinMirrorMat.map = rearTex;
      cabinMirrorMat.color.setHex(rearTex ? 0xffffff : 0xcbd5e1);
      cabinMirrorMat.needsUpdate = true;

      leftWingMirrorMat.map = rearTex;
      leftWingMirrorMat.color.setHex(rearTex ? 0xffffff : 0xcbd5e1);
      leftWingMirrorMat.needsUpdate = true;

      rightWingMirrorMat.map = rightWingTex || rearTex;
      rightWingMirrorMat.color.setHex(rightWingTex || rearTex ? 0xffffff : 0xcbd5e1);
      rightWingMirrorMat.needsUpdate = true;
    },
    updateWipers(time: number, on: boolean, isRaining = false, dt = 0.016) {
      prevWiperAngle = currentWiperAngle;
      const targetAngle = on ? Math.sin(time * 4.8) * 0.74 : -0.82;
      currentWiperAngle = THREE.MathUtils.damp(currentWiperAngle, targetAngle, on ? 18 : 7, dt);
      wiperLeft.rotation.z = currentWiperAngle;
      wiperRight.rotation.z = currentWiperAngle;

      // Smoothly build or dry windshield raindrop film
      rainGlassWetness = THREE.MathUtils.damp(rainGlassWetness, isRaining ? 1 : 0, isRaining ? 1.8 : 1.2, dt);
      if (rainGlassWetness < 0.02) {
        rainGlassMesh.visible = false;
        return;
      }

      rainGlassMesh.visible = true;
      rainGlassMat.opacity = rainGlassWetness * 0.88;

      rainGlassTimer += dt;
      if (rainGlassTimer < 0.055) return; // ~18 FPS canvas update for crisp & fast rain wipe!
      const stepDt = rainGlassTimer;
      rainGlassTimer = 0;

      // Clear & repaint translucent rain mist + falling droplets
      rainGlassCtx.clearRect(0, 0, 512, 256);
      rainGlassCtx.fillStyle = 'rgba(186, 212, 238, 0.14)';
      rainGlassCtx.fillRect(0, 0, 512, 256);

      // Compute active wiper blade sweep angles in canvas space (pivots at bottom left/right quarters)
      const pivotsX = [135, 377];
      const pivotY = 252;
      const aMin = Math.min(prevWiperAngle, currentWiperAngle) - 0.14;
      const aMax = Math.max(prevWiperAngle, currentWiperAngle) + 0.14;

      for (const d of glassDrops) {
        d.y += d.vy * stepDt;
        if (d.y > 260) {
          d.y = -4;
          d.x = Math.random() * 512;
        }

        // Check if droplet sits inside the freshly wiped fan behind the wiper blade
        let wiped = false;
        if (on) {
          for (const px of pivotsX) {
            const dx = d.x - px;
            const dy = pivotY - d.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 44 && dist < 218) {
              const ang = Math.atan2(dx, dy);
              // Clear a clean arc around the moving blade + soft trailing wiped zone
              if (ang >= aMin - 0.25 && ang <= aMax + 0.25) {
                wiped = true;
                break;
              }
            }
          }
        }
        if (wiped) {
          // Push wiped droplet to outer edge so glass looks visibly clean!
          d.y = Math.random() * 30;
          continue;
        }

        // Draw glistening raindrop + subtle downward water streak
        rainGlassCtx.strokeStyle = `rgba(224, 242, 254, ${d.alpha * 0.55})`;
        rainGlassCtx.lineWidth = d.r * 0.65;
        rainGlassCtx.beginPath();
        rainGlassCtx.moveTo(d.x, d.y - d.r * 3.2);
        rainGlassCtx.lineTo(d.x, d.y);
        rainGlassCtx.stroke();

        rainGlassCtx.fillStyle = `rgba(240, 249, 255, ${d.alpha})`;
        rainGlassCtx.beginPath();
        rainGlassCtx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        rainGlassCtx.fill();
      }

      // Erase twin crystal-clear arcs swept by the rubber wiper blades
      if (on) {
        rainGlassCtx.save();
        rainGlassCtx.globalCompositeOperation = 'destination-out';
        for (const px of pivotsX) {
          rainGlassCtx.beginPath();
          rainGlassCtx.moveTo(px, pivotY);
          const startCanvasA = -Math.PI * 0.5 + THREE.MathUtils.clamp(currentWiperAngle - 0.52, -0.78, 0.78);
          const endCanvasA = -Math.PI * 0.5 + THREE.MathUtils.clamp(currentWiperAngle + 0.52, -0.78, 0.78);
          rainGlassCtx.arc(px, pivotY, 215, startCanvasA, endCanvasA);
          rainGlassCtx.closePath();
          rainGlassCtx.fillStyle = 'rgba(0,0,0,0.92)';
          rainGlassCtx.fill();
        }
        rainGlassCtx.restore();
      }

      rainGlassTex.needsUpdate = true;
    },
    updateDriverAndConductor(
      dt: number,
      elapsed: number,
      steerAngle: number,
      speedMs: number,
      gear: number,
      conductorMode: ConductorMode,
      isShifting: boolean
    ) {
      // 1. Randomly alternate between Two-Handed, Right-Handed (left on gear lever), and Left-Handed driving
      if (isShifting) {
        shiftReachTimer = 1.15;
      } else if (shiftReachTimer > 0) {
        shiftReachTimer = Math.max(0, shiftReachTimer - dt);
      }

      gripStyleTimer -= dt;
      if (gripStyleTimer <= 0) {
        const r = Math.random();
        if (Math.abs(speedMs) < 0.8) {
          gripStyle = r < 0.5 ? 'right_only' : 'both';
        } else {
          gripStyle = r < 0.46 ? 'both' : r < 0.8 ? 'right_only' : 'left_only';
        }
        gripStyleTimer = 6.5 + Math.random() * 6.5;
      }

      // Effective active grip: briefly reach for gear stick during shifts; favor both hands on very tight hairpins
      let activeGrip: DriveGripStyle = gripStyle;
      if (shiftReachTimer > 0) {
        activeGrip = 'right_only';
      } else if (Math.abs(steerAngle) > 0.44 && Math.abs(speedMs) > 7.0) {
        activeGrip = 'both';
      }

      // Exact steering wheel spin (-steerAngle * 4.4) so hand movement mirrors wheel direction 1:1!
      const wheelSpin = -steerAngle * 4.4;
      const dualSpin = THREE.MathUtils.clamp(wheelSpin, -1.08, 1.08);
      const singleSpin = THREE.MathUtils.clamp(wheelSpin, -1.48, 1.48);

      // Compute floor gear stick knob position in bodyGroup space
      _gearKnobTarget.set(
        -0.22 - Math.sin(gearStickPivot.rotation.z) * 0.74,
        1.78,
        4.38 + Math.sin(gearStickPivot.rotation.x) * 0.74
      );
      // Relaxed driver-side window sill armrest position
      _windowRestTarget.set(-1.05, 1.81, 4.24);

      if (activeGrip === 'both') {
        computeWheelRimPoint(0.16, dualSpin, _handLeftTarget);
        computeWheelRimPoint(Math.PI - 0.16, dualSpin, _handRightTarget);
      } else if (activeGrip === 'right_only') {
        // Iconic Indian bus driver 1-hand steering (right palm near 1:30 o'clock, left hand on gear knob)
        computeWheelRimPoint(Math.PI * 0.64, singleSpin, _handRightTarget);
        _handLeftTarget.copy(_gearKnobTarget);
      } else {
        // Relaxed left-hand steering near 10:30 o'clock, right hand resting casually on window sill
        computeWheelRimPoint(Math.PI * 0.36, singleSpin, _handLeftTarget);
        _handRightTarget.copy(_windowRestTarget);
      }

      // Subtle engine/road vibration on hands when moving
      const vib = Math.sin(elapsed * 24) * 0.003 * Math.min(1, Math.abs(speedMs) * 0.15 + 0.25);
      _handLeftTarget.y += vib;
      _handRightTarget.y -= vib;

      const handDamp = 1 - Math.exp(-11.5 * dt);
      leftHandCurr.lerp(_handLeftTarget, handDamp);
      rightHandCurr.lerp(_handRightTarget, handDamp);

      leftHandGroup.position.copy(leftHandCurr);
      rightHandGroup.position.copy(rightHandCurr);

      // Tilt hands to follow steering wheel pitch & roll direction
      const leftOnWheel = activeGrip === 'both' || activeGrip === 'left_only';
      const rightOnWheel = activeGrip === 'both' || activeGrip === 'right_only';
      const handRoll = leftOnWheel && rightOnWheel ? dualSpin * 0.55 : singleSpin * 0.55;

      leftHandGroup.rotation.set(
        leftOnWheel ? 0.52 : 0.12,
        leftOnWheel ? -0.18 : 0.28,
        leftOnWheel ? handRoll * 0.85 + 0.18 : -0.12
      );
      rightHandGroup.rotation.set(
        rightOnWheel ? 0.52 : 0.08,
        rightOnWheel ? 0.18 : -0.22,
        rightOnWheel ? handRoll * 0.85 - 0.18 : 0.15
      );

      // Connect bent-elbow upper khakhi sleeves + forearms cleanly from shoulders to wrists
      _armStart.copy(leftShoulderAnchor);
      _armEnd.set(leftHandCurr.x, leftHandCurr.y - 0.01, leftHandCurr.z - 0.05);
      _armMid.lerpVectors(_armStart, _armEnd, 0.46);
      _armMid.y -= 0.12;
      _armMid.x += 0.05;
      orientCylinderSegment(leftUpperSleeve, _armStart, _armMid, 0.34);
      orientCylinderSegment(leftForearm, _armMid, _armEnd, 0.32);

      _armStart.copy(rightShoulderAnchor);
      _armEnd.set(rightHandCurr.x, rightHandCurr.y - 0.01, rightHandCurr.z - 0.05);
      _armMid.lerpVectors(_armStart, _armEnd, 0.46);
      _armMid.y -= 0.12;
      _armMid.x -= 0.05;
      orientCylinderSegment(rightUpperSleeve, _armStart, _armMid, 0.34);
      orientCylinderSegment(rightForearm, _armMid, _armEnd, 0.32);

      // 2. Animated 3D Conductor Waypoint Navigation & Gestures
      let tx = 0.42;
      let ty = 0.56;
      let tz = 4.02;
      let tRotY = -0.15;
      let targetSeated = 1;
      let moveSpeed = 3.2;

      if (conductorMode === 'seated') {
        targetSeated = 0;
        if (condState.z < 3.6 && condState.x > 1.4) {
          // Returning from rear reverse-guide spot -> walk forward along left exterior to door
          tx = 1.98;
          ty = 0.0;
          tz = 4.18;
          tRotY = 0;
          moveSpeed = 5.4;
        } else if (condState.x > 1.28) {
          // Step in through the front doorway
          tx = 0.96;
          ty = 0.52;
          tz = 4.12;
          tRotY = -Math.PI * 0.5;
          moveSpeed = 3.8;
        } else {
          // Settle into conductor seat beside the driver
          tx = 0.42;
          ty = 0.56;
          tz = 4.02;
          tRotY = -0.15;
          targetSeated = 1;
          moveSpeed = 3.2;
        }
      } else if (conductorMode === 'calling_stop') {
        targetSeated = 0;
        if (condState.x < 1.35) {
          // Step down the front entry steps onto the road
          tx = 1.88;
          ty = 0.0;
          tz = 4.18;
          tRotY = Math.PI * 0.5;
          moveSpeed = 3.8;
        } else {
          // Stand outside doorway facing roadside passengers & call out "Ajao bhai ajao!"
          tx = 2.18;
          ty = 0.0;
          tz = 4.35;
          tRotY = Math.PI * 0.48;
          moveSpeed = 3.2;
        }
      } else {
        // guiding_reverse: hop out of doorway and walk briskly behind left-rear corner to whistle-guide reverse!
        targetSeated = 0;
        if (condState.x < 1.55) {
          tx = 1.98;
          ty = 0.0;
          tz = 4.18;
          tRotY = Math.PI * 0.5;
          moveSpeed = 4.8;
        } else if (condState.z > -5.55) {
          tx = 2.02;
          ty = 0.0;
          tz = -6.15;
          tRotY = Math.PI;
          moveSpeed = 6.2;
        } else {
          // Stand behind rear-left corner facing the bus rear bumper, blowing whistle & waving driver back!
          tx = 1.96;
          ty = 0.0;
          tz = -6.28;
          tRotY = -0.38;
          moveSpeed = 3.6;
        }
      }

      const dx = tx - condState.x;
      const dy = ty - condState.y;
      const dz = tz - condState.z;
      const distToTarget = Math.hypot(dx, dy, dz);
      const step = Math.min(distToTarget, moveSpeed * dt);
      if (distToTarget > 0.01) {
        condState.x += (dx / distToTarget) * step;
        condState.y += (dy / distToTarget) * step;
        condState.z += (dz / distToTarget) * step;
      }

      // Smooth shortest-angle yaw interpolation
      let dRot = tRotY - condState.rotY;
      while (dRot > Math.PI) dRot -= Math.PI * 2;
      while (dRot < -Math.PI) dRot += Math.PI * 2;
      condState.rotY += dRot * Math.min(1, dt * 8.5);

      const isWalking = distToTarget > 0.14 && condState.seatedBlend < 0.35;
      condState.seatedBlend = THREE.MathUtils.damp(
        condState.seatedBlend,
        targetSeated === 1 && distToTarget < 0.25 ? 1 : 0,
        8.0,
        dt
      );

      if (isWalking) {
        condState.walkPhase += dt * (conductorMode === 'guiding_reverse' ? 11.5 : 8.5);
      }

      conductorGroup.position.set(
        condState.x,
        condState.y + (isWalking ? Math.abs(Math.sin(condState.walkPhase)) * 0.05 : 0),
        condState.z
      );
      conductorGroup.rotation.y = condState.rotY;

      // Apply Limb Poses: Seated vs Walking vs Calling Stop vs Guiding Reverse with Whistle!
      const sb = condState.seatedBlend;
      const walkSwing = isWalking ? Math.sin(condState.walkPhase) * 0.62 : 0;

      condLeftLeg.hip.rotation.x = THREE.MathUtils.lerp(walkSwing, -1.48, sb);
      condRightLeg.hip.rotation.x = THREE.MathUtils.lerp(-walkSwing, -1.48, sb);
      condLeftLeg.knee.rotation.x = THREE.MathUtils.lerp(Math.max(0, -walkSwing * 0.7), 1.48, sb);
      condRightLeg.knee.rotation.x = THREE.MathUtils.lerp(Math.max(0, walkSwing * 0.7), 1.48, sb);

      const conductorReadyOutside =
        (conductorMode === 'calling_stop' && condState.x > 1.75 && distToTarget < 0.35) ||
        (conductorMode === 'guiding_reverse' && condState.z < -5.3 && distToTarget < 0.55);

      if (sb > 0.6) {
        // Relaxed seated pose next to driver
        condLeftArm.sh.rotation.set(-0.35, 0, 0.12);
        condLeftArm.elbow.rotation.set(-0.65, 0, 0);
        condRightArm.sh.rotation.set(-0.32, 0, -0.14);
        condRightArm.elbow.rotation.set(-0.6, 0, 0);
        condHead.rotation.y = Math.sin(elapsed * 0.7) * 0.22;
        condHead.rotation.x = 0.04;
      } else if (isWalking) {
        condLeftArm.sh.rotation.set(-walkSwing * 0.7, 0, 0.12);
        condLeftArm.elbow.rotation.set(-0.35, 0, 0);
        condRightArm.sh.rotation.set(walkSwing * 0.7, 0, -0.12);
        condRightArm.elbow.rotation.set(-0.35, 0, 0);
        condHead.rotation.set(0, 0, 0);
      } else if (conductorMode === 'calling_stop') {
        // Enthusiastically waving right arm to beckon passengers ("Ajao bhai ajao!")
        condRightArm.sh.rotation.set(-2.35 + Math.sin(elapsed * 6.5) * 0.38, 0, -0.35);
        condRightArm.elbow.rotation.set(-0.45 + Math.sin(elapsed * 6.5) * 0.25, 0, 0);
        condLeftArm.sh.rotation.set(-0.45, 0, 0.16);
        condLeftArm.elbow.rotation.set(-0.75, 0, 0);
        condHead.rotation.y = Math.sin(elapsed * 2.4) * 0.35;
        condHead.rotation.x = -0.06;
      } else {
        // Guiding Reverse: Left hand holds silver pea-whistle up to mouth; right arm waves "Aane do, aane do!"
        condLeftArm.sh.rotation.set(-1.35, 0.25, -0.45);
        condLeftArm.elbow.rotation.set(-1.55, 0, -0.2);
        const guideWaveSpeed = Math.abs(speedMs) > 0.3 || gear === -1 ? 8.2 : 4.2;
        condRightArm.sh.rotation.set(-1.85 + Math.sin(elapsed * guideWaveSpeed) * 0.55, 0, -0.32);
        condRightArm.elbow.rotation.set(-0.55 + Math.cos(elapsed * guideWaveSpeed) * 0.35, 0, 0);
        condHead.rotation.y = Math.sin(elapsed * 2.0) * 0.15;
        condHead.rotation.x = -0.08;
      }

      const crossingDoorway =
        condState.x > 0.62 && condState.x < 1.82 && condState.z > 3.55 && condState.z < 4.75;
      const conductorDoorNeed = crossingDoorway || (conductorMode === 'calling_stop' && condState.x < 1.95) ? 1 : 0;

      return { conductorDoorNeed, conductorReadyOutside };
    },
    updateLights(headlights, braking, reversing, indicators, cabinOn, blinkOn) {
      const hlIntensity = headlights === 2 ? 14 : headlights === 1 ? 7.5 : 0;
      const hlDist = headlights === 2 ? 86 : 54;
      for (const beam of headlightBeams) {
        beam.intensity = hlIntensity;
        beam.distance = hlDist;
      }
      for (const m of headlightMats) {
        m.emissiveIntensity = headlights === 2 ? 2.2 : headlights === 1 ? 1.2 : 0.15;
      }
      brakeLightMat.emissiveIntensity = braking ? 2.4 : headlights > 0 ? 0.65 : 0.18;
      reverseLightMat.emissiveIntensity = reversing ? 2.0 : 0;
      const leftOn = blinkOn && (indicators === 'left' || indicators === 'hazard');
      const rightOn = blinkOn && (indicators === 'right' || indicators === 'hazard');
      leftIndMat.emissiveIntensity = leftOn ? 2.2 : 0;
      rightIndMat.emissiveIntensity = rightOn ? 2.2 : 0;
      cabinLight.intensity = cabinOn ? 3.8 : 0.65;
    },
  };
}
