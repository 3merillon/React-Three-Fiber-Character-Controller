import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { DirectionalLight, Vector3, Scene } from 'three';
import { CSM } from 'three/addons/csm/CSM.js';
import { useDayNight } from '../contexts/DayNightContext';
import { useCSMControls } from '../hooks/useCSMControls';

interface EnhancedCSMSunLightProps {
  targetRef: React.RefObject<{ position: { clone: () => Vector3 } }>;
}

function removeCSMLightsFromScene(csm: CSM, scene: Scene) {
  if (csm && csm.lights) {
    csm.lights.forEach(light => {
      if (scene.children.includes(light)) {
        scene.remove(light);
      }
      if (light.target && scene.children.includes(light.target)) {
        scene.remove(light.target);
      }
    });
  }
}

export function EnhancedCSMSunLight({ targetRef }: EnhancedCSMSunLightProps) {
  const lightRef = useRef<DirectionalLight>(null);
  const csmRef = useRef<CSM | null>(null);
  const { sunData } = useDayNight();
  const { camera, scene } = useThree();
  const csmControls = useCSMControls();
  const lastCameraRef = useRef<any>(null);

  // (Re)create CSM if camera reference or cascade count changes
  useEffect(() => {
    if (!csmControls.enabled) return;

    // Only recreate if camera or cascades change
    if (!csmRef.current || lastCameraRef.current !== camera) {
      // Remove previous CSM lights from the scene
      if (csmRef.current) {
        removeCSMLightsFromScene(csmRef.current, scene);
        csmRef.current.dispose();
        csmRef.current = null;
      }

      const initialLightDirection = sunData.position.clone().normalize().negate();

      const csm = new CSM({
        maxFar: csmControls.maxFar,
        cascades: csmControls.cascades,
        mode: 'practical',
        parent: scene,
        shadowMapSize: csmControls.shadowMapSize,
        lightDirection: initialLightDirection,
        camera: camera,
        lightMargin: csmControls.lightMargin,
      });

      csm.lights.forEach(light => {
        light.intensity = sunData.intensity;
        light.color.copy(sunData.color);
        light.castShadow = true;
        light.shadow.bias = csmControls.shadowBias ?? -0.000015;
        light.shadow.normalBias = csmControls.shadowNormalBias ?? 0.0;
        light.shadow.radius = csmControls.shadowRadius ?? 4;
        light.shadow.blurSamples = csmControls.shadowBlurSamples ?? 25;
      });

      csmRef.current = csm;
      lastCameraRef.current = camera;
    }
  }, [
    csmControls.enabled,
    camera,
    scene,
    sunData,
    csmControls.cascades,
    csmControls.shadowMapSize,
    csmControls.maxFar,
    csmControls.lightMargin,
    csmControls.shadowBias,
    csmControls.shadowNormalBias,
    csmControls.shadowRadius,
    csmControls.shadowBlurSamples,
  ]);

  // Dispose CSM and remove lights when disabled or unmounting
  useEffect(() => {
    return () => {
      if (csmRef.current) {
        removeCSMLightsFromScene(csmRef.current, scene);
        csmRef.current.dispose();
        csmRef.current = null;
      }
    };
  }, [csmControls.enabled, scene]);

  // Always update CSM properties that don't require recreation
  useEffect(() => {
    if (!csmRef.current) return;
    csmRef.current.maxFar = csmControls.maxFar;
    csmRef.current.lightMargin = csmControls.lightMargin;
    csmRef.current.lights.forEach((light) => {
      if (light.shadow) {
        light.shadow.bias = csmControls.shadowBias ?? -0.000015;
        light.shadow.normalBias = csmControls.shadowNormalBias ?? 0.02;
        light.shadow.radius = csmControls.shadowRadius ?? 4;
        light.shadow.blurSamples = csmControls.shadowBlurSamples ?? 25;
      }
    });
  }, [
    csmControls.maxFar,
    csmControls.lightMargin,
    csmControls.shadowBias,
    csmControls.shadowNormalBias,
    csmControls.shadowRadius,
    csmControls.shadowBlurSamples,
  ]);

  useFrame(() => {
    if (csmRef.current && sunData && csmControls.enabled) {
      // Always update direction and properties
      const lightDirection = sunData.position.clone().normalize().negate();
      csmRef.current.lightDirection.copy(lightDirection);

      csmRef.current.lights.forEach((light) => {
        light.intensity = sunData.intensity;
        light.color.copy(sunData.color);
      });

      camera.updateMatrixWorld(true);
      csmRef.current.update();
    } else if (lightRef.current && targetRef.current && sunData && !csmControls.enabled) {
      // Fallback: classic directional light
      const playerPos = targetRef.current.position.clone();
      const lightDistance = 1000;
      const sunDirection = sunData.position.clone().normalize();
      const lightWorldPosition = playerPos.clone().add(sunDirection.multiplyScalar(lightDistance));
      lightRef.current.position.copy(lightWorldPosition);
      lightRef.current.target.position.copy(playerPos);
      lightRef.current.target.updateMatrixWorld();
      lightRef.current.intensity = sunData.intensity;
      lightRef.current.color.copy(sunData.color);
    }
  },-100);

  // Fallback directional light when CSM is disabled
  if (!csmControls.enabled) {
    return (
      <directionalLight
        ref={lightRef}
        castShadow
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-near={1}
        shadow-camera-far={500}
        shadow-camera-left={-200}
        shadow-camera-right={200}
        shadow-camera-top={200}
        shadow-camera-bottom={-200}
        shadow-bias={csmControls.shadowBias ?? -0.000015}
        shadow-normalBias={csmControls.shadowNormalBias ?? 0.02}
      />
    );
  }

  return null;
}