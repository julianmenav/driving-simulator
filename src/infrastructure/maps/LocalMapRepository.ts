import type { MapRepository } from '@application/ports/MapRepository';
import type { MapManifest } from '@domain/map/MapManifest';
import { buildGridCity } from './buildGridCity';

/**
 * Local map source: returns the bundled procedural city. The future
 * HTTP/glTF adapter implements the same MapRepository port without touching
 * the domain or composition root.
 */
export class LocalMapRepository implements MapRepository {
  load(_id?: string): Promise<MapManifest> {
    return Promise.resolve(buildGridCity());
  }
}
