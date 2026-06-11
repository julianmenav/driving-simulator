import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createGame } from '@application/createGame';
import { KeyboardControlsAdapter } from '@infrastructure/input/KeyboardControlsAdapter';
import { App } from '@ui/App';
import '@ui/index.css';

const controls = new KeyboardControlsAdapter();
controls.attach(window);
const game = createGame({ controls });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App game={game} />
  </StrictMode>,
);
