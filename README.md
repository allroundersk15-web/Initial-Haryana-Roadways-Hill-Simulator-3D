# Haryana Roadways Hill Simulator 3D

A 3D heavy-bus mountain driving simulator built with **React**, **TypeScript**, **Three.js**, **Google Maps Platform**, and **Firebase**. Drive the iconic blue Haryana Roadways BS-VI coach from Haryana depots into Himachal Pradesh mountain highways, or complete all four official HSSC / IDTR HTV license test tracks.

## Features

- **3D Haryana Roadways BS-VI Coach**: Royal-blue & silver bilingual Hindi/English livery, LED route board, working pneumatic door (`O`), headlights/high-beams (`L`), windshield wipers (`V`), indicators/hazards (`Z`/`X`/`B`), roof luggage rack, and twin chrome air horns.
- **Tactile Bus Controls**:
  - Interactive 3-spoke rotary steering wheel (pointer/touch drag + keyboard sync + wheel/arrows toggle + tappable center horn boss)
  - Metallic Accelerator (`W`/`↑`) & rubber-tread Brake (`S`/`↓`) pedals + Air Parking Handbrake (`Space`)
  - Automatic (`D`/`N`/`R` with uphill grade downshift & hysteresis) and 6-Speed Manual (`M`, `Q`/`E`, or direct `1`–`6` / `N` gear gate) with live RPM shift cues and mechanical gear-shift audio
- **Live Google Maps Dispatch & 4 Himachal Corridors**:
  1. Kalka & Panchkula → Shimla & Kufri (NH-5)
  2. Ambala & Chandigarh → Kullu & Manali (NH-205 / NH-3)
  3. Ambala → Kangra, Dharamshala & McLeod Ganj (NH-154)
  4. Yamunanagar → Rampur & Reckong Peo / Kinnaur (NH-5)
- **HSSC / IDTR HTV License School**: Figure-8 Track, H-Shape Reverse Bay, Zig-Zag Slalom, and Steep Gradient Ramp Hill-Start.
- **Firebase Cloud Save**: Google Sign-In + Firestore persistence for Driver Profile, HTV certification, track scores, and Himachal trip manifests.

## Local Development

```bash
npm install
cp .env.example .env
# Add your VITE_GOOGLE_MAPS_API_KEY in .env
npm run dev
```

Build for production:

```bash
npm run build
npm run lint
```

## Security Note

Review and tighten `firestore.rules` before deploying publicly to production.
