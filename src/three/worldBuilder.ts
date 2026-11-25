import * as THREE from 'three';
import type { CareerRouteSpec, LandmarkType, RouteStopSpec } from '../types/simulator';
import {
  buildCurvedMountainTunnel,
  buildDynamicDhabaComplex,
  buildIndianTrafficVehicle,
  buildNhaiTollPlaza,
  buildPahadiMountainHouse,
  buildRoadLandslideZone,
  createHighDetailAsphaltTexture,
  createSignboardTexture,
  updateDhabaComplex,
  type DhabaComplexData,
  type LandslideZoneData,
  type TollPlazaData,
  type TrafficKind,
} from './sceneryAndTraffic';

export interface PassengerActor {
  mesh: THREE.Group;
  stopIndex: number;
  basePos: THREE.Vector3;
  boarded: boolean;
  boarding: boolean;
  phaseOffset: number;
}

export interface TrafficVehicle {
  mesh: THREE.Group;
  t: number; // 0..1 spline parameter
  speedT: number; // base spline delta per second
  cruiseSpeedMs: number;
  direction: 1 | -1; // 1 = same direction, -1 = oncoming
  laneOffset: number; // lateral offset from center (+right, -left)
  baseLaneOffset: number;
  kind: TrafficKind;
  halfWidth: number;
  halfLength: number;
  brakeLightMat: THREE.MeshStandardMaterial;
  honkYieldTimer: number;
  yieldStopTimer: number;
  currentSpeedMult: number;
  heading: number;
}

export interface StopZoneData {
  stop: RouteStopSpec;
  center: THREE.Vector3;
  tangent: THREE.Vector3;
  bayCenter: THREE.Vector3;
  completed: boolean;
  boardedCount: number;
  beaconRing: THREE.Mesh;
}

export interface HimachalWorldHandle {
  root: THREE.Group;
  curve: THREE.CatmullRomCurve3;
  totalLengthMeters: number;
  roadWidth: number;
  stops: StopZoneData[];
  tolls: TollPlazaData[];
  landslides: LandslideZoneData[];
  dhabas: DhabaComplexData[];
  passengers: PassengerActor[];
  traffic: TrafficVehicle[];
  rainSystem: THREE.Points;
  sampleRoadAt: (pos: THREE.Vector3, hintT?: number) => {
    t: number;
    point: THREE.Vector3;
    tangent: THREE.Vector3;
    right: THREE.Vector3;
    lateralOffset: number;
    slopeRad: number;
    elevationM: number;
  };
  updateWorld: (
    dt: number,
    elapsed: number,
    busPos: THREE.Vector3,
    busHeading: number,
    busSpeedMs: number,
    doorWorldPos: THREE.Vector3,
    hornBlowing: boolean,
    isRaining: boolean,
    nightFactor?: number
  ) => void;
  dispose: () => void;
}

function buildHumanActor(seed: number): THREE.Group {
  const g = new THREE.Group();
  const shirtPalette = [0xe11d48, 0x0284c7, 0xd97706, 0x16a34a, 0x7c3aed, 0xf97316, 0xf43f5e, 0x0d9488];
  const pantPalette = [0x1e293b, 0x334155, 0x451a03, 0x0f172a];
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xc88d65, roughness: 0.78 });
  const shirtMat = new THREE.MeshStandardMaterial({
    color: shirtPalette[seed % shirtPalette.length],
    roughness: 0.85,
  });
  const pantMat = new THREE.MeshStandardMaterial({
    color: pantPalette[seed % pantPalette.length],
    roughness: 0.9,
  });

  const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.76, 8), pantMat);
  leftLeg.position.set(-0.11, 0.38, 0);
  g.add(leftLeg);

  const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.76, 8), pantMat);
  rightLeg.position.set(0.11, 0.38, 0);
  g.add(rightLeg);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.24), shirtMat);
  torso.position.set(0, 1.04, 0);
  torso.castShadow = true;
  g.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 10), skinMat);
  head.position.set(0, 1.52, 0);
  g.add(head);

  if (seed % 2 === 0) {
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.165, 0.165, 0.09, 10),
      new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.8 })
    );
    cap.position.set(0, 1.65, 0);
    g.add(cap);
  }
  const bag = new THREE.Mesh(
    new THREE.BoxGeometry(0.24, 0.32, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 })
  );
  bag.position.set(0.28, 0.72, 0);
  g.add(bag);

  return g;
}

function buildLandmarkStructure(
  type: LandmarkType,
  stop: RouteStopSpec,
  maxAniso: number
): THREE.Group {
  const group = new THREE.Group();

  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.88 });
  const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.65 });
  const blueMetalMat = new THREE.MeshStandardMaterial({ color: 0x0b4fa8, roughness: 0.4, metalness: 0.45 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x7c4a26, roughness: 0.85 });

  if (type === 'bus_stand') {
    const platform = new THREE.Mesh(new THREE.BoxGeometry(16, 0.36, 5.2), concreteMat);
    platform.position.set(0, 0.18, 0);
    platform.receiveShadow = true;
    group.add(platform);

    for (const x of [-6.8, -2.2, 2.2, 6.8]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.8, 10), darkMetalMat);
      post.position.set(x, 2.08, -1.5);
      post.castShadow = true;
      group.add(post);
    }

    const roof = new THREE.Mesh(new THREE.BoxGeometry(16.8, 0.22, 5.6), blueMetalMat);
    roof.position.set(0, 4.02, -0.4);
    roof.rotation.x = 0.12;
    roof.castShadow = true;
    group.add(roof);

    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(14.5, 2.6, 0.28),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.82 })
    );
    backWall.position.set(0, 1.5, -2.1);
    group.add(backWall);

    for (const bx of [-4.2, 0, 4.2]) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.45, 0.65), woodMat);
      bench.position.set(bx, 0.58, -1.25);
      group.add(bench);
    }

    const signTex = createSignboardTexture(
      stop.signageTitle,
      stop.hindiName,
      '#0B4FA8',
      '#FFFFFF',
      '#FACC15',
      maxAniso
    );
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(11.5, 1.4, 0.18),
      new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.4 })
    );
    sign.position.set(0, 4.7, 2.15);
    group.add(sign);
  } else if (type === 'mandir') {
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(11, 1.0, 9.5),
      new THREE.MeshStandardMaterial({ color: 0xe7d3b7, roughness: 0.88 })
    );
    plinth.position.set(0, 0.5, 0);
    group.add(plinth);

    const sanctum = new THREE.Mesh(
      new THREE.BoxGeometry(6.2, 4.2, 6.2),
      new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.78 })
    );
    sanctum.position.set(0, 3.1, -0.5);
    sanctum.castShadow = true;
    group.add(sanctum);

    const shikharaMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.62 });
    for (let tier = 0; tier < 4; tier++) {
      const s = 5.6 - tier * 1.15;
      const tierMesh = new THREE.Mesh(new THREE.BoxGeometry(s, 1.05, s), shikharaMat);
      tierMesh.position.set(0, 5.65 + tier * 1.02, -0.5);
      group.add(tierMesh);
    }

    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.2, metalness: 0.9 });
    const kalash = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 12), goldMat);
    kalash.position.set(0, 9.85, -0.5);
    group.add(kalash);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.0, 8), goldMat);
    pole.position.set(0, 11.2, -0.5);
    group.add(pole);
    const flag = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 1.6, 3),
      new THREE.MeshStandardMaterial({ color: 0xff6b00, roughness: 0.65 })
    );
    flag.rotation.z = -Math.PI / 2;
    flag.position.set(0.8, 12.1, -0.5);
    group.add(flag);

    for (const sx of [-2.4, 2.4]) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 3.6, 10), shikharaMat);
      pillar.position.set(sx, 2.6, 3.6);
      group.add(pillar);
    }
    const archTop = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.65, 0.7), shikharaMat);
    archTop.position.set(0, 4.5, 3.6);
    group.add(archTop);
    const bell = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.42, 10), goldMat);
    bell.position.set(0, 3.9, 3.6);
    group.add(bell);

    const signTex = createSignboardTexture(
      stop.signageTitle,
      stop.hindiName,
      '#9A3412',
      '#FEF3C7',
      '#FACC15',
      maxAniso
    );
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(8.2, 1.15, 0.16),
      new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.4 })
    );
    sign.position.set(0, 5.4, 3.8);
    group.add(sign);
  } else if (type === 'dhaba') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(15.5, 0.28, 7.6), concreteMat);
    base.position.set(0, 0.14, 0);
    group.add(base);

    const mainHall = new THREE.Mesh(
      new THREE.BoxGeometry(11.5, 3.6, 4.6),
      new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.82 })
    );
    mainHall.position.set(0, 1.95, -1.2);
    mainHall.castShadow = true;
    group.add(mainHall);

    const tinRoof = new THREE.Mesh(
      new THREE.BoxGeometry(13.8, 0.2, 6.8),
      new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.6, metalness: 0.35 })
    );
    tinRoof.position.set(0, 3.9, 0.1);
    tinRoof.rotation.x = 0.14;
    group.add(tinRoof);

    for (const cx of [-4.8, -1.6, 1.6, 4.8]) {
      const cot = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.52, 1.05), woodMat);
      cot.position.set(cx, 0.52, 2.35);
      group.add(cot);
      const weave = new THREE.Mesh(
        new THREE.BoxGeometry(1.85, 0.08, 0.85),
        new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.95 })
      );
      weave.position.set(cx, 0.8, 2.35);
      group.add(weave);
    }

    const tandoor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.78, 1.05, 12),
      new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.92 })
    );
    tandoor.position.set(6.2, 0.65, 1.4);
    group.add(tandoor);
    const embers = new THREE.Mesh(
      new THREE.CircleGeometry(0.45, 10),
      new THREE.MeshBasicMaterial({ color: 0xf97316 })
    );
    embers.rotation.x = -Math.PI / 2;
    embers.position.set(6.2, 1.19, 1.4);
    group.add(embers);

    const signTex = createSignboardTexture(
      stop.signageTitle,
      stop.hindiName,
      '#7C2D12',
      '#FFFFFF',
      '#F59E0B',
      maxAniso
    );
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(12.2, 1.45, 0.18),
      new THREE.MeshStandardMaterial({
        map: signTex,
        emissiveMap: signTex,
        emissive: 0xffe4b5,
        emissiveIntensity: 0.45,
        roughness: 0.35,
      })
    );
    sign.position.set(0, 4.75, 2.8);
    group.add(sign);
  } else {
    const shopColors = [0xdbeafe, 0xfef3c7, 0xfce7f3, 0xdcfce7];
    const awningColors = [0xdc2626, 0x0284c7, 0xd97706, 0x16a34a];
    for (let i = 0; i < 4; i++) {
      const sx = -6.0 + i * 4.0;
      const shopH = 3.8 + (i % 2) * 1.4;
      const shop = new THREE.Mesh(
        new THREE.BoxGeometry(3.8, shopH, 4.6),
        new THREE.MeshStandardMaterial({ color: shopColors[i], roughness: 0.82 })
      );
      shop.position.set(sx, shopH / 2, -0.6);
      shop.castShadow = true;
      group.add(shop);

      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(3.2, 1.45, 4),
        new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.65, metalness: 0.3 })
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.set(sx, shopH + 0.72, -0.6);
      group.add(roof);

      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 0.14, 1.65),
        new THREE.MeshStandardMaterial({ color: awningColors[i], roughness: 0.75 })
      );
      awning.position.set(sx, 2.55, 2.25);
      awning.rotation.x = 0.24;
      group.add(awning);

      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 0.8), woodMat);
      crate.position.set(sx, 0.28, 2.3);
      group.add(crate);
    }

    const signTex = createSignboardTexture(
      stop.signageTitle,
      stop.hindiName,
      '#1E293B',
      '#F8FAFC',
      '#38BDF8',
      maxAniso
    );
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(13.2, 1.35, 0.18),
      new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.4 })
    );
    sign.position.set(0, 5.2, 2.1);
    group.add(sign);
  }

  return group;
}

export function buildHimachalMountainWorld(
  route: CareerRouteSpec,
  renderer: THREE.WebGLRenderer
): HimachalWorldHandle {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const root = new THREE.Group();
  const roadWidth = 11.2; // Generous two-lane Indian NH highway for comfortable passing

  // Tunnel & Toll reserved spline intervals (kept gently curved & graded for clean geometry)
  const tunnelRanges: Array<{ start: number; end: number; name: string }> = [
    { start: 0.36, end: 0.405, name: `${route.origin.toUpperCase()} ROCK TUNNEL` },
    { start: 0.68, end: 0.725, name: `${route.destination.toUpperCase()} PASS TUNNEL` },
  ];
  const tollSpecs = [
    {
      id: `${route.id}-toll-1`,
      t: 0.24,
      name: 'SANWARA NHAI TOLL',
      feeInr: 450,
    },
    {
      id: `${route.id}-toll-2`,
      t: 0.79,
      name: `${route.destination.split(' ')[0].toUpperCase()} GHAT TOLL`,
      feeInr: route.splineSeed % 2 === 0 ? 500 : 400,
    },
  ];

  // 1. Construct longer, sweeping 3D Himalayan mountain spline (~4,200m real-scale drive!)
  const controlPoints: THREE.Vector3[] = [];
  const numCtrl = 76;
  const seed = route.splineSeed;
  const climbScale = route.baseClimbRate;

  let curX = 0;
  let curY = 0;
  let curZ = 0;
  let heading = 0;

  for (let i = 0; i < numCtrl; i++) {
    const frac = i / (numCtrl - 1);
    controlPoints.push(new THREE.Vector3(curX, curY, curZ));

    const nearToll = tollSpecs.some((tl) => Math.abs(tl.t - frac) < 0.032);
    const nearTunnel = tunnelRanges.some((tn) => frac >= tn.start - 0.025 && frac <= tn.end + 0.025);
    const nearStop = route.stops.some((s) => Math.abs(s.progressT - frac) < 0.036);

    let turn = 0;
    if (i > 1 && i < numCtrl - 3) {
      const rawTurn =
        Math.sin(i * 0.44 + seed) * 0.34 * route.cliffTightness +
        Math.cos(i * 0.21 + seed * 1.7) * 0.22;
      // Straighten smoothly near toll plazas and gently soften inside tunnels so bore looks authentic
      turn = nearToll ? rawTurn * 0.12 : nearTunnel ? rawTurn * 0.35 : rawTurn;
    }
    heading += turn;
    // Clamp heading tightly so mountain flanks NEVER fold back over adjacent road segments
    heading = THREE.MathUtils.clamp(heading, -1.02, 1.02);

    const stepLen = 56;
    curX += Math.sin(heading) * stepLen;
    curZ += Math.cos(heading) * stepLen;

    const climb = nearStop || nearToll
      ? 0.2
      : nearTunnel
        ? 0.45
        : (1.55 + Math.sin(i * 0.36 + seed) * 0.85) * climbScale;
    curY += Math.max(0.12, climb);
  }

  const curve = new THREE.CatmullRomCurve3(controlPoints, false, 'catmullrom', 0.5);
  const totalLengthMeters = curve.getLength();

  // Pre-sample dense LUT for fast ground projection & mountain road-clearance checking
  const lutCount = 780;
  const lutPoints: THREE.Vector3[] = [];
  const lutTangents: THREE.Vector3[] = [];
  const lutRights: THREE.Vector3[] = [];
  const upVec = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i <= lutCount; i++) {
    const t = i / lutCount;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3().crossVectors(tan, upVec).normalize();
    lutPoints.push(p);
    lutTangents.push(tan);
    lutRights.push(right);
  }

  // 2. Build continuous 3D Ribbon Road Mesh + Mountain Cliff & Valley Skirt Terrain
  const roadSegs = 740;
  const roadPositions: number[] = [];
  const roadUvs: number[] = [];
  const roadIndices: number[] = [];

  const cliffPositions: number[] = [];
  const cliffColors: number[] = [];
  const cliffIndices: number[] = [];

  const valleyPositions: number[] = [];
  const valleyColors: number[] = [];
  const valleyIndices: number[] = [];

  const halfW = roadWidth / 2;
  const leftVec = new THREE.Vector3();

  for (let i = 0; i <= roadSegs; i++) {
    const t = i / roadSegs;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3().crossVectors(tan, upVec).normalize();
    leftVec.copy(right).negate();

    const rLeft = p.clone().addScaledVector(leftVec, halfW);
    const rRight = p.clone().addScaledVector(right, halfW);
    roadPositions.push(rLeft.x, rLeft.y + 0.04, rLeft.z, rRight.x, rRight.y + 0.04, rRight.z);
    roadUvs.push(0, t, 1, t);

    const nearStop = route.stops.some((s) => Math.abs(s.progressT - t) < 0.032);
    const nearDhaba = route.stops.some(
      (s) => s.landmarkType === 'dhaba' && Math.abs(s.progressT - t) < 0.044
    );
    const nearToll = tollSpecs.some((tl) => Math.abs(tl.t - t) < 0.025);
    const inTunnel = tunnelRanges.some((tn) => t >= tn.start - 0.008 && t <= tn.end + 0.008);

    // Uphill terraced mountain cliff on LEFT side (+leftVec)
    // Flatten generously near Dhabas (for full bus parking yard), stops & tolls!
    const shoulderW = nearDhaba ? 24.5 : nearStop || nearToll ? 16.5 : inTunnel ? 8.5 : 4.2;
    const midOut = nearDhaba ? 38 : nearStop || nearToll ? 30 : inTunnel ? 24 : 21;
    const midLift = nearDhaba ? 12 : nearStop || nearToll ? 14 : inTunnel ? 9 : 22 + Math.sin(t * 68) * 5;
    const peakLift = inTunnel ? 28 : 58 + Math.cos(t * 36 + seed) * 16;

    const c0 = p.clone().addScaledVector(leftVec, halfW + 0.1);
    const cliffShoulder = p.clone().addScaledVector(leftVec, halfW + shoulderW);
    const cliffMid = p
      .clone()
      .addScaledVector(leftVec, halfW + midOut)
      .add(new THREE.Vector3(0, midLift, 0));
    const cliffPeak = p
      .clone()
      .addScaledVector(leftVec, halfW + 68)
      .add(new THREE.Vector3(0, peakLift, 0));

    cliffPositions.push(
      c0.x, c0.y - 0.12, c0.z,
      cliffShoulder.x, cliffShoulder.y - 0.14, cliffShoulder.z,
      cliffMid.x, cliffMid.y, cliffMid.z,
      cliffPeak.x, cliffPeak.y, cliffPeak.z
    );
    cliffColors.push(
      0.32, 0.36, 0.27,
      0.28, 0.4, 0.22,
      0.22, 0.34, 0.2,
      0.34, 0.41, 0.37
    );

    // Downhill dramatic Himachal valley slope on RIGHT side (+right)
    const v0 = p.clone().addScaledVector(right, halfW + 0.1);
    const vShoulder = p.clone().addScaledVector(right, halfW + (nearToll ? 7.5 : 3.2));
    const vMid = p.clone().addScaledVector(right, halfW + 32).add(new THREE.Vector3(0, -22, 0));
    const vFloor = p.clone().addScaledVector(right, halfW + 120).add(new THREE.Vector3(0, -64, 0));

    valleyPositions.push(
      v0.x, v0.y - 0.12, v0.z,
      vShoulder.x, vShoulder.y - 0.18, vShoulder.z,
      vMid.x, vMid.y, vMid.z,
      vFloor.x, vFloor.y, vFloor.z
    );
    valleyColors.push(
      0.35, 0.37, 0.31,
      0.26, 0.39, 0.22,
      0.16, 0.3, 0.17,
      0.13, 0.24, 0.2
    );

    if (i < roadSegs) {
      const rIdx = i * 2;
      roadIndices.push(rIdx, rIdx + 1, rIdx + 2, rIdx + 1, rIdx + 3, rIdx + 2);

      const cIdx = i * 4;
      for (let strip = 0; strip < 3; strip++) {
        const a = cIdx + strip;
        const b = cIdx + strip + 1;
        const c = cIdx + 4 + strip;
        const d = cIdx + 4 + strip + 1;
        cliffIndices.push(a, c, b, b, c, d);
        valleyIndices.push(a, b, c, b, d, c);
      }
    }
  }

  // CRITICAL ROAD-CLEARANCE PASS: Guarantee ZERO cliff/valley vertices ever intrude onto the highway!
  const clearRadiusSq = (halfW + 3.4) * (halfW + 3.4);
  const clampTerrainClearance = (positions: number[]) => {
    const numVerts = positions.length / 3;
    for (let v = 0; v < numVerts; v++) {
      // Skip strip-0 edge vertices directly sewn to shoulder
      if (v % 4 === 0) continue;
      const vx = positions[v * 3];
      const vy = positions[v * 3 + 1];
      const vz = positions[v * 3 + 2];
      // Check against sampled road centerline points
      for (let k = 0; k <= lutCount; k += 2) {
        const lp = lutPoints[k];
        const dx = vx - lp.x;
        const dz = vz - lp.z;
        if (dx * dx + dz * dz < clearRadiusSq && vy > lp.y - 0.45) {
          positions[v * 3 + 1] = lp.y - 0.65;
          break;
        }
      }
    }
  };
  clampTerrainClearance(cliffPositions);
  clampTerrainClearance(valleyPositions);

  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
  roadGeo.setIndex(roadIndices);
  roadGeo.computeVertexNormals();

  const roadMat = new THREE.MeshStandardMaterial({
    map: createHighDetailAsphaltTexture(maxAniso, 420),
    roughness: 0.84,
    metalness: 0.04,
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = true;
  root.add(roadMesh);

  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });

  const cliffGeo = new THREE.BufferGeometry();
  cliffGeo.setAttribute('position', new THREE.Float32BufferAttribute(cliffPositions, 3));
  cliffGeo.setAttribute('color', new THREE.Float32BufferAttribute(cliffColors, 3));
  cliffGeo.setIndex(cliffIndices);
  cliffGeo.computeVertexNormals();
  const cliffMesh = new THREE.Mesh(cliffGeo, terrainMat);
  cliffMesh.receiveShadow = true;
  root.add(cliffMesh);

  const valleyGeo = new THREE.BufferGeometry();
  valleyGeo.setAttribute('position', new THREE.Float32BufferAttribute(valleyPositions, 3));
  valleyGeo.setAttribute('color', new THREE.Float32BufferAttribute(valleyColors, 3));
  valleyGeo.setIndex(valleyIndices);
  valleyGeo.computeVertexNormals();
  const valleyMesh = new THREE.Mesh(valleyGeo, terrainMat);
  valleyMesh.receiveShadow = true;
  root.add(valleyMesh);

  // 3. Distant Snow-Capped Himalayan Peaks Horizon Ring (pushed well outside route footprint)
  const peakMat = new THREE.MeshStandardMaterial({ color: 0x4b5c6e, roughness: 0.92 });
  const snowCapMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.68 });
  const midCurvePt = curve.getPointAt(0.5);
  for (let i = 0; i < 28; i++) {
    const angle = (i / 28) * Math.PI * 2;
    const dist = 1650 + (i % 3) * 260;
    const peakH = 290 + (i % 5) * 90;
    const peakR = 240 + (i % 4) * 55;
    const mGroup = new THREE.Group();
    const basePeak = new THREE.Mesh(new THREE.ConeGeometry(peakR, peakH, 6), peakMat);
    basePeak.position.y = peakH * 0.5 - 90;
    mGroup.add(basePeak);

    const snowCap = new THREE.Mesh(new THREE.ConeGeometry(peakR * 0.45, peakH * 0.44, 6), snowCapMat);
    snowCap.position.y = peakH * 0.8 - 90;
    mGroup.add(snowCap);

    mGroup.position.set(
      midCurvePt.x + Math.cos(angle) * dist,
      midCurvePt.y - 30,
      midCurvePt.z + Math.sin(angle) * dist
    );
    root.add(mGroup);
  }

  // 4. Valley-Side Stone Parapet Guard Blocks (InstancedMesh, skipped cleanly inside tunnels & tolls)
  const parapetCount = 460;
  const parapetGeo = new THREE.BoxGeometry(0.55, 0.72, 2.2);
  const parapetMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.92 });
  const parapetInst = new THREE.InstancedMesh(parapetGeo, parapetMat, parapetCount);
  const dummy = new THREE.Object3D();
  let pCountActual = 0;
  for (let i = 0; i < parapetCount; i++) {
    const t = i / (parapetCount - 1);
    const skip =
      tunnelRanges.some((tn) => t >= tn.start - 0.008 && t <= tn.end + 0.008) ||
      tollSpecs.some((tl) => Math.abs(tl.t - t) < 0.015);
    if (skip) continue;
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3().crossVectors(tan, upVec).normalize();
    dummy.position.copy(p).addScaledVector(right, halfW + 0.58);
    dummy.position.y += 0.34;
    dummy.lookAt(dummy.position.clone().add(tan));
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    parapetInst.setMatrixAt(pCountActual++, dummy.matrix);
  }
  parapetInst.count = pCountActual;
  parapetInst.instanceMatrix.needsUpdate = true;
  parapetInst.computeBoundingSphere();
  root.add(parapetInst);

  // 5. Lush Himalayan Alpine Grass Tufts along Shoulders & Slopes (InstancedMesh — fast & crisp!)
  const grassCount = 1100;
  const grassGeo = new THREE.ConeGeometry(0.42, 0.85, 5);
  const grassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 });
  const grassInst = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
  const grassPalette = [
    new THREE.Color(0x2f6b2f),
    new THREE.Color(0x3f7d2f),
    new THREE.Color(0x4d8b31),
    new THREE.Color(0x27592a),
    new THREE.Color(0x658e34),
  ];
  let placedGrass = 0;
  for (let i = 0; i < grassCount; i++) {
    const t = ((i * 0.754877666) % 0.985) + 0.008;
    const inTunnel = tunnelRanges.some((tn) => t >= tn.start - 0.012 && t <= tn.end + 0.012);
    const nearToll = tollSpecs.some((tl) => Math.abs(tl.t - t) < 0.018);
    if (inTunnel || nearToll) continue;

    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3().crossVectors(tan, upVec).normalize();
    const valleySide = i % 2 === 0;
    const nearStop = route.stops.some((s) => Math.abs(s.progressT - t) < 0.032);
    if (!valleySide && nearStop) continue;

    const offsetFromEdge = 1.15 + ((i * 17) % 100) * 0.14;
    const distOut = valleySide ? halfW + offsetFromEdge : -(halfW + offsetFromEdge);
    const yOff = valleySide
      ? -(offsetFromEdge > 3.2 ? (offsetFromEdge - 3.2) * 0.62 : 0.12)
      : offsetFromEdge > 4.2
        ? (offsetFromEdge - 4.2) * 0.75
        : -0.05;
    const sx = 0.75 + ((i * 13) % 10) * 0.1;
    const sy = 0.6 + ((i * 23) % 10) * 0.09;

    dummy.position.copy(p).addScaledVector(right, distOut);
    dummy.position.y += yOff + 0.35 * sy;
    dummy.rotation.set(0, (i * 2.1) % (Math.PI * 2), 0);
    dummy.scale.set(sx, sy, sx);
    dummy.updateMatrix();
    grassInst.setMatrixAt(placedGrass, dummy.matrix);
    grassInst.setColorAt(placedGrass, grassPalette[i % grassPalette.length]);
    placedGrass++;
  }
  grassInst.count = placedGrass;
  grassInst.instanceMatrix.needsUpdate = true;
  if (grassInst.instanceColor) grassInst.instanceColor.needsUpdate = true;
  grassInst.computeBoundingSphere();
  root.add(grassInst);

  // 6. Instanced Himalayan Deodar Cedar / Pine Forests
  const treeCount = 520;
  const trunkGeo = new THREE.CylinderGeometry(0.24, 0.42, 3.6, 6);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.94 });
  const foliageGeo = new THREE.ConeGeometry(2.6, 9.2, 7);
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88 });

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
  const foliageInst = new THREE.InstancedMesh(foliageGeo, foliageMat, treeCount);
  const pinePalette = [
    new THREE.Color(0x164e31),
    new THREE.Color(0x1d5e3a),
    new THREE.Color(0x143f29),
    new THREE.Color(0x23683e),
  ];

  let placedTrees = 0;
  for (let i = 0; i < treeCount; i++) {
    const t = ((i * 0.6180339887) % 0.98) + 0.01;
    const inTunnel = tunnelRanges.some((tn) => t >= tn.start - 0.015 && t <= tn.end + 0.015);
    const nearToll = tollSpecs.some((tl) => Math.abs(tl.t - t) < 0.02);
    if (inTunnel || nearToll) continue;

    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3().crossVectors(tan, upVec).normalize();

    const nearStop = route.stops.some((s) => Math.abs(s.progressT - t) < 0.036);
    const valleySide = i % 2 === 0 || nearStop;
    const distOut = valleySide ? halfW + 9 + (i % 7) * 5.2 : -(halfW + 11.5 + (i % 6) * 5.0);
    const yOffset = valleySide ? -(distOut - halfW) * 0.56 : (Math.abs(distOut) - halfW) * 0.72;
    const s = 0.85 + ((i * 19) % 35) / 100;

    dummy.position.copy(p).addScaledVector(right, distOut);
    dummy.position.y += yOffset + 1.8 * s - 0.6;
    dummy.rotation.set(0, (i * 1.7) % (Math.PI * 2), 0);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(placedTrees, dummy.matrix);

    dummy.position.y += 4.6 * s;
    dummy.updateMatrix();
    foliageInst.setMatrixAt(placedTrees, dummy.matrix);
    foliageInst.setColorAt(placedTrees, pinePalette[i % pinePalette.length]);
    placedTrees++;
  }
  trunkInst.count = placedTrees;
  foliageInst.count = placedTrees;
  trunkInst.instanceMatrix.needsUpdate = true;
  foliageInst.instanceMatrix.needsUpdate = true;
  if (foliageInst.instanceColor) foliageInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  foliageInst.computeBoundingSphere();
  root.add(trunkInst);
  root.add(foliageInst);

  // 7. Authentic Pahadi Mountain Houses perched on safe Himalayan terraces along the route
  for (let h = 0; h < 18; h++) {
    const t = 0.07 + (h / 18) * 0.87;
    const nearStop = route.stops.some((s) => Math.abs(s.progressT - t) < 0.042);
    const inTunnel = tunnelRanges.some((tn) => t >= tn.start - 0.02 && t <= tn.end + 0.02);
    const nearToll = tollSpecs.some((tl) => Math.abs(tl.t - t) < 0.025);
    if (nearStop || inTunnel || nearToll) continue;

    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3().crossVectors(tan, upVec).normalize();
    const left = right.clone().negate();

    const onCliffSide = h % 3 !== 0;
    const house = buildPahadiMountainHouse(h * 13 + seed);
    if (onCliffSide) {
      const distOut = halfW + 12.5 + (h % 3) * 4.5;
      house.position.copy(p).addScaledVector(left, distOut);
      house.position.y += (distOut - halfW - 3.5) * 0.65;
      house.lookAt(p.clone().addScaledVector(right, 8));
    } else {
      const distOut = halfW + 13.0 + (h % 2) * 5.0;
      house.position.copy(p).addScaledVector(right, distOut);
      house.position.y -= (distOut - halfW - 2.5) * 0.45;
      house.lookAt(p.clone().addScaledVector(left, 8));
    }
    root.add(house);
  }

  // 8. Proper Curved Spline-Extruded Hollow Mountain Tunnels (NEVER clip into the road!)
  for (const tn of tunnelRanges) {
    const tunnelMesh = buildCurvedMountainTunnel(
      curve,
      tn.start,
      tn.end,
      roadWidth,
      tn.name,
      maxAniso
    );
    root.add(tunnelMesh);
  }

  // 9. NHAI FASTag Toll Plazas (Career Mode ONLY — deduct ₹400–₹500 per pass!)
  const tolls: TollPlazaData[] = [];
  for (const tl of tollSpecs) {
    const pt = curve.getPointAt(tl.t);
    const tan = curve.getTangentAt(tl.t).normalize();
    const built = buildNhaiTollPlaza(tl.id, tl.name, tl.feeInr, tl.t, pt, tan, roadWidth, maxAniso);
    root.add(built.group);
    tolls.push(built.data);
  }

  // 9b. Random Himalayan Half-Road Landslides (2 zones per route avoiding stops, tunnels, and tolls)
  const landslides: LandslideZoneData[] = [];
  const candidateBands: Array<[number, number, string]> = [
    [0.14, 0.21, 'Kalka-Parwanoo Slope Slide'],
    [0.45, 0.56, 'Mid-Ghat Rockfall Zone'],
    [0.83, 0.89, 'High Pass Boulder Slide'],
  ];
  // Randomly pick 2 out of 3 highway bands + random t inside each band
  const pickedIndices = [0, 1, 2].sort(() => Math.random() - 0.5).slice(0, 2).sort((a, b) => a - b);
  for (const bandIdx of pickedIndices) {
    const [bMin, bMax, label] = candidateBands[bandIdx];
    let chosenT = bMin + Math.random() * (bMax - bMin);
    // Ensure clear separation from stops, tunnels, and toll plazas
    const isBlocked = (tVal: number) =>
      route.stops.some((s) => Math.abs(s.progressT - tVal) < 0.048) ||
      tunnelRanges.some((tn) => tVal >= tn.start - 0.03 && tVal <= tn.end + 0.03) ||
      tollSpecs.some((tl) => Math.abs(tl.t - tVal) < 0.04);
    for (let tries = 0; tries < 8 && isBlocked(chosenT); tries++) {
      chosenT = bMin + ((tries + 0.5) / 8) * (bMax - bMin);
    }
    if (!isBlocked(chosenT)) {
      const pt = curve.getPointAt(chosenT);
      const tan = curve.getTangentAt(chosenT).normalize();
      const builtLs = buildRoadLandslideZone(
        `${route.id}-ls-${bandIdx}`,
        label,
        pt,
        tan,
        roadWidth,
        maxAniso
      );
      root.add(builtLs.group);
      landslides.push(builtLs.data);
    }
  }

  // 10. Route Landmarks (Bus Stands, Dynamic Dhabas with Bus Parking & Traffic, Markets, Mandirs) + Waiting Crowds
  const stops: StopZoneData[] = [];
  const dhabas: DhabaComplexData[] = [];
  const passengers: PassengerActor[] = [];

  route.stops.forEach((stop, stopIdx) => {
    const pt = curve.getPointAt(stop.progressT);
    const tan = curve.getTangentAt(stop.progressT).normalize();
    const right = new THREE.Vector3().crossVectors(tan, upVec).normalize();
    const left = right.clone().negate();

    let bayCenter = pt.clone().addScaledVector(left, halfW * 0.48);

    if (stop.landmarkType === 'dhaba') {
      // Full lively Dhaba Complex with dedicated Bus Parking Bay, crowd & arriving/parking/departing bikes, cars & buses!
      const dhabaData = buildDynamicDhabaComplex(
        stop.id,
        stop.signageTitle,
        stop.hindiName,
        pt,
        tan,
        roadWidth,
        maxAniso
      );
      root.add(dhabaData.group);
      dhabas.push(dhabaData);
      bayCenter = dhabaData.busBayWorldPos.clone();
    } else {
      const landmarkMesh = buildLandmarkStructure(stop.landmarkType, stop, maxAniso);
      const structOffset = stop.landmarkType === 'mandir' ? halfW + 9.2 : halfW + 6.4;
      landmarkMesh.position.copy(pt).addScaledVector(left, structOffset);
      landmarkMesh.lookAt(pt.clone().addScaledVector(right, 8));
      root.add(landmarkMesh);
    }

    const bayMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 14.5),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: stop.landmarkType === 'dhaba' ? 0.2 : 0.28,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      })
    );
    bayMesh.position.copy(bayCenter);
    bayMesh.position.y += 0.09;
    bayMesh.lookAt(bayCenter.clone().add(tan));
    bayMesh.rotateX(-Math.PI / 2);
    root.add(bayMesh);

    const beaconRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.4, 0.12, 10, 28),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.78 })
    );
    beaconRing.position.copy(bayCenter);
    beaconRing.position.y += 0.25;
    beaconRing.rotation.x = Math.PI / 2;
    root.add(beaconRing);

    stops.push({
      stop,
      center: pt,
      tangent: tan,
      bayCenter,
      completed: false,
      boardedCount: 0,
      beaconRing,
    });

    const crowdTotal = Math.max(4, stop.waitingCount + 2);
    for (let pIdx = 0; pIdx < crowdTotal; pIdx++) {
      const actor = buildHumanActor(stopIdx * 31 + pIdx * 7);
      const alongOffset = (pIdx - crowdTotal / 2) * 1.15;
      const basePos =
        stop.landmarkType === 'dhaba'
          ? bayCenter
              .clone()
              .addScaledVector(left, 2.8 + (pIdx % 2) * 1.1)
              .addScaledVector(tan, alongOffset)
          : pt
              .clone()
              .addScaledVector(left, halfW + 1.9 + (pIdx % 2) * 1.1)
              .addScaledVector(tan, alongOffset);
      actor.position.copy(basePos);
      actor.lookAt(bayCenter);
      root.add(actor);

      if (pIdx < stop.waitingCount) {
        passengers.push({
          mesh: actor,
          stopIndex: stopIdx,
          basePos,
          boarded: false,
          boarding: false,
          phaseOffset: pIdx * 0.9,
        });
      }
    }
  });

  // 11. Spawn Realistic Indian Highway Traffic (Swift Cars, Bolero SUVs, Tata Trucks, HRTC Green Buses, Private Coaches)
  const traffic: TrafficVehicle[] = [];
  const trafficPool: TrafficKind[] = [
    'swift_car',
    'hrtc_bus',
    'suv_bolero',
    'private_bus',
    'tata_truck',
    'swift_car',
    'hrtc_bus',
    'suv_bolero',
    'private_bus',
  ];
  const trafficCount = 18;
  for (let i = 0; i < trafficCount; i++) {
    const kind = trafficPool[i % trafficPool.length];
    const direction: 1 | -1 = i % 2 === 0 ? -1 : 1;
    // Indian Left-Hand Driving: forward lane is LEFT (-2.65 along right), oncoming lane is RIGHT (+2.65 along right)
    const baseLaneOffset = direction === 1 ? -2.65 : 2.65;
    const t = 0.06 + (i / trafficCount) * 0.88;
    const built = buildIndianTrafficVehicle(kind, i + seed);
    root.add(built.group);

    const cruiseSpeedMs =
      kind === 'swift_car'
        ? 13.5
        : kind === 'suv_bolero'
          ? 12.2
          : kind === 'private_bus'
            ? 10.0
            : kind === 'hrtc_bus'
              ? 9.4
              : 8.0;

    traffic.push({
      mesh: built.group,
      t,
      speedT: cruiseSpeedMs / totalLengthMeters,
      cruiseSpeedMs,
      direction,
      laneOffset: baseLaneOffset,
      baseLaneOffset,
      kind,
      halfWidth: built.halfWidth,
      halfLength: built.halfLength,
      brakeLightMat: built.brakeLightMat,
      honkYieldTimer: 0,
      yieldStopTimer: 0,
      currentSpeedMult: 1,
      heading: 0,
    });
  }

  // 12. Procedural Monsoon Rain Particle System
  const rainCount = 950;
  const rainPositions = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i++) {
    rainPositions[i * 3] = (Math.random() - 0.5) * 60;
    rainPositions[i * 3 + 1] = Math.random() * 24;
    rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 60;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rainMat = new THREE.PointsMaterial({
    color: 0xcbd5e1,
    size: 0.22,
    transparent: true,
    opacity: 0.65,
  });
  const rainSystem = new THREE.Points(rainGeo, rainMat);
  rainSystem.visible = false;
  rainSystem.frustumCulled = false;
  root.add(rainSystem);

  const _tmpP = new THREE.Vector3();
  const _tmpTan = new THREE.Vector3();
  const _tmpRight = new THREE.Vector3();

  function sampleRoadAt(pos: THREE.Vector3, hintT?: number) {
    let bestIdx = 0;
    let bestDistSq = Infinity;
    const startIdx = hintT !== undefined ? Math.max(0, Math.floor(hintT * lutCount) - 24) : 0;
    const endIdx = hintT !== undefined ? Math.min(lutCount, Math.floor(hintT * lutCount) + 24) : lutCount;

    for (let i = startIdx; i <= endIdx; i++) {
      const lp = lutPoints[i];
      const dx = pos.x - lp.x;
      const dz = pos.z - lp.z;
      const dSq = dx * dx + dz * dz;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = i;
      }
    }

    const t = bestIdx / lutCount;
    const point = lutPoints[bestIdx];
    const tangent = lutTangents[bestIdx];
    const right = lutRights[bestIdx];
    const dx = pos.x - point.x;
    const dz = pos.z - point.z;
    const lateralOffset = dx * right.x + dz * right.z;
    const slopeRad = Math.asin(THREE.MathUtils.clamp(tangent.y, -0.5, 0.5));
    const baseAlt = route.stops[0]?.altitudeM ?? 650;
    const maxAlt = route.maxAltitudeM;
    const elevationM = Math.round(baseAlt + (maxAlt - baseAlt) * t);

    return { t, point, tangent, right, lateralOffset, slopeRad, elevationM };
  }

  function updateWorld(
    dt: number,
    elapsed: number,
    busPos: THREE.Vector3,
    _busHeading: number,
    _busSpeedMs: number,
    doorWorldPos: THREE.Vector3,
    hornBlowing: boolean,
    isRaining: boolean,
    nightFactor = 0
  ) {
    // Animate Dhaba arriving/parking/departing cars, bikes & buses + crowd + night lights
    for (const dh of dhabas) {
      updateDhabaComplex(dh, dt, elapsed, nightFactor);
    }

    // Animate stop beacons
    for (const s of stops) {
      if (!s.completed) {
        s.beaconRing.position.y = s.bayCenter.y + 0.35 + Math.sin(elapsed * 3.0) * 0.14;
      } else {
        s.beaconRing.visible = false;
      }
    }

    // Animate NHAI toll plaza boom barriers
    for (const tl of tolls) {
      const dist = tl.position.distanceTo(busPos);
      const shouldOpen = tl.paid || dist < 19;
      tl.barrierOpenAnim = THREE.MathUtils.damp(tl.barrierOpenAnim, shouldOpen ? 1 : 0, 5.5, dt);
      tl.barrierPivot.rotation.z = tl.barrierOpenAnim * (Math.PI * 0.44);
    }

    // Animate Landslide JCB Beacons & Manual Rock-Clearing Scoop Progress
    for (const ls of landslides) {
      if (ls.cleared) {
        ls.beaconLightMat.color.setHex(0x22c55e);
        ls.jcbBoomPivot.rotation.x = THREE.MathUtils.damp(ls.jcbBoomPivot.rotation.x, 0, 4, dt);
        continue;
      }
      // Flash amber warning beacon on JCB cab
      ls.beaconLightMat.color.setHex(Math.sin(elapsed * 9) > 0 ? 0xfacc15 : 0x78350f);
      if (ls.clearing) {
        ls.clearProgress = Math.min(1, ls.clearProgress + dt / 2.8);
        ls.jcbBoomPivot.rotation.x = -0.35 + Math.sin(elapsed * 7.5) * 0.32;
        const remain = Math.max(0.01, 1 - ls.clearProgress);
        ls.debrisGroup.scale.set(1, remain, 1);
        ls.debrisGroup.position.y = -ls.clearProgress * 0.85;
        if (ls.clearProgress >= 1) {
          ls.cleared = true;
          ls.clearing = false;
          ls.debrisGroup.visible = false;
        }
      }
    }

    // Animate waiting & boarding 3D crowd passengers
    for (const p of passengers) {
      if (p.boarded) continue;
      if (p.boarding) {
        p.mesh.position.lerp(doorWorldPos, Math.min(1, dt * 3.4));
        p.mesh.position.y = doorWorldPos.y + Math.abs(Math.sin(elapsed * 10 + p.phaseOffset)) * 0.12;
        p.mesh.lookAt(doorWorldPos);
        if (p.mesh.position.distanceTo(doorWorldPos) < 0.75) {
          p.boarded = true;
          p.mesh.visible = false;
        }
      } else {
        p.mesh.position.y = p.basePos.y + Math.abs(Math.sin(elapsed * 2.1 + p.phaseOffset)) * 0.04;
      }
    }

    // Intelligent Indian Traffic AI:
    // - Passes normally at full speed when there is enough lateral room (NO horn required!)
    // - When space is tight, smoothly steers toward its outer shoulder AND stops politely for a moment to let the bus pass
    // - Optional player horn simply encourages nearby vehicles to hug their shoulder slightly earlier
    const busHalfW = 1.28;
    for (let i = 0; i < traffic.length; i++) {
      const v = traffic[i];
      curve.getPointAt(v.t, _tmpP);
      curve.getTangentAt(v.t, _tmpTan).normalize();
      _tmpRight.crossVectors(_tmpTan, upVec).normalize();

      // Compute relative position of bus in this vehicle's road frame
      const relX = busPos.x - v.mesh.position.x;
      const relZ = busPos.z - v.mesh.position.z;
      const forwardSign = v.direction;
      const longAhead = (relX * _tmpTan.x + relZ * _tmpTan.z) * forwardSign;
      const latDelta = Math.abs(relX * _tmpRight.x + relZ * _tmpRight.z);
      const latClearance = latDelta - (busHalfW + v.halfWidth);

      let targetSpeedMult = 1.0;
      let targetLaneOffset = v.baseLaneOffset;
      let braking = false;

      // Check if bus is ahead or alongside within 34m
      const inEncounterZone = longAhead > -v.halfLength - 5.2 && longAhead < 34;
      if (inEncounterZone) {
        if (latClearance > 0.65) {
          // Plenty of room! Pass smoothly without stopping or needing any horn
          targetSpeedMult = 1.0;
          targetLaneOffset = v.baseLaneOffset;
        } else if (longAhead > 0) {
          // Tight squeeze ahead — pull politely toward outer shoulder & stop to yield right-of-way!
          const shoulderDir = v.direction === -1 ? 1 : -1;
          const maxShoulder = halfW - v.halfWidth - 0.35;
          targetLaneOffset = shoulderDir * Math.min(maxShoulder, Math.abs(v.baseLaneOffset) + 1.35);

          if (longAhead < 24) {
            targetSpeedMult = 0.0;
            braking = true;
            v.yieldStopTimer = 1.1;
          } else {
            targetSpeedMult = 0.32;
            braking = true;
          }
        }
      } else if (v.yieldStopTimer > 0) {
        v.yieldStopTimer = Math.max(0, v.yieldStopTimer - dt);
        targetSpeedMult = 0.25;
      }

      // Landslide bottleneck traffic behavior: traffic slows/queues around uncleared half-road debris!
      for (const ls of landslides) {
        if (ls.cleared) continue;
        const ldx = v.mesh.position.x - ls.position.x;
        const ldz = v.mesh.position.z - ls.position.z;
        const distLs = Math.hypot(ldx, ldz);
        if (distLs < 36) {
          const alongLs = ldx * ls.tangent.x + ldz * ls.tangent.z;
          const approaching = v.direction === 1 ? alongLs < 10 && alongLs > -34 : alongLs > -10 && alongLs < 34;
          if (approaching) {
            if (v.direction === 1) {
              // Forward lane is blocked by boulders — wait or carefully merge onto open right half (+2.35)
              const busNearLs = busPos.distanceTo(ls.position) < 28;
              if (busNearLs && alongLs < -6) {
                targetSpeedMult = 0.0;
                braking = true;
              } else {
                targetLaneOffset = 2.35;
                targetSpeedMult = Math.min(targetSpeedMult, 0.34);
                braking = true;
              }
            } else {
              // Oncoming vehicle on open half-lane slows cautiously past landslide & yields if bus is squeezing past
              const busNearLs = busPos.distanceTo(ls.position) < 24;
              targetLaneOffset = 3.15;
              targetSpeedMult = Math.min(targetSpeedMult, busNearLs && alongLs > 8 ? 0.0 : 0.42);
              braking = true;
            }
          }
        }
      }

      // Optional player horn courtesy nudge (never required, never slows player bus)
      if (hornBlowing && Math.hypot(relX, relZ) < 32) {
        v.honkYieldTimer = 2.0;
      }
      if (v.honkYieldTimer > 0) {
        v.honkYieldTimer = Math.max(0, v.honkYieldTimer - dt);
        const shoulderDir = v.direction === -1 ? 1 : -1;
        const maxShoulder = halfW - v.halfWidth - 0.32;
        targetLaneOffset = shoulderDir * Math.min(maxShoulder, Math.abs(v.baseLaneOffset) + 1.4);
      }

      // Keep safe following distance behind other same-direction AI vehicles
      for (let j = 0; j < traffic.length; j++) {
        if (i === j || traffic[j].direction !== v.direction) continue;
        const other = traffic[j];
        const dtSpline = (other.t - v.t) * v.direction;
        if (dtSpline > 0 && dtSpline * totalLengthMeters < v.halfLength + other.halfLength + 10) {
          targetSpeedMult = Math.min(targetSpeedMult, 0.15);
          braking = true;
          break;
        }
      }

      v.currentSpeedMult = THREE.MathUtils.damp(v.currentSpeedMult, targetSpeedMult, braking ? 7.5 : 3.6, dt);
      v.laneOffset = THREE.MathUtils.damp(v.laneOffset, targetLaneOffset, 3.8, dt);
      v.brakeLightMat.emissiveIntensity = braking || v.currentSpeedMult < 0.25 ? 2.4 : 0.35;

      v.t += v.direction * v.speedT * v.currentSpeedMult * dt;
      if (v.t > 0.96) v.t = 0.04;
      if (v.t < 0.04) v.t = 0.96;

      curve.getPointAt(v.t, _tmpP);
      curve.getTangentAt(v.t, _tmpTan).normalize();
      _tmpRight.crossVectors(_tmpTan, upVec).normalize();

      v.mesh.position.copy(_tmpP).addScaledVector(_tmpRight, v.laneOffset);
      v.mesh.position.y += 0.05;
      const lookDirX = _tmpTan.x * v.direction;
      const lookDirZ = _tmpTan.z * v.direction;
      v.heading = Math.atan2(lookDirX, lookDirZ);
      v.mesh.lookAt(
        v.mesh.position.x + lookDirX,
        v.mesh.position.y + _tmpTan.y * v.direction,
        v.mesh.position.z + lookDirZ
      );
    }

    // Monsoon rain particles follow bus
    rainSystem.visible = isRaining;
    if (isRaining) {
      rainSystem.position.set(busPos.x, busPos.y, busPos.z);
      const posAttr = rainSystem.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < rainCount; i++) {
        let y = posAttr.getY(i) - dt * 28;
        if (y < -2) y = 22;
        posAttr.setY(i, y);
      }
      posAttr.needsUpdate = true;
    }
  }

  function dispose() {
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh || obj instanceof THREE.Points) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) {
          obj.material.forEach((m) => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
    });
  }

  return {
    root,
    curve,
    totalLengthMeters,
    roadWidth,
    stops,
    tolls,
    landslides,
    dhabas,
    passengers,
    traffic,
    rainSystem,
    sampleRoadAt,
    updateWorld,
    dispose,
  };
}
