import { WorldGenerator } from './WorldGenerator';
import { ChunkCoordinate, WorldGenerationSettings, TerrainData } from './types';

let generator: WorldGenerator | null = null;
let lastSettings: WorldGenerationSettings | null = null;

self.onmessage = (event: MessageEvent) => {
  const { coordinate, settings } = event.data as {
    coordinate: ChunkCoordinate;
    settings: WorldGenerationSettings;
  };

  // Recreate generator if settings changed
  if (!generator || JSON.stringify(settings) !== JSON.stringify(lastSettings)) {
    generator = new WorldGenerator(settings);
    lastSettings = settings;
  }

  // Generate terrain data (pure arrays/objects)
  const terrain: TerrainData = generator.generateChunk(coordinate);

  self.postMessage(
    {
      coordinate,
      terrain: {
        ...terrain,
        vertices: terrain.vertices.buffer,
        indices: terrain.indices.buffer,
        normals: terrain.normals.buffer,
        heights: terrain.heights.buffer,
        cubes: terrain.cubes,
        balls: terrain.balls,
      },
    },
    {
      transfer: [
        terrain.vertices.buffer,
        terrain.indices.buffer,
        terrain.normals.buffer,
        terrain.heights.buffer,
      ]
    }
  );
};