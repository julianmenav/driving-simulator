import type { MapRepository, MapSummary } from '@application/ports/MapRepository';
import type { MapManifest } from '@domain/map/MapManifest';
import { buildGridCity } from './buildGridCity';

/** Catalog of the bundled procedural maps. The circuit lands in step 2. */
const MAPS: readonly MapSummary[] = [
  {
    id: 'city',
    name: 'Ciudad',
    description: 'Cuadrícula nocturna con tráfico, semáforos y colinas.',
  },
];

export const DEFAULT_MAP_ID = MAPS[0].id;

/**
 * Local map source: returns the bundled procedural maps. The future
 * HTTP/glTF adapter implements the same MapRepository port without touching
 * the domain or composition root.
 */
export class LocalMapRepository implements MapRepository {
  list(): Promise<MapSummary[]> {
    return Promise.resolve([...MAPS]);
  }

  load(id: string = DEFAULT_MAP_ID): Promise<MapManifest> {
    switch (id) {
      case 'city':
      default:
        return Promise.resolve(buildGridCity());
    }
  }
}
