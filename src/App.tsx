import React, { useState, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { KeyboardControls } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
import { Bolt } from 'lucide-react';
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Vignette,
  SMAA,
  BrightnessContrast,
  HueSaturation,
  DepthOfField
} from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { CharacterController } from './components/CharacterController';
import { WorldManager } from './world/WorldManager';
import { IsometricCamera } from './camera/IsometricCamera';
import { usePostProcessingControls } from './hooks/usePostProcessingControls';
import { useDayNightControls } from './hooks/useDayNightControls';
import { Leva } from 'leva';
import { MobileControlsProvider } from './contexts/MobileControlsContext';
import { CameraProvider } from './contexts/CameraContext';
import { DayNightProvider, useDayNight } from './contexts/DayNightContext';
import { MobileControls } from './components/MobileControls';
import { AtmosphericSky } from './components/AtmosphericSky';
import { DynamicEnvironmentMap } from './components/DynamicEnvironmentMap';
import { DynamicEnvironmentLight } from './components/DynamicEnvironmentLight';
import { SmoothedPositionProvider } from './contexts/SmoothedPositionContext';
import { Vector3, Vector2 } from 'three';
import { useTerrainControls } from './world/useTerrainControls';
import { EnhancedCSMSunLight } from './components/EnhancedCSMSunLight';
import { detectDevice } from './utils/deviceDetection';
import { sampleTerrainHeightAt } from './world/sampleTerrainHeightAt';

// Component to handle dynamic ambient lighting
function DynamicAmbientLight() {
  const { atmosphericData } = useDayNight();
  
  return (
    <ambientLight 
      intensity={atmosphericData.ambientIntensity} 
      color={atmosphericData.ambientColor}
    />
  );
}

type DynamicDepthOfFieldProps = {
  enabled: boolean;
  target: React.RefObject<{ position: { clone: () => Vector3 } }>;
  focalLength: number;
  bokehScale: number;
};

function DynamicDepthOfField({
  enabled,
  target,
  focalLength,
  bokehScale
}: DynamicDepthOfFieldProps) {
  const { camera } = useThree();
  const [focusDistance, setFocusDistance] = React.useState(0);

  useFrame(() => {
    if (!enabled || !target.current) return;
    const distance = camera.position.distanceTo(target.current.position.clone());
    setFocusDistance(Math.min(distance / 20, 1));
  });

  return enabled ? (
    <DepthOfField
      focusDistance={focusDistance}
      focalLength={focalLength}
      bokehScale={bokehScale}
      height={1080}
    />
  ) : null;
}

function App() {
  const characterRef = React.useRef<any>(null);
  const worldManagerRef = React.useRef<any>(null);
  const [pendingTeleport, setPendingTeleport] = useState<{ x: number, z: number } | null>(null);
  const [worldReady, setWorldReady] = useState(false);
  const [fadeIn, setFadeIn] = useState(false);
  const [spawnY, setSpawnY] = useState<number | undefined>(undefined);
  const [spawnX, setSpawnX] = useState<number | undefined>(undefined);
  const [spawnZ, setSpawnZ] = useState<number | undefined>(undefined);

  const postProcessing = usePostProcessingControls();
  const terrainSettings = useTerrainControls();

  const deviceInfo = detectDevice();

  useEffect(() => {
    if (worldReady) {
      requestAnimationFrame(() => {
        setTimeout(() => setFadeIn(true), 150);
      });
    }
  }, [worldReady]);

  useEffect(() => {
    if (!worldReady || !characterRef.current) return;
    const x = characterRef.current.position.clone().x ?? (spawnX ?? 0);
    const z = characterRef.current.position.clone().z ?? (spawnZ ?? 0);
    setPendingTeleport({ x, z });
  }, [
    terrainSettings.chunkSize,
    terrainSettings.meshResolution,
    terrainSettings.renderDistance,
    terrainSettings.continentAmplitude,
    terrainSettings.mountainAmplitude,
    terrainSettings.detailAmplitude,
    terrainSettings.warpStrength,
    // add other relevant terrain controls here
  ]);

  useEffect(() => {
    const preventContextMenu = (e: MouseEvent) => e.preventDefault();
    window.addEventListener('contextmenu', preventContextMenu);
    return () => window.removeEventListener('contextmenu', preventContextMenu);
  }, []);

  useEffect(() => {
    document.body.style.background = '#000';
    return () => {
      document.body.style.background = '';
    };
  }, []);

  useEffect(() => {
    if (!worldReady) return;
    // Get the current character position
    const x = characterRef.current?.position.clone().x ?? (spawnX ?? 0);
    const z = characterRef.current?.position.clone().z ?? (spawnZ ?? 0);

    // Wait a bit for chunks to load (or you could make this more robust by listening for chunk loaded events)
    const timeout = setTimeout(() => {
      if (!worldManagerRef.current) return;
      const data = worldManagerRef.current.getTerrainDataAt(x, z);
      if (data) {
        const { chunk, terrain } = data;
        const y = sampleTerrainHeightAt(chunk, terrain, x, z);
        if (y !== null && characterRef.current?.teleportTo) {
          characterRef.current.teleportTo(x, y + 1.5, z);
        }
      }
    }, 600); // 600ms is usually enough for chunk to load

    return () => clearTimeout(timeout);
  }, [
    terrainSettings.chunkSize,
    terrainSettings]);

  return (
    <div className="w-full h-screen bg-black">
      <Bolt className="fixed top-4 right-4 w-6 h-6 text-white opacity-50" />
      <div className="fixed top-4 left-1/2 -translate-x-1/2 text-white font-mono text-sm pointer-events-none select-none bg-white/30 px-4 py-2 rounded-lg backdrop-blur-sm z-50">
        WASD to move | SPACE to jump | SHIFT to run | Dynamic Day/Night Cycle
      </div>
      <Leva collapsed />
      {!fadeIn && (
        <div className="fixed inset-0 flex items-center justify-center z-[100] bg-black transition-opacity duration-500 pointer-events-none"
             style={{ opacity: worldReady ? 0 : 1, transition: 'opacity 0.5s' }}>
          <div className="text-white text-xl font-bold animate-pulse">Loading...</div>
        </div>
      )}
      <div className={`w-full h-screen transition-opacity duration-500 ${fadeIn ? 'opacity-100' : 'opacity-0'}`}>
        <DayNightProvider>
          <SmoothedPositionProvider>
            <CameraProvider>
              <MobileControlsProvider>
                <MobileControls />
                <DayNightControls />
                <KeyboardControls
                  map={[
                    { name: 'forward', keys: ['ArrowUp', 'w', 'W'] },
                    { name: 'backward', keys: ['ArrowDown', 's', 'S'] },
                    { name: 'left', keys: ['ArrowLeft', 'a', 'A'] },
                    { name: 'right', keys: ['ArrowRight', 'd', 'D'] },
                    { name: 'jump', keys: ['Space'] },
                    { name: 'sprint', keys: ['ShiftLeft', 'ShiftRight'] },
                  ]}
                >
                  <Canvas shadows dpr={deviceInfo.isMobileDevice ? 1 : window.devicePixelRatio}>
                    <AtmosphericSky />
                    <DynamicEnvironmentMap />
                    <DynamicEnvironmentLight />
                    <DynamicAmbientLight />
                    <EnhancedCSMSunLight targetRef={characterRef} />
                    <Physics interpolate={true} timeStep={'vary'}>
                      <WorldManager
                        playerRef={characterRef}
                        settings={terrainSettings}
                        onReady={(initialY?: number, initialX?: number, initialZ?: number) => {
                          setWorldReady(true);
                          setSpawnY(initialY ?? 6);
                          setSpawnX(initialX ?? 0);
                          setSpawnZ(initialZ ?? 0);
                        }}
                        onChunkLoaded={(chunk, terrain) => {
                          if (
                            pendingTeleport &&
                            chunk.position.x <= pendingTeleport.x &&
                            pendingTeleport.x < chunk.position.x + terrainSettings.chunkSize &&
                            chunk.position.z <= pendingTeleport.z &&
                            pendingTeleport.z < chunk.position.z + terrainSettings.chunkSize
                          ) {
                            // This is the chunk under the player!
                            const y = sampleTerrainHeightAt(chunk, terrain, pendingTeleport.x, pendingTeleport.z);
                            if (y !== null && characterRef.current?.teleportTo) {
                              characterRef.current.teleportTo(pendingTeleport.x, y + 10.5, pendingTeleport.z);
                              setPendingTeleport(null);
                            }
                          }
                        }}
                      />
                      {worldReady && spawnY !== undefined && spawnX !== undefined && spawnZ !== undefined && (
                        <>
                          <CharacterController ref={characterRef} spawnY={spawnY} spawnX={spawnX} spawnZ={spawnZ} />
                          {/* REMOVED: <Balls /> */}
                          <IsometricCamera target={characterRef} />
                        </>
                      )}
                    </Physics>
                    
                    <EffectComposer>
                      <>
                        {postProcessing.depthOfFieldEnabled && (
                          <DynamicDepthOfField
                            enabled={postProcessing.depthOfFieldEnabled}
                            target={characterRef}
                            focalLength={postProcessing.focalLength}
                            bokehScale={postProcessing.bokehScale}
                          />
                        )}
                        {postProcessing.bloomEnabled && (
                          <Bloom intensity={postProcessing.bloomIntensity} />
                        )}
                        {postProcessing.chromaticAberrationEnabled && (
                          <ChromaticAberration
                            offset={new Vector2(
                              postProcessing.chromaticAberrationOffset,
                              postProcessing.chromaticAberrationOffset
                            )}
                            radialModulation={false}
                            modulationOffset={0}
                            blendFunction={BlendFunction.NORMAL}
                          />
                        )}
                        {postProcessing.vignetteEnabled && (
                          <Vignette
                            darkness={postProcessing.vignetteDarkness}
                            offset={postProcessing.vignetteOffset}
                            blendFunction={BlendFunction.NORMAL}
                          />
                        )}
                        {postProcessing.brightnessContrastEnabled && (
                          <BrightnessContrast
                            brightness={postProcessing.brightness}
                            contrast={postProcessing.contrast}
                            blendFunction={BlendFunction.NORMAL}
                          />
                        )}
                        {postProcessing.hueSaturationEnabled && (
                          <HueSaturation
                            hue={postProcessing.hue}
                            saturation={postProcessing.saturation}
                            blendFunction={BlendFunction.NORMAL}
                          />
                        )}
                        <SMAA />
                      </>
                    </EffectComposer>
                  </Canvas>
                </KeyboardControls>
              </MobileControlsProvider>
            </CameraProvider>
          </SmoothedPositionProvider>
        </DayNightProvider>
      </div>
    </div>
  );
}

// Component to use day/night controls (must be inside DayNightProvider)
function DayNightControls() {
  useDayNightControls();
  return null;
}

export default App;