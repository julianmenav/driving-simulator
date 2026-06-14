# Driving Simulator

A first-person, in-browser **driving game** built on a modular core that can host several
**game modes**. The near-term goal is a **multiplayer racing game** — rooms with join
codes, a race circuit, configurable laps, and a finish-order event when someone crosses the
line first.

Play it (single-player build): **https://julianmenav.github.io/driving-simulator/**

> The in-game text is in Spanish on purpose (target audience). Code, comments and docs are
> in English.

## What works today

- **Drivable car** with a believable feel: Rapier raycast-vehicle physics, automatic
  gearbox (R · N · D), aerodynamic drag + engine braking, front/rear brake split.
- **First-person cabin** with an animated steering wheel, a diegetic 3D instrument cluster
  (speed + gear), and working **mirrors** (center + doors, real render-to-texture).
- **Procedural night city**: a deterministic grid generator with avenues/streets,
  intersections, **traffic lights**, zebra crossings, **drivable hills** (height-level
  terrain), buildings with lit windows and streetlights.
- **Autonomous NPC traffic**: cars that follow lanes, stop at red lights, yield, and crash
  + recover — all driven by a pure, testable state machine.
- **Day / night** toggle with a coherent lighting preset system (sky/stars/moon, glow,
  headlights).

## Where it's going (roadmap)

The racing MVP = today's game **plus**:

1. **Start menu** — choose game mode, map and car; configure laps.
2. **A second map**: a linear **race circuit** (added alongside the existing free-roam
   city, keeping the night theme).
3. **Time-trial core**: ordered checkpoints, lap counting, timer, finish order.
4. **Car selection** (one car for now, but the selection seam is built).
5. **Multiplayer**: rooms with codes — the creator presses **Start** once ≥2 players are
   in; the first to finish is broadcast to everyone.

Game modes planned on top of the same core: **time-trial / racing** (near-term),
**free-roam**, and a future **Crazy-Taxi**-style delivery mode.

> The earlier driving-exam direction was dropped (it demanded unrealistic accuracy from a
> procedural world). The infraction code is kept but is no longer the product goal.

## Architecture

Hexagonal + DDD applied to the **game rules** (not the game loop):

```
src/
├── domain/          # pure game rules — ZERO Three.js/Rapier imports (vehicle, traffic, maps, events)
├── application/     # use cases, game-mode policies, ports (interfaces)
├── infrastructure/  # physics (Rapier), rendering (R3F), input, maps, persistence
└── ui/              # React components (menus, HUD, warnings)
```

Per-frame flow: **physics → state snapshot → domain evaluates rules → emits events → game
modes react.** The domain `EventBus` is the heart of the design. Per-frame state lives in
refs and `useFrame`, never in React state.

Because the `domain/` layer has no rendering/physics dependencies, **the same domain code
can run on a server** — which is how planned multiplayer keeps NPCs and race results
consistent for every player (an authoritative Node server runs the domain; clients render
and drive). See `CLAUDE.md` for the full multiplayer design.

## Stack

- **Vite + TypeScript + React 19**
- **@react-three/fiber** + **@react-three/drei** (3D)
- **@react-three/rapier** (Rapier WASM physics; the car uses `DynamicRayCastVehicleController`)
- **Zustand** for UI/game state

## Develop

Node is managed with nvm (v24). The dev scripts:

```bash
npm install
npm run dev      # local dev server
npm test         # vitest (unit tests for the pure domain)
npm run build    # typecheck + production bundle
npm run deploy   # build + publish dist/ to GitHub Pages (gh-pages branch)
```

See `CLAUDE.md` for the detailed design notes, build history and per-phase status.
