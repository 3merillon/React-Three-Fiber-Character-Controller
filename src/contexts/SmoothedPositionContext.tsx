import React, { createContext, useContext, useRef } from 'react';
import { Vector3 } from 'three';

const SmoothedPositionContext = createContext<React.MutableRefObject<Vector3> | null>(null);

export function SmoothedPositionProvider({ children }: { children: React.ReactNode }) {
  const smoothedRef = useRef(new Vector3());
  return (
    <SmoothedPositionContext.Provider value={smoothedRef}>
      {children}
    </SmoothedPositionContext.Provider>
  );
}

export function useSmoothedPosition() {
  const ctx = useContext(SmoothedPositionContext);
  if (!ctx) throw new Error("useSmoothedPosition must be used within SmoothedPositionProvider");
  return ctx;
}