import { Vector3 } from 'three';
import { ChunkCoordinate, WorldChunk, WorldState, WorldGenerationSettings } from './types';
import { WorldGenerator } from './WorldGenerator';

export class ChunkManager {
  private worldState: WorldState;
  private generator: WorldGenerator;
  private settings: WorldGenerationSettings;

  constructor(settings: WorldGenerationSettings) {
    this.settings = settings;
    this.generator = new WorldGenerator(settings);
    this.worldState = {
      playerChunk: { x: 0, z: 0 },
      loadedChunks: new Map(),
      visibleChunks: new Set(),
      generationQueue: []
    };
  }

  private chunkKey(coord: ChunkCoordinate): string {
    return `${coord.x},${coord.z}`;
  }

  private worldToChunk(worldPos: Vector3): ChunkCoordinate {
    return {
      x: Math.floor(worldPos.x / this.settings.chunkSize),
      z: Math.floor(worldPos.z / this.settings.chunkSize)
    };
  }

  private chunkToWorld(coord: ChunkCoordinate): Vector3 {
    return new Vector3(
      coord.x * this.settings.chunkSize,
      0,
      coord.z * this.settings.chunkSize
    );
  }

  private getRequiredChunks(playerChunk: ChunkCoordinate): ChunkCoordinate[] {
    const chunks: ChunkCoordinate[] = [];
    const radius = Math.floor(this.settings.renderDistance / 2);
    
    for (let x = playerChunk.x - radius; x <= playerChunk.x + radius; x++) {
      for (let z = playerChunk.z - radius; z <= playerChunk.z + radius; z++) {
        chunks.push({ x, z });
      }
    }
    
    return chunks;
  }

  updatePlayerPosition(worldPosition: Vector3): {
    chunksToLoad: ChunkCoordinate[];
    chunksToUnload: string[];
    playerChunkChanged: boolean;
  } {
    const newPlayerChunk = this.worldToChunk(worldPosition);
    const playerChunkChanged = 
      newPlayerChunk.x !== this.worldState.playerChunk.x || 
      newPlayerChunk.z !== this.worldState.playerChunk.z;

    if (playerChunkChanged) {
      this.worldState.playerChunk = newPlayerChunk;
    }

    const requiredChunks = this.getRequiredChunks(newPlayerChunk);
    const requiredKeys = new Set(requiredChunks.map(c => this.chunkKey(c)));
    
    // Find chunks to load
    const chunksToLoad = requiredChunks.filter(coord => {
      const key = this.chunkKey(coord);
      return !this.worldState.loadedChunks.has(key);
    });

    // Find chunks to unload
    const chunksToUnload: string[] = [];
    for (const [key] of this.worldState.loadedChunks) {
      if (!requiredKeys.has(key)) {
        chunksToUnload.push(key);
      }
    }

    // Update visible chunks
    this.worldState.visibleChunks = requiredKeys;

    return { chunksToLoad, chunksToUnload, playerChunkChanged };
  }

  generateChunk(coordinate: ChunkCoordinate): WorldChunk {
    //const terrainData = this.generator.generateChunk(coordinate);
    const position = this.chunkToWorld(coordinate);
    
    const chunk: WorldChunk = {
      coordinate,
      position,
      isLoaded: false,
      isVisible: true,
      needsUpdate: true
    };

    const key = this.chunkKey(coordinate);
    this.worldState.loadedChunks.set(key, chunk);
    
    return chunk;
  }

  getChunk(coordinate: ChunkCoordinate): WorldChunk | undefined {
    const key = this.chunkKey(coordinate);
    return this.worldState.loadedChunks.get(key);
  }

  unloadChunk(key: string): void {
    this.worldState.loadedChunks.delete(key);
  }

  getLoadedChunks(): WorldChunk[] {
    return Array.from(this.worldState.loadedChunks.values());
  }

  getWorldState(): WorldState {
    return this.worldState;
  }

  updateSettings(newSettings: Partial<WorldGenerationSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    this.generator.updateSettings(newSettings);
  }
}