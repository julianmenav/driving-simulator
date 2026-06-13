import type { Game } from '@application/createGame';
import { SimulatorCanvas } from '@infrastructure/rendering/SimulatorCanvas';
import { useEnvironmentStore } from '@infrastructure/rendering/environment/environmentStore';
import { InfractionWarning } from './InfractionWarning';

export function App({ game }: { game: Game }) {
  const phase = useEnvironmentStore((state) => state.phase);
  const toggle = useEnvironmentStore((state) => state.toggle);

  return (
    <div className="app-root">
      <SimulatorCanvas game={game} />
      <InfractionWarning game={game} />
      <div className="overlay">
        <h1>Simulador de conducción</h1>
        <p>
          <kbd>W</kbd>/<kbd>↑</kbd> acelerar · <kbd>S</kbd>/<kbd>↓</kbd> frenar · <kbd>A</kbd>/<kbd>D</kbd> dirección ·{' '}
          <kbd>E</kbd>/<kbd>Q</kbd> marcha (R·N·D)
        </p>
      </div>
      <button className="env-toggle" onClick={toggle} title="Cambiar día/noche">
        {phase === 'night' ? '☀️ Día' : '🌙 Noche'}
      </button>
    </div>
  );
}
