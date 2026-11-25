import * as THREE from 'three';
import type { WeatherPreset } from '../types/simulator';

export type TrafficKind = 'swift_car' | 'suv_bolero' | 'tata_truck' | 'hrtc_bus' | 'private_bus';

export interface TrafficVehicleAsset {
  group: THREE.Group;
  halfWidth: number;
  halfLength: number;
  brakeLightMat: THREE.MeshStandardMaterial;
}

export interface TollPlazaData {
  id: string;
  name: string;
  feeInr: number;
  t: number;
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  barrierPivot: THREE.Group;
  paid: boolean;
  barrierOpenAnim: number;
}

export function createHighDetailAsphaltTexture(maxAniso: number, repeatY = 380): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Rich weathered Himalayan highway bitumen base
  ctx.fillStyle = '#293039';
  ctx.fillRect(0, 0, 512, 512);

  // Subtle dual wheel-track tire wear bands in both Indian lanes
  const drawWearTrack = (cx: number, w: number) => {
    const g = ctx.createLinearGradient(cx - w, 0, cx + w, 0);
    g.addColorStop(0, 'rgba(15, 20, 26, 0)');
    g.addColorStop(0.5, 'rgba(15, 20, 26, 0.28)');
    g.addColorStop(1, 'rgba(15, 20, 26, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - w, 0, w * 2, 512);
  };
  drawWearTrack(110, 24);
  drawWearTrack(182, 24);
  drawWearTrack(330, 24);
  drawWearTrack(402, 24);

  // Fine aggregate asphalt speckle
  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 30 + Math.floor(Math.random() * 38);
    ctx.fillStyle = `rgb(${v},${v + 3},${v + 7})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Slight weathered tar seams
  ctx.strokeStyle = 'rgba(12, 16, 22, 0.35)';
  ctx.lineWidth = 2;
  for (let y = 40; y < 512; y += 140) {
    ctx.beginPath();
    ctx.moveTo(28, y);
    ctx.lineTo(484, y + 6);
    ctx.stroke();
  }

  // Crisp reflective white shoulder edge lines
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(18, 0, 12, 512);
  ctx.fillRect(482, 0, 12, 512);

  // Indian highway dashed yellow centerline
  ctx.fillStyle = '#FACC15';
  for (let y = 0; y < 512; y += 96) {
    ctx.fillRect(250, y, 12, 54);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, repeatY);
  tex.anisotropy = maxAniso;
  return tex;
}

export function createSignboardTexture(
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

/**
 * Procedural Sky Gradient Dome for crisp Himalayan daylight / mist / rain / starlit night atmosphere.
 */
export function createSkyGradientDome(): {
  mesh: THREE.Mesh;
  updateWeather: (w: WeatherPreset) => void;
} {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 512;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const paintSky = (w: WeatherPreset) => {
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    if (w === 'sunny') {
      grad.addColorStop(0, '#1D5EA8');
      grad.addColorStop(0.38, '#5FA8E6');
      grad.addColorStop(0.62, '#B6D9F4');
      grad.addColorStop(0.75, '#E4EEF6');
      grad.addColorStop(1, '#7A9280');
    } else if (w === 'mist') {
      grad.addColorStop(0, '#8FA6BA');
      grad.addColorStop(0.5, '#BCCAD6');
      grad.addColorStop(0.75, '#D2DCE4');
      grad.addColorStop(1, '#9BAAB8');
    } else if (w === 'rain') {
      grad.addColorStop(0, '#334155');
      grad.addColorStop(0.5, '#54667B');
      grad.addColorStop(0.76, '#6E8094');
      grad.addColorStop(1, '#3B4856');
    } else {
      grad.addColorStop(0, '#040914');
      grad.addColorStop(0.48, '#0A1730');
      grad.addColorStop(0.72, '#13264A');
      grad.addColorStop(1, '#081020');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 512);
    tex.needsUpdate = true;
  };

  paintSky('sunny');
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(1150, 24, 16),
    new THREE.MeshBasicMaterial({
      map: tex,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    })
  );
  mesh.renderOrder = -10;
  return { mesh, updateWeather: paintSky };
}

/**
 * Builds realistic multi-part Indian highway vehicles:
 * - Maruti Swift / Alto Hatchback
 * - Mahindra Scorpio / Bolero Hill SUV
 * - Tata 1613 Decorated Indian Cargo Truck
 * - HRTC Himachal Green & White Bus
 * - Private Himachal Tourist Deluxe Coach
 */
export function buildIndianTrafficVehicle(
  kind: TrafficKind,
  variantSeed = 0
): TrafficVehicleAsset {
  const g = new THREE.Group();
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x171a1f, roughness: 0.92 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.25, metalness: 0.85 });
  const darkTrimMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.72 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x14263a,
    roughness: 0.08,
    metalness: 0.15,
    clearcoat: 1.0,
  });
  const hlMat = new THREE.MeshStandardMaterial({
    color: 0xfffbeb,
    emissive: 0xfef08a,
    emissiveIntensity: 0.8,
  });
  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    emissive: 0xef4444,
    emissiveIntensity: 0.35,
  });

  const addWheel = (x: number, y: number, z: number, r: number, w = 0.22) => {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 14), tireMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    g.add(wheel);
    const alloy = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.56, r * 0.56, w + 0.02, 10), rimMat);
    alloy.rotation.z = Math.PI / 2;
    alloy.position.set(x, y, z);
    g.add(alloy);
  };

  let halfWidth = 0.92;
  let halfLength = 2.15;
  let frontZ = 2.0;
  let backZ = -2.0;
  let lightY = 0.72;
  let lightHalfW = 0.66;

  if (kind === 'swift_car') {
    // Realistic Maruti Swift / Alto Indian Hatchback
    halfWidth = 0.88;
    halfLength = 2.02;
    frontZ = 1.98;
    backZ = -1.96;
    lightY = 0.68;
    lightHalfW = 0.64;

    const palette = [0xdc2626, 0xf8fafc, 0x94a3b8, 0x2563eb, 0xeab308, 0x0f766e];
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: palette[variantSeed % palette.length],
      roughness: 0.22,
      metalness: 0.32,
      clearcoat: 0.9,
      clearcoatRoughness: 0.12,
    });

    // Lower sculpted body & front sloped bonnet
    const mainBody = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.64, 3.86), bodyMat);
    mainBody.position.set(0, 0.68, 0);
    mainBody.castShadow = true;
    g.add(mainBody);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.18, 1.15), bodyMat);
    hood.position.set(0, 1.0, 1.25);
    hood.rotation.x = 0.14;
    g.add(hood);

    // Cabin greenhouse with raked windshield
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.52, 0.58, 2.05), bodyMat);
    cabin.position.set(0, 1.26, -0.25);
    cabin.castShadow = true;
    g.add(cabin);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.44, 0.54, 0.08), glassMat);
    windshield.position.set(0, 1.24, 0.8);
    windshield.rotation.x = -0.45;
    g.add(windshield);

    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.46, 0.08), glassMat);
    rearGlass.position.set(0, 1.25, -1.3);
    rearGlass.rotation.x = 0.32;
    g.add(rearGlass);

    const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.44, 1.72), glassMat);
    sideGlass.position.set(0, 1.26, -0.22);
    g.add(sideGlass);

    // Front grille + bumpers + Indian white/yellow plate
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.24, 0.08), darkTrimMat);
    grille.position.set(0, 0.64, 1.94);
    g.add(grille);

    const bumperF = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.22, 0.16), darkTrimMat);
    bumperF.position.set(0, 0.44, 1.92);
    g.add(bumperF);

    const bumperR = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.22, 0.14), darkTrimMat);
    bumperR.position.set(0, 0.44, -1.92);
    g.add(bumperR);

    const plateMat = new THREE.MeshStandardMaterial({
      color: variantSeed % 3 === 0 ? 0xfacc15 : 0xf8fafc,
      roughness: 0.4,
    });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.04), plateMat);
    plate.position.set(0, 0.48, 2.01);
    g.add(plate);

    addWheel(-0.84, 0.32, 1.18, 0.32, 0.2);
    addWheel(0.84, 0.32, 1.18, 0.32, 0.2);
    addWheel(-0.84, 0.32, -1.16, 0.32, 0.2);
    addWheel(0.84, 0.32, -1.16, 0.32, 0.2);
  } else if (kind === 'suv_bolero') {
    // Realistic Mahindra Scorpio / Bolero Himachal Hill SUV
    halfWidth = 0.96;
    halfLength = 2.34;
    frontZ = 2.28;
    backZ = -2.26;
    lightY = 0.86;
    lightHalfW = 0.7;

    const suvPalette = [0xf8fafc, 0x1e293b, 0xcbd5e1, 0x7f1d1d, 0x1e3a8a];
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: suvPalette[variantSeed % suvPalette.length],
      roughness: 0.26,
      metalness: 0.35,
      clearcoat: 0.85,
    });

    const lower = new THREE.Mesh(new THREE.BoxGeometry(1.88, 0.78, 4.46), bodyMat);
    lower.position.set(0, 0.84, 0);
    lower.castShadow = true;
    g.add(lower);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.78, 2.95), bodyMat);
    cabin.position.set(0, 1.58, -0.45);
    cabin.castShadow = true;
    g.add(cabin);

    const glassBand = new THREE.Mesh(new THREE.BoxGeometry(1.81, 0.56, 2.65), glassMat);
    glassBand.position.set(0, 1.58, -0.42);
    g.add(glassBand);

    const frontWindshield = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.62, 0.08), glassMat);
    frontWindshield.position.set(0, 1.56, 1.04);
    frontWindshield.rotation.x = -0.22;
    g.add(frontWindshield);

    // Chrome Mahindra-style vertical slats grille & steel front bumper
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.34, 0.08), darkTrimMat);
    grille.position.set(0, 0.9, 2.24);
    g.add(grille);
    for (let sx = -0.4; sx <= 0.41; sx += 0.16) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.28, 0.1), rimMat);
      slat.position.set(sx, 0.9, 2.25);
      g.add(slat);
    }

    // Roof luggage rails + tailgate-mounted spare tire (classic Bolero/Sumo Himachal silhouette!)
    for (const rx of [-0.72, 0.72]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 2.4), darkTrimMat);
      rail.position.set(rx, 2.02, -0.45);
      g.add(rail);
    }
    const spareTire = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.22, 14), tireMat);
    spareTire.rotation.x = Math.PI / 2;
    spareTire.position.set(0, 1.12, -2.35);
    g.add(spareTire);

    // Yellow Himachal taxi plate
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.54, 0.15, 0.05),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.45 })
    );
    plate.position.set(0, 0.56, 2.26);
    g.add(plate);

    addWheel(-0.92, 0.39, 1.38, 0.39, 0.24);
    addWheel(0.92, 0.39, 1.38, 0.39, 0.24);
    addWheel(-0.92, 0.39, -1.36, 0.39, 0.24);
    addWheel(0.92, 0.39, -1.36, 0.39, 0.24);
  } else if (kind === 'tata_truck') {
    // Classic Decorated Indian Tata 1613 Highway Cargo Truck
    halfWidth = 1.22;
    halfLength = 3.85;
    frontZ = 3.66;
    backZ = -3.82;
    lightY = 0.92;
    lightHalfW = 0.94;

    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(2.36, 2.3, 2.15),
      new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.42, metalness: 0.25 })
    );
    cab.position.set(0, 1.68, 2.52);
    cab.castShadow = true;
    g.add(cab);

    // Crown forehead carrier above cab
    const crown = new THREE.Mesh(
      new THREE.BoxGeometry(2.38, 0.48, 1.6),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 })
    );
    crown.position.set(0, 3.04, 2.35);
    g.add(crown);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.72, 0.1), glassMat);
    windshield.position.set(0, 2.1, 3.58);
    g.add(windshield);

    const cargoWood = new THREE.Mesh(
      new THREE.BoxGeometry(2.42, 1.25, 5.15),
      new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.85 })
    );
    cargoWood.position.set(0, 1.48, -1.24);
    cargoWood.castShadow = true;
    g.add(cargoWood);

    // Blue tarpaulin top load
    const tarp = new THREE.Mesh(
      new THREE.BoxGeometry(2.38, 1.32, 5.05),
      new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.78 })
    );
    tarp.position.set(0, 2.68, -1.24);
    tarp.castShadow = true;
    g.add(tarp);

    const rearPlank = new THREE.Mesh(
      new THREE.BoxGeometry(2.32, 0.52, 0.1),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.55 })
    );
    rearPlank.position.set(0, 1.12, -3.84);
    g.add(rearPlank);

    addWheel(-1.14, 0.48, 2.32, 0.48, 0.3);
    addWheel(1.14, 0.48, 2.32, 0.48, 0.3);
    addWheel(-1.14, 0.48, -2.15, 0.48, 0.36);
    addWheel(1.14, 0.48, -2.15, 0.48, 0.36);
  } else if (kind === 'hrtc_bus') {
    // Authentic HRTC Himachal Pradesh Green & White Bus
    halfWidth = 1.24;
    halfLength = 4.95;
    frontZ = 4.86;
    backZ = -4.86;
    lightY = 0.96;
    lightHalfW = 0.92;

    const upperBody = new THREE.Mesh(
      new THREE.BoxGeometry(2.42, 2.48, 9.65),
      new THREE.MeshPhysicalMaterial({ color: 0xf8fafc, roughness: 0.32, metalness: 0.18, clearcoat: 0.65 })
    );
    upperBody.position.set(0, 1.88, 0);
    upperBody.castShadow = true;
    g.add(upperBody);

    // Classic HRTC Emerald Green lower band + yellow accent stripe
    const greenBand = new THREE.Mesh(
      new THREE.BoxGeometry(2.46, 1.06, 9.68),
      new THREE.MeshPhysicalMaterial({ color: 0x15803d, roughness: 0.34, clearcoat: 0.65 })
    );
    greenBand.position.set(0, 1.26, 0);
    g.add(greenBand);

    const yellowStripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.48, 0.14, 9.7),
      new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 })
    );
    yellowStripe.position.set(0, 1.82, 0);
    g.add(yellowStripe);

    const glassBand = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.86, 8.9), glassMat);
    glassBand.position.set(0, 2.38, 0.15);
    g.add(glassBand);

    // Roof luggage carrier
    const rack = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.18, 4.8), darkTrimMat);
    rack.position.set(0, 3.22, -1.4);
    g.add(rack);

    addWheel(-1.14, 0.48, 2.9, 0.48, 0.28);
    addWheel(1.14, 0.48, 2.9, 0.48, 0.28);
    addWheel(-1.14, 0.48, -2.8, 0.48, 0.34);
    addWheel(1.14, 0.48, -2.8, 0.48, 0.34);
  } else {
    // Private Himachal Tourist Deluxe Coach (Vibrant Private Bus Liveries)
    halfWidth = 1.24;
    halfLength = 5.05;
    frontZ = 4.96;
    backZ = -4.96;
    lightY = 0.98;
    lightHalfW = 0.94;

    const privBaseColors = [0xf8fafc, 0xfffbeb, 0xf1f5f9];
    const privAccentColors = [0xc026d3, 0xea580c, 0x0284c7, 0xdc2626];
    const accent = privAccentColors[variantSeed % privAccentColors.length];

    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(2.44, 2.6, 9.85),
      new THREE.MeshPhysicalMaterial({
        color: privBaseColors[variantSeed % privBaseColors.length],
        roughness: 0.25,
        metalness: 0.24,
        clearcoat: 0.85,
      })
    );
    shell.position.set(0, 1.94, 0);
    shell.castShadow = true;
    g.add(shell);

    const stripeLow = new THREE.Mesh(
      new THREE.BoxGeometry(2.48, 0.9, 9.88),
      new THREE.MeshPhysicalMaterial({ color: accent, roughness: 0.3, clearcoat: 0.7 })
    );
    stripeLow.position.set(0, 1.22, 0);
    g.add(stripeLow);

    const goldLine = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.14, 9.9),
      new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.25, metalness: 0.7 })
    );
    goldLine.position.set(0, 1.72, 0);
    g.add(goldLine);

    const glassBand = new THREE.Mesh(new THREE.BoxGeometry(2.47, 0.96, 9.15), glassMat);
    glassBand.position.set(0, 2.46, 0.14);
    g.add(glassBand);

    // Sleek rooftop AC unit pod
    const acPod = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 0.28, 3.2),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.35 })
    );
    acPod.position.set(0, 3.36, 0.2);
    g.add(acPod);

    addWheel(-1.14, 0.48, 2.95, 0.48, 0.28);
    addWheel(1.14, 0.48, 2.95, 0.48, 0.28);
    addWheel(-1.14, 0.48, -2.85, 0.48, 0.34);
    addWheel(1.14, 0.48, -2.85, 0.48, 0.34);
  }

  // Front Headlights & Rear Functional Brake Lights
  for (const sx of [-lightHalfW, lightHalfW]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.06), hlMat);
    hl.position.set(sx, lightY, frontZ);
    g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.18, 0.06), brakeLightMat);
    tl.position.set(sx, lightY + 0.04, backZ);
    g.add(tl);
  }

  return { group: g, halfWidth, halfLength, brakeLightMat };
}

/**
 * Builds an authentic Himachali Kath-Kuni Pahadi Mountain House (stone & timber cottage
 * with sloped slate/tin roof, wooden veranda balcony, and warm glowing windows).
 */
export function buildPahadiMountainHouse(seed: number): THREE.Group {
  const g = new THREE.Group();
  const wallPalette = [0xf1e8dc, 0xe2e8f0, 0xfef3c7, 0xdbeafe, 0xfce7f3];
  const roofPalette = [0x15803d, 0x991b1b, 0x1d4ed8, 0x334155];

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.94 });
  const wallMat = new THREE.MeshStandardMaterial({
    color: wallPalette[seed % wallPalette.length],
    roughness: 0.85,
  });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b3e26, roughness: 0.88 });
  const roofMat = new THREE.MeshStandardMaterial({
    color: roofPalette[seed % roofPalette.length],
    roughness: 0.55,
    metalness: 0.25,
  });
  const windowGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.45,
    roughness: 0.2,
  });

  // Deep stone foundation plinth so house sits solidly on sloped hillsides without floating!
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(6.8, 4.6, 5.8), stoneMat);
  plinth.position.set(0, -1.2, 0);
  g.add(plinth);

  // Upper plastered residential floor
  const upperH = 3.2 + (seed % 2) * 1.4;
  const upper = new THREE.Mesh(new THREE.BoxGeometry(6.4, upperH, 5.4), wallMat);
  upper.position.set(0, 1.1 + upperH / 2, 0);
  upper.castShadow = true;
  g.add(upper);

  // Wooden Pahadi projecting balcony
  const balcony = new THREE.Mesh(new THREE.BoxGeometry(6.9, 0.22, 1.3), woodMat);
  balcony.position.set(0, 2.3, 3.1);
  g.add(balcony);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(6.9, 0.72, 0.12), woodMat);
  rail.position.set(0, 2.75, 3.68);
  g.add(rail);

  // Sloped Himalayan tin/slate roof
  const roof = new THREE.Mesh(new THREE.ConeGeometry(5.5, 2.2, 4), roofMat);
  roof.rotation.y = Math.PI / 4;
  roof.position.set(0, 1.1 + upperH + 1.05, 0);
  roof.castShadow = true;
  g.add(roof);

  // Glowing front windows
  for (const wx of [-1.75, 0, 1.75]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.88, 1.05, 0.12), windowGlowMat);
    win.position.set(wx, 1.1 + upperH * 0.58, 2.72);
    g.add(win);
  }

  return g;
}

/**
 * Builds a properly hollow, curved mountain tunnel extruded directly along the road Catmull-Rom spline
 * so the tunnel bore NEVER clips into the road and hugs every curve cleanly.
 */
export function buildCurvedMountainTunnel(
  curve: THREE.CatmullRomCurve3,
  tStart: number,
  tEnd: number,
  roadWidth: number,
  tunnelName: string,
  maxAniso: number
): THREE.Group {
  const group = new THREE.Group();
  const upVec = new THREE.Vector3(0, 1, 0);
  const steps = 28;
  const archSteps = 12;
  const innerHalfW = roadWidth * 0.5 + 1.55;
  const wallH = 2.6;
  const archRadius = innerHalfW;
  const totalHeight = wallH + archRadius * 0.72; // ~7.6m generous bus clearance!

  const innerPos: number[] = [];
  const innerIdx: number[] = [];
  const outerRockPos: number[] = [];
  const outerRockIdx: number[] = [];

  for (let i = 0; i <= steps; i++) {
    const frac = i / steps;
    const t = THREE.MathUtils.lerp(tStart, tEnd, frac);
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t).normalize();
    const right = new THREE.Vector3().crossVectors(tan, upVec).normalize();

    for (let j = 0; j <= archSteps; j++) {
      const a = (j / archSteps) * Math.PI; // 0 (right base) -> PI/2 (crown) -> PI (left base)
      const lx = Math.cos(a) * innerHalfW;
      const ly = Math.sin(a) * (totalHeight - wallH) + (j === 0 || j === archSteps ? -0.4 : wallH);

      const vIn = p.clone().addScaledVector(right, lx);
      vIn.y += Math.max(-0.4, ly);
      innerPos.push(vIn.x, vIn.y, vIn.z);

      // Natural rocky mountain dome wrapping OVER the tunnel roof (leaving entrance/exit cleanly open!)
      const domeBell = Math.sin(frac * Math.PI);
      const rockLift = 1.6 + domeBell * 15.5;
      const rockSpread = innerHalfW + 1.8 + domeBell * 14.0;
      const ox = Math.cos(a) * rockSpread;
      const oy = Math.sin(a) * (totalHeight + rockLift) + (j === 0 || j === archSteps ? -3.5 : 1.5);
      const vOut = p.clone().addScaledVector(right, ox);
      vOut.y += oy;
      outerRockPos.push(vOut.x, vOut.y, vOut.z);
    }

    if (i < steps) {
      const stride = archSteps + 1;
      for (let j = 0; j < archSteps; j++) {
        const a = i * stride + j;
        const b = a + 1;
        const c = (i + 1) * stride + j;
        const d = c + 1;
        // Inner concrete vault facing inward + double-sided safety
        innerIdx.push(a, c, b, b, c, d);
        outerRockIdx.push(a, b, c, b, d, c);
      }
    }

    // Overhead warm amber sodium lamps every 4 spline steps
    if (i > 1 && i < steps - 1 && i % 4 === 0) {
      const lamp = new THREE.Mesh(
        new THREE.BoxGeometry(1.3, 0.16, 0.42),
        new THREE.MeshBasicMaterial({ color: 0xfdba74 })
      );
      lamp.position.copy(p);
      lamp.position.y += totalHeight - 0.25;
      lamp.lookAt(lamp.position.clone().add(tan));
      group.add(lamp);

      // Reflective yellow-black side chevrons along tunnel walls
      for (const side of [-1, 1]) {
        const refStrip = new THREE.Mesh(
          new THREE.BoxGeometry(0.12, 0.42, 0.55),
          new THREE.MeshBasicMaterial({ color: 0xfacc15 })
        );
        refStrip.position.copy(p).addScaledVector(right, side * (innerHalfW - 0.12));
        refStrip.position.y += 1.25;
        refStrip.lookAt(refStrip.position.clone().add(tan));
        group.add(refStrip);
      }
    }
  }

  const innerGeo = new THREE.BufferGeometry();
  innerGeo.setAttribute('position', new THREE.Float32BufferAttribute(innerPos, 3));
  innerGeo.setIndex(innerIdx);
  innerGeo.computeVertexNormals();
  const innerMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.9,
    metalness: 0.06,
    side: THREE.DoubleSide,
  });
  group.add(new THREE.Mesh(innerGeo, innerMat));

  const rockGeo = new THREE.BufferGeometry();
  rockGeo.setAttribute('position', new THREE.Float32BufferAttribute(outerRockPos, 3));
  rockGeo.setIndex(outerRockIdx);
  rockGeo.computeVertexNormals();
  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x475548,
    roughness: 0.95,
    side: THREE.DoubleSide,
  });
  group.add(new THREE.Mesh(rockGeo, rockMat));

  // Entrance & Exit Concrete Portal Facades with Signboards
  const signTex = createSignboardTexture(
    tunnelName,
    'SWITCH ON HEADLIGHTS (L) • KEEP IN LANE',
    '#1E293B',
    '#FACC15',
    '#F8FAFC',
    maxAniso
  );
  const portalMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85 });
  for (const [portalT, flip] of [
    [tStart, false],
    [tEnd, true],
  ] as const) {
    const p = curve.getPointAt(portalT);
    const tan = curve.getTangentAt(portalT).normalize();
    const portal = new THREE.Group();
    portal.position.copy(p);
    portal.lookAt(p.clone().add(flip ? tan.clone().negate() : tan));

    // Left & Right masonry abutments
    for (const sx of [-innerHalfW - 0.65, innerHalfW + 0.65]) {
      const pier = new THREE.Mesh(new THREE.BoxGeometry(1.4, totalHeight + 1.2, 1.4), portalMat);
      pier.position.set(sx, (totalHeight + 1.2) / 2, 0);
      portal.add(pier);
    }
    // Overhead concrete lintel header beam (high above bus roof!)
    const lintel = new THREE.Mesh(new THREE.BoxGeometry((innerHalfW + 1.35) * 2, 1.5, 1.5), portalMat);
    lintel.position.set(0, totalHeight + 0.4, 0);
    portal.add(lintel);

    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(8.6, 1.35),
      new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.38 })
    );
    sign.position.set(0, totalHeight + 0.42, -0.78);
    sign.rotation.y = Math.PI;
    portal.add(sign);

    group.add(portal);
  }

  return group;
}

/**
 * Builds an authentic NHAI FASTag Highway Toll Plaza (used ONLY in Career Mode — never in Endless Mode!)
 * with overhead gantry, booths, and animated boom barrier arm.
 */
export function buildNhaiTollPlaza(
  id: string,
  name: string,
  feeInr: number,
  t: number,
  pos: THREE.Vector3,
  tan: THREE.Vector3,
  roadWidth: number,
  maxAniso: number
): { group: THREE.Group; data: TollPlazaData } {
  const group = new THREE.Group();
  group.position.copy(pos);
  group.lookAt(pos.clone().add(tan));

  const halfW = roadWidth * 0.5;
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x0b4fa8, roughness: 0.35, metalness: 0.35 });
  const yellowMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.45 });
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.6 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.15, metalness: 0.45 });

  // Center island & side concrete toll booths
  for (const bx of [-halfW - 1.35, 0.25, halfW + 1.35]) {
    const island = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.45, 7.6), yellowMat);
    island.position.set(bx, 0.22, 0);
    group.add(island);

    const booth = new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.75, 3.2), whiteMat);
    booth.position.set(bx, 1.8, 0);
    booth.castShadow = true;
    group.add(booth);

    const win = new THREE.Mesh(new THREE.BoxGeometry(1.08, 1.0, 2.2), glassMat);
    win.position.set(bx, 2.15, 0);
    group.add(win);

    const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 5.4, 0.42), blueMat);
    pillar.position.set(bx, 2.7, -1.2);
    group.add(pillar);
  }

  // Wide Overhead NHAI Blue & Yellow Canopy
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(roadWidth + 5.2, 1.4, 6.2), blueMat);
  canopy.position.set(0, 5.6, 0);
  canopy.castShadow = true;
  group.add(canopy);

  const canopyStripe = new THREE.Mesh(new THREE.BoxGeometry(roadWidth + 5.28, 0.24, 6.26), yellowMat);
  canopyStripe.position.set(0, 4.95, 0);
  group.add(canopyStripe);

  // Crisp NHAI FASTag Front Signboard facing approaching bus (-Z in local lookAt space)
  const signTex = createSignboardTexture(
    `${name} • NHAI FASTag`,
    `HEAVY BUS TOLL ₹${feeInr}  •  SLOW DOWN`,
    '#0B4FA8',
    '#FFFFFF',
    '#FACC15',
    maxAniso
  );
  const frontSign = new THREE.Mesh(
    new THREE.PlaneGeometry(roadWidth + 3.2, 1.2),
    new THREE.MeshStandardMaterial({
      map: signTex,
      emissiveMap: signTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.35,
      roughness: 0.35,
    })
  );
  frontSign.position.set(0, 5.62, -3.14);
  frontSign.rotation.y = Math.PI;
  group.add(frontSign);

  // Green FASTag active lane indicator above Indian left travel lane (+X in local space)
  const laneArrow = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.52, 0.14),
    new THREE.MeshBasicMaterial({ color: 0x22c55e })
  );
  laneArrow.position.set(2.8, 4.55, -3.12);
  group.add(laneArrow);

  // Animated Red-White Boom Barrier Arm across Indian left travel lane (+X side)
  const barrierPivot = new THREE.Group();
  barrierPivot.position.set(0.75, 1.18, -1.6);
  const armRed = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 0.12, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.4 })
  );
  armRed.position.set(2.2, 0, 0);
  barrierPivot.add(armRed);
  for (let stripe = 0; stripe < 4; stripe++) {
    const wBand = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.13, 0.13), whiteMat);
    wBand.position.set(0.6 + stripe * 1.1, 0, 0);
    barrierPivot.add(wBand);
  }
  group.add(barrierPivot);

  return {
    group,
    data: {
      id,
      name,
      feeInr,
      t,
      position: pos.clone(),
      tangent: tan.clone(),
      barrierPivot,
      paid: false,
      barrierOpenAnim: 0,
    },
  };
}
