import { useRef, useEffect } from 'react';
import { ChunkCoordinate, WorldGenerationSettings, TerrainData } from './types';

type TerrainWorkerRequest = {
  coordinate: ChunkCoordinate;
  settings: WorldGenerationSettings;
};

type TerrainWorkerResponse = {
  coordinate: ChunkCoordinate;
  terrain: Omit<TerrainData, 'vertices' | 'indices' | 'normals' | 'heights'> & {
    vertices: ArrayBuffer;
    indices: ArrayBuffer;
    normals: ArrayBuffer;
    heights: ArrayBuffer;
  };
};

export function useTerrainWorker(settings: WorldGenerationSettings) {
  const workerRef = useRef<Worker | null>(null);

  // Map: key = "x,z", value = Promise
  const pending = useRef<Map<string, (data: TerrainData) => void>>(new Map());

  useEffect(() => {
    // Create worker instance
    workerRef.current = new Worker(new URL('./terrainWorker.ts', import.meta.url), {
      type: 'module',
    });

    workerRef.current.onmessage = (event: MessageEvent) => {
      const { coordinate, terrain } = event.data as TerrainWorkerResponse;
      const key = `${coordinate.x},${coordinate.z}`;
      const resolve = pending.current.get(key);
      if (resolve) {
        pending.current.delete(key);

        // Reconstruct Float32Array/Uint32Array from buffers
        const result: TerrainData = {
          ...terrain,
          vertices: new Float32Array(terrain.vertices),
          indices: new Uint32Array(terrain.indices),
          normals: new Float32Array(terrain.normals),
          heights: new Float32Array(terrain.heights),
        };
        resolve(result);
      }
    };

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [settings.seed, settings.chunkSize, settings.renderDistance]);

  function requestChunk(coordinate: ChunkCoordinate): Promise<TerrainData> {
    const key = `${coordinate.x},${coordinate.z}`;
    return new Promise<TerrainData>((resolve) => {
      pending.current.set(key, resolve);
      workerRef.current?.postMessage({ coordinate, settings });
    });
  }

  return { requestChunk };
}