import { WorldChunk, TerrainData } from './types';

/**
 * Sample the Y (height) at a given world (x, z) from a chunk's terrain data.
 */
export function sampleTerrainHeightAt(
  chunk: WorldChunk,
  terrainData: TerrainData,
  worldX: number,
  worldZ: number
): number | null {
  const { position } = chunk;
  const { vertices } = terrainData;
  const res = Math.round(Math.sqrt(vertices.length / 3));
  if (res < 2) return null;

  // Convert worldX/worldZ to local chunk coordinates
  const localX = worldX - position.x;
  const localZ = worldZ - position.z;

  // Clamp to grid
  const gridSize = res - 1;
  const step = chunk.mesh
    ? (chunk.mesh.geometry.boundingBox?.max.x ?? 1) / gridSize
    : 1;
  const normX = Math.max(0, Math.min(gridSize, Math.round((localX / (step * gridSize)) * gridSize)));
  const normZ = Math.max(0, Math.min(gridSize, Math.round((localZ / (step * gridSize)) * gridSize)));
  const idx = normZ * res + normX;

  if (idx * 3 + 1 < vertices.length) {
    return vertices[idx * 3 + 1];
  }
  return null;
}