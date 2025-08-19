import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { HemisphereLight, Color } from 'three';
import { useDayNight } from '../contexts/DayNightContext';

// FANTASY key points for sky/ground color
const keyPoints = [
  {
    t: 0.0,
    sky: new Color(0.12, 0.15, 0.28),
    ground: new Color(0.08, 0.09, 0.13),
    intensity: 0.05,
  },
  {
    t: 0.10,
    sky: new Color(0.28, 0.16, 0.36), // deep indigo
    ground: new Color(0.13, 0.12, 0.18),
    intensity: 0.12,
  },
  {
    t: 0.21,
    sky: new Color(1.0, 0.28, 0.65), // FANTASY SUNRISE pink
    ground: new Color(0.45, 0.18, 0.23), // magenta ground
    intensity: 0.22,
  },
  {
    t: 0.28,
    sky: new Color(1.0, 0.82, 0.44), // gold-orange
    ground: new Color(0.44, 0.36, 0.28),
    intensity: 0.32,
  },
  {
    t: 0.35,
    sky: new Color(0.68, 0.82, 1.0),
    ground: new Color(0.33, 0.38, 0.38),
    intensity: 0.38,
  },
  {
    t: 0.5,
    sky: new Color(0.82, 0.95, 1.0),
    ground: new Color(0.38, 0.44, 0.44),
    intensity: 0.42,
  },
  {
    t: 0.65,
    sky: new Color(0.68, 0.82, 1.0),
    ground: new Color(0.33, 0.38, 0.38),
    intensity: 0.38,
  },
  {
    t: 0.72,
    sky: new Color(1.0, 0.46, 0.15), // FANTASY SUNSET orange-red
    ground: new Color(0.38, 0.19, 0.22), // reddish ground
    intensity: 0.32,
  },
  {
    t: 0.79,
    sky: new Color(0.38, 0.18, 0.66), // FANTASY DUSK violet
    ground: new Color(0.18, 0.14, 0.36), // purple ground
    intensity: 0.22,
  },
  {
    t: 0.90,
    sky: new Color(0.18, 0.14, 0.36),
    ground: new Color(0.13, 0.12, 0.18),
    intensity: 0.12,
  },
  {
    t: 1.0,
    sky: new Color(0.12, 0.15, 0.28),
    ground: new Color(0.08, 0.09, 0.13),
    intensity: 0.05,
  },
];

function interpolateKeyPoints(points: typeof keyPoints, t: number) {
  // Wrap t to [0,1]
  t = ((t % 1) + 1) % 1;
  for (let i = 1; i < points.length; i++) {
    if (t <= points[i].t) {
      const prev = points[i - 1], next = points[i];
      const tt = (t - prev.t) / (next.t - prev.t);
      // Smootherstep for smooth blending
      const smoothT = tt * tt * tt * (tt * (tt * 6 - 15) + 10);
      return {
        sky: prev.sky.clone().lerp(next.sky, smoothT),
        ground: prev.ground.clone().lerp(next.ground, smoothT),
        intensity: prev.intensity + (next.intensity - prev.intensity) * smoothT,
      };
    }
  }
  // fallback
  const last = points[points.length - 1];
  return { sky: last.sky, ground: last.ground, intensity: last.intensity };
}

export function DynamicEnvironmentLight() {
  const lightRef = useRef<HemisphereLight | null>(null);
  const { sunData } = useDayNight();

  useFrame(() => {
    if (!lightRef.current || !sunData) return;
    // Use normalized time (same as sunData)
    const normalizedTime = ((sunData.azimuth / (2 * Math.PI)) + 1) % 1;
    const { sky, ground, intensity } = interpolateKeyPoints(keyPoints, normalizedTime);

    lightRef.current.color.copy(sky);
    lightRef.current.groundColor.copy(ground);
    lightRef.current.intensity = intensity;
  });

  return <hemisphereLight ref={lightRef} />;
}