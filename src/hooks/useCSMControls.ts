import { useControls } from 'leva';

export function useCSMControls() {
  return useControls('CSM Shadows', {
    enabled: { value: true },
    cascades: { value: 3, min: 1, max: 6, step: 1 },
    shadowMapSize: { 
      value: 4096, 
      options: [512, 1024, 2048, 4096] 
    },
    maxFar: { value: 500, min: 100, max: 2000, step: 50 },
    lightMargin: { value: 1000, min: 50, max: 1000, step: 10 },
    shadowBias: { value: -0.000015, min: -0.001, max: 0.001, step: 0.000001 },
    shadowNormalBias: { value: 0.02, min: 0, max: 0.1, step: 0.01 },
    shadowRadius: { value: 400, min: 1, max: 400, step: 1 },
    shadowBlurSamples: { value: 25, min: 1, max: 50, step: 1 },
  });
}