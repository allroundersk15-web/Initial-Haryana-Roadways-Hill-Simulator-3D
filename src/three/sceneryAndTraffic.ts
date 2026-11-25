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

export interface DayNightSkyHandle {
  group: THREE.Group;
  updateSky: (timeOfDayHours: number, weather: WeatherPreset) => void;
  dispose: () => void;
}

function lerpHexColor(a: number, b: number, t: number, out: THREE.Color): THREE.Color {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  return out.copy(ca).lerp(cb, THREE.MathUtils.clamp(t, 0, 1));
}

/**
 * Dynamic 24-Hour Day-Night Sky Dome with glowing Sun, Moon, and Starfield
 * smoothly blending Dawn -> Morning -> Noon -> Golden Sunset -> Dusk -> Starlit Night.
 */
export function createSkyGradientDome(): DayNightSkyHandle {
  const group = new THREE.Group();
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 512;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const domeMat = new THREE.MeshBasicMaterial({
    map: tex,
    side: THREE.BackSide,
    fog: false,
    depthWrite: false,
  });
  const domeGeo = new THREE.SphereGeometry(1150, 24, 16);
  const domeMesh = new THREE.Mesh(domeGeo, domeMat);
  domeMesh.renderOrder = -12;
  group.add(domeMesh);

  // Glowing 3D Sun disc + soft corona
  const sunGroup = new THREE.Group();
  const sunDiscGeo = new THREE.SphereGeometry(34, 16, 16);
  const sunDiscMat = new THREE.MeshBasicMaterial({ color: 0xfff8d6, fog: false, depthWrite: false });
  const sunDisc = new THREE.Mesh(sunDiscGeo, sunDiscMat);
  const sunHaloGeo = new THREE.SphereGeometry(60, 16, 16);
  const sunHaloMat = new THREE.MeshBasicMaterial({
    color: 0xfde047,
    transparent: true,
    opacity: 0.28,
    fog: false,
    depthWrite: false,
  });
  const sunHalo = new THREE.Mesh(sunHaloGeo, sunHaloMat);
  sunGroup.add(sunDisc, sunHalo);
  sunGroup.renderOrder = -11;
  group.add(sunGroup);

  // Crisp 3D Moon disc
  const moonGeo = new THREE.SphereGeometry(24, 16, 16);
  const moonMat = new THREE.MeshBasicMaterial({
    color: 0xe2ecff,
    transparent: true,
    opacity: 0.92,
    fog: false,
    depthWrite: false,
  });
  const moonMesh = new THREE.Mesh(moonGeo, moonMat);
  moonMesh.renderOrder = -11;
  group.add(moonMesh);

  // Himalayan Starfield (fades in smoothly during twilight & night)
  const starCount = 340;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(0.08 + Math.random() * 0.92); // upper hemisphere only
    const r = 980;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi);
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({
    color: 0xf8fafc,
    size: 4.5,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    fog: false,
    depthWrite: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.renderOrder = -11;
  group.add(stars);

  let lastPaintedHour = -99;
  let lastWeather: WeatherPreset | null = null;
  const cTop = new THREE.Color();
  const cMid = new THREE.Color();
  const cHor = new THREE.Color();
  const cLow = new THREE.Color();

  const updateSky = (timeOfDayHours: number, weather: WeatherPreset) => {
    const h = ((timeOfDayHours % 24) + 24) % 24;

    // Position Sun & Moon continuously along sky arc (sunrise ~6:00, zenith ~12:00, sunset ~18:00)
    const sunAngle = ((h - 6) / 12) * Math.PI; // 0 at 6am, PI/2 at noon, PI at 6pm
    const orbitR = 900;
    const sunY = Math.sin(sunAngle) * orbitR;
    const sunX = Math.cos(sunAngle) * orbitR;
    const sunZ = -320;
    sunGroup.position.set(sunX, sunY, sunZ);
    sunGroup.visible = sunY > -65 && weather !== 'rain';

    const horizonWarmth = Math.max(0, 1 - Math.abs(sunY) / 380);
    sunDiscMat.color.setHex(horizonWarmth > 0.45 ? 0xffb347 : 0xfff8d6);
    sunHaloMat.color.setHex(horizonWarmth > 0.45 ? 0xf97316 : 0xfde047);
    sunHaloMat.opacity = weather === 'mist' ? 0.14 : 0.3;

    // Opposite Moon arc
    moonMesh.position.set(-sunX, -sunY, 280);
    const nightWeight =
      h >= 20 || h < 5
        ? 1
        : h >= 18.2 && h < 20
          ? (h - 18.2) / 1.8
          : h >= 5 && h < 6.8
            ? 1 - (h - 5) / 1.8
            : 0;
    moonMesh.visible = -sunY > -40 && nightWeight > 0.08;
    moonMat.opacity = Math.min(0.95, nightWeight * (weather === 'rain' ? 0.35 : 1));
    starMat.opacity = Math.max(0, (nightWeight - 0.15) * (weather === 'rain' ? 0.15 : weather === 'mist' ? 0.35 : 0.92));

    // Repaint sky dome gradient only when hour or weather shifts noticeably
    if (Math.abs(h - lastPaintedHour) < 0.045 && weather === lastWeather) return;
    lastPaintedHour = h;
    lastWeather = weather;

    // Keyframe sky palettes across 24h cycle
    if (h < 5.0 || h >= 20.5) {
      // Deep Himalayan Starlit Night
      cTop.setHex(0x030712);
      cMid.setHex(0x09142b);
      cHor.setHex(0x132445);
      cLow.setHex(0x070d1c);
    } else if (h < 6.8) {
      // Dawn Sunrise
      const t = (h - 5.0) / 1.8;
      lerpHexColor(0x09142b, 0x2c6eb5, t, cTop);
      lerpHexColor(0x1a284f, 0xe88b5a, t < 0.65 ? t / 0.65 : 1 - (t - 0.65) / 0.35, cMid);
      lerpHexColor(0x283558, 0xfdba74, t, cHor);
      lerpHexColor(0x111a2c, 0x7c8e82, t, cLow);
    } else if (h < 8.5) {
      // Crisp Morning into Full Daylight
      const t = (h - 6.8) / 1.7;
      lerpHexColor(0x2c6eb5, 0x1d5ea8, t, cTop);
      lerpHexColor(0x8bbce6, 0x5fa8e6, t, cMid);
      lerpHexColor(0xfdba74, 0xd6e9f8, t, cHor);
      lerpHexColor(0x7c8e82, 0x7a9280, t, cLow);
    } else if (h < 16.5) {
      // Clear Himalayan Daytime
      cTop.setHex(0x1d5ea8);
      cMid.setHex(0x5fa8e6);
      cHor.setHex(0xcbe2f5);
      cLow.setHex(0x7a9280);
    } else if (h < 18.6) {
      // Golden Himalayan Sunset
      const t = (h - 16.5) / 2.1;
      lerpHexColor(0x1d5ea8, 0x293b6b, t, cTop);
      lerpHexColor(0x5fa8e6, 0xe07a52, t, cMid);
      lerpHexColor(0xcbe2f5, 0xf97316, t, cHor);
      lerpHexColor(0x7a9280, 0x45353a, t, cLow);
    } else {
      // Dusk Twilight -> Night
      const t = (h - 18.6) / 1.9;
      lerpHexColor(0x293b6b, 0x030712, t, cTop);
      lerpHexColor(0xe07a52, 0x09142b, t, cMid);
      lerpHexColor(0xf97316, 0x132445, t, cHor);
      lerpHexColor(0x45353a, 0x070d1c, t, cLow);
    }

    // Modulate palette for Misty / Rainy overcast skies while preserving Day-Night brightness!
    if (weather === 'mist') {
      const mistTint = new THREE.Color(nightWeight > 0.5 ? 0x1c2838 : 0xbccad6);
      cTop.lerp(mistTint, 0.58);
      cMid.lerp(mistTint, 0.65);
      cHor.lerp(mistTint, 0.72);
    } else if (weather === 'rain') {
      const rainTint = new THREE.Color(nightWeight > 0.5 ? 0x0e1726 : 0x47596d);
      cTop.lerp(rainTint, 0.72);
      cMid.lerp(rainTint, 0.76);
      cHor.lerp(rainTint, 0.72);
    }

    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, `#${cTop.getHexString()}`);
    grad.addColorStop(0.42, `#${cMid.getHexString()}`);
    grad.addColorStop(0.7, `#${cHor.getHexString()}`);
    grad.addColorStop(1, `#${cLow.getHexString()}`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 512);
    tex.needsUpdate = true;
  };

  updateSky(9.5, 'sunny');

  return {
    group,
    updateSky,
    dispose() {
      domeGeo.dispose();
      domeMat.dispose();
      tex.dispose();
      sunDiscGeo.dispose();
      sunDiscMat.dispose();
      sunHaloGeo.dispose();
      sunHaloMat.dispose();
      moonGeo.dispose();
      moonMat.dispose();
      starGeo.dispose();
      starMat.dispose();
    },
  };
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

export interface LandslideZoneData {
  id: string;
  label: string;
  position: THREE.Vector3; // Road centerline position
  blockCenter: THREE.Vector3; // Center of the blocked half-road boulder pile
  tangent: THREE.Vector3;
  right: THREE.Vector3;
  halfWidth: number;
  halfLength: number;
  debrisGroup: THREE.Group;
  jcbBoomPivot: THREE.Group;
  beaconLightMat: THREE.MeshBasicMaterial;
  clearing: boolean;
  clearProgress: number; // 0 = blocked half-road, 1 = fully cleared
  cleared: boolean;
}

/**
 * Builds a realistic Himalayan Half-Road Landslide Zone:
 * - Covers the uphill LEFT half of the highway (+left = -right) with rocky boulders, mud scree & fallen timber
 * - Leaves the outer RIGHT half-lane open for tight single-lane passing
 * - Includes warning cones, BRO landslide board, and a yellow JCB road-clearing loader with animated scoop
 *   so the driver can manually clear the blockage!
 */
export function buildRoadLandslideZone(
  id: string,
  label: string,
  pos: THREE.Vector3,
  tan: THREE.Vector3,
  roadWidth: number,
  maxAniso: number
): { group: THREE.Group; data: LandslideZoneData } {
  const group = new THREE.Group();
  group.position.copy(pos);
  group.lookAt(pos.clone().add(tan));

  const upVec = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(tan, upVec).normalize();
  const left = right.clone().negate();
  const halfW = roadWidth * 0.5;

  // In local lookAt space (+Z = forward along tan, +X = LEFT uphill cliff side, -X = RIGHT valley open lane)
  const debrisGroup = new THREE.Group();
  group.add(debrisGroup);

  const rockMatDark = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.95 });
  const rockMatMud = new THREE.MeshStandardMaterial({ color: 0x6b5b49, roughness: 0.96 });
  const rockMatLight = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.92 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 });

  // Mud & gravel landslide scree mound spilling from hillside across left half of road (X from +0.2 to +halfW+2.8)
  const mound = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2.35, 9), rockMatMud);
  mound.scale.set(1.15, 0.95, 2.25);
  mound.position.set(halfW * 0.65 + 1.0, 0.95, 0);
  mound.receiveShadow = true;
  mound.castShadow = true;
  debrisGroup.add(mound);

  // Cluster of jagged slate Himalayan boulders occupying the blocked left half-lane
  const boulderSpecs: Array<[number, number, number, number, number]> = [
    [1.45, 0.72, -3.4, 0.95, 0],
    [2.65, 1.15, -1.6, 1.38, 1],
    [1.1, 0.62, 0.35, 0.86, 2],
    [3.1, 1.35, 1.4, 1.48, 0],
    [1.6, 0.78, 3.2, 1.05, 1],
    [4.2, 1.65, -0.5, 1.75, 2],
    [2.1, 0.68, -5.2, 0.82, 0],
    [2.3, 0.72, 4.9, 0.9, 2],
  ];
  const rockMats = [rockMatDark, rockMatMud, rockMatLight];
  for (const [bx, by, bz, r, mIdx] of boulderSpecs) {
    const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), rockMats[mIdx]);
    boulder.position.set(bx, by, bz);
    boulder.rotation.set(bx * 1.1, bz * 0.7, by * 1.3);
    boulder.scale.set(1.15, 0.85, 1.05);
    boulder.castShadow = true;
    boulder.receiveShadow = true;
    debrisGroup.add(boulder);
  }

  // Fallen pine trunk across the scree pile
  const log = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.34, 5.4, 8), woodMat);
  log.position.set(2.4, 1.45, -0.8);
  log.rotation.set(0.32, 0.4, 1.22);
  debrisGroup.add(log);

  // Bright Orange-White Highway Warning Cones guiding traffic onto the open single half-lane
  const coneMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.55 });
  const coneBandMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
  for (const cz of [-7.5, -4.5, 0, 4.5, 7.5]) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.72, 8), coneMat);
    cone.position.set(0.15, 0.38, cz);
    debrisGroup.add(cone);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.19, 0.16, 8), coneBandMat);
    band.position.set(0.15, 0.44, cz);
    debrisGroup.add(band);
  }

  // Yellow JCB / BRO Road-Clearing Loader parked on shoulder beside the landslide
  const jcb = new THREE.Group();
  jcb.position.set(halfW + 1.8, 0, -9.8);
  const jcbYellow = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.38, metalness: 0.3 });
  const jcbDark = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 });
  const jcbBody = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.25, 3.6), jcbYellow);
  jcbBody.position.set(0, 1.15, 0);
  jcbBody.castShadow = true;
  jcb.add(jcbBody);
  const jcbCab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.3, 1.7), jcbDark);
  jcbCab.position.set(0, 2.35, -0.45);
  jcb.add(jcbCab);
  const beaconLightMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.24, 10), beaconLightMat);
  beacon.position.set(0, 3.12, -0.45);
  jcb.add(beacon);

  // JCB wheels
  for (const [wx, wz, wr] of [
    [-1.08, 1.1, 0.52],
    [1.08, 1.1, 0.52],
    [-1.12, -1.05, 0.68],
    [1.12, -1.05, 0.68],
  ]) {
    const wh = new THREE.Mesh(new THREE.CylinderGeometry(wr, wr, 0.36, 12), jcbDark);
    wh.rotation.z = Math.PI / 2;
    wh.position.set(wx, wr, wz);
    jcb.add(wh);
  }

  // Animated Front Loader Boom & Bucket
  const jcbBoomPivot = new THREE.Group();
  jcbBoomPivot.position.set(0, 1.35, 1.55);
  const boomArm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.24, 2.1), jcbYellow);
  boomArm.position.set(0, -0.1, 1.0);
  jcbBoomPivot.add(boomArm);
  const scoop = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.85, 0.9), jcbDark);
  scoop.position.set(0, -0.45, 2.25);
  jcbBoomPivot.add(scoop);
  jcb.add(jcbBoomPivot);
  group.add(jcb);

  // BRO "CAUTION: LANDSLIDE AHEAD • ONE LANE" Signboard facing approaching drivers
  const signTex = createSignboardTexture(
    'CAUTION: LANDSLIDE ZONE',
    'HALF ROAD BLOCKED • CLEAR OR PASS SLOWLY',
    '#7F1D1D',
    '#FEF08A',
    '#F59E0B',
    maxAniso
  );
  const signPost = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 8), jcbDark);
  signPost.position.set(halfW + 1.1, 1.6, -14.5);
  group.add(signPost);
  const signBoard = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 1.15, 0.12),
    new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.4 })
  );
  signBoard.position.set(halfW + 0.5, 2.85, -14.5);
  signBoard.rotation.y = Math.PI;
  group.add(signBoard);

  // World-space center of the blocked half-road boulder zone (offset +2.55m toward LEFT uphill side)
  const blockCenter = pos.clone().addScaledVector(left, 2.55);

  return {
    group,
    data: {
      id,
      label,
      position: pos.clone(),
      blockCenter,
      tangent: tan.clone(),
      right,
      halfWidth: 2.35,
      halfLength: 6.2,
      debrisGroup,
      jcbBoomPivot,
      beaconLightMat,
      clearing: false,
      clearProgress: 0,
      cleared: false,
    },
  };
}

/**
 * Builds a realistic Indian Highway Motorcycle (Splendor / Royal Enfield style) with helmeted rider
 * for Dhaba parking & arriving/departing traffic!
 */
export function buildIndianMotorcycleWithRider(seed = 0): {
  group: THREE.Group;
  riderGroup: THREE.Group;
  headlightMat: THREE.MeshStandardMaterial;
} {
  const g = new THREE.Group();
  const tankPalette = [0xb91c1c, 0x1d4ed8, 0x0f172a, 0x15803d, 0xd97706];
  const jacketPalette = [0x1e293b, 0x991b1b, 0x0369a1, 0x3f6212];

  const tireMat = new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.92 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.88 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.72 });
  const tankMat = new THREE.MeshPhysicalMaterial({
    color: tankPalette[seed % tankPalette.length],
    roughness: 0.25,
    metalness: 0.35,
    clearcoat: 0.85,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfffbeb,
    emissive: 0xfef08a,
    emissiveIntensity: 0.9,
  });

  // Front & rear spoked wheels
  for (const wz of [0.68, -0.66]) {
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.065, 8, 16), tireMat);
    tire.rotation.y = Math.PI / 2;
    tire.position.set(0, 0.34, wz);
    g.add(tire);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.14, 10), chromeMat);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(0, 0.34, wz);
    g.add(hub);
  }

  // Chassis frame, engine block & exhaust silencer
  const engine = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 0.42), chromeMat);
  engine.position.set(0, 0.46, 0.04);
  g.add(engine);
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.95, 8), chromeMat);
  exhaust.rotation.x = Math.PI / 2 - 0.12;
  exhaust.position.set(-0.18, 0.34, -0.35);
  g.add(exhaust);

  // Fuel tank & cushioned seat
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.52), tankMat);
  tank.position.set(0, 0.78, 0.22);
  tank.castShadow = true;
  g.add(tank);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.72), darkMat);
  seat.position.set(0, 0.72, -0.32);
  g.add(seat);

  // Front forks, handlebar, headlight & red tail lamp
  const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.72, 8), chromeMat);
  fork.position.set(0, 0.68, 0.54);
  fork.rotation.x = -0.32;
  g.add(fork);
  const handleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.66, 8), chromeMat);
  handleBar.rotation.z = Math.PI / 2;
  handleBar.position.set(0, 1.0, 0.44);
  g.add(handleBar);
  const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.14, 10), headlightMat);
  hl.rotation.x = Math.PI / 2;
  hl.position.set(0, 0.92, 0.66);
  g.add(hl);
  const tl = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.1, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0xef4444, emissiveIntensity: 0.7 })
  );
  tl.position.set(0, 0.74, -0.78);
  g.add(tl);

  // Helmeted Indian Rider (visible while riding in & out; hides when parked so rider is "inside Dhaba"!)
  const riderGroup = new THREE.Group();
  const jacketMat = new THREE.MeshStandardMaterial({
    color: jacketPalette[seed % jacketPalette.length],
    roughness: 0.8,
  });
  const helmetMat = new THREE.MeshPhysicalMaterial({
    color: seed % 2 === 0 ? 0x0f172a : 0xdc2626,
    roughness: 0.22,
    clearcoat: 0.9,
  });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.52, 0.24), jacketMat);
  torso.position.set(0, 1.12, -0.18);
  torso.rotation.x = 0.22;
  riderGroup.add(torso);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), helmetMat);
  helmet.position.set(0, 1.52, -0.08);
  riderGroup.add(helmet);
  for (const sx of [-0.18, 0.18]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.055, 0.52, 8), darkMat);
    leg.position.set(sx, 0.64, -0.05);
    leg.rotation.x = -0.35;
    riderGroup.add(leg);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.042, 0.46, 8), jacketMat);
    arm.position.set(sx * 1.1, 1.14, 0.16);
    arm.rotation.x = 1.15;
    riderGroup.add(arm);
  }
  g.add(riderGroup);

  return { group: g, riderGroup, headlightMat };
}

export interface DhabaVisitorVehicle {
  mesh: THREE.Group;
  riderGroup?: THREE.Group;
  kind: 'bike' | 'car' | 'suv' | 'bus';
  parkLocalX: number;
  parkLocalZ: number;
  parkYaw: number;
  entryZ: number;
  exitZ: number;
  roadEdgeX: number;
  cycleDuration: number;
  phaseTime: number;
}

export interface DhabaCrowdPerson {
  mesh: THREE.Group;
  baseX: number;
  baseZ: number;
  walkRadius: number;
  walkSpeed: number;
  phase: number;
}

export interface DhabaComplexData {
  id: string;
  title: string;
  position: THREE.Vector3; // Road centerline point
  busBayWorldPos: THREE.Vector3; // Center of the paved Dhaba Bus Parking Bay
  tangent: THREE.Vector3;
  right: THREE.Vector3;
  group: THREE.Group;
  visitors: DhabaVisitorVehicle[];
  crowd: DhabaCrowdPerson[];
  nightLightMats: THREE.MeshStandardMaterial[];
  dhabaPointLight: THREE.PointLight;
}

function buildDhabaGuestPerson(seed: number): THREE.Group {
  const g = new THREE.Group();
  const shirtPalette = [0xf97316, 0x0284c7, 0xdc2626, 0x16a34a, 0x9333ea, 0xeab308, 0xf43f5e, 0x0d9488];
  const pantPalette = [0x1e293b, 0x334155, 0x451a03, 0x0f172a];
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xc88d65, roughness: 0.78 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtPalette[seed % shirtPalette.length], roughness: 0.85 });
  const pantMat = new THREE.MeshStandardMaterial({ color: pantPalette[seed % pantPalette.length], roughness: 0.9 });

  const lLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.068, 0.74, 8), pantMat);
  lLeg.position.set(-0.1, 0.37, 0);
  g.add(lLeg);
  const rLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.068, 0.74, 8), pantMat);
  rLeg.position.set(0.1, 0.37, 0);
  g.add(rLeg);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.22), shirtMat);
  torso.position.set(0, 1.02, 0);
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), skinMat);
  head.position.set(0, 1.48, 0);
  g.add(head);
  return g;
}

/**
 * Builds a complete lively Indian Highway Dhaba Complex on the LEFT (+X local) side of the highway:
 * - Wide paved parking yard with a dedicated yellow-marked BUS PARKING BAY for the player's bus
 * - Authentic Dhaba hall, tin roof, warm glowing string lights, charpais, clay tandoor & signboard
 * - Mingling crowd of travellers & chai staff
 * - Animated visiting motorcycles/bikes, Indian cars, SUVs, and other buses that drive in from the road,
 *   park at the Dhaba, stay awhile, and then pull out & depart back onto the highway!
 */
export function buildDynamicDhabaComplex(
  id: string,
  title: string,
  hindiName: string,
  pos: THREE.Vector3,
  tan: THREE.Vector3,
  roadWidth: number,
  maxAniso: number
): DhabaComplexData {
  const group = new THREE.Group();
  group.position.copy(pos);
  group.lookAt(pos.clone().add(tan));

  const upVec = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(tan, upVec).normalize();
  const left = right.clone().negate();
  const halfW = roadWidth * 0.5;

  // 1. Wide Paved Dhaba Parking Apron & Courtyard (+X from halfW to halfW + 21m, length 40m)
  const yardW = 20.5;
  const yardL = 40.0;
  const yardCenterX = halfW + yardW * 0.5 - 0.35;
  const tarmacMat = new THREE.MeshStandardMaterial({ color: 0x3b424c, roughness: 0.92 });
  const yardPad = new THREE.Mesh(new THREE.BoxGeometry(yardW, 0.16, yardL), tarmacMat);
  yardPad.position.set(yardCenterX, -0.02, 0);
  yardPad.receiveShadow = true;
  group.add(yardPad);

  // Gravel shoulder apron border
  const gravelMat = new THREE.MeshStandardMaterial({ color: 0x6b6254, roughness: 0.96 });
  const apron = new THREE.Mesh(new THREE.BoxGeometry(yardW + 2.4, 0.1, yardL + 5.0), gravelMat);
  apron.position.set(yardCenterX + 0.6, -0.06, 0);
  apron.receiveShadow = true;
  group.add(apron);

  // Dedicated Yellow-Marked Player BUS PARKING BAY (at X = halfW + 3.4, Z = -6.5)
  const busBayX = halfW + 3.4;
  const busBayZ = -6.5;
  const paintYellow = new THREE.MeshBasicMaterial({ color: 0xfacc15 });
  const bayW = 4.2;
  const bayL = 14.2;
  // Painted parking bay outline strips
  for (const bx of [-bayW / 2, bayW / 2]) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.18, bayL), paintYellow);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(busBayX + bx, 0.08, busBayZ);
    group.add(strip);
  }
  for (const bz of [-bayL / 2, bayL / 2]) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(bayW, 0.18), paintYellow);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(busBayX, 0.08, busBayZ + bz);
    group.add(strip);
  }

  // Crisp "BUS PARKING • DHABA STOP" Roadside Signpost
  const parkSignTex = createSignboardTexture(
    'DHABA BUS PARKING',
    'FREE PARKING • TEA & MEALS',
    '#14532D',
    '#FFFFFF',
    '#FACC15',
    maxAniso
  );
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.6 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 8), darkMetal);
  post.position.set(halfW + 1.2, 1.7, -18.5);
  group.add(post);
  const parkSign = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 1.15, 0.12),
    new THREE.MeshStandardMaterial({
      map: parkSignTex,
      emissiveMap: parkSignTex,
      emissive: 0xffffff,
      emissiveIntensity: 0.3,
      roughness: 0.4,
    })
  );
  parkSign.position.set(halfW + 1.2, 3.05, -18.5);
  parkSign.rotation.y = Math.PI;
  group.add(parkSign);

  // 2. Dhaba Building, Veranda, Charpais, Tandoor & Warm String Lights (set back at X = halfW + 15.8)
  const hallX = halfW + 16.0;
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.88 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x7c4a26, roughness: 0.85 });
  const nightLightMats: THREE.MeshStandardMaterial[] = [];

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.34, 19.5), concreteMat);
  plinth.position.set(hallX - 0.6, 0.17, 0);
  plinth.receiveShadow = true;
  group.add(plinth);

  const mainHall = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 3.8, 16.0),
    new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.82 })
  );
  mainHall.position.set(hallX + 0.6, 2.08, 0);
  mainHall.castShadow = true;
  group.add(mainHall);

  // Warm glowing Dhaba interior doorway & windows
  const dhabaWindowMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.45,
    roughness: 0.25,
  });
  nightLightMats.push(dhabaWindowMat);
  for (const wz of [-5.0, -1.6, 1.8, 5.2]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.45, 2.0), dhabaWindowMat);
    win.position.set(hallX - 2.02, 2.15, wz);
    group.add(win);
  }

  // Red Corrugated Tin Veranda Roof
  const tinRoof = new THREE.Mesh(
    new THREE.BoxGeometry(8.6, 0.22, 18.8),
    new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.58, metalness: 0.35 })
  );
  tinRoof.position.set(hallX - 0.4, 4.1, 0);
  tinRoof.rotation.z = 0.12;
  tinRoof.castShadow = true;
  group.add(tinRoof);

  // Veranda support pillars
  for (const pz of [-8.2, -2.8, 2.8, 8.2]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.8, 8), darkMetal);
    pillar.position.set(hallX - 3.6, 2.05, pz);
    group.add(pillar);
  }

  // Festive Warm Glowing Dhaba Bulb Garland along the front eave
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfbbf24,
    emissiveIntensity: 0.6,
  });
  nightLightMats.push(bulbMat);
  for (let b = 0; b < 11; b++) {
    const bz = -8.5 + b * 1.7;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), bulbMat);
    bulb.position.set(hallX - 4.1, 3.62, bz);
    group.add(bulb);
  }

  // Warm local point light illuminating Dhaba parking at dusk/night
  const dhabaPointLight = new THREE.PointLight(0xffbe66, 0.6, 28);
  dhabaPointLight.position.set(hallX - 5.2, 4.4, 0);
  group.add(dhabaPointLight);

  // Classic Indian Charpais (cots) + Dining Tables on Courtyard
  const weaveMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.94 });
  for (const cz of [-6.4, -3.2, 0.2, 3.6, 6.8]) {
    const cot = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.5, 2.1), woodMat);
    cot.position.set(hallX - 4.8, 0.35, cz);
    group.add(cot);
    const weave = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.08, 1.85), weaveMat);
    weave.position.set(hallX - 4.8, 0.62, cz);
    group.add(weave);
  }

  // Glowing Clay Tandoor & Chai Stall Counter
  const tandoor = new THREE.Mesh(
    new THREE.CylinderGeometry(0.62, 0.76, 1.08, 12),
    new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.92 })
  );
  tandoor.position.set(hallX - 3.6, 0.64, -9.2);
  group.add(tandoor);
  const embers = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 10),
    new THREE.MeshBasicMaterial({ color: 0xf97316 })
  );
  embers.rotation.x = -Math.PI / 2;
  embers.position.set(hallX - 3.6, 1.2, -9.2);
  group.add(embers);

  // Big Illuminated Dhaba Roof Signboard facing the highway (-X local)
  const signTex = createSignboardTexture(
    title,
    `${hindiName} • TEA, PARANTHA & BUS PARKING`,
    '#7C2D12',
    '#FFFFFF',
    '#F59E0B',
    maxAniso
  );
  const signMat = new THREE.MeshStandardMaterial({
    map: signTex,
    emissiveMap: signTex,
    emissive: 0xffe4b5,
    emissiveIntensity: 0.55,
    roughness: 0.35,
  });
  nightLightMats.push(signMat);
  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.65, 13.8), signMat);
  sign.position.set(hallX - 3.8, 5.15, 0);
  group.add(sign);

  // 3. Lively Dhaba Crowd (9 animated diners, staff & travellers walking between vehicles & tables)
  const crowd: DhabaCrowdPerson[] = [];
  const crowdSpecs: Array<[number, number, number, number]> = [
    [hallX - 4.8, -8.2, 0.55, 1.4],
    [hallX - 5.6, -5.2, 1.2, 1.1],
    [hallX - 5.2, -2.1, 0.45, 0.9],
    [hallX - 6.0, 0.8, 1.45, 1.25],
    [hallX - 4.6, 3.2, 0.5, 1.0],
    [hallX - 5.8, 6.2, 1.15, 1.15],
    [hallX - 7.8, -1.5, 1.8, 1.3],
    [hallX - 7.2, 4.5, 1.6, 1.2],
    [hallX - 3.4, -9.8, 0.4, 1.6],
  ];
  crowdSpecs.forEach(([cx, cz, radius, speed], idx) => {
    const person = buildDhabaGuestPerson(idx * 17 + title.length);
    person.position.set(cx, 0.06, cz);
    group.add(person);
    crowd.push({
      mesh: person,
      baseX: cx,
      baseZ: cz,
      walkRadius: radius,
      walkSpeed: speed,
      phase: idx * 1.37,
    });
  });

  // 4. Dynamic Visiting Vehicles (Bikes, Cars, SUV, Visiting Bus) that Arrive -> Park -> Depart!
  const visitors: DhabaVisitorVehicle[] = [];
  const seedBase = title.length * 7;

  // Visitor A: Indian Motorcycle + Rider
  const bike1 = buildIndianMotorcycleWithRider(seedBase + 1);
  group.add(bike1.group);
  visitors.push({
    mesh: bike1.group,
    riderGroup: bike1.riderGroup,
    kind: 'bike',
    parkLocalX: halfW + 9.2,
    parkLocalZ: -7.8,
    parkYaw: 0.95,
    entryZ: -26,
    exitZ: 28,
    roadEdgeX: halfW - 1.3,
    cycleDuration: 26,
    phaseTime: 4.5,
  });

  // Visitor B: Second Motorcycle + Rider (offset cycle so bikes come & go!)
  const bike2 = buildIndianMotorcycleWithRider(seedBase + 4);
  group.add(bike2.group);
  visitors.push({
    mesh: bike2.group,
    riderGroup: bike2.riderGroup,
    kind: 'bike',
    parkLocalX: halfW + 9.6,
    parkLocalZ: -4.6,
    parkYaw: 1.05,
    entryZ: -26,
    exitZ: 28,
    roadEdgeX: halfW - 1.3,
    cycleDuration: 29,
    phaseTime: 16.5,
  });

  // Visitor C: Maruti Swift Hatchback Car
  const car = buildIndianTrafficVehicle('swift_car', seedBase + 2);
  group.add(car.group);
  visitors.push({
    mesh: car.group,
    kind: 'car',
    parkLocalX: halfW + 8.6,
    parkLocalZ: 0.6,
    parkYaw: 0.62,
    entryZ: -30,
    exitZ: 32,
    roadEdgeX: halfW - 1.5,
    cycleDuration: 34,
    phaseTime: 11.0,
  });

  // Visitor D: Mahindra Bolero SUV
  const suv = buildIndianTrafficVehicle('suv_bolero', seedBase + 5);
  group.add(suv.group);
  visitors.push({
    mesh: suv.group,
    kind: 'suv',
    parkLocalX: halfW + 8.8,
    parkLocalZ: 6.4,
    parkYaw: 0.55,
    entryZ: -30,
    exitZ: 32,
    roadEdgeX: halfW - 1.5,
    cycleDuration: 38,
    phaseTime: 25.0,
  });

  // Visitor E: Visiting HRTC / Private Highway Bus (uses front-north coach slot Z = +11.5 so player's bay at Z = -6.5 stays clear!)
  const visitBus = buildIndianTrafficVehicle(seedBase % 2 === 0 ? 'hrtc_bus' : 'private_bus', seedBase + 3);
  group.add(visitBus.group);
  visitors.push({
    mesh: visitBus.group,
    kind: 'bus',
    parkLocalX: halfW + 4.3,
    parkLocalZ: 10.5,
    parkYaw: 0.12,
    entryZ: -34,
    exitZ: 36,
    roadEdgeX: halfW - 1.7,
    cycleDuration: 46,
    phaseTime: 14.0,
  });

  const busBayWorldPos = pos
    .clone()
    .addScaledVector(left, busBayX)
    .addScaledVector(tan, busBayZ);

  return {
    id,
    title,
    position: pos.clone(),
    busBayWorldPos,
    tangent: tan.clone(),
    right,
    group,
    visitors,
    crowd,
    nightLightMats,
    dhabaPointLight,
  };
}

/**
 * Animates a Dhaba's arriving/parking/departing bikes, cars & buses, mingling crowd, and night lights.
 */
export function updateDhabaComplex(
  dhaba: DhabaComplexData,
  dt: number,
  elapsed: number,
  nightFactor: number
): void {
  // Brighten warm Dhaba signage, fairy lights & courtyard point light at dusk/night
  const emissiveVal = 0.35 + nightFactor * 1.25;
  for (const m of dhaba.nightLightMats) {
    m.emissiveIntensity = emissiveVal;
  }
  dhaba.dhabaPointLight.intensity = 0.3 + nightFactor * 4.2;

  // Animate mingling Dhaba crowd walking casually between tables and parking yard
  for (const p of dhaba.crowd) {
    const a = elapsed * p.walkSpeed * 0.48 + p.phase;
    const x = p.baseX + Math.cos(a) * p.walkRadius;
    const z = p.baseZ + Math.sin(a * 0.8) * p.walkRadius;
    const dx = -Math.sin(a) * p.walkRadius;
    const dz = Math.cos(a * 0.8) * p.walkRadius * 0.8;
    p.mesh.position.set(x, 0.06 + Math.abs(Math.sin(elapsed * 4.5 + p.phase)) * 0.04, z);
    if (dx * dx + dz * dz > 0.001) {
      p.mesh.rotation.y = Math.atan2(dx, dz);
    }
  }

  // Animate visiting cars, bikes & buses: Arrive from highway -> Park at Dhaba -> Depart onto highway!
  for (const v of dhaba.visitors) {
    v.phaseTime = (v.phaseTime + dt) % v.cycleDuration;
    const frac = v.phaseTime / v.cycleDuration;

    // 0.00..0.18: Arriving from highway into parking bay
    // 0.18..0.70: Parked at Dhaba (rider gets off bike while eating!)
    // 0.70..0.88: Pulling out & departing back onto highway
    // 0.88..1.00: Away on highway (hidden before next arrival)
    if (frac < 0.18) {
      v.mesh.visible = true;
      if (v.riderGroup) v.riderGroup.visible = true;
      const u = frac / 0.18;
      const smooth = u * u * (3 - 2 * u);
      const x = THREE.MathUtils.lerp(v.roadEdgeX, v.parkLocalX, Math.pow(smooth, 0.85));
      const z = THREE.MathUtils.lerp(v.entryZ, v.parkLocalZ, smooth);
      const nextU = Math.min(1, u + 0.04);
      const nextSmooth = nextU * nextU * (3 - 2 * nextU);
      const nx = THREE.MathUtils.lerp(v.roadEdgeX, v.parkLocalX, Math.pow(nextSmooth, 0.85));
      const nz = THREE.MathUtils.lerp(v.entryZ, v.parkLocalZ, nextSmooth);
      v.mesh.position.set(x, 0.06, z);
      v.mesh.rotation.y = Math.atan2(nx - x, nz - z);
    } else if (frac < 0.70) {
      v.mesh.visible = true;
      if (v.riderGroup) v.riderGroup.visible = false;
      v.mesh.position.set(v.parkLocalX, 0.06, v.parkLocalZ);
      v.mesh.rotation.y = v.parkYaw;
    } else if (frac < 0.88) {
      v.mesh.visible = true;
      if (v.riderGroup) v.riderGroup.visible = true;
      const u = (frac - 0.70) / 0.18;
      const smooth = u * u * (3 - 2 * u);
      const x = THREE.MathUtils.lerp(v.parkLocalX, v.roadEdgeX, Math.pow(smooth, 1.15));
      const z = THREE.MathUtils.lerp(v.parkLocalZ, v.exitZ, smooth);
      const nextU = Math.min(1, u + 0.04);
      const nextSmooth = nextU * nextU * (3 - 2 * nextU);
      const nx = THREE.MathUtils.lerp(v.parkLocalX, v.roadEdgeX, Math.pow(nextSmooth, 1.15));
      const nz = THREE.MathUtils.lerp(v.parkLocalZ, v.exitZ, nextSmooth);
      v.mesh.position.set(x, 0.06, z);
      v.mesh.rotation.y = Math.atan2(nx - x, nz - z);
    } else {
      v.mesh.visible = false;
    }
  }
}

