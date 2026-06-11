# Simulador de conducción (driving-simulator)

Juego de conducción en navegador, en primera persona, orientado a práctica/examen de conducir.
Construcción **modular y escalable, con resultados visibles por fase**.

## Stack (decidido)

- **Vite + TypeScript + React 19**
- **@react-three/fiber v9** (render 3D) + **@react-three/drei** (helpers)
- **@react-three/rapier** (físicas Rapier WASM). Para el coche: `DynamicRayCastVehicleController` de Rapier (acceso vía `useRapier` al API crudo).
- **Zustand** para estado global de UI/juego
- UI 2D (HUD, menús, retrovisores como overlay) en React normal sobre el canvas

Regla de oro de rendimiento: el estado por-frame va en refs y `useFrame`, **nunca** en estado de React (evitar re-renders en el game loop).

## Arquitectura (decidida): hexagonal + DDD, con matiz

Hexagonal aplicada a las **reglas del juego**, no al game loop. Render y físicas son
infraestructura con su propio paradigma (loop por frame, mutación, refs).

```
src/
├── domain/          # Vehicle, GearState, Infraction, reglas, GameEvent, EventBus — CERO imports de Three.js/Rapier
├── application/     # casos de uso (StartExam, ProcessTick...), PracticeMode, ExamMode, ports (interfaces)
├── infrastructure/  # physics/ (Rapier), rendering/ (R3F), input/, maps/, persistence/
└── ui/              # componentes React: HUD, espejos, menús
```

Flujo por frame: físicas → snapshot de estado → dominio evalúa reglas → emite eventos
(`SpeedLimitExceeded`, `PedestrianHit`...) → los modos de juego reaccionan.

El **event bus de dominio es el corazón del diseño**: se construye primero, en fase 1.
Práctica y examen son dos políticas suscritas al mismo bus.

## Backend (decidido)

**v1 sin backend, todo en frontend.** Juego local sin sesión. La apertura a futuro
(OAuth, persistencia, rankings en tiempo real) se garantiza vía puertos: `ScoreRepository`,
`ExamResultRepository`, etc. con adaptadores locales (localStorage/IndexedDB) hoy, y
adaptadores HTTP/WebSocket cuando lleguen sesiones. Nota: un ranking competitivo futuro
necesitará validación server-side (anti-cheat) — problema de esa fase, no de la v1.

## Fase 1 — Simulador básico

- Acciones: acelerar, frenar, cambio de marcha automático (D, R, N) — máquina de estados en dominio que firma el signo del torque.
- Vista en primera persona desde dentro del vehículo, con retrovisores y velocímetro/acelerómetro en la UI.
- Retrovisores: render targets (`RenderTexture`/`useFBO` de drei). Coste real: cada espejo re-renderiza la escena → resolución baja y refresco ≤30 fps en espejos.

Orden de implementación de fase 1 (cada paso da resultado visible):
1. Esqueleto Vite+TS con las capas y el event bus con tests
2. Escena R3F con suelo y vehículo Rapier conducible
3. Caja de cambios D/R/N en dominio
4. HUD con velocímetro
5. Retrovisores

## Features futuras (el diseño debe mantenerse compatible)

1. **Mapas intercambiables**: cada mapa = GLTF (geometría) + manifest JSON (spawns, zonas de trigger, señales con límites, rutas de NPCs). Puerto `MapRepository`. Añadir mapa = añadir assets, cero código.
2. **NPCs** en movimiento, con físicas y atropellables: character controller cinemático mientras caminan → conmutar a rigid body dinámico al impacto.
3. **Triggers de infracciones**: colliders *sensores* de Rapier (eventos de intersección) definidos en el manifest del mapa — borde de carretera, paso de cebra con NPC cruzando, zonas de señal. El exceso de velocidad por defecto es regla continua evaluada cada tick, no trigger espacial.
4. **UI de inicio** (selección de modo / configuración): React puro.
5. **Modos de juego** sobre el event bus:
   - **Práctica**: conducción libre con avisos de infracciones.
   - **Examen**: suspendes al acumular X infracciones.

## Estado actual

- ✅ Paso 1 completado (jun 2026): esqueleto Vite+TS+React 19, capas con alias (`@domain`, `@application`, `@infrastructure`, `@ui`), `EventBus` tipado en dominio con 9 tests, `createGame()` como raíz de composición.
- ✅ Paso 2 completado (jun 2026): escena R3F con suelo/carretera/obstáculos y vehículo Rapier conducible en primera persona. `ControlsPort` + `KeyboardControlsAdapter` (WASD/flechas, con tests). `VehicleSpec` en dominio (convención de ejes: **+z = frente, +x = izquierda del conductor**; eje de rueda -x para que fuerza positiva empuje a +z). `PlayerVehicle` usa `world.createVehicleController` (DynamicRayCastVehicleController) con `useBeforePhysicsStep`; publica `vehicle/stateUpdated` cada tick. Verificado con captura headless: render, conducción y giro OK. Pendiente de pulir: tuning de frenada/suspensión, tamaño del salpicadero en pantalla.
- Provisional: S con el coche parado = marcha atrás (lógica en `PlayerVehicle`); se sustituye por la caja D/N/R en el paso 3.
- Siguiente: paso 3 — caja de cambios D/N/R en dominio.

## Comandos y entorno

- Node se gestiona con **nvm.fish**; en shells no interactivas no está en PATH. Usar:
  `export PATH="$HOME/.local/share/nvm/v24.15.0/bin:$PATH"` antes de npm/node.
- `npm run dev` · `npm test` · `npm run build` (typecheck + bundle).
- Verificación visual headless: no hay chromium-cli; usar `playwright-core` (instalado ad hoc en /tmp) con `executablePath: /usr/bin/google-chrome-stable` y flags `--no-sandbox --enable-unsafe-swiftshader --use-angle=swiftshader`; esperar ~7 s a que cargue el WASM de Rapier antes de capturar.
- TypeScript 6: `baseUrl` está deprecado — los `paths` del tsconfig usan rutas relativas.

## Referencias

- Ejemplo oficial vehicle controller: https://threejs.org/examples/physics_rapier_vehicle_controller.html
- Ejemplo coche react-three-rapier: https://github.com/pmndrs/react-three-rapier/blob/main/demo/src/examples/car/CarExample.tsx
- API: https://rapier.rs/javascript3d/classes/DynamicRayCastVehicleController.html
