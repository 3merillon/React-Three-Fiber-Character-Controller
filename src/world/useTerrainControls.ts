import { useControls } from 'leva';

export function useTerrainControls() {
  return useControls('Terrain Generation', {
    // Basic settings
    chunkSize: { value: 128, min: 64, max: 512, step: 64 },
    meshResolution: { value: 128, min: 32, max: 256, step: 32 },
    seed: { value: 'enhanced_world' },
    waterLevel: { value: 15, min: 0, max: 50, step: 1 },
    renderDistance: { value: 5, min: 3, max: 10, step: 1 },

    // Continental features
    continentScale: { value: 0.0008, min: 0.0001, max: 0.005, step: 0.0001 },
    continentAmplitude: { value: 80, min: 20, max: 200, step: 5 },

    // Mountain features
    mountainScale: { value: 0.006, min: 0.001, max: 0.02, step: 0.001 },
    mountainAmplitude: { value: 25, min: 5, max: 60, step: 1 },
    mountainSharpness: { value: 1.5, min: 0.5, max: 3, step: 0.1 },

    // Detail features
    detailScale: { value: 0.03, min: 0.01, max: 0.1, step: 0.01 },
    detailAmplitude: { value: 4, min: 1, max: 10, step: 0.5 },

    // Domain warping
    warpScale: { value: 0.01, min: 0.001, max: 0.05, step: 0.001 },
    warpStrength: { value: 15, min: 1, max: 50, step: 1 },
  });
}