import * as THREE from 'three';
import type { TrackId } from '../types/simulator';

export interface TrainingCone {
  mesh: THREE.Group;
  pos: THREE.Vector3;
  hit: boolean;
}

export interface TrainingCheckpoint {
  pos: THREE.Vector3;
  radius: number;
  ring: THREE.Mesh;
  cleared: boolean;
  label: string;
}

export interface TrainingArenaHandle {
  root: THREE.Group;
  trackId: TrackId;
  startPos: THREE.Vector3;
  startHeading: number;
  cones: TrainingCone[];
  checkpoints: TrainingCheckpoint[];
  // For H-Bay Reverse parking
  bayBox: { center: THREE.Vector3; halfW: number; halfL: number; targetHeading: number } | null;
  // For Gradient Ramp Hill-Start
  rampSpec: {
    startZ: number;
    peakStartZ: number;
    peakEndZ: number;
    endZ: number;
    width: number;
    maxHeight: number;
    stopBoxZMin: number;
    stopBoxZMax: number;
  } | null;
  getGroundHeightAndSlope: (x: number, z: number) => { y: number; slopeRad: number };
  dispose: () => void;
}

function createConeMesh(): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.08, 0.55),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 })
  );
  base.position.y = 0.04;
  g.add(base);

  const body = new THREE.Mesh(
    new THREE.ConeGeometry(0.22, 0.88, 12),
    new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.45 })
  );
  body.position.y = 0.5;
  body.castShadow = true;
  g.add(body);

  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.16, 0.22, 12),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, emissive: 0xffffff, emissiveIntensity: 0.2 })
  );
  stripe.position.y = 0.58;
  g.add(stripe);
  return g;
}

function createArchBannerTexture(title: string, subtitle: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 180;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#073B8C';
  ctx.fillRect(0, 0, 1024, 180);
  ctx.strokeStyle = '#FACC15';
  ctx.lineWidth = 10;
  ctx.strokeRect(8, 8, 1008, 164);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 44px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, 512, 82);
  ctx.fillStyle = '#FDE047';
  ctx.font = '700 30px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(subtitle, 512, 138);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildTrainingGroundArena(trackId: TrackId): TrainingArenaHandle {
  const root = new THREE.Group();
  const cones: TrainingCone[] = [];
  const checkpoints: TrainingCheckpoint[] = [];

  // 1. Expansive Haryana Plains Ground + IDTR Asphalt Pad (No boxed indoor wall!)
  const grass = new THREE.Mesh(
    new THREE.CircleGeometry(420, 48),
    new THREE.MeshStandardMaterial({ color: 0x3b5932, roughness: 0.96 })
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.04;
  grass.receiveShadow = true;
  root.add(grass);

  const tarmac = new THREE.Mesh(
    new THREE.PlaneGeometry(150, 180),
    new THREE.MeshStandardMaterial({ color: 0x2b313a, roughness: 0.88, metalness: 0.04 })
  );
  tarmac.rotation.x = -Math.PI / 2;
  tarmac.position.y = 0;
  tarmac.receiveShadow = true;
  root.add(tarmac);

  // Subtle painted grid lines on tarmac
  const whitePaint = new THREE.MeshBasicMaterial({
    color: 0xf8fafc,
    transparent: true,
    opacity: 0.72,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const yellowPaint = new THREE.MeshBasicMaterial({
    color: 0xfacc15,
    transparent: true,
    opacity: 0.9,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });

  // Perimeter trees surrounding the IDTR test ground naturally
  const treeCount = 72;
  const trunkInst = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.28, 0.4, 3.2, 6),
    new THREE.MeshStandardMaterial({ color: 0x5c3d28, roughness: 0.94 }),
    treeCount
  );
  const crownInst = new THREE.InstancedMesh(
    new THREE.SphereGeometry(2.6, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0x2d6a36, roughness: 0.9 }),
    treeCount
  );
  const dummy = new THREE.Object3D();
  for (let i = 0; i < treeCount; i++) {
    const a = (i / treeCount) * Math.PI * 2;
    const r = 104 + (i % 4) * 14;
    const s = 0.85 + (i % 5) * 0.14;
    dummy.position.set(Math.cos(a) * r, 1.6 * s, Math.sin(a) * r);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);
    dummy.position.y += 2.6 * s;
    dummy.updateMatrix();
    crownInst.setMatrixAt(i, dummy.matrix);
  }
  trunkInst.instanceMatrix.needsUpdate = true;
  crownInst.instanceMatrix.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  crownInst.computeBoundingSphere();
  root.add(trunkInst);
  root.add(crownInst);

  // Haryana Roadways IDTR Welcome Archway & Examiner Observation Booth
  const archGroup = new THREE.Group();
  archGroup.position.set(0, 0, -48);
  const pillarMat = new THREE.MeshStandardMaterial({ color: 0x0b4fa8, roughness: 0.45 });
  for (const px of [-10, 10]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.9, 6.2, 0.9), pillarMat);
    p.position.set(px, 3.1, 0);
    archGroup.add(p);
  }
  const banner = new THREE.Mesh(
    new THREE.BoxGeometry(21, 2.2, 0.4),
    new THREE.MeshStandardMaterial({
      map: createArchBannerTexture(
        'HARYANA ROADWAYS IDTR — HTV DRIVING TEST',
        'HSSC HEAVY TRANSPORT VEHICLE SKILL TRACK'
      ),
      roughness: 0.4,
    })
  );
  banner.position.set(0, 6.2, 0);
  archGroup.add(banner);
  root.add(archGroup);

  const addCone = (x: number, z: number, y = 0) => {
    const mesh = createConeMesh();
    mesh.position.set(x, y, z);
    root.add(mesh);
    cones.push({ mesh, pos: new THREE.Vector3(x, y, z), hit: false });
  };

  const addCheckpoint = (x: number, y: number, z: number, radius: number, label: string) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius, 0.16, 10, 32),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.85 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, y + 0.18, z);
    root.add(ring);
    checkpoints.push({
      pos: new THREE.Vector3(x, y, z),
      radius,
      ring,
      cleared: false,
      label,
    });
  };

  let startPos = new THREE.Vector3(0, 0, -24);
  let startHeading = 0; // +Z
  let bayBox: TrainingArenaHandle['bayBox'] = null;
  let rampSpec: TrainingArenaHandle['rampSpec'] = null;

  if (trackId === 'figure8') {
    // Authentic HSSC Figure "8" Track: Two tangent loops centered at z = +18 and z = -18 (radius 18m)
    const loopR = 18;
    const laneHalf = 3.8;
    startPos = new THREE.Vector3(0, 0, -3);
    startHeading = 0.25;

    for (const cz of [loopR, -loopR]) {
      // Painted track guide ring
      const trackRing = new THREE.Mesh(
        new THREE.RingGeometry(loopR - laneHalf, loopR + laneHalf, 56),
        new THREE.MeshStandardMaterial({
          color: 0x363e4a,
          roughness: 0.85,
          polygonOffset: true,
          polygonOffsetFactor: -1,
        })
      );
      trackRing.rotation.x = -Math.PI / 2;
      trackRing.position.set(0, 0.02, cz);
      root.add(trackRing);

      // Inner & outer boundary cones (skip crossover junction near z = 0)
      const count = 24;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const innerX = Math.cos(a) * (loopR - laneHalf - 0.6);
        const innerZ = cz + Math.sin(a) * (loopR - laneHalf - 0.6);
        const outerX = Math.cos(a) * (loopR + laneHalf + 0.6);
        const outerZ = cz + Math.sin(a) * (loopR + laneHalf + 0.6);

        if (Math.hypot(innerX, innerZ) > 6.5) addCone(innerX, innerZ);
        if (Math.hypot(outerX, outerZ) > 7.5) addCone(outerX, outerZ);
      }
    }

    // 8 Sequential Checkpoints tracing a full Figure-8
    addCheckpoint(14, 0, 10, 4.6, 'Upper Loop East');
    addCheckpoint(0, 0, 36, 4.6, 'North Apex');
    addCheckpoint(-14, 0, 10, 4.6, 'Upper Loop West');
    addCheckpoint(0, 0, 0, 4.8, 'Center Crossover');
    addCheckpoint(14, 0, -10, 4.6, 'Lower Loop East');
    addCheckpoint(0, 0, -36, 4.6, 'South Apex');
    addCheckpoint(-14, 0, -10, 4.6, 'Lower Loop West');
    addCheckpoint(0, 0, 2, 4.8, 'Finish Crossover');
  } else if (trackId === 'hBayReverse') {
    // Authentic HSSC "H" Shape & Dug Reverse Garage Bay
    startPos = new THREE.Vector3(-8.5, 0, -22);
    startHeading = 0; // Facing +Z

    // Painted pull-up staging lane
    const stageStrip = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 48), whitePaint);
    stageStrip.rotation.x = -Math.PI / 2;
    stageStrip.position.set(-8.5, 0.02, 0);
    root.add(stageStrip);

    // Reverse Dug Garage Bay at x = +4.5, z = -12..-27
    const bayCenter = new THREE.Vector3(4.5, 0, -16);
    const bayW = 4.5;
    const bayL = 13.8;
    bayBox = { center: bayCenter, halfW: bayW / 2, halfL: bayL / 2, targetHeading: 0 };

    const bayPad = new THREE.Mesh(new THREE.PlaneGeometry(bayW, bayL), yellowPaint);
    bayPad.rotation.x = -Math.PI / 2;
    bayPad.position.set(bayCenter.x, 0.03, bayCenter.z);
    root.add(bayPad);

    // Barrier cones lining left, right, and rear of the garage dug bay
    for (let bz = bayCenter.z - bayL / 2; bz <= bayCenter.z + bayL / 2; bz += 2.6) {
      addCone(bayCenter.x - bayW / 2 - 0.55, bz);
      addCone(bayCenter.x + bayW / 2 + 0.55, bz);
    }
    for (let bx = bayCenter.x - bayW / 2; bx <= bayCenter.x + bayW / 2; bx += 1.5) {
      addCone(bx, bayCenter.z - bayL / 2 - 0.55);
    }

    // Forward pull-up turning checkpoint first, then reverse into dug bay
    addCheckpoint(-2, 0, 14, 5.5, 'Staging Point (Engage Reverse)');
    addCheckpoint(bayCenter.x, 0, bayCenter.z, 3.8, 'Dug Garage Bay');
  } else if (trackId === 'zigZag') {
    // Authentic HSSC Zig-Zag Serpentine Slalom
    startPos = new THREE.Vector3(0, 0, -44);
    startHeading = 0;

    const gateOffsets = [-6.5, 6.5, -6.5, 6.5, -5.5, 0];
    gateOffsets.forEach((gx, idx) => {
      const gz = -26 + idx * 14.5;
      addCone(gx - 3.6, gz);
      addCone(gx + 3.6, gz);
      // Offset central divider bollards forcing serpentine weave
      if (idx < gateOffsets.length - 1) {
        addCone(gx > 0 ? -1.5 : 1.5, gz + 7.25);
      }
      addCheckpoint(gx, 0, gz, 4.2, `Slalom Gate ${idx + 1}`);
    });
  } else {
    // Authentic HSSC Steep Gradient Ramp / Hill-Start Bridge Test
    startPos = new THREE.Vector3(0, 0, -42);
    startHeading = 0;

    rampSpec = {
      startZ: -26,
      peakStartZ: 2,
      peakEndZ: 14,
      endZ: 42,
      width: 7.4,
      maxHeight: 3.1,
      stopBoxZMin: -14,
      stopBoxZMax: -5,
    };

    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.88 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.45 });

    // Upward incline deck (z: -26 to +2 -> length 28m, rise 3.1m -> ~11% grade!)
    const upLen = Math.hypot(28, 3.1);
    const upAngle = Math.atan2(3.1, 28);
    const upDeck = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.45, upLen), concreteMat);
    upDeck.position.set(0, 3.1 / 2 - 0.22, -12);
    upDeck.rotation.x = -upAngle;
    upDeck.receiveShadow = true;
    root.add(upDeck);

    // Painted RED STOP BOX halfway up the incline!
    const stopBoxMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(5.6, 8.8),
      new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.48,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      })
    );
    stopBoxMesh.position.set(0, 1.88, -9.5);
    stopBoxMesh.rotation.x = -Math.PI / 2 - upAngle;
    root.add(stopBoxMesh);

    // Summit flat deck (z: +2 to +14)
    const peakDeck = new THREE.Mesh(new THREE.BoxGeometry(7.4, 3.1, 12), concreteMat);
    peakDeck.position.set(0, 3.1 / 2, 8);
    peakDeck.receiveShadow = true;
    root.add(peakDeck);

    // Downward descent deck (z: +14 to +42)
    const downDeck = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.45, upLen), concreteMat);
    downDeck.position.set(0, 3.1 / 2 - 0.22, 28);
    downDeck.rotation.x = upAngle;
    downDeck.receiveShadow = true;
    root.add(downDeck);

    // Side yellow safety curbs along ramp
    for (const sx of [-3.55, 3.55]) {
      const railUp = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.55, upLen), railMat);
      railUp.position.set(sx, 3.1 / 2 + 0.22, -12);
      railUp.rotation.x = -upAngle;
      root.add(railUp);

      const railPeak = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.55, 12), railMat);
      railPeak.position.set(sx, 3.1 + 0.26, 8);
      root.add(railPeak);

      const railDown = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.55, upLen), railMat);
      railDown.position.set(sx, 3.1 / 2 + 0.22, 28);
      railDown.rotation.x = upAngle;
      root.add(railDown);
    }

    // Approach & exit cones
    addCone(-4.1, -30);
    addCone(4.1, -30);
    addCone(-4.1, 46);
    addCone(4.1, 46);

    addCheckpoint(0, 1.85, -9.5, 4.4, 'Incline STOP Box (Hold 0 km/h)');
    addCheckpoint(0, 3.1, 8, 4.4, 'Ramp Summit');
    addCheckpoint(0, 0, 48, 4.8, 'Ramp Finish');
  }

  function getGroundHeightAndSlope(x: number, z: number): { y: number; slopeRad: number } {
    if (!rampSpec) return { y: 0, slopeRad: 0 };
    if (Math.abs(x) > rampSpec.width / 2 + 0.8) return { y: 0, slopeRad: 0 };

    if (z >= rampSpec.startZ && z <= rampSpec.peakStartZ) {
      const f = (z - rampSpec.startZ) / (rampSpec.peakStartZ - rampSpec.startZ);
      const slopeRad = Math.atan2(rampSpec.maxHeight, rampSpec.peakStartZ - rampSpec.startZ);
      return { y: f * rampSpec.maxHeight, slopeRad };
    }
    if (z > rampSpec.peakStartZ && z < rampSpec.peakEndZ) {
      return { y: rampSpec.maxHeight, slopeRad: 0 };
    }
    if (z >= rampSpec.peakEndZ && z <= rampSpec.endZ) {
      const f = 1 - (z - rampSpec.peakEndZ) / (rampSpec.endZ - rampSpec.peakEndZ);
      const slopeRad = -Math.atan2(rampSpec.maxHeight, rampSpec.endZ - rampSpec.peakEndZ);
      return { y: f * rampSpec.maxHeight, slopeRad };
    }
    return { y: 0, slopeRad: 0 };
  }

  function dispose() {
    root.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
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
    trackId,
    startPos,
    startHeading,
    cones,
    checkpoints,
    bayBox,
    rampSpec,
    getGroundHeightAndSlope,
    dispose,
  };
}
