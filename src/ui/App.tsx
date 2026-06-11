import type { Game } from '@application/createGame';
import { SimulatorCanvas } from '@infrastructure/rendering/SimulatorCanvas';

export function App({ game }: { game: Game }) {
  return (
    <div className="app-root">
      <SimulatorCanvas game={game} />
      <div className="overlay">
        <h1>Simulador de conducción</h1>
        <p>
          <kbd>W</kbd>/<kbd>↑</kbd> acelerar · <kbd>S</kbd>/<kbd>↓</kbd> frenar (parado: marcha atrás) ·{' '}
          <kbd>A</kbd>/<kbd>D</kbd> dirección
        </p>
      </div>
    </div>
  );
}
