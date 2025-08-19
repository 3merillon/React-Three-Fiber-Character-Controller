import { useControls } from 'leva';
import { useState } from 'react';

export function useCameraRotation() {
  const [rotation, setRotation] = useState(0); // radians
  const [distance, setDistance] = useState(15);
  const [skew, setSkew] = useState(Math.PI / 6);

  useControls('Camera', {
    rotation: {
      value: rotation % (2 * Math.PI),
      min: 0,
      max: 2 * Math.PI,
      step: 0.01,
      label: 'Rotation (radians)',
      onChange: (sliderValue: number) => {
        setRotation((prev) => prev + (sliderValue - (prev % (2 * Math.PI))));
      },
    },
    distance: {
      value: distance,
      min: 3,
      max: 40,
      step: 0.1,
      label: 'Zoom',
      onChange: (v) => setDistance(v),
    },
    skew: {
      value: skew,
      min: 0.1,
      max: Math.PI / 2,
      step: 0.01,
      label: 'Skew (vertical)',
      onChange: (v) => setSkew(v),
    },
  });

  return { rotation, setRotation, distance, setDistance, skew, setSkew };
}