import type { MapManifest } from '@domain/map/MapManifest';

/**
 * Source of map manifests. Today a local adapter returns a bundled procedural
 * city; tomorrow an HTTP adapter (or a glTF importer) can fetch real maps —
 * async so the contract does not change when that arrives.
 */
export interface MapRepository {
  load(id?: string): Promise<MapManifest>;
}
