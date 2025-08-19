import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Mesh, ShaderMaterial, SphereGeometry, Vector3, BackSide } from 'three';
import { useDayNight } from '../contexts/DayNightContext';

const atmosphericVertexShader = `
varying vec3 vWorldPosition;
varying vec3 vSunDirection;
varying float vSunfade;
varying vec3 vBetaR;
varying vec3 vBetaM;
varying float vSunE;

uniform vec3 sunPosition;
uniform float rayleigh;
uniform float turbidity;
uniform float mieCoefficient;

const vec3 up = vec3(0.0, 1.0, 0.0);
const float e = 2.71828182845904523536028747135266249775724709369995957;
const float pi = 3.141592653589793238462643383279502884197169;
const vec3 lambda = vec3(686e-9, 678e-9, 666e-9);
const vec3 totalRayleigh = vec3(5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5);
const float v = 4.0;
const vec3 K = vec3(0.686, 0.678, 0.666);
const vec3 MieConst = vec3(1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14);
const float cutoffAngle = 1.6110731556870734;
const float steepness = 1.5;
const float EE = 1000.0;

float sunIntensity(float zenithAngleCos) {
  zenithAngleCos = clamp(zenithAngleCos, -1.0, 1.0);
  return EE * max(0.0, 1.0 - pow(e, -((cutoffAngle - acos(zenithAngleCos)) / steepness)));
}

vec3 totalMie(float T) {
  float c = (0.2 * T) * 10E-18;
  return 0.434 * c * MieConst;
}

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vSunDirection = normalize(sunPosition);
  vSunE = sunIntensity(dot(vSunDirection, up));
  vSunfade = 1.0 - clamp(1.0 - exp((sunPosition.y / 450000.0)), 0.0, 1.0);
  float rayleighCoefficient = rayleigh - (1.0 * (1.0 - vSunfade));
  vBetaR = totalRayleigh * rayleighCoefficient;
  vBetaM = totalMie(turbidity) * mieCoefficient;
}
`;

const atmosphericFragmentShader = `
varying vec3 vWorldPosition;
varying vec3 vSunDirection;
varying float vSunfade;
varying vec3 vBetaR;
varying vec3 vBetaM;
varying float vSunE;

uniform float mieDirectionalG;
uniform vec3 up;
uniform float nightIntensity;
uniform float timeOfDay;
uniform float starRotation;
uniform vec3 cameraPos;

const float pi = 3.141592653589793238462643383279502884197169;
const float rayleighZenithLength = 8.4E3;
const float mieZenithLength = 1.25E3;
const float sunAngularDiameterCos = 0.999956676946448443553574619906976478926848692873900859324;
const float THREE_OVER_SIXTEENPI = 0.05968310365946075;
const float ONE_OVER_FOURPI = 0.07957747154594767;

float smoothstep3(float edge0, float edge1, float x) {
  float t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

float smoothstep5(float edge0, float edge1, float x) {
  float t = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
  return t * t * t * t * (t * (t * (t * (-20.0 * t + 70.0) - 84.0) + 35.0));
}

float hash21(vec2 p) {
  p = fract(p * vec2(233.34, 851.73));
  p += dot(p, p + 23.45);
  return fract(p.x * p.y);
}

vec2 rotate2D(vec2 v, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(v.x * c - v.y * s, v.x * s + v.y * c);
}

float getStars(vec3 direction) {
  vec3 dir = normalize(direction);
  float phi = atan(dir.z, dir.x);
  float theta = acos(dir.y);
  phi += starRotation;
  vec2 starCoord = vec2(phi * 2.0, theta * 4.0);
  float stars = 0.0;
  vec2 bigStarGrid = floor(starCoord * 8.0);
  float bigStarRand = hash21(bigStarGrid);
  if (bigStarRand > 0.997) {
    vec2 bigStarPos = fract(starCoord * 8.0);
    float bigStarDist = length(bigStarPos - 0.5);
    stars += smoothstep5(0.1, 0.0, bigStarDist) * 3.0;
  }
  vec2 medStarGrid = floor(starCoord * 20.0);
  float medStarRand = hash21(medStarGrid + 100.0);
  if (medStarRand > 0.994) {
    vec2 medStarPos = fract(starCoord * 20.0);
    float medStarDist = length(medStarPos - 0.5);
    stars += smoothstep5(0.08, 0.0, medStarDist) * 2.0;
  }
  vec2 smallStarGrid = floor(starCoord * 50.0);
  float smallStarRand = hash21(smallStarGrid + 200.0);
  if (smallStarRand > 0.99) {
    vec2 smallStarPos = fract(starCoord * 50.0);
    float smallStarDist = length(smallStarPos - 0.5);
    stars += smoothstep5(0.05, 0.0, smallStarDist) * 1.0;
  }
  float twinkle = 0.8 + 0.2 * sin(hash21(bigStarGrid) * 100.0 + timeOfDay * 3.0);
  stars *= twinkle;
  return stars;
}

vec3 getNebula(vec3 direction) {
  vec3 dir = normalize(direction);
  float nebula1 = sin(dir.x * 3.0 + timeOfDay * 0.1) * sin(dir.y * 2.0) * sin(dir.z * 4.0);
  float nebula2 = sin(dir.x * 5.0 + timeOfDay * 0.05) * sin(dir.z * 3.0);
  nebula1 = pow(max(0.0, nebula1), 3.0);
  nebula2 = pow(max(0.0, nebula2), 2.0);
  vec3 nebulaColor = vec3(0.6, 0.3, 0.9) * nebula1 * 0.3;
  nebulaColor += vec3(0.2, 0.7, 1.0) * nebula2 * 0.2;
  return nebulaColor;
}

float rayleighPhase(float cosTheta) {
  return THREE_OVER_SIXTEENPI * (1.0 + pow(cosTheta, 2.0));
}

float hgPhase(float cosTheta, float g) {
  float g2 = pow(g, 2.0);
  float inverse = 1.0 / pow(1.0 - 2.0 * g * cosTheta + g2, 1.5);
  return ONE_OVER_FOURPI * ((1.0 - g2) * inverse);
}

void main() {
  vec3 direction = normalize(vWorldPosition - cameraPos);

  float zenithAngle = acos(max(0.0, dot(up, direction)));
  float inverse = 1.0 / (cos(zenithAngle) + 0.15 * pow(93.885 - ((zenithAngle * 180.0) / pi), -1.253));
  float sR = rayleighZenithLength * inverse;
  float sM = mieZenithLength * inverse;

  vec3 Fex = exp(-(vBetaR * sR + vBetaM * sM));

  float cosTheta = dot(direction, vSunDirection);

  float rPhase = rayleighPhase(cosTheta * 0.5 + 0.5);
  vec3 betaRTheta = vBetaR * rPhase;

  float mPhase = hgPhase(cosTheta, mieDirectionalG);
  vec3 betaMTheta = vBetaM * mPhase;

  vec3 Lin = pow(vSunE * ((betaRTheta + betaMTheta) / (vBetaR + vBetaM)) * (1.0 - Fex), vec3(1.5));
  Lin *= mix(vec3(1.0), pow(vSunE * ((betaRTheta + betaMTheta) / (vBetaR + vBetaM)) * Fex, vec3(1.0 / 2.0)), clamp(pow(1.0 - dot(up, vSunDirection), 5.0), 0.0, 1.0));

  vec3 nightSky = vec3(0.01, 0.02, 0.05) * nightIntensity;
  float starVisibility = nightIntensity * smoothstep3(-0.05, 0.1, direction.y);
  float stars = getStars(direction) * starVisibility;
  vec3 nebula = getNebula(direction) * nightIntensity * 0.5;
  nightSky += vec3(stars);
  nightSky += nebula;
  vec3 L0 = mix(nightSky, vec3(0.1) * Fex, clamp(vSunE / 1000.0, 0.0, 1.0));

  float sunDisk = smoothstep5(sunAngularDiameterCos, sunAngularDiameterCos + 0.00001, cosTheta);
  vec3 sunColor = (vSunE * 15000.0 * Fex) * sunDisk;
  float sunGlow = smoothstep3(0.95, 0.98, cosTheta) * max(0.0, vSunDirection.y);
  sunColor += (vSunE * 2000.0 * Fex) * sunGlow;
  L0 += sunColor;

  vec3 texColor = (Lin + L0) * 0.04 + vec3(0.0, 0.0003, 0.00075);
  vec3 retColor = pow(texColor, vec3(1.0 / (1.2 + (1.2 * vSunfade))));

  gl_FragColor = vec4(retColor, 1.0);
}
`;

export function AtmosphericSky() {
  const meshRef = useRef<Mesh>(null);
  const { sunData, timeOfDay } = useDayNight();
  const { camera } = useThree();

  const skyMaterial = useMemo(() => {
    return new ShaderMaterial({
      uniforms: {
        sunPosition: { value: new Vector3() },
        up: { value: new Vector3(0, 1, 0) },
        rayleigh: { value: 2 },
        turbidity: { value: 10 },
        mieCoefficient: { value: 0.005 },
        mieDirectionalG: { value: 0.8 },
        nightIntensity: { value: 0.0 },
        timeOfDay: { value: 0.0 },
        starRotation: { value: 0.0 },
        cameraPos: { value: new Vector3() }, // <-- camera pos
      },
      vertexShader: atmosphericVertexShader,
      fragmentShader: atmosphericFragmentShader,
      side: BackSide,
      depthWrite: false,
    });
  }, []);

  const skyGeometry = useMemo(() => {
    return new SphereGeometry(1000, 64, 32);
  }, []);

  useFrame((state) => {
    if (skyMaterial && sunData) {
      skyMaterial.uniforms.sunPosition.value.copy(sunData.position).normalize();
      skyMaterial.uniforms.cameraPos.value.copy(camera.position); // <-- update cameraPos
      const sunHeight = Math.max(0, Math.sin(sunData.elevation));
      const nightFactor = Math.max(0, -sunData.elevation / (Math.PI / 4));
      skyMaterial.uniforms.turbidity.value = 10 + (1 - sunHeight) * 15;
      skyMaterial.uniforms.rayleigh.value = 2 + (1 - sunHeight) * 1;
      skyMaterial.uniforms.nightIntensity.value = Math.min(1, nightFactor);
      skyMaterial.uniforms.timeOfDay.value = state.clock.elapsedTime;
      const starRotationSpeed = 0.1;
      skyMaterial.uniforms.starRotation.value = (timeOfDay.totalMinutes / 1440) * Math.PI * 2 * starRotationSpeed;
    }
    if (meshRef.current) {
      meshRef.current.position.copy(camera.position);
    }
  });

  return (
    <mesh
      ref={meshRef}
      geometry={skyGeometry}
      material={skyMaterial}
      renderOrder={-1}
    />
  );
}