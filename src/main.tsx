import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createGame } from '@application/createGame';
import { KeyboardControlsAdapter } from '@infrastructure/input/KeyboardControlsAdapter';
import { LocalMapRepository } from '@infrastructure/maps/LocalMapRepository';
import { App } from '@ui/App';
import '@ui/index.css';

const controls = new KeyboardControlsAdapter();
controls.attach(window);

// The map is loaded through the MapRepository port before the game is composed,
// so a future HTTP/glTF adapter swaps in here without further changes.
const mapRepository = new LocalMapRepository();
const root = createRoot(document.getElementById('root')!);

mapRepository.load().then((map) => {
  const game = createGame({ controls, map });
  root.render(
    <StrictMode>
      <App game={game} />
    </StrictMode>,
  );
});
