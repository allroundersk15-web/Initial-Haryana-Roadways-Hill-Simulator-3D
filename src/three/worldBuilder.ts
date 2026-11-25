import * as THREE from 'three';
import type { CareerRouteSpec, LandmarkType, RouteStopSpec } from '../types/simulator';

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
  speedT: number; // spline delta per second
  direction: 1 | -1; // 1 = same direction, -1 = oncoming
  laneOffset: number; // lateral offset from center
  baseLaneOffset: number;
  kind: 'truck' | 'hrtc_bus' | 'taxi';
  honkYieldTimer: number;
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
    doorWorldPos: THREE.Vector3,
    hornBlowing: boolean,
    isRaining: boolean
  ) => void;
  dispose: () => void;
}

function createRoadAsphaltTexture(maxAniso: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Weathered Himalayan asphalt base
  ctx.fillStyle = '#2d343d';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle gravel grain
  for (let i = 0; i < 4200; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 34 + Math.floor(Math.random() * 34);
    ctx.fillStyle = `rgb(${v},${v + 3},${v + 7})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // White edge shoulder markings
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(22, 0, 12, 512);
  ctx.fillRect(478, 0, 12, 512);

  // Indian highway dashed yellow center divider
  ctx.fillStyle = '#facc15';
  for (let y = 0; y < 512; y += 96) {
    ctx.fillRect(250, y, 12, 54);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 220);
  tex.anisotropy = maxAniso;
  return tex;
}

function createSignboardTexture(
  title: string,
  subtitle: string,
  bgColor: string,
  textColor: string,
  borderColor: string,
  maxAniso: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, 1024, 256);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 14;
  ctx.strokeRect(10, 10, 1004, 236);

  ctx.fillStyle = textColor;
  ctx.font = '800 44px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title.slice(0, 38), 512, 118);

  ctx.fillStyle = borderColor;
  ctx.font = '700 32px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(subtitle.slice(0, 42), 512, 186);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  return tex;
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

  // Grounded bottom-center at y = 0
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

  // Small shoulder duffel bag or Himachali cap on half the crowd
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
    // Concrete waiting platform
    const platform = new THREE.Mesh(new THREE.BoxGeometry(16, 0.36, 5.2), concreteMat);
    platform.position.set(0, 0.18, 0);
    platform.receiveShadow = true;
    group.add(platform);

    // Steel columns
    for (const x of [-6.8, -2.2, 2.2, 6.8]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.8, 10), darkMetalMat);
      post.position.set(x, 2.08, -1.5);
      post.castShadow = true;
      group.add(post);
    }

    // Sloped Haryana / Himachal Interstate canopy roof
    const roof = new THREE.Mesh(new THREE.BoxGeometry(16.8, 0.22, 5.6), blueMetalMat);
    roof.position.set(0, 4.02, -0.4);
    roof.rotation.x = 0.12;
    roof.castShadow = true;
    group.add(roof);

    // Back timetable wall
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(14.5, 2.6, 0.28),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.82 })
    );
    backWall.position.set(0, 1.5, -2.1);
    group.add(backWall);

    // Waiting benches
    for (const bx of [-4.2, 0, 4.2]) {
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.45, 0.65), woodMat);
      bench.position.set(bx, 0.58, -1.25);
      group.add(bench);
    }

    // Illuminated Bus Stand Signboard
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
    // Authentic Pahadi Himachal Temple (Shikhara + Saffron Flags + Bell Archway)
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

    // Stepped Shikhara spire
    const shikharaMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.62 });
    for (let tier = 0; tier < 4; tier++) {
      const s = 5.6 - tier * 1.15;
      const tierMesh = new THREE.Mesh(new THREE.BoxGeometry(s, 1.05, s), shikharaMat);
      tierMesh.position.set(0, 5.65 + tier * 1.02, -0.5);
      group.add(tierMesh);
    }

    // Golden Kalash finial
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.2, metalness: 0.9 });
    const kalash = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 12), goldMat);
    kalash.position.set(0, 9.85, -0.5);
    group.add(kalash);

    // Saffron Dhwaja flagpole + triangular banner
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

    // Entrance Torana Arch & Hanging Brass Bell
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
    // Authentic Punjabi / Himachal Highway Dhaba with Charpais & Glowing Tandoor
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

    // Corrugated tin sloped veranda roof
    const tinRoof = new THREE.Mesh(
      new THREE.BoxGeometry(13.8, 0.2, 6.8),
      new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.6, metalness: 0.35 })
    );
    tinRoof.position.set(0, 3.9, 0.1);
    tinRoof.rotation.x = 0.14;
    group.add(tinRoof);

    // Outdoor wooden Charpais (cots) & tables
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

    // Glowing Clay Tandoor Pit
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
    // Colorful Pahadi Hill Market (Bazaar row of 4 terraced shops with awnings)
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

      // Pitched Pahadi tin roof
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(3.2, 1.45, 4),
        new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.65, metalness: 0.3 })
      );
      roof.rotation.y = Math.PI / 4;
      roof.position.set(sx, shopH + 0.72, -0.6);
      group.add(roof);

      // Striped front awning
      const awning = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 0.14, 1.65),
        new THREE.MeshStandardMaterial({ color: awningColors[i], roughness: 0.75 })
      );
      awning.position.set(sx, 2.55, 2.25);
      awning.rotation.x = 0.24;
      group.add(awning);

      // Display fruit/apple crates
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

function buildTrafficVehicle(kind: 'truck' | 'hrtc_bus' | 'taxi'): THREE.Group {
  const g = new THREE.Group();
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.15, metalness: 0.5 });

  const addWheel = (x: number, y: number, z: number, r = 0.42) => {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.28, 12), wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, y, z);
    g.add(w);
  };

  if (kind === 'truck') {
    // Colorful Indian Cargo Truck (Tata 1613 style)
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(2.35, 2.25, 2.1),
      new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.45, metalness: 0.25 })
    );
    cab.position.set(0, 1.65, 2.5);
    cab.castShadow = true;
    g.add(cab);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.72, 0.1), glassMat);
    windshield.position.set(0, 2.05, 3.54);
    g.add(windshield);

    const cargo = new THREE.Mesh(
      new THREE.BoxGeometry(2.42, 2.35, 5.1),
      new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.8 })
    );
    cargo.position.set(0, 1.85, -1.25);
    cargo.castShadow = true;
    g.add(cargo);

    // Yellow rear "HORN OK PLEASE" plank
    const rearPlank = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 0.52, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 })
    );
    rearPlank.position.set(0, 1.15, -3.82);
    g.add(rearPlank);

    addWheel(-1.12, 0.46, 2.3, 0.46);
    addWheel(1.12, 0.46, 2.3, 0.46);
    addWheel(-1.12, 0.46, -2.2, 0.46);
    addWheel(1.12, 0.46, -2.2, 0.46);
  } else if (kind === 'hrtc_bus') {
    // Himachal Road Transport Corporation (HRTC) Green-White Hill Bus
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.42, 2.45, 9.6),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.38, metalness: 0.2 })
    );
    body.position.set(0, 1.82, 0);
    body.castShadow = true;
    g.add(body);

    const greenBand = new THREE.Mesh(
      new THREE.BoxGeometry(2.46, 0.92, 9.62),
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.42 })
    );
    greenBand.position.set(0, 1.25, 0);
    g.add(greenBand);

    const glassBand = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.82, 8.8), glassMat);
    glassBand.position.set(0, 2.28, 0.1);
    g.add(glassBand);

    addWheel(-1.14, 0.48, 2.9, 0.48);
    addWheel(1.14, 0.48, 2.9, 0.48);
    addWheel(-1.14, 0.48, -2.8, 0.48);
    addWheel(1.14, 0.48, -2.8, 0.48);
  } else {
    // White Himachal Hill SUV / Taxi (Innova / Bolero)
    const lower = new THREE.Mesh(
      new THREE.BoxGeometry(1.86, 0.85, 4.45),
      new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.3, metalness: 0.35 })
    );
    lower.position.set(0, 0.84, 0);
    lower.castShadow = true;
    g.add(lower);

    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.68, 0.72, 2.55),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35 })
    );
    cabin.position.set(0, 1.56, -0.18);
    g.add(cabin);

    const cabinGlass = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.56, 2.25), glassMat);
    cabinGlass.position.set(0, 1.56, -0.18);
    g.add(cabinGlass);

    // Yellow commercial taxi plate
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.16, 0.08),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 })
    );
    plate.position.set(0, 0.62, 2.24);
    g.add(plate);

    addWheel(-0.9, 0.36, 1.35, 0.36);
    addWheel(0.9, 0.36, 1.35, 0.36);
    addWheel(-0.9, 0.36, -1.35, 0.36);
    addWheel(0.9, 0.36, -1.35, 0.36);
  }

  // Headlights & Taillights
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xfef9c3 });
  const tlMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const frontZ = kind === 'hrtc_bus' ? 4.82 : kind === 'truck' ? 3.56 : 2.24;
  const backZ = kind === 'hrtc_bus' ? -4.82 : kind === 'truck' ? -3.82 : -2.24;
  const halfW = kind === 'taxi' ? 0.68 : 0.92;
  for (const sx of [-halfW, halfW]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.16, 0.06), hlMat);
    hl.position.set(sx, 0.88, frontZ);
    g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.06), tlMat);
    tl.position.set(sx, 0.92, backZ);
    g.add(tl);
  }

  return g;
}

export function buildHimachalMountainWorld(
  route: CareerRouteSpec,
  renderer: THREE.WebGLRenderer
): HimachalWorldHandle {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const root = new THREE.Group();
  const roadWidth = 10.6; // Authentic two-lane Himachal mountain highway

  // 1. Construct sweeping 3D Himalayan mountain spline (~2,200m scaled real drive with hairpins & climbs)
  const controlPoints: THREE.Vector3[] = [];
  const numCtrl = 46;
  const seed = route.splineSeed;
  const climbScale = route.baseClimbRate;

  let curX = 0;
  let curY = 0;
  let curZ = 0;
  let heading = 0;

  for (let i = 0; i < numCtrl; i++) {
    const frac = i / (numCtrl - 1);
    controlPoints.push(new THREE.Vector3(curX, curY, curZ));

    // Keep first 2 and last 2 segments straight for smooth depot start/finish
    let turn = 0;
    if (i > 1 && i < numCtrl - 3) {
      turn =
        Math.sin(i * 0.58 + seed) * 0.42 * route.cliffTightness +
        Math.cos(i * 0.27 + seed * 1.7) * 0.28;
    }
    heading += turn;
    // Clamp heading so road never loops back on itself
    heading = THREE.MathUtils.clamp(heading, -1.18, 1.18);

    const stepLen = 52;
    curX += Math.sin(heading) * stepLen;
    curZ += Math.cos(heading) * stepLen;

    // Gradual Himachal ascent with gentle flats around stops
    const nearStop = route.stops.some((s) => Math.abs(s.progressT - frac) < 0.055);
    const climb = nearStop ? 0.35 : (1.7 + Math.sin(i * 0.4 + seed) * 0.95) * climbScale;
    curY += Math.max(0.15, climb);
  }

  const curve = new THREE.CatmullRomCurve3(controlPoints, false, 'catmullrom', 0.5);
  const totalLengthMeters = curve.getLength();

  // Pre-sample dense LUT for O(1)-ish fast ground & road projection
  const lutCount = 440;
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
  const roadSegs = 420;
  const roadPositions: number[] = [];
  const roadUvs: number[] = [];
  const roadIndices: number[] = [];

  // Terrain skirt: uphill rock cliff on -right (inner mountain), downhill valley drop on +right (outer valley)
  // Wait: in India left-hand drive, curb is +X (left of travel). Let's make LEFT (+left = -right) the cliff/stop terrace side, and RIGHT (+right) the scenic Himalayan valley vista!
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

    // Road left/right edge vertices (offset +0.02 above terrain skirt to avoid Z-fighting)
    const rLeft = p.clone().addScaledVector(leftVec, halfW);
    const rRight = p.clone().addScaledVector(right, halfW);
    roadPositions.push(rLeft.x, rLeft.y + 0.04, rLeft.z, rRight.x, rRight.y + 0.04, rRight.z);
    roadUvs.push(0, t, 1, t);

    // Uphill terraced mountain cliff on LEFT side (carves gently flat near stops so buildings sit flush!)
    const nearStop = route.stops.some((s) => Math.abs(s.progressT - t) < 0.045);
    const cliffShoulder = p.clone().addScaledVector(leftVec, halfW + (nearStop ? 15 : 3.2));
    const cliffMid = p
      .clone()
      .addScaledVector(leftVec, halfW + (nearStop ? 28 : 22))
      .add(new THREE.Vector3(0, nearStop ? 14 : 24 + Math.sin(t * 48) * 6, 0));
    const cliffPeak = p
      .clone()
      .addScaledVector(leftVec, halfW + 78)
      .add(new THREE.Vector3(0, 62 + Math.cos(t * 25 + seed) * 18, 0));

    // Shoulder base slightly below road
    const c0 = p.clone().addScaledVector(leftVec, halfW - 0.2);
    cliffPositions.push(
      c0.x, c0.y - 0.04, c0.z,
      cliffShoulder.x, cliffShoulder.y - 0.08, cliffShoulder.z,
      cliffMid.x, cliffMid.y, cliffMid.z,
      cliffPeak.x, cliffPeak.y, cliffPeak.z
    );
    // Vertex colors: earthy shoulder -> mossy slate rock -> lush alpine pine -> misty stone
    cliffColors.push(
      0.34, 0.35, 0.31,
      0.32, 0.36, 0.26,
      0.24, 0.33, 0.22,
      0.34, 0.4, 0.38
    );

    // Downhill dramatic Himachal valley slope on RIGHT side
    const v0 = p.clone().addScaledVector(right, halfW - 0.2);
    const vShoulder = p.clone().addScaledVector(right, halfW + 2.8);
    const vMid = p.clone().addScaledVector(right, halfW + 34).add(new THREE.Vector3(0, -24, 0));
    const vFloor = p.clone().addScaledVector(right, halfW + 135).add(new THREE.Vector3(0, -68, 0));

    valleyPositions.push(
      v0.x, v0.y - 0.04, v0.z,
      vShoulder.x, vShoulder.y - 0.14, vShoulder.z,
      vMid.x, vMid.y, vMid.z,
      vFloor.x, vFloor.y, vFloor.z
    );
    valleyColors.push(
      0.36, 0.36, 0.34,
      0.28, 0.36, 0.24,
      0.16, 0.28, 0.17,
      0.14, 0.24, 0.2
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

  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
  roadGeo.setIndex(roadIndices);
  roadGeo.computeVertexNormals();

  const roadMat = new THREE.MeshStandardMaterial({
    map: createRoadAsphaltTexture(maxAniso),
    roughness: 0.86,
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

  // 3. Distant Snow-Capped Himalayan Mountain Peaks Ring (Natural Outdoor Horizon)
  const peakMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.92 });
  const snowCapMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.72 });
  const midCurvePt = curve.getPointAt(0.5);
  for (let i = 0; i < 24; i++) {
    const angle = (i / 24) * Math.PI * 2;
    const dist = 780 + (i % 3) * 180;
    const peakH = 220 + (i % 5) * 75;
    const peakR = 175 + (i % 4) * 45;
    const mGroup = new THREE.Group();
    const basePeak = new THREE.Mesh(new THREE.ConeGeometry(peakR, peakH, 6), peakMat);
    basePeak.position.y = peakH * 0.5 - 80;
    mGroup.add(basePeak);

    const snowCap = new THREE.Mesh(new THREE.ConeGeometry(peakR * 0.44, peakH * 0.42, 6), snowCapMat);
    snowCap.position.y = peakH * 0.8 - 80;
    mGroup.add(snowCap);

    mGroup.position.set(
      midCurvePt.x + Math.cos(angle) * dist,
      midCurvePt.y - 30,
      midCurvePt.z + Math.sin(angle) * dist
    );
    root.add(mGroup);
  }

  // 4. Valley-Side Stone Parapet Guard Blocks & Red-White Hairpin Posts (InstancedMesh)
  const parapetCount = 260;
  const parapetGeo = new THREE.BoxGeometry(0.55, 0.72, 2.2);
  const parapetMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.92 });
  const parapetInst = new THREE.InstancedMesh(parapetGeo, parapetMat, parapetCount);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < parapetCount; i++) {
    const t = i / (parapetCount - 1);
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3().crossVectors(tan, upVec).normalize();
    dummy.position.copy(p).addScaledVector(right, halfW + 0.55);
    dummy.position.y += 0.34;
    dummy.lookAt(dummy.position.clone().add(tan));
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    parapetInst.setMatrixAt(i, dummy.matrix);
  }
  parapetInst.instanceMatrix.needsUpdate = true;
  parapetInst.computeBoundingSphere();
  root.add(parapetInst);

  // 5. Instanced Himalayan Deodar Cedar / Pine Forests (Trunk + 2 Foliage Cones)
  const treeCount = 340;
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
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3().crossVectors(tan, upVec).normalize();

    const nearStop = route.stops.some((s) => Math.abs(s.progressT - t) < 0.042);
    const valleySide = i % 2 === 0 || nearStop;
    const distOut = valleySide ? halfW + 8 + (i % 7) * 5.5 : -(halfW + 10 + (i % 6) * 5.2);
    const yOffset = valleySide ? -(distOut - halfW) * 0.55 : (Math.abs(distOut) - halfW) * 0.68;
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
  trunkInst.instanceMatrix.needsUpdate = true;
  foliageInst.instanceMatrix.needsUpdate = true;
  if (foliageInst.instanceColor) foliageInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  foliageInst.computeBoundingSphere();
  root.add(trunkInst);
  root.add(foliageInst);

  // 6. Iconic Rock-Cut Mountain Tunnel (Barog / Aut style at t = 0.61)
  const tunnelT = 0.61;
  const tunnelPos = curve.getPointAt(tunnelT);
  const tunnelTan = curve.getTangentAt(tunnelT).normalize();
  const tunnelGroup = new THREE.Group();
  tunnelGroup.position.copy(tunnelPos);
  tunnelGroup.lookAt(tunnelPos.clone().add(tunnelTan));

  const tunnelArchMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.92,
    side: THREE.DoubleSide,
  });
  const tunnelCylinder = new THREE.Mesh(
    new THREE.CylinderGeometry(7.2, 7.2, 42, 16, 1, true, 0, Math.PI),
    tunnelArchMat
  );
  tunnelCylinder.rotation.z = Math.PI / 2;
  tunnelCylinder.rotation.y = Math.PI / 2;
  tunnelCylinder.position.y = 0.2;
  tunnelGroup.add(tunnelCylinder);

  // Warm orange tunnel overhead lamps
  for (let lz = -16; lz <= 16; lz += 8) {
    const lamp = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.14, 0.35),
      new THREE.MeshBasicMaterial({ color: 0xfdba74 })
    );
    lamp.position.set(0, 6.7, lz);
    tunnelGroup.add(lamp);
  }
  root.add(tunnelGroup);

  // 7. Route Landmarks (Bus Stands, Dhabas, Markets, Pahadi Mandirs) + Waiting Crowds + Stop Bays
  const stops: StopZoneData[] = [];
  const passengers: PassengerActor[] = [];

  route.stops.forEach((stop, stopIdx) => {
    const pt = curve.getPointAt(stop.progressT);
    const tan = curve.getTangentAt(stop.progressT).normalize();
    const right = new THREE.Vector3().crossVectors(tan, upVec).normalize();
    const left = right.clone().negate();

    // Place landmark cleanly on the Indian LEFT curb side (+left) facing the highway
    const landmarkMesh = buildLandmarkStructure(stop.landmarkType, stop, maxAniso);
    const structOffset = stop.landmarkType === 'mandir' ? halfW + 9.2 : halfW + 6.4;
    landmarkMesh.position.copy(pt).addScaledVector(left, structOffset);
    landmarkMesh.lookAt(pt.clone().addScaledVector(right, 8));
    root.add(landmarkMesh);

    // Painted Yellow Stop Bay on the Indian Left Lane
    const bayCenter = pt.clone().addScaledVector(left, halfW * 0.48);
    const bayMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 14.5),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      })
    );
    bayMesh.position.copy(bayCenter);
    bayMesh.position.y += 0.08;
    bayMesh.lookAt(bayCenter.clone().add(tan));
    bayMesh.rotateX(-Math.PI / 2);
    root.add(bayMesh);

    // Crisp Glowing Checkpoint Halo Ring over Stop Bay
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

    // Spawn 3D Public Crowd waiting near the curb at this stop
    const crowdTotal = Math.max(4, stop.waitingCount + 2);
    for (let pIdx = 0; pIdx < crowdTotal; pIdx++) {
      const actor = buildHumanActor(stopIdx * 31 + pIdx * 7);
      const alongOffset = (pIdx - crowdTotal / 2) * 1.15;
      const curbDist = halfW + 1.9 + (pIdx % 2) * 1.1;
      const basePos = pt
        .clone()
        .addScaledVector(left, curbDist)
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

  // 8. Spawn Multi-Part AI Mountain Traffic (Trucks, HRTC Buses, Hill Taxis)
  const traffic: TrafficVehicle[] = [];
  const trafficKinds: Array<'truck' | 'hrtc_bus' | 'taxi'> = ['truck', 'taxi', 'hrtc_bus', 'taxi', 'truck'];
  const trafficCount = 12;
  for (let i = 0; i < trafficCount; i++) {
    const kind = trafficKinds[i % trafficKinds.length];
    const direction: 1 | -1 = i % 2 === 0 ? -1 : 1; // Half oncoming in right lane, half same-dir in left lane
    // Indian Left-Hand Driving: forward lane is LEFT (-rightOffset), oncoming lane is RIGHT (+rightOffset)
    const baseLaneOffset = direction === 1 ? -2.55 : 2.55;
    const t = 0.08 + (i / trafficCount) * 0.84;
    const mesh = buildTrafficVehicle(kind);
    root.add(mesh);

    traffic.push({
      mesh,
      t,
      speedT: (kind === 'taxi' ? 11.5 : kind === 'hrtc_bus' ? 8.8 : 7.4) / totalLengthMeters,
      direction,
      laneOffset: baseLaneOffset,
      baseLaneOffset,
      kind,
      honkYieldTimer: 0,
    });
  }

  // 9. Procedural Monsoon Rain Particle System (toggled in Rain weather)
  const rainCount = 900;
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
    const startIdx = hintT !== undefined ? Math.max(0, Math.floor(hintT * lutCount) - 18) : 0;
    const endIdx = hintT !== undefined ? Math.min(lutCount, Math.floor(hintT * lutCount) + 18) : lutCount;

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
    doorWorldPos: THREE.Vector3,
    hornBlowing: boolean,
    isRaining: boolean
  ) {
    // Animate stop beacons
    for (const s of stops) {
      if (!s.completed) {
        s.beaconRing.position.y = s.bayCenter.y + 0.35 + Math.sin(elapsed * 3.0) * 0.14;
      } else {
        s.beaconRing.visible = false;
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
        // Gentle idle weight-shift / wave at bus stand
        p.mesh.position.y = p.basePos.y + Math.abs(Math.sin(elapsed * 2.1 + p.phaseOffset)) * 0.04;
      }
    }

    // Update AI Mountain Traffic along spline lanes
    for (const v of traffic) {
      let speedMult = 1.0;
      const distToBus = v.mesh.position.distanceTo(busPos);
      if (distToBus < 19) {
        speedMult = distToBus < 11 ? 0.18 : 0.55;
        if (hornBlowing) {
          v.honkYieldTimer = 2.4;
        }
      }
      if (v.honkYieldTimer > 0) {
        v.honkYieldTimer = Math.max(0, v.honkYieldTimer - dt);
        const yieldTarget = v.baseLaneOffset + (v.direction === -1 ? 1.15 : -0.85);
        v.laneOffset = THREE.MathUtils.damp(v.laneOffset, yieldTarget, 4, dt);
      } else {
        v.laneOffset = THREE.MathUtils.damp(v.laneOffset, v.baseLaneOffset, 2.5, dt);
      }

      v.t += v.direction * v.speedT * speedMult * dt;
      if (v.t > 0.96) v.t = 0.04;
      if (v.t < 0.04) v.t = 0.96;

      curve.getPointAt(v.t, _tmpP);
      curve.getTangentAt(v.t, _tmpTan).normalize();
      _tmpRight.crossVectors(_tmpTan, upVec).normalize();

      v.mesh.position.copy(_tmpP).addScaledVector(_tmpRight, v.laneOffset);
      v.mesh.position.y += 0.05;
      const lookDir = _tmpTan.clone().multiplyScalar(v.direction);
      v.mesh.lookAt(v.mesh.position.clone().add(lookDir));
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
    passengers,
    traffic,
    rainSystem,
    sampleRoadAt,
    updateWorld,
    dispose,
  };
}
