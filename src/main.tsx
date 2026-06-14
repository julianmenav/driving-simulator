import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { KeyboardControlsAdapter } from '@infrastructure/input/KeyboardControlsAdapter';
import { LocalMapRepository } from '@infrastructure/maps/LocalMapRepository';
import { App } from '@ui/App';
import '@ui/index.css';

const controls = new KeyboardControlsAdapter();
controls.attach(window);

// The ports are created here (the composition edge) and handed to the UI. The
// game itself is composed later, once the start menu has collected the session
// config — so the map is loaded through the repository only after Play.
const mapRepository = new LocalMapRepository();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App controls={controls} mapRepository={mapRepository} />
  </StrictMode>,
);
