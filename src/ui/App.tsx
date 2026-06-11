import type { Game } from '@application/createGame';
import { SimulatorCanvas } from '@infrastructure/rendering/SimulatorCanvas';
import { Hud } from './Hud';

export function App({ game }: { game: Game }) {
  return (
    <div className="app-root">
      <SimulatorCanvas game={game} />
      <div className="overlay">
        <h1>Simulador de conducción</h1>
        <p>
          <kbd>W</kbd>/<kbd>↑</kbd> acelerar · <kbd>S</kbd>/<kbd>↓</kbd> frenar · <kbd>A</kbd>/<kbd>D</kbd> dirección ·{' '}
          <kbd>E</kbd>/<kbd>Q</kbd> marcha (R·N·D)
        </p>
      </div>
      <Hud game={game} />
    </div>
  );
}
