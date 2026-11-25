import * as THREE from 'three';

export interface BusVisualRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  frontLeftPivot: THREE.Group;
  frontRightPivot: THREE.Group;
  wheelMeshes: THREE.Object3D[];
  doorLeaf1: THREE.Group;
  doorLeaf2: THREE.Group;
  steeringWheel: THREE.Group;
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
  setDoorOpenAmount: (t: number) => void;
  setSteeringAngle: (angleRad: number) => void;
  spinWheels: (distDelta: number) => void;
  updateWipers: (time: number, on: boolean) => void;
  updateLights: (
    headlights: 0 | 1 | 2,
    braking: boolean,
    reversing: boolean,
    indicators: 'off' | 'left' | 'right' | 'hazard',
    cabinOn: boolean,
    blinkOn: boolean
  ) => void;
}

/**
 * Draws a dignified stylized editorial statesman portrait inside a circular medallion
 * for Haryana Roadways official civic welfare bus wrap panels (Hon'ble PM of India & Hon'ble CM of Haryana).
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

  // Outer golden tricolor ring
  const ringGrad = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  ringGrad.addColorStop(0, '#FF9933');
  ringGrad.addColorStop(0.5, '#FFFFFF');
  ringGrad.addColorStop(1, '#138808');
  ctx.beginPath();
  ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
  ctx.fillStyle = ringGrad;
  ctx.fill();

  // Inner circular portrait backdrop
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();

  const bgGrad = ctx.createRadialGradient(cx, cy - r * 0.2, r * 0.1, cx, cy, r);
  bgGrad.addColorStop(0, variant === 'pm' ? '#FEF3C7' : '#DBEAFE');
  bgGrad.addColorStop(1, variant === 'pm' ? '#D97706' : '#1D4ED8');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);

  // Shoulders & Nehru Jacket / Kurta
  ctx.fillStyle = variant === 'pm' ? '#F59E0B' : '#1E3A8A';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.85, r * 0.78, r * 0.56, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  // Crisp white kurta collar V-neck
  ctx.fillStyle = '#F8FAFC';
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.22, cy + r * 0.35);
  ctx.lineTo(cx, cy + r * 0.75);
  ctx.lineTo(cx + r * 0.22, cy + r * 0.35);
  ctx.closePath();
  ctx.fill();

  // Neck
  ctx.fillStyle = '#D99B72';
  ctx.fillRect(cx - r * 0.16, cy + r * 0.18, r * 0.32, r * 0.24);

  // Face oval
  ctx.fillStyle = '#E5AD84';
  ctx.beginPath();
  ctx.ellipse(cx, cy - r * 0.06, r * 0.34, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  // Hair & facial features
  if (variant === 'pm') {
    // Silver-white hair crown
    ctx.fillStyle = '#F1F5F9';
    ctx.beginPath();
    ctx.ellipse(cx, cy - r * 0.36, r * 0.34, r * 0.16, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    // Signature groomed white beard
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.arc(cx, cy + r * 0.06, r * 0.33, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.fill();
    // Rimless glasses
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = Math.max(1.5, r * 0.035);
    ctx.strokeRect(cx - r * 0.24, cy - r * 0.16, r * 0.2, r * 0.12);
    ctx.strokeRect(cx + r * 0.04, cy - r * 0.16, r * 0.2, r * 0.12);
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.04, cy - r * 0.1);
    ctx.lineTo(cx + r * 0.04, cy - r * 0.1);
    ctx.stroke();
  } else {
    // Haryana CM dark hair & neat mustache
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.ellipse(cx, cy - r * 0.37, r * 0.34, r * 0.17, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    // Mustache
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.09, r * 0.14, r * 0.045, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Warm eyes & smile
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

  // Caption ribbon below medallion
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

function createSideLiveryTexture(maxAniso: number, side: 'left' | 'right'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base iconic Haryana Roadways royal blue metallic gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#E2E8F0');
  grad.addColorStop(0.24, '#F8FAFC');
  grad.addColorStop(0.26, '#1565C0');
  grad.addColorStop(0.68, '#0B4FA8');
  grad.addColorStop(1, '#062C65');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2048, 512);

  // Sweeping dynamic Haryana Roadways silver/sky/tricolor speed stripes
  ctx.fillStyle = '#38BDF8';
  ctx.fillRect(0, 140, 2048, 18);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 158, 2048, 12);

  // Tricolor accent wave band
  ctx.fillStyle = '#FF9933';
  ctx.fillRect(0, 442, 2048, 16);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 458, 2048, 14);
  ctx.fillStyle = '#138808';
  ctx.fillRect(0, 472, 2048, 16);

  // Bold bilingual Haryana Roadways lettering
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 72px "Chakra Petch", sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('HARYANA ROADWAYS', 120, 255);

  ctx.fillStyle = '#FDE047';
  ctx.font = '700 44px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('हरियाणा रोडवेज  •  हरियाणा गौरव (BS-VI)', 120, 315);

  ctx.fillStyle = '#BFDBFE';
  ctx.font = '600 26px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('SURAKSHIT SAFAR • HIMACHAL HILL EXPRESS • 1800-180-2345', 120, 365);

  // Official Civic Welfare Promotional Panel on Rear Side Body
  const panelX = side === 'left' ? 1230 : 1210;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.fillRect(panelX, 178, 720, 250);
  ctx.strokeStyle = '#F59E0B';
  ctx.lineWidth = 6;
  ctx.strokeRect(panelX, 178, 720, 250);

  // Panel header
  ctx.fillStyle = '#073B8C';
  ctx.fillRect(panelX, 178, 720, 46);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('विकसित भारत • विकसित हरियाणा — जन कल्याण यात्रा', panelX + 360, 208);

  // Stylized PM & CM portraits
  drawStatesmanMedallion(ctx, panelX + 140, 305, 62, 'pm', "Hon'ble PM of India", 'माननीय प्रधानमंत्री');
  drawStatesmanMedallion(ctx, panelX + 580, 305, 62, 'cm', "Hon'ble CM Haryana", 'माननीय मुख्यमंत्री');

  // Center slogan inside promo panel
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

  // Subtle metallic panel seams
  ctx.strokeStyle = 'rgba(2, 6, 23, 0.25)';
  ctx.lineWidth = 3;
  for (let x = 240; x < 2048; x += 260) {
    ctx.beginPath();
    ctx.moveTo(x, 170);
    ctx.lineTo(x, 495);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

function createRearPromoTexture(maxAniso: number, plateText: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Royal Blue Haryana Roadways rear panel
  const grad = ctx.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, '#F1F5F9');
  grad.addColorStop(0.14, '#1565C0');
  grad.addColorStop(0.75, '#0B4FA8');
  grad.addColorStop(1, '#062B62');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1024);

  // Header
  ctx.fillStyle = '#FDE047';
  ctx.font = '800 54px "Chakra Petch", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('HARYANA ROADWAYS', 512, 92);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 34px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('हरियाणा राज्य परिवहन • पहाड़ी सेवा', 512, 138);

  // Rear Promotional Civic Wrap Frame (PM of India & CM of Haryana)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
  ctx.fillRect(72, 178, 880, 440);
  ctx.strokeStyle = '#FF9933';
  ctx.lineWidth = 8;
  ctx.strokeRect(72, 178, 880, 440);

  // Tricolor ribbon at top of rear poster
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

  // Iconic Indian Highway Back Bumper Art
  ctx.fillStyle = '#F59E0B';
  ctx.fillRect(88, 652, 848, 86);
  ctx.fillStyle = '#0F172A';
  ctx.font = '800 50px "Chakra Petch", sans-serif';
  ctx.fillText('HORN  OK  PLEASE', 512, 712);

  // Safety message + Registration Number Plate
  ctx.fillStyle = '#E2E8F0';
  ctx.font = '700 26px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('KEEP SAFE DISTANCE • सुरक्षित दूरी बनाए रखें', 512, 788);

  // Yellow Commercial Number Plate
  ctx.fillStyle = '#FACC15';
  ctx.fillRect(322, 822, 380, 84);
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 6;
  ctx.strokeRect(322, 822, 380, 84);
  ctx.fillStyle = '#0F172A';
  ctx.font = '800 42px "JetBrains Mono", monospace';
  ctx.fillText(plateText, 512, 878);

  // Reflective red-white chevron safety strip
  for (let x = 0; x < 1024; x += 64) {
    ctx.fillStyle = (x / 64) % 2 === 0 ? '#EF4444' : '#F8FAFC';
    ctx.fillRect(x, 948, 64, 34);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAniso;
  tex.needsUpdate = true;
  return tex;
}

function drawLedDestinationCanvas(canvas: HTMLCanvasElement, routeText: string, plateText: string) {
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#090D16';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Subtle LED matrix grid glow
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
  ctx.fillText(`HARYANA ROADWAYS  •  ${plateText}`, canvas.width / 2, 108);
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

function buildWheelAssembly(dualRear: boolean): THREE.Group {
  const group = new THREE.Group();
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x1a1e24,
    roughness: 0.9,
    metalness: 0.05,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.3,
    metalness: 0.78,
  });
  const hubMat = new THREE.MeshStandardMaterial({
    color: 0x0b4fa8,
    roughness: 0.35,
    metalness: 0.65,
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

    // 6 lug bolts for crisp rotation feedback
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
  initialPlate: string
): BusVisualRig {
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // Bus dimensions: Width = 2.55m, Length = 11.2m (Z: -5.6 rear to +5.6 front), Height = 3.35m
  // Grounded bottom-center at y = 0 (wheels radius = 0.52m, chassis floor at y = 0.78m)

  // Contact shadow grounding plane
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

  // PBR Materials with clear roughness/metalness contrast
  const bluePaintMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b52b5,
    roughness: 0.28,
    metalness: 0.38,
    clearcoat: 0.85,
    clearcoatRoughness: 0.16,
  });
  const silverRoofMat = new THREE.MeshStandardMaterial({
    color: 0xe6edf5,
    roughness: 0.36,
    metalness: 0.45,
  });
  const chassisDarkMat = new THREE.MeshStandardMaterial({
    color: 0x161c24,
    roughness: 0.82,
    metalness: 0.25,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.14,
    metalness: 0.94,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x1b334b,
    roughness: 0.08,
    metalness: 0.1,
    transparent: true,
    opacity: isSoftwareGl ? 0.48 : 0.42,
    clearcoat: 1.0,
    depthWrite: false,
  });
  const yellowRailMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.35,
    metalness: 0.3,
  });
  const interiorSeatMat = new THREE.MeshStandardMaterial({
    color: 0x1e40af,
    roughness: 0.85,
    metalness: 0.05,
  });

  const leftSideTex = createSideLiveryTexture(maxAniso, 'left');
  const rightSideTex = createSideLiveryTexture(maxAniso, 'right');
  const rearPromoTex = createRearPromoTexture(maxAniso, initialPlate);

  const leftSideMat = new THREE.MeshPhysicalMaterial({
    map: leftSideTex,
    roughness: 0.32,
    metalness: 0.22,
    clearcoat: 0.65,
    clearcoatRoughness: 0.2,
  });
  const rightSideMat = new THREE.MeshPhysicalMaterial({
    map: rightSideTex,
    roughness: 0.32,
    metalness: 0.22,
    clearcoat: 0.65,
    clearcoatRoughness: 0.2,
  });
  const rearMat = new THREE.MeshPhysicalMaterial({
    map: rearPromoTex,
    roughness: 0.34,
    metalness: 0.18,
    clearcoat: 0.5,
  });

  // 1. Undercarriage chassis frame
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.34, 10.9), chassisDarkMat);
  chassis.position.set(0, 0.64, 0);
  chassis.castShadow = true;
  bodyGroup.add(chassis);

  // 2. Lower body shell (split so front-left passenger doorway has an open recess!)
  // Right (driver) lower wall full length
  const rightLowerWall = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.24, 11.0), rightSideMat);
  rightLowerWall.position.set(1.22, 1.38, 0);
  rightLowerWall.castShadow = true;
  rightLowerWall.receiveShadow = true;
  bodyGroup.add(rightLowerWall);

  // Left (passenger) lower wall — stops before front entry door (z: -5.5 to +3.45)
  const leftLowerWall = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.24, 8.95), leftSideMat);
  leftLowerWall.position.set(-1.22, 1.38, -1.02);
  leftLowerWall.castShadow = true;
  leftLowerWall.receiveShadow = true;
  bodyGroup.add(leftLowerWall);

  // Left front corner pillar ahead of door
  const leftFrontLower = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.24, 0.8), bluePaintMat);
  leftFrontLower.position.set(-1.21, 1.38, 5.12);
  bodyGroup.add(leftFrontLower);

  // 3. Sculpted beveled front nose cowl
  const frontLower = new THREE.Mesh(new THREE.BoxGeometry(2.54, 1.18, 0.35), bluePaintMat);
  frontLower.position.set(0, 1.35, 5.42);
  frontLower.castShadow = true;
  bodyGroup.add(frontLower);

  // Front radiator grille + chrome horizontal louvers
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.52, 0.12), chassisDarkMat);
  grille.position.set(0, 1.16, 5.58);
  bodyGroup.add(grille);

  for (let i = 0; i < 4; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.045, 0.14), chromeMat);
    slat.position.set(0, 0.99 + i * 0.11, 5.59);
    bodyGroup.add(slat);
  }

  // Front & rear heavy steel bumpers
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.3, 0.32), chassisDarkMat);
  frontBumper.position.set(0, 0.68, 5.54);
  bodyGroup.add(frontBumper);

  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.32, 0.28), chassisDarkMat);
  rearBumper.position.set(0, 0.68, -5.56);
  bodyGroup.add(rearBumper);

  // Front commercial yellow plate
  const frontPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.76, 0.18, 0.06),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 })
  );
  frontPlate.position.set(0, 0.69, 5.71);
  bodyGroup.add(frontPlate);

  // 4. Rear Promotional Wrap Wall (with PM & CM civic banner + Horn OK Please)
  const rearWall = new THREE.Mesh(new THREE.BoxGeometry(2.54, 2.38, 0.18), rearMat);
  rearWall.position.set(0, 1.98, -5.48);
  rearWall.castShadow = true;
  bodyGroup.add(rearWall);

  // 5. Roof Crown + AC/Ventilation Pods + Roof Luggage Rack with Strapped Bags
  const roofShell = new THREE.Mesh(new THREE.BoxGeometry(2.56, 0.24, 11.15), silverRoofMat);
  roofShell.position.set(0, 3.16, -0.02);
  roofShell.castShadow = true;
  bodyGroup.add(roofShell);

  const roofCrown = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.14, 10.6), bluePaintMat);
  roofCrown.position.set(0, 3.31, -0.1);
  bodyGroup.add(roofCrown);

  // Tubular luggage carrier on roof rear half
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

  // Roof travel bags / luggage crates
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

  // Twin chrome roof air horns!
  for (const xPos of [-0.62, 0.62]) {
    const hornTube = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.025, 0.65, 12), chromeMat);
    hornTube.rotation.x = Math.PI / 2;
    hornTube.position.set(xPos, 3.44, 4.35);
    bodyGroup.add(hornTube);
  }

  // 6. Front LED Destination Board above windshield
  const ledBoardCanvas = document.createElement('canvas');
  ledBoardCanvas.width = 1024;
  ledBoardCanvas.height = 140;
  drawLedDestinationCanvas(ledBoardCanvas, initialBoard, initialPlate);
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

  // 7. Split Panoramic Front Windshield & Side Window Pillars
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.42, 1.12, 0.08), glassMat);
  windshield.position.set(0, 2.46, 5.47);
  windshield.rotation.x = -0.08;
  windshield.renderOrder = 3;
  bodyGroup.add(windshield);

  // Center windshield mullion & A-pillars
  const centerMullion = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.18, 0.14), chassisDarkMat);
  centerMullion.position.set(0, 2.46, 5.47);
  bodyGroup.add(centerMullion);

  for (const sx of [-1.24, 1.24]) {
    for (let pz = -5.4; pz <= 5.4; pz += 1.8) {
      if (sx < 0 && pz > 3.2 && pz < 4.9) continue; // doorway opening
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.11, 1.16, 0.14), bluePaintMat);
      pillar.position.set(sx, 2.52, pz);
      bodyGroup.add(pillar);
    }
    const sideGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 1.06, sx < 0 ? 8.85 : 10.65),
      glassMat
    );
    sideGlass.position.set(sx, 2.52, sx < 0 ? -1.0 : 0.0);
    sideGlass.renderOrder = 3;
    bodyGroup.add(sideGlass);
  }

  // 8. Interior Cabin: Floor, Passenger Seats, Yellow Grab Poles, Dashboard, Animated Steering Wheel
  const floorDeck = new THREE.Mesh(new THREE.BoxGeometry(2.38, 0.08, 10.7), chassisDarkMat);
  floorDeck.position.set(0, 0.92, -0.05);
  bodyGroup.add(floorDeck);

  // Entry steps at left front doorway
  for (let s = 0; s < 3; s++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.07, 1.08), chassisDarkMat);
    step.position.set(-0.98 + s * 0.14, 0.56 + s * 0.18, 4.12);
    bodyGroup.add(step);
  }
  const grabRail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.75, 8), yellowRailMat);
  grabRail.position.set(-1.02, 1.85, 3.55);
  bodyGroup.add(grabRail);

  // Passenger seat rows (left 2-seater, right 3-seater Indian roadways layout)
  for (let row = 0; row < 8; row++) {
    const zPos = 2.6 - row * 1.02;
    const leftSeat = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.72, 0.45), interiorSeatMat);
    leftSeat.position.set(-0.74, 1.38, zPos);
    bodyGroup.add(leftSeat);

    const rightSeat = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.72, 0.45), interiorSeatMat);
    rightSeat.position.set(0.64, 1.38, zPos);
    bodyGroup.add(rightSeat);
  }

  // Right-Hand-Drive Indian Driver Cockpit Console (Right side +X in our forward=+Z space? Wait: +Z is front, +Y is up -> right side from driver's seat looking +Z is -X! Let's verify: cross(+Y, +Z) = +X -> looking along +Z, left is +X and right is -X! Wait: let's check!)
  // Right-handed coordinate check:
  // If bus forward is +Z and up is +Y, then viewer sitting in bus looking +Z has RIGHT = -X and LEFT = +X!
  // Let's keep that consistent:
  // Wait: earlier we put the passenger door at x = -1.22! In India (left-hand traffic), the bus drives on the LEFT lane, so the passenger door is on the LEFT curb side (+X when facing +Z) and the driver sits on the RIGHT side (-X when facing +Z)!
  // Let's position the driver steering console at x = +0.72 if we mirror, OR even simpler: in India, passenger door is on the LEFT side of the bus. Since `cross(forward(+Z), up(+Y))` = `(-1, 0, 0)` = RIGHT! So LEFT side of the bus (curb side in India) is `+X`, and RIGHT side (driver seat) is `-X`!
  // Let's flip the door cutout to `+X` or keep driver on `-X` right now? Let's put the steering wheel at `x = 0.74` (wait: let's check visually: from chase camera behind the bus at z = -12 looking toward +Z, screen-right is `-X` and screen-left is `+X`!).
  // YES! From behind the bus at `(0, 5, -13)` looking at `(0, 2, 0)`:
  // Camera forward = `+Z`, Camera up = `+Y`, Camera right = `cross(camFwd(+Z), camUp(+Y)) = -X`!
  // So screen-LEFT (Indian road curb / bus stop side!) is `+X`, and screen-RIGHT (Indian driver RHD side) is `-X`!
  // Wait—let's move the door cutout to `+X`? Actually we just built leftLowerWall at `x = -1.22`, so let's simply mirror `leftLowerWall` to `x = +1.22` and `rightLowerWall` to `x = -1.22` so the passenger door opens right onto the Indian LEFT curb (`+X`) and the driver sits on the Indian RIGHT side (`-X`)! That makes left-hand Indian road driving 100% authentic!
  rightLowerWall.position.x = -1.22;
  leftLowerWall.position.x = 1.22;
  leftFrontLower.position.x = 1.21;
  grabRail.position.x = 1.02;
  // Also fix the side glass/pillars doorway opening to +X
  bodyGroup.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry instanceof THREE.BoxGeometry) {
      if (Math.abs(child.position.x - -1.24) < 0.01 && Math.abs(child.position.y - 2.52) < 0.01) {
        child.position.x = 1.24;
      } else if (Math.abs(child.position.x - 1.24) < 0.01 && Math.abs(child.position.y - 2.52) < 0.01) {
        child.position.x = -1.24;
      }
    }
  });
  // Reposition entry steps to +X curb side
  bodyGroup.children.forEach((c) => {
    if (c instanceof THREE.Mesh && Math.abs(c.position.z - 4.12) < 0.05 && c.position.x < 0) {
      c.position.x = -c.position.x;
    }
  });

  // Driver Dashboard on Indian RHD side (x = -0.68, z = 4.9)
  const dash = new THREE.Mesh(new THREE.BoxGeometry(2.34, 0.56, 0.72), chassisDarkMat);
  dash.position.set(0, 1.54, 4.98);
  bodyGroup.add(dash);

  const steeringWheel = new THREE.Group();
  steeringWheel.position.set(-0.68, 1.9, 4.62);
  steeringWheel.rotation.x = 0.52;
  const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.028, 10, 24), chassisDarkMat);
  steeringWheel.add(wheelRing);
  const wheelSpoke = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, 0.03), chassisDarkMat);
  steeringWheel.add(wheelSpoke);
  const wheelHub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 12), bluePaintMat);
  wheelHub.rotation.x = Math.PI / 2;
  steeringWheel.add(wheelHub);
  bodyGroup.add(steeringWheel);

  // 9. Animated Pneumatic Bi-Fold Passenger Door on Indian LEFT Curb Side (+X, z = 3.55..4.68)
  const doorLeaf1 = new THREE.Group();
  doorLeaf1.position.set(1.22, 0.72, 3.58);
  const leafGeo = new THREE.BoxGeometry(0.08, 2.24, 0.54);
  const leafGlassGeo = new THREE.BoxGeometry(0.09, 0.96, 0.42);
  const leaf1Body = new THREE.Mesh(leafGeo, bluePaintMat);
  leaf1Body.position.set(0, 1.12, 0.27);
  doorLeaf1.add(leaf1Body);
  const leaf1Glass = new THREE.Mesh(leafGlassGeo, glassMat);
  leaf1Glass.position.set(0, 1.66, 0.27);
  doorLeaf1.add(leaf1Glass);
  bodyGroup.add(doorLeaf1);

  const doorLeaf2 = new THREE.Group();
  doorLeaf2.position.set(1.22, 0.72, 4.68);
  const leaf2Body = new THREE.Mesh(leafGeo, bluePaintMat);
  leaf2Body.position.set(0, 1.12, -0.27);
  doorLeaf2.add(leaf2Body);
  const leaf2Glass = new THREE.Mesh(leafGlassGeo, glassMat);
  leaf2Glass.position.set(0, 1.66, -0.27);
  doorLeaf2.add(leaf2Glass);
  bodyGroup.add(doorLeaf2);

  // 10. Twin Extended Side Wing Mirrors
  for (const sx of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.04, 0.04), chassisDarkMat);
    arm.position.set(sx * 1.4, 2.48, 5.36);
    bodyGroup.add(arm);
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.42, 0.08), chassisDarkMat);
    housing.position.set(sx * 1.56, 2.32, 5.42);
    bodyGroup.add(housing);
    const mirrorGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.36), chromeMat);
    mirrorGlass.position.set(sx * 1.56, 2.32, 5.37);
    mirrorGlass.rotation.y = Math.PI;
    bodyGroup.add(mirrorGlass);
  }

  // 11. Animated Windshield Wipers
  const wiperLeft = new THREE.Group();
  wiperLeft.position.set(0.55, 1.92, 5.56);
  const blade1 = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.72, 0.03), chassisDarkMat);
  blade1.position.y = 0.36;
  wiperLeft.add(blade1);
  bodyGroup.add(wiperLeft);

  const wiperRight = new THREE.Group();
  wiperRight.position.set(-0.55, 1.92, 5.56);
  const blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.72, 0.03), chassisDarkMat);
  blade2.position.y = 0.36;
  wiperRight.add(blade2);
  bodyGroup.add(wiperRight);

  // 12. Functional Lights (Headlights, Indicators, Brakes, Reverse, Cabin)
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

    const spot = new THREE.SpotLight(0xfff5d6, 0, 58, Math.PI / 5.2, 0.45, 1.35);
    spot.position.set(sx, 1.15, 5.65);
    spot.target.position.set(sx * 0.6, 0.2, 26);
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

  // Front & rear indicator lenses (left = +X, right = -X)
  for (const zPos of [5.59, -5.58]) {
    const lInd = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.08), leftIndMat);
    lInd.position.set(1.14, 1.12, zPos);
    bodyGroup.add(lInd);
    const rInd = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.08), rightIndMat);
    rInd.position.set(-1.14, 1.12, zPos);
    bodyGroup.add(rInd);
  }

  // Rear brake & reverse cluster
  for (const sx of [-0.94, 0.94]) {
    const brk = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.24, 0.08), brakeLightMat);
    brk.position.set(sx, 1.06, -5.58);
    bodyGroup.add(brk);
    const rev = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.08), reverseLightMat);
    rev.position.set(sx * 0.72, 1.06, -5.58);
    bodyGroup.add(rev);
  }

  const cabinLight = new THREE.PointLight(0xfff4d4, 0, 7.5);
  cabinLight.position.set(0, 2.8, 1.2);
  bodyGroup.add(cabinLight);

  // 13. Front Steerable & Rear Dual Wheels (Grounded at y = 0.52)
  const frontLeftPivot = new THREE.Group();
  frontLeftPivot.position.set(1.16, 0.52, 3.15);
  const flWheel = buildWheelAssembly(false);
  frontLeftPivot.add(flWheel);
  root.add(frontLeftPivot);

  const frontRightPivot = new THREE.Group();
  frontRightPivot.position.set(-1.16, 0.52, 3.15);
  const frWheel = buildWheelAssembly(false);
  frontRightPivot.add(frWheel);
  root.add(frontRightPivot);

  const rearLeft = buildWheelAssembly(true);
  rearLeft.position.set(1.06, 0.52, -2.95);
  root.add(rearLeft);

  const rearRight = buildWheelAssembly(true);
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
      drawLedDestinationCanvas(ledBoardCanvas, routeText, plateText);
      ledBoardTexture.needsUpdate = true;
    },
    setDoorOpenAmount(t: number) {
      const clamped = Math.max(0, Math.min(1, t));
      // Smooth outward/bi-fold swing
      doorLeaf1.rotation.y = clamped * 1.45;
      doorLeaf2.rotation.y = -clamped * 1.45;
    },
    setSteeringAngle(angleRad: number) {
      frontLeftPivot.rotation.y = angleRad;
      frontRightPivot.rotation.y = angleRad;
      steeringWheel.rotation.z = -angleRad * 4.2;
    },
    spinWheels(distDelta: number) {
      const dRot = distDelta / 0.52;
      for (const w of wheelMeshes) {
        w.rotation.x += dRot;
      }
    },
    updateWipers(time: number, on: boolean) {
      const target = on ? Math.sin(time * 5.6) * 0.65 : -0.6;
      wiperLeft.rotation.z = target;
      wiperRight.rotation.z = target;
    },
    updateLights(headlights, braking, reversing, indicators, cabinOn, blinkOn) {
      const hlIntensity = headlights === 2 ? 12 : headlights === 1 ? 6.5 : 0;
      const hlDist = headlights === 2 ? 78 : 48;
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
      cabinLight.intensity = cabinOn ? 3.5 : 0;
    },
  };
}
