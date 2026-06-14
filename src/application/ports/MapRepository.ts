import type { MapManifest } from '@domain/map/MapManifest';

/**
 * Catalog metadata for a selectable map — enough for the start menu to list
 * the options without loading the (potentially heavy) manifest itself.
 */
export interface MapSummary {
  id: string;
  /** End-user-facing name (Spanish). */
  name: string;
  description: string;
}

/**
 * Source of map manifests. Today a local adapter returns bundled procedural
 * maps; tomorrow an HTTP adapter (or a glTF importer) can fetch real maps —
 * async so the contract does not change when that arrives.
 */
export interface MapRepository {
  /** Lists the available maps (catalog metadata only). */
  list(): Promise<MapSummary[]>;
  /** Loads the full manifest for a map id (defaults to the first map). */
  load(id?: string): Promise<MapManifest>;
}
