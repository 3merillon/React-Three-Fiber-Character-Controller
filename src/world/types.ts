import { Mesh, Vector3 } from 'three';

export interface ChunkCoordinate {
  x: number;
  z: number;
}

export interface WorldChunk {
  coordinate: ChunkCoordinate;
  position: Vector3;
  isLoaded: boolean;
  isVisible: boolean;
  mesh?: Mesh;
  needsUpdate: boolean;
}

export interface WorldGenerationSettings {
  seed: string;
  chunkSize: number;
  meshResolution: number;
  waterLevel: number;
  continentScale: number;
  continentAmplitude: number;
  mountainScale: number;
  mountainAmplitude: number;
  mountainSharpness: number;
  detailScale: number;
  detailAmplitude: number;
  warpScale: number;
  warpStrength: number;
  renderDistance: number;
}

export interface TerrainData {
  heights: Float32Array;
  normals: Float32Array;
  vertices: Float32Array;
  indices: Uint32Array;
  cubes?: { x: number; y: number; z: number; size: number }[];
  balls?: { x: number; y: number; z: number; radius: number }[];
}

export interface WorldState {
  playerChunk: ChunkCoordinate;
  loadedChunks: Map<string, WorldChunk>;
  visibleChunks: Set<string>;
  generationQueue: ChunkCoordinate[];
}