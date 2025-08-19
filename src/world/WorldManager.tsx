import React, {
  useRef,
  useEffect,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { ChunkManager } from './ChunkManager';
import { TerrainChunk } from './TerrainChunk';
import { WorldChunk, WorldGenerationSettings, TerrainData } from './types';
import { useTerrainWorker } from './useTerrainWorker';

interface WorldManagerProps {
  playerRef: React.RefObject<{ position: { clone: () => Vector3 } }>;
  settings?: Partial<WorldGenerationSettings>;
  onReady?: (spawnY: number, spawnX: number, spawnZ: number) => void;
  onChunkLoaded?: (chunk: WorldChunk, terrain: TerrainData) => void; // <-- add this
}

const defaultSettings: WorldGenerationSettings = {
  seed: 'default_world_seed',
  chunkSize: 256,
  meshResolution: 256,
  waterLevel: 10,
  continentScale: 0.002,
  continentAmplitude: 40,
  mountainScale: 0.02,
  mountainAmplitude: 32,
  mountainSharpness: 1.2,
  detailScale: 0.07,
  detailAmplitude: 8,
  warpScale: 0.06,
  warpStrength: 30,
  renderDistance: 5,
};

export const WorldManager = forwardRef(function WorldManager(
  { playerRef, settings = {}, onReady, onChunkLoaded }: WorldManagerProps,
  ref
) {
  const chunkManagerRef = useRef<ChunkManager>();
  const [loadedChunks, setLoadedChunks] = useState<WorldChunk[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [ready, setReady] = useState(false);

  const finalSettings: WorldGenerationSettings = { ...defaultSettings, ...settings };
  const requiredChunkCount = finalSettings.renderDistance * finalSettings.renderDistance;
  const loadedChunkCoords = useRef<Set<string>>(new Set());

  const { requestChunk } = useTerrainWorker(finalSettings);
  const chunkTerrainData = useRef<Map<string, TerrainData>>(new Map());
  const loadingChunks = useRef<Set<string>>(new Set());

  // --- Expose getTerrainDataAt via ref ---
  useImperativeHandle(ref, () => ({
    /**
     * Returns { chunk, terrain } for the chunk at worldX, worldZ, or null if not loaded.
     */
    getTerrainDataAt(worldX: number, worldZ: number) {
      if (!chunkManagerRef.current) return null;
      // Compute which chunk this position is in
      const chunkSize = finalSettings.chunkSize;
      const x = Math.floor(worldX / chunkSize);
      const z = Math.floor(worldZ / chunkSize);
      const key = `${x},${z}`;
      const chunk = chunkManagerRef.current.getChunk({ x, z });
      const terrain = chunkTerrainData.current.get(key);
      return chunk && terrain ? { chunk, terrain } : null;
    },
  }));

  useEffect(() => {
    chunkManagerRef.current = new ChunkManager(finalSettings);
    setIsInitialized(true);
    chunkTerrainData.current.clear();
    loadingChunks.current.clear();
    loadedChunkCoords.current.clear();
    setLoadedChunks([]);
    setReady(false);
  }, [
    finalSettings.seed,
    finalSettings.chunkSize,
    finalSettings.meshResolution,
    finalSettings.waterLevel,
    finalSettings.continentScale,
    finalSettings.continentAmplitude,
    finalSettings.mountainScale,
    finalSettings.mountainAmplitude,
    finalSettings.mountainSharpness,
    finalSettings.detailScale,
    finalSettings.detailAmplitude,
    finalSettings.warpScale,
    finalSettings.warpStrength,
    finalSettings.renderDistance,
  ]);

  // Only call onReady when all required chunks are loaded
  const handleChunkLoaded = useCallback(
    (chunk: WorldChunk) => {
      const key = `${chunk.coordinate.x},${chunk.coordinate.z}`;
      loadedChunkCoords.current.add(key);

      if (!ready && loadedChunkCoords.current.size >= requiredChunkCount) {
        // Find the chunk at (0,0) (spawn)
        const spawnChunk = Array.from(loadedChunks).find(
          (c) => c.coordinate.x === 0 && c.coordinate.z === 0
        );
        let initialY = 2;
        let initialX = finalSettings.chunkSize / 2;
        let initialZ = finalSettings.chunkSize / 2;
        if (spawnChunk && spawnChunk.mesh && spawnChunk.mesh.geometry) {
          const posAttr = spawnChunk.mesh.geometry.attributes.position;
          let closestDist = Infinity;
          let bestY = -Infinity;
          for (let i = 0; i < posAttr.count; i++) {
            const x = posAttr.getX(i);
            const y = posAttr.getY(i);
            const z = posAttr.getZ(i);
            const dist = Math.hypot(x - initialX, z - initialZ);
            if (dist < closestDist) {
              closestDist = dist;
              bestY = y;
            }
          }
          if (bestY > -Infinity) initialY = bestY + 10.5;
        }
        setReady(true);
        if (onReady) onReady(initialY, initialX, initialZ);
      }
    },
    [ready, loadedChunks, finalSettings.chunkSize, onReady, requiredChunkCount]
  );

  useFrame(() => {
    if (!chunkManagerRef.current || !playerRef.current || !isInitialized) return;
    const playerPosition = playerRef.current.position.clone();
    const updateResult = chunkManagerRef.current.updatePlayerPosition(playerPosition);

    updateResult.chunksToLoad.forEach((coord) => {
      const key = `${coord.x},${coord.z}`;
      if (!chunkTerrainData.current.has(key) && !loadingChunks.current.has(key)) {
        loadingChunks.current.add(key);
        requestChunk(coord).then((terrainData) => {
          chunkTerrainData.current.set(key, terrainData);
          loadingChunks.current.delete(key);
          chunkManagerRef.current!.generateChunk(coord);
          setLoadedChunks(chunkManagerRef.current!.getLoadedChunks());
        });
      }
    });

    updateResult.chunksToUnload.forEach((key) => {
      chunkManagerRef.current!.unloadChunk(key);
      chunkTerrainData.current.delete(key);
      loadingChunks.current.delete(key);
      loadedChunkCoords.current.delete(key);
    });

    setLoadedChunks(chunkManagerRef.current.getLoadedChunks());
  });

  useEffect(() => {
    if (!chunkManagerRef.current || !isInitialized) return;
    const spawnPosition = new Vector3(0, 0, 0);
    const updateResult = chunkManagerRef.current.updatePlayerPosition(spawnPosition);
    updateResult.chunksToLoad.forEach((coord) => {
      const key = `${coord.x},${coord.z}`;
      if (!chunkTerrainData.current.has(key) && !loadingChunks.current.has(key)) {
        loadingChunks.current.add(key);
        requestChunk(coord).then((terrainData) => {
          chunkTerrainData.current.set(key, terrainData);
          loadingChunks.current.delete(key);
          chunkManagerRef.current!.generateChunk(coord);
          setLoadedChunks(chunkManagerRef.current!.getLoadedChunks());
        });
      }
    });
    setLoadedChunks(chunkManagerRef.current.getLoadedChunks());
  }, [isInitialized]);

  if (!isInitialized || !chunkManagerRef.current) {
    return null;
  }

  return (
    <group name="world-manager">
      {loadedChunks.map((chunk) => {
        const key = `${chunk.coordinate.x},${chunk.coordinate.z}`;
        const terrainData = chunkTerrainData.current.get(key);
        if (!terrainData) return null; // Wait for worker
        return (
          <TerrainChunk
            key={key}
            chunk={chunk}
            terrainData={terrainData}
            onLoaded={(loadedChunk) => {
              handleChunkLoaded(loadedChunk);
              if (onChunkLoaded) {
                onChunkLoaded(loadedChunk, terrainData);
              }
            }}
          />
        );
      })}
    </group>
  );
});