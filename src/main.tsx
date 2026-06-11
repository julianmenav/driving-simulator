import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createGame } from '@application/createGame';
import { App } from '@ui/App';
import '@ui/index.css';

const game = createGame();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App game={game} />
  </StrictMode>,
);
