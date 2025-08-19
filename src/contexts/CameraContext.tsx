import React, { createContext, useContext, useState } from 'react';

interface CameraContextType {
  cameraAngle: number;
  setCameraAngle: (angle: number) => void;
}

const CameraContext = createContext<CameraContextType>({
  cameraAngle: 0,
  setCameraAngle: () => {},
});

export function CameraProvider({ children }: { children: React.ReactNode }) {
  const [cameraAngle, setCameraAngle] = useState(0);

  return (
    <CameraContext.Provider value={{ cameraAngle, setCameraAngle }}>
      {children}
    </CameraContext.Provider>
  );
}

export function useCameraContext() {
  return useContext(CameraContext);
}