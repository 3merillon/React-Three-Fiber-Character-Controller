import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { 
  WebGLCubeRenderTarget, 
  CubeCamera, 
  Scene, 
  Color, 
  Mesh, 
  SphereGeometry, 
  ShaderMaterial,
  BackSide
} from 'three';
import { useDayNight } from '../contexts/DayNightContext';

const dynamicEnvironmentVertexShader = `
varying vec3 vWorldDirection;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldDirection = worldPosition.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const dynamicEnvironmentFragmentShader = `
uniform vec3 sunPosition;
uniform float sunIntensity;
uniform vec3 sunColor;
uniform float sunElevation;
uniform vec3 zenithColor;
uniform vec3 horizonColor;
uniform vec3 groundColor;

varying vec3 vWorldDirection;

float smoothstep3(float edge0, float edge1, float x) {
  float t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

vec3 getSkyColor(vec3 direction) {
  float elevation = direction.y;
  
  vec3 sunDir = normalize(sunPosition);
  float sunDistance = distance(normalize(direction), sunDir);
  
  float horizonFactor = 1.0 - abs(elevation);
  float zenithFactor = max(0.0, elevation);
  
  vec3 skyColor = mix(
    mix(groundColor, horizonColor, smoothstep3(0.0, 1.0, horizonFactor)),
    zenithColor,
    smoothstep3(0.0, 1.0, zenithFactor)
  );
  
  // Simple sun glow for environment reflections only
  float sunVisibility = smoothstep3(-0.3, 0.2, sunElevation);
  float sunGlow = (1.0 - smoothstep3(0.0, 0.3, sunDistance)) * sunVisibility;
  sunGlow = pow(sunGlow, 2.0);
  
  skyColor = mix(skyColor, sunColor * 0.5, sunGlow * sunIntensity * 0.3);
  
  return skyColor;
}

void main() {
  vec3 direction = normalize(vWorldDirection);
  vec3 color = getSkyColor(direction);
  
  gl_FragColor = vec4(color, 1.0);
}
`;

export function DynamicEnvironmentMap() {
  const { gl, scene } = useThree();
  const { sunData } = useDayNight();
  
  const cubeRenderTarget = useRef<WebGLCubeRenderTarget | null>(null);
  const cubeCamera = useRef<CubeCamera | null>(null);
  const environmentScene = useRef<Scene | null>(null);
  const skyMaterial = useRef<ShaderMaterial | null>(null);
  const isInitialized = useRef(false);

  useMemo(() => {
    try {
      cubeRenderTarget.current = new WebGLCubeRenderTarget(256);
      cubeCamera.current = new CubeCamera(0.1, 1000, cubeRenderTarget.current);
      environmentScene.current = new Scene();

      const skyGeometry = new SphereGeometry(500, 32, 16);
      skyMaterial.current = new ShaderMaterial({
        uniforms: {
          sunPosition: { value: sunData.position.clone().normalize() },
          sunIntensity: { value: sunData.intensity },
          sunColor: { value: sunData.color.clone() },
          sunElevation: { value: sunData.elevation },
          zenithColor: { value: new Color(0.3, 0.6, 1.0) },
          horizonColor: { value: new Color(1.0, 0.8, 0.6) },
          groundColor: { value: new Color(0.2, 0.3, 0.4) }
        },
        vertexShader: dynamicEnvironmentVertexShader,
        fragmentShader: dynamicEnvironmentFragmentShader,
        side: BackSide,
        depthWrite: false
      });

      const skyMesh = new Mesh(skyGeometry, skyMaterial.current);
      environmentScene.current.add(skyMesh);
      
      isInitialized.current = true;
    } catch (error) {
      console.error('Failed to initialize DynamicEnvironmentMap:', error);
      isInitialized.current = false;
    }
  }, []);

  /*const smoothstep = (edge0: number, edge1: number, x: number): number => {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * t * (t * (t * 6 - 15) + 10);
  };*/

  useFrame(() => {
    if (!isInitialized.current || 
        !cubeCamera.current || 
        !environmentScene.current || 
        !skyMaterial.current || 
        !cubeRenderTarget.current) {
      return;
    }

    const elevation = sunData.elevation;
    const normalizedElevation = (elevation + Math.PI / 2) / Math.PI;

    try {
      skyMaterial.current.uniforms.sunPosition.value.copy(sunData.position).normalize();
      skyMaterial.current.uniforms.sunIntensity.value = sunData.intensity;
      skyMaterial.current.uniforms.sunColor.value.copy(sunData.color);
      skyMaterial.current.uniforms.sunElevation.value = elevation;

      // Simple color transitions for environment reflections
      const nightZenith = new Color(0.05, 0.05, 0.15);
      const nightHorizon = new Color(0.1, 0.1, 0.2);
      const nightGround = new Color(0.02, 0.02, 0.08);

      const dayZenith = new Color(0.3, 0.6, 1.0);
      const dayHorizon = new Color(0.8, 0.9, 1.0);
      const dayGround = new Color(0.4, 0.5, 0.6);

      let zenithColor, horizonColor, groundColor;

      // Simple day/night interpolation
      const dayFactor = Math.max(0, Math.min(1, (normalizedElevation - 0.2) / 0.6));
      
      zenithColor = nightZenith.clone().lerp(dayZenith, dayFactor);
      horizonColor = nightHorizon.clone().lerp(dayHorizon, dayFactor);
      groundColor = nightGround.clone().lerp(dayGround, dayFactor);

      skyMaterial.current.uniforms.zenithColor.value.copy(zenithColor);
      skyMaterial.current.uniforms.horizonColor.value.copy(horizonColor);
      skyMaterial.current.uniforms.groundColor.value.copy(groundColor);

      cubeCamera.current.update(gl, environmentScene.current);
      scene.environment = cubeRenderTarget.current.texture;
      
    } catch (error) {
      console.error('Error updating DynamicEnvironmentMap:', error);
    }
  });

  return null;
}