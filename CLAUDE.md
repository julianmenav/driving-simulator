# Driving Simulator (driving-simulator)

A first-person, in-browser **driving game** built to host several **game modes** on a
shared, modular core. The near-term goal is a **multiplayer racing game**: rooms with
join codes, a linear race circuit, configurable laps, and a finish-order event when
someone crosses the line first. Free-roam city driving and a future Crazy-Taxi-style
mode ride on the same vehicle, maps and event bus.

Built to be **modular and scalable, with visible results per phase**.

> History / direction (jun 2026): this started as a driving-practice/**exam** simulator.
> That direction was dropped — an exam only works if the procedural world is *correct*
> (signs, right-of-way, NPC rules), which is a bottomless accuracy pit. We pivoted to an
> **arcade racing game** where the city is a playground, not a thing that scores you. The
> infraction/exam code (`domain/rules`, `domain/infractions`, `PracticeMode`) is **kept**
> but is no longer the product goal; it may be reused as obstacle/penalty flavour later.

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
├── application/     # use cases (StartRace, ProcessTick...), game-mode policies, ports (interfaces)
├── infrastructure/  # physics/ (Rapier), rendering/ (R3F), input/, maps/, persistence/
└── ui/              # React components: HUD, mirrors, menus
```

Per-frame flow: physics → state snapshot → domain evaluates rules → emits events
(`SpeedLimitExceeded`, `PedestrianHit`...) → the game modes react.

The **domain event bus is the heart of the design**: it is built first, in phase 1.
Game modes (time-trial, free-roam, …) are policies subscribed to the same bus.

## Backend

**Single-player stays backendless** — the static build on GitHub Pages is a complete
single-player game (free-roam + local time-trial). **Multiplayer introduces a small
authoritative server** (see *Multiplayer architecture* below); the client still ships to
Pages, the server runs on a cheap always-on host (Fly.io / Railway / Render / VPS — Pages
cannot host a WebSocket server). Everything network-related lives behind a `NetworkPort`
so single-player simply doesn't instantiate it, consistent with the existing port design.

Future openness (accounts, persistence, rankings) stays guaranteed via ports
(`ScoreRepository`, etc.) with local adapters (localStorage/IndexedDB) today and HTTP
adapters later. A competitive ranking would need server-side validation (anti-cheat) — a
later-phase problem.

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
4. **Start UI** (mode / map / car selection + configuration): plain React.
5. **Game modes** on top of the event bus:
   - **Time-trial / racing** (near-term goal): laps around a circuit, checkpoints,
     finish order, best times. Single-player first, then multiplayer rooms.
   - **Free-roam**: chill city driving (current default behaviour).
   - **Crazy-Taxi (future)**: pick up / drop off against a timer, navigated via the
     `RoadGraph`. Same plumbing as time-trial (checkpoints + timer + scoring on the bus).
   - *(Deprecated)* Practice / Exam infraction modes — code retained, not the product goal.

## Racing MVP roadmap (jun 2026 pivot)

The MVP = **what exists today + the following**, each a phase with a visible result:

1. **Start menu** (plain React, on top of the canvas): choose **game mode**, **map**, and
   **car**, plus **configuration** (number of laps). Drives a small zustand "session"
   store; the canvas only mounts the game once the player presses *Play*. Single-player
   path works end-to-end before any networking.
2. **A second map: a linear race circuit.** Added *alongside* the city, not replacing it —
   `MapRepository` already returns a manifest per id, so this is a new `buildCircuit()`
   generator (or a hand-authored manifest) selected from the menu. Keep the night-city
   theme for now. A circuit needs: a start/finish line, an ordered list of **checkpoints**
   (reuse the `RoadGraph`/manifest data contract), and lap geometry. The current grid city
   stays as the free-roam map. *(Future: a better non-linear city than today's plain web of
   square blocks.)*
3. **Time-trial core (single-player):** lap + checkpoint tracking in the **domain** (pure,
   testable, like `TrafficSignals`): you must pass checkpoints in order to count a lap;
   finishing N laps ends the race. New bus events: `race/checkpointPassed`,
   `race/lapCompleted`, `race/finished` (carries finish order / time). HUD shows lap N/M and
   timer.
4. **Car selection:** one car for now, but build the selection seam — a registry of
   `VehicleSpec` presets chosen in the menu and passed to the player vehicle. Adding a car
   later = adding a spec (+ optional model), zero plumbing.
5. **Multiplayer (rooms with codes):** see the architecture section below. Creator makes a
   room, others join by code, creator presses **Start** once ≥2 players are in. The
   `race/finished` event becomes the authoritative "X finished first" broadcast to all.

## Multiplayer architecture (design — to confirm with Julián)

**Do we need a server? Yes.** Rooms-with-codes and a single shared truth (who finished
first, where the NPCs are) need a process that all clients trust. Pure peer-to-peer
(WebRTC mesh) is possible but adds NAT-traversal pain and has no authority — not worth it
for an MVP. So: a **small authoritative Node server**.

**Why Node specifically is a big win here:** the `domain/` layer imports **zero**
Three.js/Rapier — `NpcDriver`, `RoadGraph`, `TrafficSignals`, the lap/checkpoint logic and
the `EventBus` are pure TypeScript. The **same domain code runs on the server**. That is
exactly what the hexagonal split was for: the server owns the rules, the clients own
rendering/physics.

**Transport: WebSockets (TCP) for the MVP.** Simplest, works everywhere, fine for a handful
of friends. Its weakness is head-of-line blocking under packet loss → latency spikes; if we
ever need competitive-grade netcode we move to unreliable UDP (WebRTC DataChannels or
WebTransport, e.g. geckos.io). Hide it behind a **`NetworkPort`** in `application/ports` so
the transport is swappable — same pattern as `ControlsPort`/`MapRepository`.

**Authority model — hybrid (recommended for MVP):**
- **Each player simulates their own car locally** in Rapier (responsive, no input lag) and
  **broadcasts its transform** (position + rotation + velocity) at ~15–20 Hz. Remote cars
  on other clients are **not** physics bodies — just interpolated transforms (render a tick
  behind / lerp), so the local Rapier sims never fight each other.
- **The server owns shared state:** room membership, the race orchestration (countdown,
  lap/checkpoint validation, finish order) and **the NPCs**.
- **Lap/finish is server-authoritative:** clients report checkpoint crossings; the server
  orders them and emits the single trusted `race/finished`. (For the MVP we can trust
  clients; anti-cheat is a later phase.)

**NPCs shared across all players — yes, this is possible, and cleanly.** This is the part
Julián asked about ("if an NPC crashes, its route must change for *everyone*"). Because
`NpcDriver` is a **pure deterministic state machine** (`cruising | waiting | crashed |
rejoining`) with injected RNG and *no* physics dependency, the **server runs the NPC brains**
and **broadcasts NPC transforms** to every client; clients only render them. To make a
player↔NPC crash reroute for everyone:
- Clients already broadcast their car transform + velocity → the server knows every
  player's position and speed.
- The server does a **cheap proximity + relative-speed check** (the same "is a car within
  my forward corridor / did we collide above threshold" logic the client uses today, but on
  broadcast transforms — no full Rapier needed) and, on a hit, flips that NPC's state to
  `crashed`, which after `recoverySeconds` re-routes via `RoadGraph` — **for all clients at
  once**, since they all just render the server's NPC state.
- The visual *bounce* of the player's own car stays a local cosmetic (their local Rapier
  contact), which is fine — the authoritative consequence (the NPC's new route) is shared.

So the architecture already in place (pure domain + ports + manifest-driven maps) is the
right seam: the server is "a headless client that runs the domain and owns NPCs + race
state", the clients render and drive. The **circuit MVP may not even have NPCs** (it's a
race between players), so NPC sync can land *after* the core room+race loop — same code path
when it does.

**Suggested build order for multiplayer:** (a) room server (create/join by code, lobby,
Start gate at ≥2 players) → (b) broadcast + interpolate remote player cars → (c)
server-authoritative countdown + lap/finish + `race/finished` to all → (d) *(if/when a map
has NPCs)* move NPC simulation to the server and broadcast NPC transforms.

**Library choice (open question):** raw `ws` (full control, more plumbing) vs **Colyseus**
(purpose-built for authoritative rooms + state sync + a join-code/room concept + client
SDK — maps almost 1:1 onto "rooms with codes, creator presses Start"). Leaning Colyseus for
the MVP to skip boilerplate; revisit if we need UDP-grade netcode.

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
- ✅ City round 2 — crossings, traffic lights, hills (jun 2026): three incremental phases on the map system, one commit each.
  - **Bigger map + zebra crossings:** `buildGridCity` defaults to a 5×5 grid; `Crossing` data on the spawn avenue renders as white stripe rows (`CityMap`).
  - **Traffic lights + enforced red lights:** `domain/traffic/TrafficSignals.ts` is a time-based state machine (green→amber→red, advanced by frame `dt` from `PlayerVehicle`'s step — **no `Date.now`**, so it's testable; publishes `traffic/lightChanged`). `RedLightRule` commits a `red-light` infraction when the car crosses a governed stop line on red (tracks previous position; lane band + travel direction). `Infraction` is now a **discriminated union** (`speeding | red-light`). `createGame` wires the signals + red-light rule (joins the monitor's `Rule[]`) and exposes `game.signals`. `TrafficLights.tsx` renders poles/lamps coloured off the bus. The generator emits a corridor of northbound avenue lights with spread `phaseOffset`s. `InfractionWarning` shows "Semáforo en rojo".
  - **Drivable hills:** `MapManifest.terrain` + pure `domain/map/elevation.ts` `elevationAt(terrain,x,z)`. `rendering/Terrain.tsx` builds a triangulated heightfield with a **trimesh collider** (the raycast suspension drives over it); `rendering/drape.ts` `buildSurfaceGeometry` drapes roads/crossings onto the terrain, and all objects (buildings, props, signs, lights) + the **vehicle spawn** take their `y` from `elevationAt`. The flat ground box collider is gone. Verified headless. **Deferred (unchanged seams):** glTF/Marbella import, pedestrian NPCs at crossings, banked/curved roads, amber-light/stopping-distance scoring.
- ✅ Map round 3 — feedback fixes (jun 2026): two phases.
  - **Terrain levels:** `TerrainSpec` is now a coarse grid of integer levels (4 levels × 1.5 m; `levels[iz][ix]`, adjacent cells differ ≤1 — invariant tested). `elevationAt` = bilinear interpolation with a **plateau-biased easing** (`PLATEAU = 0.3`: flat for 30% of each cell span on both ends, smoothstep hill in the middle band) → flat plateaus, hills only between levels, and reaching level 2 from 0 always crosses a level-1 band. Buildings sample the terrain at footprint corners + centre and sink below the minimum (no slope gaps). Terrain margin 220 m.
  - **Intersection-first generator:** `buildGridCity` computes every junction and a deterministic per-intersection `variant = (xi·7 + zi·11) % 12` decides furniture — avenue×avenue always signal-controlled, avenue×residential ~2/3, residential×residential ~1/4 (heterogeneous on purpose, per feedback). Controlled junctions get lights on **all existing approaches** (edge junctions skip non-existent ones) with N–S and E–W half a cycle apart; `PHASE_SECONDS.red = green + amber` (9 = 7+2) so the axes alternate exactly (invariant tested). Crossings on all approaches when controlled, a variant-picked subset otherwise. Zebra bars are **parallel to the road**, repeating across its width. `RedLightRule`/`TrafficLights`/`CityMap` needed zero changes for map-wide coverage — the manifest pipeline scaled as designed. Verified headless (stripes correct at spawn, lit junctions along the avenue, "Semáforo en rojo" fires).

- ✅ NPC traffic cars (jun 2026): autonomous cars that share the road, fully **map-agnostic** (derived from the manifest, so a new map populates with zero code).
  - **Domain** (`domain/traffic/`): `RoadGraph.ts` turns `manifest.roads` into a navigable lane graph — intersections of crossing axis-aligned roads become nodes, the sections between them become directed **right-hand lane** edges (offset to a fraction of road width, drive-on-the-right). Pure/deterministic like `elevationAt`/`resolveSpeedLimit`; `nearestNode`/`chooseEdge` (turn weighted toward going straight, never a U-turn unless dead-end) + tests. `NpcDriver.ts` is the per-car **brain**: a pure state machine (`cruising | waiting | crashed | rejoining`) that follows lanes, **stops at red/amber stop lines** (reuses `TrafficLightSpec` + `signals.colorOf`, same data the player's `RedLightRule` reads), **yields** by braking to a gap behind any car/player in its forward corridor (so it only advances when the next step is clear), and on impact goes **limp → waits `recoverySeconds` → re-routes to the nearest node**. Injected RNG keeps it testable; speeds clamp to road type (residential 7 / avenue 11 m/s). Tests cover cruise/turn, light-stop, yield-without-overrun, crash→recover.
  - **Infrastructure** (`infrastructure/vehicle/TrafficCars.tsx`): one dynamic Rapier body per car, **velocity-controlled** each `useBeforePhysicsStep` (horizontal = heading×speed; a clamped vertical term tracks `elevationAt` so they glide over the hills; X/Z rotations locked so they stay upright). Control is **released while crashed** so the contact solver produces a real bounce, then resumes. A contact counts as a crash only when the other body is a car (`userData.kind` `player`/`npc`) **and** relative speed > 3 m/s — so terrain/kerbs/buildings and gentle nudges never trip it. Player chassis tagged `userData={{kind:'player'}}`; player position read off `vehicle/stateUpdated` for NPC avoidance. `createGame` exposes `game.roadGraph = buildRoadGraph(map.roads)`; mounted in `SimulatorCanvas` (NPCs are layer 0 → visible in the mirrors). Verified headless: 12 cars driving in-lane at the right per-road speeds, stopping at reds, crashing+recovering. **Deferred (unchanged seams):** pedestrian NPCs at crossings, intersection right-of-way among NPCs (perpendicular crossers can still clip and recover), hitting an NPC as a scored infraction, and the richer **scalable road model** below.
  - **Collision feel tuning (jun 2026 feedback):** the crash threshold was lowered (3 → 1 m/s relative) so *any* real touch — not just a fast one — hands the body fully to physics for the recovery window. The earlier behaviour hard-set velocity/rotation every frame *unless* crashed, which made a controlled NPC an immovable powered wall: the player couldn't shove a stopped car, yet a driving NPC rammed the player with full momentum. With the lower threshold a bumped car goes limp (so it visibly stops driving and bounces), and while limp it is an ordinary dynamic body, so pushes are mutual and a stopped car can be shoved (verified headless: an impulse shoves a limp car ~8 m, then it re-routes). Sub-1-m/s grazing still stays under control (no spurious freezes in queues).

- ✅ Day/night lighting (jun 2026): a scalable time-of-day system, **night by default**, with a UI toggle (`☀️ Día`/`🌙 Noche`).
  - **One source of truth:** `infrastructure/rendering/environment/` holds `presets.ts` (`EnvironmentPreset` = pure data: background, fog, hemisphere/sun colour+intensity, sky kind, and a `lightsOn` flag — same spirit as a manifest) and a tiny zustand store (`environmentStore.ts`, `usePreset`/`useLightsOn`). Everything visual that depends on time of day derives from the active preset, so the look stays internally consistent and a new phase (e.g. `dusk`) is purely additive (add a preset + extend the `DayPhase` union, no consumer changes).
  - **`SceneEnvironment`** renders background/fog/hemisphere/sun from the preset and swaps the backdrop: drei `Sky` by day vs drei `Stars` + a glowing `Moon` (placed along the key-light direction) at night. All on layer 0, so the moon/stars show in the mirrors.
  - **Glow = a function, not a dependency:** `glowTexture.ts` generates two cached radial-gradient canvas textures (an additive halo + an opaque window pane). `Glow.tsx` exposes a camera-facing additive `<Glow>` sprite (correct in mirrors too) and a ground-facing `<LightPool>` decal. No postprocessing/bloom — chosen to stay self-contained and avoid interaction with the multi-camera mirror FBOs and swiftshader.
  - **Building windows** (`BuildingWindows.tsx`): one **instanced** mesh of panes per building, layout derived from the box dimensions (any building gets windows free, no manifest data). Lit pattern is deterministic per building (stable seed); at night a subset glows warm and a few flip on/off over time via direct instance-colour mutation (no React re-render, Math.random is fine in the render layer); by day all panes read as glass. Windows recolour on phase toggle.
  - **Streetlights** are **manifest data** (`StreetLightSpec`, generated by `buildGridCity`: one per road segment, alternating sides) → `StreetLights.tsx` renders pole + emissive lamp + halo + ground light-pool, lit only at night. Map-agnostic like crossings/lights. **No real point lights per lamp** (would not scale to dozens) — emissive + halo + pool sell it.
  - **Traffic lights** gain a halo on the lit lamp + brighter emissive at night (zero data change). **Cabin** dims to cool moonlight with a soft warm interior point light (layer 1) at night. **Headlights**: two real spotlights on the player car aimed at a child target ahead (so the beam follows heading), on only at night. Verified headless in both modes; 85 tests pass.

## Scalable road model (design note — not built yet, per Julián's feedback jun 2026)

Today a road is geometry + a coarse `type` (`avenue`/`residential`), and `buildRoadGraph`
hard-codes one right-hand lane per direction with uniform rules; `NpcDriver` applies the
same behaviour everywhere. To grow toward real circulation rules, roads should become
richer **domain data** (still pure manifest, like `VehicleSpec`/`TerrainSpec`) describing
how traffic may use them, e.g.:

- **Senses:** `oneWay` vs two-way (and which direction[s] exist).
- **Lanes:** `lanesPerDirection` → multi-lane, keep-right, an overtaking lane.
- **Markings:** centre line `solid | dashed` → lane-crossing / overtaking allowed or not.
- **Class & priority:** speed defaults (already via `ROAD_LIMITS`) + right-of-way rank at
  uncontrolled junctions.

The seam is already in the right place: `buildRoadGraph` is the **single** translator from
road data → lane edges, so it would emit N lane edges per direction at the correct offsets,
tagging each with the rules above; `NpcDriver` reads that metadata to pick a lane (keep
right; pull left to overtake only on a dashed line into a clear faster lane) and to resolve
**intersection right-of-way** (today there is none — perpendicular crossers clip and
recover; a yield resolver keyed off road priority + light presence would ask "do I have
right of way entering edge E at node N?", mirroring the existing red-light stop check). The
pipeline stays fully data-driven: a new map sets per-road attributes and `buildGridCity`
picks sensible defaults — **zero NPC/renderer code changes**, the same way lights/crossings
scaled map-wide. So: the architecture is *not* the limitation; the road data model and the
generator are simply minimal today, exactly as with the earlier "single street" feedback.

## Julián's gameplay feedback (Jun 2026)

1. When releasing the throttle the car did not decelerate naturally (no drag or engine braking). → Aerodynamic drag ∝ v² on the chassis + engine braking on release.
2. Acceleration was too fast and linear. → Constant-power model: available force = min(F_max, P/v), with moderate power/force in the spec.
3. The mirrors were floating and no bodywork was visible in first person. → Visible cabin: A/B pillars, frame, roof, window line and mirror mounts — without invading the useful view.
4. (2nd round) The left mirror was half-covered by the bodywork, the right one was on the hood instead of on the door, the glass effect was missing, and we wanted to see our own car on the sides. → Door mirrors at y=0.93 (above the window line), camera FOV at 80° so the right one fits on screen in its real spot, mirror cameras with yaw ±0.15 (a sliver of our own car visible), and translucent glass (windshield/windows/rear window, opacity 0.16 blue-tinted).
5. (Detected during verification) The car yawed under hard braking (locked rear axle). → 100/60 front/rear brake split and maxBrakeForce 60→45. A slight residual drift remains under full braking.
6. (Map round, jun 2026) Sinusoidal terrain read as unrealistic waviness → replaced with **discrete height levels** (plateaus + hills only between levels, see status). Buildings floated over slope gaps → bases sink below the lowest footprint point. Zebra stripes were rotated 90° from reality → bars now parallel to the road, repeating across its width. Lights/crossings existed on a single street → **the framework was not the limitation** (manifest → renderer → rules is fully data-driven); the generator was minimal. Fixed by making the generator intersection-first.
7. (Detected during verification, jun 2026) With heightfield terrain the mesh ended ~45 m past the roads, so leaving the city meant falling off the world → terrain margin widened to 220 m (elevationAt clamps to edge plateaus beyond the level grid).
8. (NPC traffic round, jun 2026) (a) Cars should keep to the right lane and circulation rules should differ per road kind (one/two-way, solid/dashed line) — noted as the **scalable road model** design above, not built yet; the architecture (manifest → `buildRoadGraph` → `NpcDriver`) is the right seam, the road data model is just minimal. (b) NPCs didn't stop when crashed/touched and (c) a stopped NPC couldn't be pushed while NPCs shoved the player easily → both were the hard per-frame velocity/rotation control making controlled cars immovable walls; fixed by lowering the crash threshold to 1 m/s so any touch hands the body to physics (see NPC status entry).

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
