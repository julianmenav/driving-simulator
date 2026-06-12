# Driving Simulator (driving-simulator)

A first-person, in-browser driving game aimed at driving practice/exams.
Built to be **modular and scalable, with visible results per phase**.

> Note: the in-game / end-user-facing text is in Spanish on purpose (the target
> audience is Spanish-speaking). Everything else — code, comments, this document —
> is in English.

## Stack (decided)

- **Vite + TypeScript + React 19**
- **@react-three/fiber v9** (3D rendering) + **@react-three/drei** (helpers)
- **@react-three/rapier** (Rapier WASM physics). For the car: Rapier's `DynamicRayCastVehicleController` (accessed via `useRapier` to the raw API).
- **Zustand** for global UI/game state
- 2D UI (HUD, menus, mirrors as overlay) in plain React on top of the canvas

Performance golden rule: per-frame state lives in refs and `useFrame`, **never** in React state (avoid re-renders in the game loop).

## Architecture (decided): hexagonal + DDD, with a nuance

Hexagonal applied to the **game rules**, not the game loop. Rendering and physics are
infrastructure with their own paradigm (per-frame loop, mutation, refs).

```
src/
├── domain/          # Vehicle, GearState, Infraction, rules, GameEvent, EventBus — ZERO imports of Three.js/Rapier
├── application/     # use cases (StartExam, ProcessTick...), PracticeMode, ExamMode, ports (interfaces)
├── infrastructure/  # physics/ (Rapier), rendering/ (R3F), input/, maps/, persistence/
└── ui/              # React components: HUD, mirrors, menus
```

Per-frame flow: physics → state snapshot → domain evaluates rules → emits events
(`SpeedLimitExceeded`, `PedestrianHit`...) → the game modes react.

The **domain event bus is the heart of the design**: it is built first, in phase 1.
Practice and exam are two policies subscribed to the same bus.

## Backend (decided)

**v1 with no backend, everything in the frontend.** Local, sessionless game. Future
openness (OAuth, persistence, real-time rankings) is guaranteed via ports: `ScoreRepository`,
`ExamResultRepository`, etc. with local adapters (localStorage/IndexedDB) today, and
HTTP/WebSocket adapters once sessions arrive. Note: a future competitive ranking will
need server-side validation (anti-cheat) — a problem for that phase, not for v1.

## Phase 1 — Basic simulator

- Actions: accelerate, brake, automatic gear shifting (D, R, N) — a state machine in the domain that signs the torque.
- First-person view from inside the vehicle, with mirrors and a speedometer/accelerometer in the UI.
- Mirrors: render targets (drei's `RenderTexture`/`useFBO`). Real cost: each mirror re-renders the scene → low resolution and ≤30 fps refresh on mirrors.

Phase 1 implementation order (each step yields a visible result):
1. Vite+TS skeleton with the layers and the event bus with tests
2. R3F scene with ground and a drivable Rapier vehicle
3. D/R/N gearbox in the domain
4. HUD with speedometer
5. Mirrors

## Future features (the design must stay compatible)

1. **Swappable maps**: each map = GLTF (geometry) + JSON manifest (spawns, trigger zones, signs with limits, NPC routes). `MapRepository` port. Adding a map = adding assets, zero code.
2. **NPCs** moving, with physics, and hittable: kinematic character controller while walking → switch to dynamic rigid body on impact.
3. **Infraction triggers**: Rapier *sensor* colliders (intersection events) defined in the map manifest — road edge, crosswalk with an NPC crossing, sign zones. Speeding by default is a continuous rule evaluated every tick, not a spatial trigger.
4. **Start UI** (mode selection / configuration): plain React.
5. **Game modes** on top of the event bus:
   - **Practice**: free driving with infraction warnings.
   - **Exam**: you fail once you accumulate X infractions.

## Current status

- ✅ Step 1 done (Jun 2026): Vite+TS+React 19 skeleton, layers with aliases (`@domain`, `@application`, `@infrastructure`, `@ui`), typed `EventBus` in the domain with 9 tests, `createGame()` as the composition root.
- ✅ Step 2 done (Jun 2026): R3F scene with ground/road/obstacles and a drivable Rapier vehicle in first person. `ControlsPort` + `KeyboardControlsAdapter` (WASD/arrows, with tests). `VehicleSpec` in the domain (axis convention: **+z = front, +x = driver's left**; wheel axle -x so positive force pushes towards +z). `PlayerVehicle` uses `world.createVehicleController` (DynamicRayCastVehicleController) with `useBeforePhysicsStep`; publishes `vehicle/stateUpdated` every tick. Verified with a headless capture: render, driving and turning OK. Still to polish: braking/suspension tuning, dashboard size on screen.
- ✅ Step 3 done (Jun 2026): `AutomaticGearbox` in the domain (R·N·D lever with Q/E; will not engage D/R against the direction of travel above 6 km/h; `computeDrive` decides forces per gear; publishes `vehicle/gearChanged`). `ControlsPort.consumeShiftRequests()` as a queue of key presses. The car starts in N. Verified headless: in N it does not move, after E (D) it does.
- ✅ Step 4 done (Jun 2026): HUD with speedometer and gear (`src/ui/Hud.tsx`). Speed (60 Hz over the bus) is written directly to the DOM via ref; the gear uses React state.
- ✅ Step 5 done (Jun 2026): mirrors (`RearViewMirror`): plane + rear camera (local -z) + `useFBO` 384px, texture flipped in X, refresh 1 out of every 2 frames with an offset between mirrors. Center + side mirrors mounted on `PlayerVehicle`.
- **PHASE 1 COMPLETE.** Next: future features — suggested to start with data-driven maps (GLTF + manifest) or the infraction system on top of the bus.
- ✅ Cabin visual overhaul (Jun 2026): all interior cosmetics extracted to `src/infrastructure/vehicle/Cabin.tsx` (reworked dashboard with fascia + instrument housing + air vents/controls, continuous door panels with armrest/pull, pillars, glass, **animated lowpoly steering wheel** that turns with `steeringRef`, and a **diegetic 3D instrument cluster** with speed/gear via drei's `Text` — speed imperative over the bus, gear via state: shows the **R·N·D row with only the active gear lit** and the others dimmed grey; a small minimalist panel above the wheel resting on the instrument housing). The **2D HUD was removed** (deleted `Hud.tsx` and its styles). High wheel and **driver camera raised to y=1.10** (high on purpose: the dashboard took up too much room, so this gives a clear view of the road). Enlarged windshield (roof/upper frame raised, larger glass).
- **Render layer system for the cabin (key):** the interior cosmetics + their own fill lights (hemisphere + directional) are on **layer 1**; the exterior bodywork/hood/wheels on **layer 2**; the world (ground, road, cones) on layer 0. The driver camera enables layers 0+1+2; the mirror cameras stay on layer 0, so they reflect **only the world behind** (no interior trim and no shadowed faces of our own car, which was the black "streak" in the mirrors). The door mirror cameras point almost straight back with a slight `cameraPitch` to frame the road like the center one. **Heads up:** in three.js lights only illuminate objects on their own layer → the cabin (layer 1) needs its own light rig on layer 1 (the scene's sun, layer 0, does not reach it and it goes black). Verified headless.
- ✅ Infraction core — first slice (Jun 2026): the design's core loop (physics → snapshot → domain rules → events → game-mode policy) now runs end-to-end with one minimal infraction. Domain (`src/domain/rules/`, `src/domain/infractions/`): a `Rule` interface evaluated against a `VehicleSnapshot`, a `SpeedLimitRule` (see maps entry for the zone-aware version), and an `InfractionMonitor` that subscribes to `vehicle/stateUpdated`, runs the rules and publishes the new **`infraction/committed`** event. Application: `PracticeMode` policy collects infractions off the bus (`count`/`getInfractions()`). UI: `InfractionWarning.tsx` transient Spanish banner (occasional event → plain React state + timeout is fine, the per-frame rule does not apply). Verified headless. **Deliberately deferred:** `ExamMode` (fail after X), sensor-collider spatial triggers, a second infraction type — the `InfractionType` union and `Rule[]` make those additive.
- ✅ Data-driven maps — first slice (jun 2026): swappable maps via a `MapManifest` data contract (pure domain data, like `VehicleSpec`) + a `MapRepository` port (`application/ports/`). `main.tsx` loads the map through the port (async) **before** `createGame({ controls, map })`, so a future HTTP/glTF adapter swaps in with no domain/UI change. v1 geometry is **procedural**: `infrastructure/maps/buildGridCity.ts` deterministically builds a grid city (outer-ring avenues + residential streets, 3×3 buildings with colliders, dynamic props, a 30 km/h residential band across the centre); `LocalMapRepository` returns it. `infrastructure/rendering/CityMap.tsx` renders everything from the manifest (replaces the deleted `Ground.tsx`) incl. speed-limit signs at zones. **Speed limits are now spatial:** `VehicleSnapshot` gained `position`; `PlayerVehicle` publishes `chassis.translation()` on `vehicle/stateUpdated` and spawns from `map.spawn`; `SpeedLimitRule` takes a `limitProvider` resolving the limit per tick via `resolveSpeedLimit(map, x, z)`. The rule tracks the **limit being violated** (not a bare flag), so crossing from a 50 zone into a 30 zone while already speeding commits a fresh infraction without per-tick spam. The `MapManifest.gltfUrl` field is the seam for real geometry. Verified headless: city renders, warning shows "límite 50" on the avenue and "límite 30" in the band. **Deferred:** glTF/real-city (Marbella) loader, road-edge/off-road infractions, NPC routes, rotated/curved roads.

## Julián's gameplay feedback (Jun 2026)

1. When releasing the throttle the car did not decelerate naturally (no drag or engine braking). → Aerodynamic drag ∝ v² on the chassis + engine braking on release.
2. Acceleration was too fast and linear. → Constant-power model: available force = min(F_max, P/v), with moderate power/force in the spec.
3. The mirrors were floating and no bodywork was visible in first person. → Visible cabin: A/B pillars, frame, roof, window line and mirror mounts — without invading the useful view.
4. (2nd round) The left mirror was half-covered by the bodywork, the right one was on the hood instead of on the door, the glass effect was missing, and we wanted to see our own car on the sides. → Door mirrors at y=0.93 (above the window line), camera FOV at 80° so the right one fits on screen in its real spot, mirror cameras with yaw ±0.15 (a sliver of our own car visible), and translucent glass (windshield/windows/rear window, opacity 0.16 blue-tinted).
5. (Detected during verification) The car yawed under hard braking (locked rear axle). → 100/60 front/rear brake split and maxBrakeForce 60→45. A slight residual drift remains under full braking.

## Commands and environment

- Node is managed with **nvm.fish**; in non-interactive shells it is not on PATH. Use:
  `export PATH="$HOME/.local/share/nvm/v24.15.0/bin:$PATH"` before npm/node.
- `npm run dev` · `npm test` · `npm run build` (typecheck + bundle).
- Headless visual verification: there is no chromium-cli; use `playwright-core` (installed ad hoc in /tmp) with `executablePath: /usr/bin/google-chrome-stable` and flags `--no-sandbox --enable-unsafe-swiftshader --use-angle=swiftshader`; wait ~7 s for the Rapier WASM to load before capturing.

## Deploy (GitHub Pages)

- Same convention as dnd-calculator: `gh-pages` package (no GitHub Actions). `base: '/driving-simulator/'` in vite.config.ts.
- `npm run deploy` = `npm run build && gh-pages -d dist`: publishes `dist/` to the `gh-pages` branch.
- SSH remote `git@github.com:julianmenav/driving-simulator.git`. Pages serves from the `gh-pages` branch.
- URL: https://julianmenav.github.io/driving-simulator/
- TypeScript 6: `baseUrl` is deprecated — the tsconfig `paths` use relative paths.

## References

- Official vehicle controller example: https://threejs.org/examples/physics_rapier_vehicle_controller.html
- react-three-rapier car example: https://github.com/pmndrs/react-three-rapier/blob/main/demo/src/examples/car/CarExample.tsx
- API: https://rapier.rs/javascript3d/classes/DynamicRayCastVehicleController.html
