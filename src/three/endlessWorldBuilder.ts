import * as THREE from 'three';
import type { EndlessBiome, WeatherPreset } from '../types/simulator';
import {
  buildCurvedMountainTunnel,
  buildDynamicDhabaComplex,
  buildHighAltitudeClouds,
  buildHillMarketTownComplex,
  buildIndianTrafficVehicle,
  buildPahadiMountainHouse,
  buildRoadLandslideZone,
  buildSmallRoadsideMandir,
  createHighDetailAsphaltTexture,
  makeLocalColliderOBB,
  updateDhabaComplex,
  updateHillMarketTown,
  type DhabaComplexData,
  type HighAltitudeCloudHandle,
  type HillMarketTownData,
  type LandslideZoneData,
  type StaticColliderOBB,
  type TrafficKind,
} from './sceneryAndTraffic';

export interface EndlessTrafficVehicle {
  mesh: THREE.Group;
  sMeters: number; // longitudinal distance along endless ribbon
  cruiseSpeedMs: number;
  direction: 1 | -1;
  laneOffset: number;
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

interface EndlessSamplePoint {
  s: number; // cumulative meters
  pos: THREE.Vector3;
  tan: THREE.Vector3;
  right: THREE.Vector3;
  biome: EndlessBiome;
}

interface EndlessChunk {
  index: number;
  biome: EndlessBiome;
  startS: number;
  endS: number;
  group: THREE.Group;
  samples: EndlessSamplePoint[];
  landslide: LandslideZoneData | null;
  dhaba: DhabaComplexData | null;
  market: HillMarketTownData | null;
  clouds: HighAltitudeCloudHandle | null;
  colliders: StaticColliderOBB[];
}

export interface EndlessWorldHandle {
  root: THREE.Group;
  roadWidth: number;
  traffic: EndlessTrafficVehicle[];
  rainSystem: THREE.Points;
  startPos: THREE.Vector3;
  startHeading: number;
  getLandslides: () => LandslideZoneData[];
  getDhabas: () => DhabaComplexData[];
  getMarkets: () => HillMarketTownData[];
  getColliders: () => StaticColliderOBB[];
  sampleRoadAt: (pos: THREE.Vector3) => {
    sMeters: number;
    point: THREE.Vector3;
    tangent: THREE.Vector3;
    right: THREE.Vector3;
    lateralOffset: number;
    slopeRad: number;
    elevationM: number;
    biome: EndlessBiome;
  };
  updateWorld: (
    dt: number,
    elapsed: number,
    busPos: THREE.Vector3,
    busHeading: number,
    busSpeedMs: number,
    hornBlowing: boolean,
    isRaining: boolean,
    nightFactor?: number,
    timeOfDayHours?: number,
    weather?: WeatherPreset
  ) => void;
  dispose: () => void;
}

const BIOME_CYCLE: EndlessBiome[] = ['mountain', 'foothills', 'plains', 'foothills'];

function buildPlainsVillageHouse(seed: number): THREE.Group {
  const g = new THREE.Group();
  const colors = [0xfef3c7, 0xe0f2fe, 0xfce7f3, 0xe2e8f0, 0xdcfce7];
  const wallMat = new THREE.MeshStandardMaterial({ color: colors[seed % colors.length], roughness: 0.85 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.82 });
  const winMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.35,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(7.2, 3.8, 5.6), wallMat);
  body.position.set(0, 1.9, 0);
  body.castShadow = true;
  g.add(body);

  // Classic North Indian flat parapet terrace roof
  const parapet = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.72, 5.9), trimMat);
  parapet.position.set(0, 4.15, 0);
  g.add(parapet);

  const porch = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.24, 1.8), trimMat);
  porch.position.set(0, 2.75, 3.5);
  g.add(porch);

  for (const wx of [-2.0, 2.0]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 0.12), winMat);
    win.position.set(wx, 2.1, 2.84);
    g.add(win);
  }
  return g;
}

/**
 * Seamless Endless Procedural Highway Generator:
 * Smoothly transitions across Mountain -> Foothills -> Plains -> Foothills -> Mountain in continuity
 * with ZERO toll plazas, realistic Indian traffic, Pahadi houses, grass, and occasional mountain tunnels.
 */
export function buildEndlessMountainWorld(renderer: THREE.WebGLRenderer): EndlessWorldHandle {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const root = new THREE.Group();
  const roadWidth = 11.4;
  const halfW = roadWidth * 0.5;
  const upVec = new THREE.Vector3(0, 1, 0);

  // Shared high-detail asphalt & foliage materials across chunks
  const asphaltTex = createHighDetailAsphaltTexture(maxAniso, 58);
  const roadMat = new THREE.MeshStandardMaterial({
    map: asphaltTex,
    roughness: 0.84,
    metalness: 0.04,
  });
  const terrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  const parapetMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.92 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.94 });
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88 });
  const grassMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.92 });

  const chunks: EndlessChunk[] = [];
  let nextChunkIndex = 0;
  let cursorPos = new THREE.Vector3(0, 0, 0);
  let cursorHeading = 0;
  let cursorS = 0;
  let currentBusS = 25;

  const disposeObject = (obj: THREE.Object3D) => {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.InstancedMesh) {
        child.geometry.dispose();
        // Don't dispose shared top-level materials (roadMat, terrainMat, etc.)
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const m of mats) {
          if (
            m !== roadMat &&
            m !== terrainMat &&
            m !== parapetMat &&
            m !== trunkMat &&
            m !== foliageMat &&
            m !== grassMat
          ) {
            m.dispose();
          }
        }
      }
    });
  };

  const generateNextChunk = (): EndlessChunk => {
    const idx = nextChunkIndex++;
    // Each biome runs smoothly for 2 chunks (~1.05km) before seamlessly blending into the next terrain
    const biome = BIOME_CYCLE[Math.floor(idx / 2) % BIOME_CYCLE.length];
    const prevBiome = idx === 0 ? biome : BIOME_CYCLE[Math.floor((idx - 1) / 2) % BIOME_CYCLE.length];

    const group = new THREE.Group();
    const ctrlPts: THREE.Vector3[] = [];
    const numSteps = 12;
    const stepLen = 46;
    const seed = idx * 17.3 + 4.1;

    let px = cursorPos.x;
    let py = cursorPos.y;
    let pz = cursorPos.z;
    let hd = cursorHeading;

    ctrlPts.push(new THREE.Vector3(px, py, pz));
    for (let i = 1; i <= numSteps; i++) {
      const frac = i / numSteps;
      const curveFactor = biome === 'mountain' ? 0.28 : biome === 'foothills' ? 0.18 : 0.08;
      // Keep chunk joins smooth (step 1 follows incoming heading)
      const turn =
        idx === 0 && i <= 2
          ? 0
          : i === 1
            ? 0
            : (Math.sin(i * 0.62 + seed) * curveFactor + Math.cos(i * 0.31 + seed) * (curveFactor * 0.55));
      hd = THREE.MathUtils.clamp(hd + turn, -0.92, 0.92);

      px += Math.sin(hd) * stepLen;
      pz += Math.cos(hd) * stepLen;

      // Smooth vertical elevation transitions between biomes
      if (biome === 'mountain') {
        py += 0.9 + Math.sin(frac * Math.PI + seed) * 0.75;
      } else if (biome === 'foothills') {
        const targetSlope = prevBiome === 'mountain' ? -0.7 : 0.45;
        py += targetSlope + Math.sin(frac * Math.PI * 2 + seed) * 0.35;
      } else {
        // Gently level out toward Haryana plains altitude
        py += THREE.MathUtils.clamp((8 - py) * 0.06, -0.6, 0.4);
      }

      ctrlPts.push(new THREE.Vector3(px, py, pz));
    }

    const curve = new THREE.CatmullRomCurve3(ctrlPts, false, 'catmullrom', 0.5);
    const chunkLen = curve.getLength();
    const startS = cursorS;
    const endS = cursorS + chunkLen;

    // Update cursors for seamless next chunk continuation
    const endPt = curve.getPointAt(1);
    const endTan = curve.getTangentAt(1).normalize();
    cursorPos.copy(endPt);
    cursorHeading = Math.atan2(endTan.x, endTan.z);
    cursorS = endS;

    // Sample chunk centerline LUT
    const segs = 90;
    const samples: EndlessSamplePoint[] = [];
    const roadPos: number[] = [];
    const roadUvs: number[] = [];
    const roadIdx: number[] = [];
    const leftPos: number[] = [];
    const leftCols: number[] = [];
    const leftIdx: number[] = [];
    const rightPos: number[] = [];
    const rightCols: number[] = [];
    const rightIdx: number[] = [];

    const leftVec = new THREE.Vector3();
    const chunkColliders: StaticColliderOBB[] = [];
    const hasMountainTunnel = biome === 'mountain' && idx > 0 && idx % 3 === 1;
    const tunnelTStart = 0.42;
    const tunnelTEnd = 0.62;
    // Guaranteed early Dhaba right ahead on chunk 0 (t=0.34, ~160m from spawn!) & every even chunk
    const hasDhaba = !hasMountainTunnel && (idx === 0 || idx % 2 === 0);
    const dhabaT = idx === 0 ? 0.34 : 0.52;
    // Clustered Hill Market Town (houses + shops + school) on odd non-tunnel chunks & chunk 0 upper end!
    const hasMarket = !hasMountainTunnel && biome !== 'plains' && (idx === 0 || idx % 2 === 1);
    const marketT = idx === 0 ? 0.80 : 0.56;

    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t).normalize();
      const right = new THREE.Vector3().crossVectors(tan, upVec).normalize();
      leftVec.copy(right).negate();

      samples.push({
        s: startS + t * chunkLen,
        pos: p,
        tan,
        right,
        biome,
      });

      const rL = p.clone().addScaledVector(leftVec, halfW);
      const rR = p.clone().addScaledVector(right, halfW);
      roadPos.push(rL.x, rL.y + 0.04, rL.z, rR.x, rR.y + 0.04, rR.z);
      roadUvs.push(0, t, 1, t);

      // Blend biome terrain profile smoothly across first 25% of chunk when biome changes
      const blend = prevBiome !== biome ? Math.min(1, t / 0.28) : 1;
      const getHeightProfile = (b: EndlessBiome) =>
        b === 'mountain'
          ? { lMidY: 22, lPeakY: 56, rMidY: -20, rFloorY: -56 }
          : b === 'foothills'
            ? { lMidY: 9, lPeakY: 24, rMidY: -4.5, rFloorY: -10 }
            : { lMidY: 0.6, lPeakY: 2.2, rMidY: -0.35, rFloorY: -0.8 };

      const pPrev = getHeightProfile(prevBiome);
      const pCur = getHeightProfile(biome);
      const lMidY = THREE.MathUtils.lerp(pPrev.lMidY, pCur.lMidY, blend);
      const lPeakY = THREE.MathUtils.lerp(pPrev.lPeakY, pCur.lPeakY, blend);
      const rMidY = THREE.MathUtils.lerp(pPrev.rMidY, pCur.rMidY, blend);
      const rFloorY = THREE.MathUtils.lerp(pPrev.rFloorY, pCur.rFloorY, blend);

      const inTunnel = hasMountainTunnel && t >= tunnelTStart - 0.02 && t <= tunnelTEnd + 0.02;
      const nearDhaba = hasDhaba && Math.abs(t - dhabaT) < 0.14;
      const nearMarket = hasMarket && Math.abs(t - marketT) < 0.15;
      const nearWide = nearDhaba || nearMarket;
      const lShoulderOut = nearWide ? 25.5 : inTunnel ? 8.5 : 4.2;
      const lMidOut = nearWide ? 42 : 24;

      const c0 = p.clone().addScaledVector(leftVec, halfW + 0.1);
      const c1 = p.clone().addScaledVector(leftVec, halfW + lShoulderOut);
      const c2 = p
        .clone()
        .addScaledVector(leftVec, halfW + lMidOut)
        .add(new THREE.Vector3(0, (inTunnel ? 8 : nearWide ? Math.min(lMidY, 10) : lMidY) + Math.sin(t * 14 + seed) * (biome === 'plains' ? 0.3 : 3.2), 0));
      const c3 = p
        .clone()
        .addScaledVector(leftVec, halfW + 92)
        .add(new THREE.Vector3(0, lPeakY + Math.cos(t * 9 + seed) * (biome === 'plains' ? 0.6 : 8), 0));

      leftPos.push(
        c0.x, c0.y - 0.12, c0.z,
        c1.x, c1.y - 0.14, c1.z,
        c2.x, c2.y, c2.z,
        c3.x, c3.y, c3.z
      );

      // Biome vertex colors (Himalayan pine slate vs golden-green Haryana plains fields)
      if (biome === 'plains') {
        leftCols.push(0.36, 0.38, 0.25, 0.35, 0.49, 0.22, 0.44, 0.56, 0.21, 0.38, 0.48, 0.2);
        rightCols.push(0.36, 0.38, 0.25, 0.33, 0.48, 0.22, 0.48, 0.56, 0.22, 0.35, 0.46, 0.2);
      } else if (biome === 'foothills') {
        leftCols.push(0.33, 0.38, 0.26, 0.28, 0.44, 0.23, 0.24, 0.38, 0.21, 0.26, 0.36, 0.26);
        rightCols.push(0.33, 0.38, 0.26, 0.28, 0.43, 0.23, 0.22, 0.36, 0.2, 0.2, 0.32, 0.22);
      } else {
        leftCols.push(0.32, 0.35, 0.29, 0.27, 0.39, 0.22, 0.22, 0.33, 0.2, 0.34, 0.41, 0.37);
        rightCols.push(0.34, 0.36, 0.31, 0.26, 0.38, 0.22, 0.16, 0.29, 0.17, 0.14, 0.24, 0.2);
      }

      const v0 = p.clone().addScaledVector(right, halfW + 0.1);
      const v1 = p.clone().addScaledVector(right, halfW + 3.6);
      const v2 = p.clone().addScaledVector(right, halfW + 30).add(new THREE.Vector3(0, rMidY, 0));
      const v3 = p.clone().addScaledVector(right, halfW + 108).add(new THREE.Vector3(0, rFloorY, 0));

      rightPos.push(
        v0.x, v0.y - 0.12, v0.z,
        v1.x, v1.y - 0.16, v1.z,
        v2.x, v2.y, v2.z,
        v3.x, v3.y, v3.z
      );

      if (i < segs) {
        const ri = i * 2;
        roadIdx.push(ri, ri + 1, ri + 2, ri + 1, ri + 3, ri + 2);
        const ti = i * 4;
        for (let sIdx = 0; sIdx < 3; sIdx++) {
          const a = ti + sIdx;
          const b = a + 1;
          const c = ti + 4 + sIdx;
          const d = c + 1;
          leftIdx.push(a, c, b, b, c, d);
          rightIdx.push(a, b, c, b, d, c);
        }
      }
    }

    // Road-clearance clamp so NO hill vertex ever intrudes onto the road
    const clearSq = (halfW + 3.4) * (halfW + 3.4);
    const clampPositions = (arr: number[]) => {
      const nv = arr.length / 3;
      for (let v = 0; v < nv; v++) {
        if (v % 4 === 0) continue;
        const vx = arr[v * 3];
        const vy = arr[v * 3 + 1];
        const vz = arr[v * 3 + 2];
        for (let k = 0; k < samples.length; k += 2) {
          const sp = samples[k].pos;
          const dx = vx - sp.x;
          const dz = vz - sp.z;
          if (dx * dx + dz * dz < clearSq && vy > sp.y - 0.45) {
            arr[v * 3 + 1] = sp.y - 0.65;
            break;
          }
        }
      }
    };
    clampPositions(leftPos);
    clampPositions(rightPos);

    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPos, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
    roadGeo.setIndex(roadIdx);
    roadGeo.computeVertexNormals();
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.receiveShadow = true;
    group.add(roadMesh);

    const lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute('position', new THREE.Float32BufferAttribute(leftPos, 3));
    lGeo.setAttribute('color', new THREE.Float32BufferAttribute(leftCols, 3));
    lGeo.setIndex(leftIdx);
    lGeo.computeVertexNormals();
    const lMesh = new THREE.Mesh(lGeo, terrainMat);
    lMesh.receiveShadow = true;
    group.add(lMesh);

    const rGeo = new THREE.BufferGeometry();
    rGeo.setAttribute('position', new THREE.Float32BufferAttribute(rightPos, 3));
    rGeo.setAttribute('color', new THREE.Float32BufferAttribute(rightCols, 3));
    rGeo.setIndex(rightIdx);
    rGeo.computeVertexNormals();
    const rMesh = new THREE.Mesh(rGeo, terrainMat);
    rMesh.receiveShadow = true;
    group.add(rMesh);

    const dummy = new THREE.Object3D();

    // Mountain parapets on mountain/foothills valley edge
    if (biome !== 'plains') {
      const pCount = 46;
      const pInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.55, 0.72, 2.2), parapetMat, pCount);
      let actual = 0;
      for (let i = 0; i < pCount; i++) {
        const t = i / (pCount - 1);
        if (hasMountainTunnel && t >= tunnelTStart - 0.02 && t <= tunnelTEnd + 0.02) continue;
        const p = curve.getPointAt(t);
        const tan = curve.getTangentAt(t).normalize();
        const right = new THREE.Vector3().crossVectors(tan, upVec).normalize();
        dummy.position.copy(p).addScaledVector(right, halfW + 0.58);
        dummy.position.y += 0.34;
        dummy.lookAt(dummy.position.clone().add(tan));
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        pInst.setMatrixAt(actual++, dummy.matrix);
      }
      pInst.count = actual;
      pInst.instanceMatrix.needsUpdate = true;
      group.add(pInst);
    }

    // Lush Grass Tufts along shoulders
    const grassCount = 170;
    const grassInst = new THREE.InstancedMesh(new THREE.ConeGeometry(0.42, 0.82, 5), grassMat, grassCount);
    const grassColors =
      biome === 'plains'
        ? [new THREE.Color(0x4d8b31), new THREE.Color(0x7ca236), new THREE.Color(0x659632)]
        : [new THREE.Color(0x2f6b2f), new THREE.Color(0x3f7d2f), new THREE.Color(0x27592a)];
    let gPlaced = 0;
    for (let i = 0; i < grassCount; i++) {
      const t = ((i * 0.7548776) % 0.96) + 0.02;
      if (hasMountainTunnel && t >= tunnelTStart - 0.02 && t <= tunnelTEnd + 0.02) continue;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t).normalize();
      const right = new THREE.Vector3().crossVectors(tan, upVec).normalize();
      const rightSide = i % 2 === 0;
      if (!rightSide && ((hasDhaba && Math.abs(t - dhabaT) < 0.14) || (hasMarket && Math.abs(t - marketT) < 0.15))) continue;
      const off = 1.2 + ((i * 19) % 70) * 0.15;
      const distOut = rightSide ? halfW + off : -(halfW + off);
      const yOff =
        biome === 'plains'
          ? -0.05
          : rightSide
            ? -(off > 3.4 ? (off - 3.4) * 0.52 : 0.12)
            : off > 4.2
              ? (off - 4.2) * (biome === 'mountain' ? 0.68 : 0.3)
              : -0.05;
      const sc = 0.75 + (i % 6) * 0.12;
      dummy.position.copy(p).addScaledVector(right, distOut);
      dummy.position.y += yOff + 0.35 * sc;
      dummy.rotation.set(0, (i * 1.9) % (Math.PI * 2), 0);
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      grassInst.setMatrixAt(gPlaced, dummy.matrix);
      grassInst.setColorAt(gPlaced, grassColors[i % grassColors.length]);
      gPlaced++;
    }
    grassInst.count = gPlaced;
    grassInst.instanceMatrix.needsUpdate = true;
    if (grassInst.instanceColor) grassInst.instanceColor.needsUpdate = true;
    group.add(grassInst);

    // Biome-Matched Trees (Deodar Pines in Mountains/Foothills, Broadleaf Neem/Sheesham in Plains)
    const tCount = 72;
    const trunkInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.24, 0.4, 3.6, 6), trunkMat, tCount);
    const crownGeo =
      biome === 'plains' ? new THREE.DodecahedronGeometry(3.2, 0) : new THREE.ConeGeometry(2.6, 9.0, 7);
    const crownInst = new THREE.InstancedMesh(crownGeo, foliageMat, tCount);
    const treeColors =
      biome === 'plains'
        ? [new THREE.Color(0x2d6a2d), new THREE.Color(0x3a7d32), new THREE.Color(0x255b26)]
        : [new THREE.Color(0x164e31), new THREE.Color(0x1d5e3a), new THREE.Color(0x143f29)];
    let tPlaced = 0;
    for (let i = 0; i < tCount; i++) {
      const t = ((i * 0.6180339) % 0.96) + 0.02;
      if (hasMountainTunnel && t >= tunnelTStart - 0.03 && t <= tunnelTEnd + 0.03) continue;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t).normalize();
      const right = new THREE.Vector3().crossVectors(tan, upVec).normalize();
      const rightSide = i % 2 === 0;
      if (!rightSide && ((hasDhaba && Math.abs(t - dhabaT) < 0.15) || (hasMarket && Math.abs(t - marketT) < 0.16))) continue;
      const off = 9.5 + (i % 7) * 5.2;
      const distOut = rightSide ? halfW + off : -(halfW + off);
      const yOff =
        biome === 'plains'
          ? 0
          : rightSide
            ? -off * (biome === 'mountain' ? 0.52 : 0.14)
            : off * (biome === 'mountain' ? 0.68 : 0.28);
      const sc = 0.85 + ((i * 17) % 35) / 100;

      dummy.position.copy(p).addScaledVector(right, distOut);
      dummy.position.y += yOff + 1.7 * sc - 0.4;
      dummy.rotation.set(0, (i * 2.3) % (Math.PI * 2), 0);
      dummy.scale.set(sc, sc, sc);
      dummy.updateMatrix();
      trunkInst.setMatrixAt(tPlaced, dummy.matrix);

      dummy.position.y += (biome === 'plains' ? 3.2 : 4.5) * sc;
      dummy.updateMatrix();
      crownInst.setMatrixAt(tPlaced, dummy.matrix);
      crownInst.setColorAt(tPlaced, treeColors[i % treeColors.length]);
      tPlaced++;
    }
    trunkInst.count = tPlaced;
    crownInst.count = tPlaced;
    trunkInst.instanceMatrix.needsUpdate = true;
    crownInst.instanceMatrix.needsUpdate = true;
    if (crownInst.instanceColor) crownInst.instanceColor.needsUpdate = true;
    group.add(trunkInst);
    group.add(crownInst);

    // Mountain Pahadi Houses or Haryana Plains Cottages along the roadside (with solid colliders!)
    for (let h = 0; h < 3; h++) {
      const t = 0.18 + h * 0.31;
      if (hasMountainTunnel && t >= tunnelTStart - 0.05 && t <= tunnelTEnd + 0.05) continue;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t).normalize();
      const right = new THREE.Vector3().crossVectors(tan, upVec).normalize();
      const left = right.clone().negate();
      const onLeft = (idx + h) % 2 === 0;
      if (onLeft && ((hasDhaba && Math.abs(t - dhabaT) < 0.16) || (hasMarket && Math.abs(t - marketT) < 0.17))) continue;
      const house = biome === 'plains' ? buildPlainsVillageHouse(idx * 7 + h) : buildPahadiMountainHouse(idx * 11 + h);
      const distOut = halfW + 13.5 + (h % 2) * 4.5;
      house.position.copy(p).addScaledVector(onLeft ? left : right, distOut);
      if (biome !== 'plains') {
        house.position.y += onLeft
          ? (distOut - halfW - 3) * (biome === 'mountain' ? 0.58 : 0.22)
          : -(distOut - halfW - 3) * (biome === 'mountain' ? 0.42 : 0.12);
      }
      house.lookAt(p.clone().addScaledVector(onLeft ? right : left, 8));
      group.add(house);
      chunkColliders.push(
        makeLocalColliderOBB(
          p,
          tan,
          right,
          onLeft ? distOut : -distOut,
          0,
          3.6,
          3.2,
          `endless-house-${idx}-${h}`,
          'Roadside House',
          'house'
        )
      );
    }

    // Small Roadside Pahadi Mandirs in mountain & foothill chunks!
    if (biome !== 'plains') {
      const shrineTs = [0.16, 0.68];
      shrineTs.forEach((st, sIdx) => {
        if (hasMountainTunnel && st >= tunnelTStart - 0.05 && st <= tunnelTEnd + 0.05) return;
        if (hasDhaba && Math.abs(st - dhabaT) < 0.15) return;
        if (hasMarket && Math.abs(st - marketT) < 0.16) return;
        const sp = curve.getPointAt(st);
        const stan = curve.getTangentAt(st).normalize();
        const sright = new THREE.Vector3().crossVectors(stan, upVec).normalize();
        const shrine = buildSmallRoadsideMandir(
          `endless-mandir-${idx}-${sIdx}`,
          sp,
          stan,
          sright,
          true,
          halfW + 3.05
        );
        group.add(shrine.group);
        chunkColliders.push(shrine.collider);
      });
    }

    // High-Altitude 3D Clouds in mountain biome chunks!
    let clouds: HighAltitudeCloudHandle | null = null;
    if (biome === 'mountain') {
      const cloudAnchors: Array<{ pos: THREE.Vector3; right: THREE.Vector3; lowValley?: boolean; scale?: number }> = [];
      for (let c = 0; c < 10; c++) {
        const ct = 0.08 + (c / 9) * 0.84;
        const cp = curve.getPointAt(ct);
        const ctan = curve.getTangentAt(ct).normalize();
        const cright = new THREE.Vector3().crossVectors(ctan, upVec).normalize();
        cloudAnchors.push({
          pos: cp,
          right: cright,
          lowValley: c % 3 === 0,
          scale: c % 3 === 0 ? 1.1 : 1.4,
        });
      }
      clouds = buildHighAltitudeClouds(cloudAnchors, idx * 11 + 3);
      group.add(clouds.group);
    }

    // Occasional curved hollow mountain tunnel in mountain chunks (ZERO tolls in Endless Mode!)
    if (hasMountainTunnel) {
      const builtTunnel = buildCurvedMountainTunnel(
        curve,
        tunnelTStart,
        tunnelTEnd,
        roadWidth,
        `HIMALAYAN PASS TUNNEL #${idx}`,
        maxAniso
      );
      group.add(builtTunnel.group);
      chunkColliders.push(...builtTunnel.colliders);
    }

    // Lively Indian Highway Dhaba Stop with Bus Parking Bay + Arriving/Departing Cars, Bikes & Buses!
    let dhaba: DhabaComplexData | null = null;
    if (hasDhaba) {
      const dhabaNames: Array<[string, string]> = [
        ['SHER-E-PUNJAB HIGHWAY DHABA', 'शेर-ए-पंजाब ढाबा'],
        ['HIMACHAL VAISHNO DHABA', 'हिमाचल वैष्णो ढाबा'],
        ['HARYANA CHAI & PARANTHA DHABA', 'हरियाणा चाय परांठा ढाबा'],
        ['SHIVALIK PAHADI DHABA', 'शिवालिक पहाड़ी ढाबा'],
      ];
      const [dTitle, dHindi] = dhabaNames[idx % dhabaNames.length];
      const dPos = curve.getPointAt(dhabaT);
      const dTan = curve.getTangentAt(dhabaT).normalize();
      dhaba = buildDynamicDhabaComplex(
        `endless-dhaba-${idx}`,
        dTitle,
        dHindi,
        dPos,
        dTan,
        roadWidth,
        maxAniso
      );
      group.add(dhaba.group);
      chunkColliders.push(...dhaba.colliders);
    }

    // Clustered Pahadi Hill Market Town (Homes + Shops + Govt. Hill School together!)
    let market: HillMarketTownData | null = null;
    if (hasMarket) {
      const marketNames: Array<[string, string]> = [
        ['SOLAN RIDGE BAZAAR & SCHOOL', 'सोलन पहाड़ी बाजार व पाठशाला'],
        ['DHARAMSHALA HILL MARKET', 'धर्मशाला कोतवाली बाजार'],
        ['KULLU VALLEY BAZAAR', 'कुल्लू वैली मुख्य बाजार'],
        ['NARKANDA TOWN MARKET', 'नारकंडा कस्बा व स्कूल'],
      ];
      const [mTitle, mHindi] = marketNames[idx % marketNames.length];
      const mPos = curve.getPointAt(marketT);
      const mTan = curve.getTangentAt(marketT).normalize();
      market = buildHillMarketTownComplex(
        `endless-market-${idx}`,
        mTitle,
        mHindi,
        mPos,
        mTan,
        roadWidth,
        maxAniso
      );
      group.add(market.group);
      chunkColliders.push(...market.colliders);
    }

    // Random Half-Road Mountain / Foothill Landslide (~45% of non-tunnel hill chunks, avoiding Dhaba & Market zones)
    let landslide: LandslideZoneData | null = null;
    if (biome !== 'plains' && !hasMountainTunnel && idx > 0 && Math.random() < 0.48) {
      const lsT = hasDhaba || hasMarket ? 0.22 + Math.random() * 0.1 : 0.32 + Math.random() * 0.36;
      const lsBlocked =
        (hasDhaba && Math.abs(lsT - dhabaT) < 0.15) || (hasMarket && Math.abs(lsT - marketT) < 0.16);
      if (!lsBlocked) {
        const lsPos = curve.getPointAt(lsT);
        const lsTan = curve.getTangentAt(lsT).normalize();
        const builtLs = buildRoadLandslideZone(
          `endless-ls-${idx}`,
          biome === 'mountain' ? 'Himalayan Rockfall Slide' : 'Shivalik Hill Landslide',
          lsPos,
          lsTan,
          roadWidth,
          maxAniso
        );
        group.add(builtLs.group);
        landslide = builtLs.data;
      }
    }

    root.add(group);
    return {
      index: idx,
      biome,
      startS,
      endS,
      group,
      samples,
      landslide,
      dhaba,
      market,
      clouds,
      colliders: chunkColliders,
    };
  };

  // Bootstrap initial 4 seamless highway chunks (~2,100m ahead)
  for (let c = 0; c < 4; c++) {
    chunks.push(generateNextChunk());
  }

  const startSample = chunks[0].samples[3];
  const startPos = startSample.pos.clone().addScaledVector(startSample.right, -2.6);
  const startHeading = Math.atan2(startSample.tan.x, startSample.tan.z);

  // Sample exact road frame at longitudinal distance sMeters
  const sampleAtDistance = (sMeters: number): EndlessSamplePoint => {
    for (const ch of chunks) {
      if (sMeters >= ch.startS && sMeters <= ch.endS) {
        const frac = (sMeters - ch.startS) / Math.max(1, ch.endS - ch.startS);
        const idx = THREE.MathUtils.clamp(Math.floor(frac * (ch.samples.length - 1)), 0, ch.samples.length - 1);
        return ch.samples[idx];
      }
    }
    const first = chunks[0].samples[0];
    const lastCh = chunks[chunks.length - 1];
    return sMeters < first.s ? first : lastCh.samples[lastCh.samples.length - 1];
  };

  // Spawn 14 realistic Indian highway vehicles that recycle continuously ahead of the bus
  const traffic: EndlessTrafficVehicle[] = [];
  const trafficPool: TrafficKind[] = [
    'swift_car',
    'hrtc_bus',
    'suv_bolero',
    'private_bus',
    'tata_truck',
    'swift_car',
    'hrtc_bus',
  ];
  for (let i = 0; i < 14; i++) {
    const kind = trafficPool[i % trafficPool.length];
    const direction: 1 | -1 = i % 2 === 0 ? -1 : 1;
    const baseLaneOffset = direction === 1 ? -2.65 : 2.65;
    const built = buildIndianTrafficVehicle(kind, i * 5 + 3);
    root.add(built.group);

    const cruiseSpeedMs =
      kind === 'swift_car'
        ? 14.2
        : kind === 'suv_bolero'
          ? 12.8
          : kind === 'private_bus'
            ? 10.5
            : kind === 'hrtc_bus'
              ? 9.8
              : 8.4;

    traffic.push({
      mesh: built.group,
      sMeters: 95 + i * 105,
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

  // Monsoon rain system
  const rainCount = 900;
  const rainPositions = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i++) {
    rainPositions[i * 3] = (Math.random() - 0.5) * 60;
    rainPositions[i * 3 + 1] = Math.random() * 24;
    rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 60;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rainMat = new THREE.PointsMaterial({ color: 0xcbd5e1, size: 0.22, transparent: true, opacity: 0.65 });
  const rainSystem = new THREE.Points(rainGeo, rainMat);
  rainSystem.visible = false;
  rainSystem.frustumCulled = false;
  root.add(rainSystem);

  function sampleRoadAt(pos: THREE.Vector3) {
    let best: EndlessSamplePoint = chunks[0].samples[0];
    let bestDistSq = Infinity;

    for (const ch of chunks) {
      for (let i = 0; i < ch.samples.length; i++) {
        const sp = ch.samples[i];
        const dx = pos.x - sp.pos.x;
        const dz = pos.z - sp.pos.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          best = sp;
        }
      }
    }

    currentBusS = best.s;
    const dx = pos.x - best.pos.x;
    const dz = pos.z - best.pos.z;
    const lateralOffset = dx * best.right.x + dz * best.right.z;
    const slopeRad = Math.asin(THREE.MathUtils.clamp(best.tan.y, -0.5, 0.5));
    const elevationM = Math.max(240, Math.round(320 + best.pos.y * 5.2));

    return {
      sMeters: best.s,
      point: best.pos,
      tangent: best.tan,
      right: best.right,
      lateralOffset,
      slopeRad,
      elevationM,
      biome: best.biome,
    };
  }

  function getLandslides(): LandslideZoneData[] {
    const list: LandslideZoneData[] = [];
    for (const ch of chunks) {
      if (ch.landslide) list.push(ch.landslide);
    }
    return list;
  }

  function getDhabas(): DhabaComplexData[] {
    const list: DhabaComplexData[] = [];
    for (const ch of chunks) {
      if (ch.dhaba) list.push(ch.dhaba);
    }
    return list;
  }

  function getMarkets(): HillMarketTownData[] {
    const list: HillMarketTownData[] = [];
    for (const ch of chunks) {
      if (ch.market) list.push(ch.market);
    }
    return list;
  }

  function getColliders(): StaticColliderOBB[] {
    const list: StaticColliderOBB[] = [];
    for (const ch of chunks) {
      for (const c of ch.colliders) list.push(c);
    }
    return list;
  }

  function updateWorld(
    dt: number,
    elapsed: number,
    busPos: THREE.Vector3,
    _busHeading: number,
    _busSpeedMs: number,
    hornBlowing: boolean,
    isRaining: boolean,
    nightFactor = 0,
    timeOfDayHours = 9.5,
    weather: WeatherPreset = 'sunny'
  ) {
    // Stream new chunks ahead and recycle far-behind chunks seamlessly
    const lastChunk = chunks[chunks.length - 1];
    if (lastChunk && currentBusS > lastChunk.endS - 950) {
      chunks.push(generateNextChunk());
    }
    if (chunks.length > 5 && currentBusS > chunks[0].endS + 260) {
      const old = chunks.shift()!;
      root.remove(old.group);
      disposeObject(old.group);
    }

    // Animate roadside Dhaba stops, Hill Market Towns & High-Altitude Mountain Clouds
    for (const ch of chunks) {
      if (ch.dhaba) {
        updateDhabaComplex(ch.dhaba, dt, elapsed, nightFactor);
      }
      if (ch.market) {
        updateHillMarketTown(ch.market, dt, elapsed, nightFactor);
      }
      if (ch.clouds) {
        ch.clouds.updateClouds(dt, elapsed, timeOfDayHours, weather);
      }
    }

    const activeLandslides = getLandslides();
    for (const ls of activeLandslides) {
      if (ls.cleared) {
        ls.beaconLightMat.color.setHex(0x22c55e);
        ls.jcbBoomPivot.rotation.x = THREE.MathUtils.damp(ls.jcbBoomPivot.rotation.x, 0, 4, dt);
        continue;
      }
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

    const minS = chunks[0].startS + 18;
    const maxS = chunks[chunks.length - 1].endS - 30;
    const busHalfW = 1.28;

    // Update Intelligent Endless Traffic
    for (let i = 0; i < traffic.length; i++) {
      const v = traffic[i];
      const sp = sampleAtDistance(v.sMeters);

      const relX = busPos.x - v.mesh.position.x;
      const relZ = busPos.z - v.mesh.position.z;
      const longAhead = (relX * sp.tan.x + relZ * sp.tan.z) * v.direction;
      const latDelta = Math.abs(relX * sp.right.x + relZ * sp.right.z);
      const latClearance = latDelta - (busHalfW + v.halfWidth);

      let targetSpeedMult = 1.0;
      let targetLaneOffset = v.baseLaneOffset;
      let braking = false;

      const inEncounter = longAhead > -v.halfLength - 5.2 && longAhead < 34;
      if (inEncounter) {
        if (latClearance > 0.65) {
          targetSpeedMult = 1.0;
        } else if (longAhead > 0) {
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

      // Landslide single-lane traffic queuing & slow pass
      for (const ls of activeLandslides) {
        if (ls.cleared) continue;
        const ldx = v.mesh.position.x - ls.position.x;
        const ldz = v.mesh.position.z - ls.position.z;
        if (Math.hypot(ldx, ldz) < 36) {
          const alongLs = ldx * ls.tangent.x + ldz * ls.tangent.z;
          const approaching = v.direction === 1 ? alongLs < 10 && alongLs > -34 : alongLs > -10 && alongLs < 34;
          if (approaching) {
            if (v.direction === 1) {
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
              const busNearLs = busPos.distanceTo(ls.position) < 24;
              targetLaneOffset = 3.15;
              targetSpeedMult = Math.min(targetSpeedMult, busNearLs && alongLs > 8 ? 0.0 : 0.42);
              braking = true;
            }
          }
        }
      }

      if (hornBlowing && Math.hypot(relX, relZ) < 32) {
        v.honkYieldTimer = 2.0;
      }
      if (v.honkYieldTimer > 0) {
        v.honkYieldTimer = Math.max(0, v.honkYieldTimer - dt);
        const shoulderDir = v.direction === -1 ? 1 : -1;
        const maxShoulder = halfW - v.halfWidth - 0.32;
        targetLaneOffset = shoulderDir * Math.min(maxShoulder, Math.abs(v.baseLaneOffset) + 1.4);
      }

      v.currentSpeedMult = THREE.MathUtils.damp(v.currentSpeedMult, targetSpeedMult, braking ? 7.5 : 3.6, dt);
      v.laneOffset = THREE.MathUtils.damp(v.laneOffset, targetLaneOffset, 3.8, dt);
      v.brakeLightMat.emissiveIntensity = braking || v.currentSpeedMult < 0.25 ? 2.4 : 0.35;

      v.sMeters += v.direction * v.cruiseSpeedMs * v.currentSpeedMult * dt;

      // Seamlessly recycle traffic far behind or far ahead of the bus
      if (v.sMeters < currentBusS - 180 || v.sMeters < minS) {
        v.sMeters = Math.min(maxS - 20, currentBusS + 320 + ((i * 53) % 340));
      } else if (v.sMeters > currentBusS + 760 || v.sMeters > maxS) {
        v.sMeters = Math.max(minS + 20, currentBusS + 240 + ((i * 47) % 280));
      }

      const nextSp = sampleAtDistance(v.sMeters);
      v.mesh.position.copy(nextSp.pos).addScaledVector(nextSp.right, v.laneOffset);
      v.mesh.position.y += 0.05;
      const lookDirX = nextSp.tan.x * v.direction;
      const lookDirZ = nextSp.tan.z * v.direction;
      v.heading = Math.atan2(lookDirX, lookDirZ);
      v.mesh.lookAt(
        v.mesh.position.x + lookDirX,
        v.mesh.position.y + nextSp.tan.y * v.direction,
        v.mesh.position.z + lookDirZ
      );
    }

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
    for (const ch of chunks) {
      disposeObject(ch.group);
    }
    traffic.forEach((t) => disposeObject(t.mesh));
    rainGeo.dispose();
    rainMat.dispose();
    asphaltTex.dispose();
    roadMat.dispose();
    terrainMat.dispose();
    parapetMat.dispose();
    trunkMat.dispose();
    foliageMat.dispose();
    grassMat.dispose();
  }

  return {
    root,
    roadWidth,
    traffic,
    rainSystem,
    startPos,
    startHeading,
    getLandslides,
    getDhabas,
    getMarkets,
    getColliders,
    sampleRoadAt,
    updateWorld,
    dispose,
  };
}
