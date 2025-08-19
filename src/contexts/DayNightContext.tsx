import React, { createContext, useContext, useState, useRef } from 'react';
import { Vector3, Color } from 'three';

export interface TimeOfDay {
  hours: number;
  minutes: number;
  totalMinutes: number;
}

export interface SunData {
  position: Vector3;
  intensity: number;
  color: Color;
  elevation: number;
  azimuth: number;
}

export interface AtmosphericData {
  ambientColor: Color;
  ambientIntensity: number;
  skyColor: Color;
}

interface DayNightContextType {
  timeOfDay: TimeOfDay;
  sunData: SunData;
  atmosphericData: AtmosphericData;
  timeSpeed: number;
  setTimeSpeed: (speed: number) => void;
  setTime: (hours: number, minutes: number) => void;
  isNight: boolean;
  isDawn: boolean;
  isDusk: boolean;
  isDay: boolean;
}

const DayNightContext = createContext<DayNightContextType | null>(null);

// FANTASY key points: distinct sunrise/sunset, smooth and vibrant
const keyPoints = [
  { t: 0.0,  color: new Color(0.22, 0.25, 0.38), intensity: 0.02 }, // deep night blue
  { t: 0.10, color: new Color(0.38, 0.22, 0.46), intensity: 0.06 }, // indigo twilight
  { t: 0.21, color: new Color(1.0, 0.38, 0.68), intensity: 0.18 },  // FANTASY SUNRISE magenta
  { t: 0.28, color: new Color(1.0, 0.82, 0.44), intensity: 0.32 },  // gold-orange morning
  { t: 0.35, color: new Color(0.78, 0.95, 1.0), intensity: 0.8 },   // blue-cyan daylight
  { t: 0.5,  color: new Color(0.92, 1.0, 1.0), intensity: 1.1 },    // midday, bright but not washed out
  { t: 0.65, color: new Color(0.78, 0.95, 1.0), intensity: 0.8 },   // blue-cyan daylight
  { t: 0.72, color: new Color(1.0, 0.56, 0.18), intensity: 0.32 },  // FANTASY SUNSET orange-red
  { t: 0.79, color: new Color(0.52, 0.25, 0.78), intensity: 0.18 }, // FANTASY DUSK violet
  { t: 0.90, color: new Color(0.28, 0.22, 0.46), intensity: 0.06 }, // indigo twilight
  { t: 1.0,  color: new Color(0.22, 0.25, 0.38), intensity: 0.02 }, // deep night blue
];

// Remap normalized time so day lasts longer and night is shorter.
// dayStart/dayEnd: fractions of the day (e.g. 0.21, 0.79 for 6:18am to 7:56pm)
// dayPortion: fraction of the cycle to allocate to day (e.g. 2/3 for day = 2x night)
function mapGameTimeToSolarTime(normalizedTime: number, dayStart = 0.21, dayEnd = 0.79, dayPortion = 2/3) {
  const nightPortion = 1 - dayPortion;
  if (normalizedTime < nightPortion / 2) {
    // First night segment
    const t = normalizedTime / (nightPortion / 2);
    return t * dayStart;
  } else if (normalizedTime < nightPortion / 2 + dayPortion) {
    // Day segment
    const t = (normalizedTime - nightPortion / 2) / dayPortion;
    return dayStart + t * (dayEnd - dayStart);
  } else {
    // Second night segment
    const t = (normalizedTime - (nightPortion / 2 + dayPortion)) / (nightPortion / 2);
    return dayEnd + t * (1 - dayEnd);
  }
}

function interpolateKeyPoints(points: typeof keyPoints, t: number) {
  // Wrap t to [0,1]
  t = ((t % 1) + 1) % 1;
  for (let i = 1; i < points.length; i++) {
    if (t <= points[i].t) {
      const prev = points[i - 1], next = points[i];
      const tt = (t - prev.t) / (next.t - prev.t);
      // Smootherstep for extra smoothness
      const smoothT = tt * tt * tt * (tt * (tt * 6 - 15) + 10);
      return {
        color: prev.color.clone().lerp(next.color, smoothT),
        intensity: prev.intensity + (next.intensity - prev.intensity) * smoothT,
      };
    }
  }
  // fallback
  const last = points[points.length - 1];
  return { color: last.color, intensity: last.intensity };
}

export function DayNightProvider({ children }: { children: React.ReactNode }) {
  const [timeSpeed, setTimeSpeed] = useState(600);
  const [currentTime, setCurrentTime] = useState(720); // Start at noon
  const lastUpdateTime = useRef(Date.now());

  const timeOfDay: TimeOfDay = {
    hours: Math.floor(currentTime / 60) % 24,
    minutes: Math.floor(currentTime % 60),
    totalMinutes: currentTime % 1440,
  };

  // Map game time to solar time for longer day
  const rawTime = (currentTime % 1440) / 1440;
  // You can tweak dayStart/dayEnd/dayPortion for different ratios
  const normalizedTime = mapGameTimeToSolarTime(rawTime, 0.21, 0.79, 2/3);

  // Calculate sun position and properties
  const azimuth = normalizedTime * Math.PI * 2;
  const elevation = Math.sin((normalizedTime - 0.25) * Math.PI * 2) * (Math.PI / 2);

  // Sun position in world space (distance 1000)
  const distance = 1000;
  const x = Math.cos(elevation) * Math.sin(azimuth) * distance;
  const y = Math.sin(elevation) * distance;
  const z = Math.cos(elevation) * Math.cos(azimuth) * distance;

  // Use new smooth color/intensity
  const { color: sunColor, intensity: sunIntensity } = interpolateKeyPoints(keyPoints, normalizedTime);

  // Atmospheric/ambient color (lerp between night and day ambient)
  const dayAmbient = new Color(0.85, 0.95, 1.0);
  const nightAmbient = new Color(0.22, 0.28, 0.36);
  const normalizedElevation = (elevation + Math.PI / 2) / Math.PI; // 0 at nadir, 1 at zenith
  const ambientColor = nightAmbient.clone().lerp(dayAmbient, Math.max(0, Math.min(1, normalizedElevation)));
  // Ambient intensity: a little less than sun, never >0.5
  const ambientIntensity = 0.06 + 0.44 * Math.max(0, Math.min(1, normalizedElevation));

  // Sky color for fallback/legacy
  const skyColor = sunColor.clone().lerp(new Color(0.48, 0.68, 1.0), Math.max(0, Math.min(1, normalizedElevation)));

  const sunData: SunData = {
    position: new Vector3(x, y, z),
    intensity: sunIntensity,
    color: sunColor,
    elevation,
    azimuth,
  };

  const atmosphericData: AtmosphericData = {
    ambientColor,
    ambientIntensity,
    skyColor,
  };

  // Smooth time period detection
  const isNight = sunIntensity < 0.04;
  const isDawn = sunIntensity >= 0.04 && sunIntensity < 0.2 && timeOfDay.hours >= 5 && timeOfDay.hours < 10;
  const isDusk = sunIntensity >= 0.04 && sunIntensity < 0.2 && timeOfDay.hours >= 16 && timeOfDay.hours < 21;
  const isDay = !isNight && !isDawn && !isDusk;

  // Time progression
  React.useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const deltaSeconds = (now - lastUpdateTime.current) / 1000;
      lastUpdateTime.current = now;
      setCurrentTime(prev => (prev + deltaSeconds * timeSpeed / 60) % 1440);
    }, 16);
    return () => clearInterval(interval);
  }, [timeSpeed]);

  const setTime = (hours: number, minutes: number) => {
    setCurrentTime(hours * 60 + minutes);
  };

  return (
    <DayNightContext.Provider value={{
      timeOfDay,
      sunData,
      atmosphericData,
      timeSpeed,
      setTimeSpeed,
      setTime,
      isNight,
      isDawn,
      isDusk,
      isDay
    }}>
      {children}
    </DayNightContext.Provider>
  );
}

export function useDayNight() {
  const context = useContext(DayNightContext);
  if (!context) {
    throw new Error('useDayNight must be used within DayNightProvider');
  }
  return context;
}