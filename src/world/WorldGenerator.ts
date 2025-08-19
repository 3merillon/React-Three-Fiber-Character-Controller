import { Vector3 } from 'three';
import { ChunkCoordinate, TerrainData, WorldGenerationSettings } from './types';
import { createNoise2D } from 'simplex-noise';
import alea from 'alea';

export class WorldGenerator {
  private settings: WorldGenerationSettings;
  private continentNoise!: ReturnType<typeof createNoise2D>;
  private mountainNoise!: ReturnType<typeof createNoise2D>;
  private hillNoise!: ReturnType<typeof createNoise2D>;
  private detailNoise!: ReturnType<typeof createNoise2D>;
  private warpNoiseX!: ReturnType<typeof createNoise2D>;
  private warpNoiseZ!: ReturnType<typeof createNoise2D>;
  private ridgeNoise!: ReturnType<typeof createNoise2D>;
  private valleyNoise!: ReturnType<typeof createNoise2D>;
  private erosionNoise!: ReturnType<typeof createNoise2D>;
  private underwaterNoise!: ReturnType<typeof createNoise2D>;
  private plainsNoise!: ReturnType<typeof createNoise2D>;
  private gentleNoise!: ReturnType<typeof createNoise2D>;

  constructor(settings: WorldGenerationSettings) {
    this.settings = settings;
    this.initializeNoiseGenerators();
  }

  private initializeNoiseGenerators() {
    const seed = this.settings.seed;
    this.continentNoise = createNoise2D(alea(seed + '_continent'));
    this.mountainNoise = createNoise2D(alea(seed + '_mountain'));
    this.hillNoise = createNoise2D(alea(seed + '_hill'));
    this.detailNoise = createNoise2D(alea(seed + '_detail'));
    this.warpNoiseX = createNoise2D(alea(seed + '_warpX'));
    this.warpNoiseZ = createNoise2D(alea(seed + '_warpZ'));
    this.ridgeNoise = createNoise2D(alea(seed + '_ridge'));
    this.valleyNoise = createNoise2D(alea(seed + '_valley'));
    this.erosionNoise = createNoise2D(alea(seed + '_erosion'));
    this.underwaterNoise = createNoise2D(alea(seed + '_underwater'));
    this.plainsNoise = createNoise2D(alea(seed + '_plains'));
    this.gentleNoise = createNoise2D(alea(seed + '_gentle'));
  }

  private fractal(
    x: number, 
    z: number, 
    noiseFunc: ReturnType<typeof createNoise2D>, 
    octaves: number, 
    scale: number, 
    amplitude: number, 
    persistence: number = 0.5,
    lacunarity: number = 2.0
  ): number {
    let value = 0;
    let currentAmplitude = amplitude;
    let currentScale = scale;
    let maxValue = 0;
    
    for (let i = 0; i < octaves; i++) {
      value += noiseFunc(x * currentScale, z * currentScale) * currentAmplitude;
      maxValue += currentAmplitude;
      currentAmplitude *= persistence;
      currentScale *= lacunarity;
    }
    return value / maxValue;
  }

  private ridged(
    x: number, 
    z: number, 
    noiseFunc: ReturnType<typeof createNoise2D>, 
    scale: number, 
    amplitude: number,
    sharpness: number = 1.5
  ): number {
    const n = noiseFunc(x * scale, z * scale);
    const ridged = 1 - Math.abs(n);
    return Math.pow(ridged, sharpness) * amplitude;
  }

  private billow(
    x: number, 
    z: number, 
    noiseFunc: ReturnType<typeof createNoise2D>, 
    scale: number, 
    amplitude: number
  ): number {
    const n = noiseFunc(x * scale, z * scale);
    return Math.abs(n) * amplitude;
  }

  private warp(x: number, z: number): [number, number] {
    const warpStrength = this.settings.warpStrength;
    const warpScale = this.settings.warpScale;
    
    const offsetX = this.fractal(x, z, this.warpNoiseX, 3, warpScale, warpStrength * 0.8, 0.5, 2.1);
    const offsetZ = this.fractal(x, z, this.warpNoiseZ, 3, warpScale, warpStrength * 0.8, 0.5, 2.1);
    
    return [x + offsetX, z + offsetZ];
  }

  private smootherstep(a: number, b: number, t: number): number {
    const x = Math.max(0, Math.min(1, (t - a) / (b - a)));
    return x * x * x * (x * (x * 6 - 15) + 10);
  }

  private getHeightAt(worldX: number, worldZ: number): number {
    const [wx, wz] = this.warp(worldX, worldZ);

    // 1. Continental base
    const continentScale = this.settings.continentScale;
    const continentAmp = this.settings.continentAmplitude * 1.5;
    const continent = this.fractal(wx, wz, this.continentNoise, 6, continentScale, continentAmp, 0.55, 2.2);

    // 2. Underwater terrain
    const underwaterBase = this.fractal(wx, wz, this.underwaterNoise, 5, 0.003, -35, 0.6, 2.1);
    const underwaterRidges = this.ridged(wx, wz, this.underwaterNoise, 0.008, -20, 1.2);
    const underwaterDetail = this.fractal(wx, wz, this.detailNoise, 4, 0.025, -12, 0.5, 2.0);
    const underwaterCanyons = this.billow(wx, wz, this.valleyNoise, 0.004, -25);
    
    const combinedUnderwater = underwaterBase + underwaterRidges + underwaterDetail + underwaterCanyons;
    const underwaterMask = this.smootherstep(0.2, -0.5, continent);
    const underwaterTerrain = combinedUnderwater * underwaterMask;

    // 3. Mountains
    const mountainScale = this.settings.mountainScale;
    const mountainAmp = this.settings.mountainAmplitude * 3.0;
    
    const primaryMountains = this.ridged(wx, wz, this.mountainNoise, mountainScale, mountainAmp, 2.0);
    const secondaryRidges = this.ridged(wx + 100, wz + 50, this.ridgeNoise, mountainScale * 1.3, mountainAmp * 0.4, 1.6);
    const tertiaryRidges = this.ridged(wx - 50, wz + 150, this.mountainNoise, mountainScale * 0.7, mountainAmp * 0.6, 1.4);
    
    const erosion = this.fractal(wx, wz, this.erosionNoise, 5, mountainScale * 4, 18, 0.45, 2.1);
    const microErosion = this.fractal(wx, wz, this.detailNoise, 3, mountainScale * 8, 8, 0.35, 2.5);
    
    const combinedMountains = primaryMountains + secondaryRidges + tertiaryRidges - erosion - microErosion;
    const mountainMask = this.smootherstep(-0.1, 0.6, continent);

    // 4. Coastal flattening
    const distanceFromWater = Math.max(0, continent + 0.2);
    const coastalFlattening = this.smootherstep(0.4, 0, distanceFromWater) * -6;

    // 5. Plains layer
    const plainsBase = this.fractal(wx, wz, this.plainsNoise, 4, 0.004, 8, 0.6, 2.0);
    const gentleUndulation = this.fractal(wx, wz, this.gentleNoise, 3, 0.008, 4, 0.5, 2.2);
    const plainsLayer = (plainsBase + gentleUndulation) * 0.9;

    // 6. Valleys
    const valleyBase = this.billow(wx, wz, this.valleyNoise, 0.006, -18);
    const riverValleys = this.billow(wx + 200, wz - 100, this.valleyNoise, 0.015, -12);
    const combinedValleys = valleyBase + riverValleys;
    const valleyMask = this.smootherstep(-0.2, 0.4, continent) * this.smootherstep(0, 15, Math.abs(combinedMountains * mountainMask));

    // 7. Hills
    const largeHills = this.fractal(wx, wz, this.hillNoise, 4, 0.006, 25, 0.5, 2.1);
    const mediumHills = this.fractal(wx + 75, wz - 25, this.hillNoise, 3, 0.012, 15, 0.6, 2.0);
    const rollingHills = this.fractal(wx - 30, wz + 80, this.detailNoise, 2, 0.025, 8, 0.5, 2.2);
    
    const combinedHills = largeHills + mediumHills + rollingHills;
    const hillMask = this.smootherstep(-0.4, 0.3, continent);

    // 8. Surface smoothing
    const smoothingLayer = this.fractal(wx, wz, this.gentleNoise, 6, 0.02, 3.5, 0.4, 2.1);
    
    // 9. Surface details
    const detailScale = this.settings.detailScale;
    const detailAmp = this.settings.detailAmplitude * 1.2;
    const surfaceDetails = this.fractal(wx, wz, this.detailNoise, 5, detailScale, detailAmp, 0.45, 2.4);
    const microDetails = this.fractal(wx, wz, this.detailNoise, 3, detailScale * 3, detailAmp * 0.3, 0.4, 2.6);

    // 10. Plateaus
    const plateauBase = this.fractal(wx, wz, this.continentNoise, 3, 0.004, 18, 0.7, 2.0);
    const plateauMask = this.smootherstep(0.3, 0.7, continent);
    const plateaus = Math.max(0, plateauBase) * plateauMask;

    // Combine everything
    let height = this.settings.waterLevel;
    height += continent;
    height += underwaterTerrain;
    height += coastalFlattening;
    height += combinedMountains * mountainMask;
    height += combinedValleys * valleyMask;
    height += combinedHills * hillMask;
    height += plainsLayer;
    height += plateaus;
    height += smoothingLayer;
    height += surfaceDetails + microDetails;

    return height;
  }

  generateChunk(coordinate: ChunkCoordinate): TerrainData {
    const { chunkSize, meshResolution } = this.settings;
    const resolution = meshResolution + 1;

    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];
    const heights: number[] = [];

    const worldX = coordinate.x * chunkSize;
    const worldZ = coordinate.z * chunkSize;

    // Generate height map with border sampling for seamless chunks
    const heightMap: number[][] = [];
    const borderSize = 2;
    
    for (let z = -borderSize; z < resolution + borderSize; z++) {
      heightMap[z + borderSize] = [];
      for (let x = -borderSize; x < resolution + borderSize; x++) {
        const px = worldX + (x / meshResolution) * chunkSize;
        const pz = worldZ + (z / meshResolution) * chunkSize;
        const h = this.getHeightAt(px, pz);
        heightMap[z + borderSize][x + borderSize] = h;
        
        if (x >= 0 && x < resolution && z >= 0 && z < resolution) {
          heights.push(h);
        }
      }
    }

    // Generate vertices
    for (let z = 0; z < resolution; z++) {
      for (let x = 0; x < resolution; x++) {
        const px = (x / meshResolution) * chunkSize;
        const pz = (z / meshResolution) * chunkSize;
        const h = heightMap[z + borderSize][x + borderSize];
        vertices.push(px, h, pz);
      }
    }

    // Generate normals
    for (let z = 0; z < resolution; z++) {
      for (let x = 0; x < resolution; x++) {
        const stepSize = chunkSize / meshResolution;
        
        const hL = heightMap[z + borderSize][x + borderSize - 1];
        const hR = heightMap[z + borderSize][x + borderSize + 1];
        const hD = heightMap[z + borderSize - 1][x + borderSize];
        const hU = heightMap[z + borderSize + 1][x + borderSize];

        const normal = {
          x: (hL - hR) / (2 * stepSize),
          y: 1,
          z: (hD - hU) / (2 * stepSize)
        };
        
        const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y + normal.z * normal.z);
        normals.push(normal.x / length, normal.y / length, normal.z / length);
      }
    }

    // Generate indices
    for (let z = 0; z < meshResolution; z++) {
      for (let x = 0; x < meshResolution; x++) {
        const topLeft = z * resolution + x;
        const topRight = topLeft + 1;
        const bottomLeft = (z + 1) * resolution + x;
        const bottomRight = bottomLeft + 1;
        
        indices.push(topLeft, bottomLeft, topRight);
        indices.push(topRight, bottomLeft, bottomRight);
      }
    }

    // Generate objects (simplified)
    const cubes: { x: number; y: number; z: number; size: number }[] = [];
    const balls: { x: number; y: number; z: number; radius: number }[] = [];
    
    function seededRandom(seed: number) {
      let x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    }
    
    const prngSeed = coordinate.x * 73856093 ^ coordinate.z * 19349663;
    
    for (let i = 0; i < 8; i++) {
      const rx = 5 + Math.floor(seededRandom(prngSeed + i * 10) * (chunkSize - 10));
      const rz = 5 + Math.floor(seededRandom(prngSeed + i * 10 + 1) * (chunkSize - 10));
      const gridX = Math.floor((rx / chunkSize) * meshResolution);
      const gridZ = Math.floor((rz / chunkSize) * meshResolution);
      const terrainHeight = heightMap[gridZ + borderSize][gridX + borderSize];
      
      if (terrainHeight > this.settings.waterLevel + 3) {
        const objectRandom = seededRandom(prngSeed + i * 10 + 2);
        
        if (objectRandom > 0.5) {
          const size = 0.6 + seededRandom(prngSeed + i * 10 + 3) * 2.8;
          cubes.push({ x: rx, y: terrainHeight + size * 0.5, z: rz, size });
        } else if (objectRandom > 0.3) {
          const radius = 0.3 + seededRandom(prngSeed + i * 10 + 4) * 0.8;
          balls.push({ x: rx, y: terrainHeight + radius + 0.5, z: rz, radius });
        }
      }
    }

    return {
      vertices: new Float32Array(vertices),
      indices: new Uint32Array(indices),
      normals: new Float32Array(normals),
      heights: new Float32Array(heights),
      cubes,
      balls
    };
  }

  updateSettings(newSettings: Partial<WorldGenerationSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    if (newSettings.seed) {
      this.initializeNoiseGenerators();
    }
  }
}