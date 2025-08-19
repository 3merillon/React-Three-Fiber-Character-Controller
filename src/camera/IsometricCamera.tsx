import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera as ThreePerspectiveCamera, Vector3, MathUtils } from 'three';
import { PerspectiveCamera } from '@react-three/drei';
import { useCameraRotation } from '../hooks/useCameraRotation';
import { useCameraContext } from '../contexts/CameraContext';
import { useSmoothedPosition } from '../contexts/SmoothedPositionContext';

interface IsometricCameraProps {
  target: React.RefObject<{ position: { clone: () => Vector3 } }>;
}

declare global {
  interface Window {
    __joystickTouchId?: number | null;
  }
}

export function IsometricCamera({ target }: IsometricCameraProps) {
  const cameraRef = useRef<ThreePerspectiveCamera>(null);
  const smoothedTarget = useSmoothedPosition();
  const currentAngle = useRef(0);
  const currentSkew = useRef(0);
  const { camera } = useThree();

  const {
    rotation,
    setRotation,
    distance,
    setDistance,
    skew,
    setSkew,
  } = useCameraRotation();
  const { setCameraAngle } = useCameraContext();

  // --- Camera drag state ---
  const dragging = useRef(false);
  const lastPointer = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Touch state for mobile
  const touchState = useRef<{
    dragging: boolean;
    last: { x: number; y: number };
    pinchDist: number;
    pinching: boolean;
    ignoreNextPan: boolean;
  }>({ dragging: false, last: { x: 0, y: 0 }, pinchDist: 0, pinching: false, ignoreNextPan: false });

  // Filter out joystick finger
  function getNonJoystickTouches(touches: TouchList) {
    const id = (window as any).__joystickTouchId;
    if (id == null) return Array.from(touches);
    return Array.from(touches).filter(t => t.identifier !== id);
  }

  // Prevent context menu
  useEffect(() => {
    const preventContextMenu = (e: MouseEvent) => e.preventDefault();
    window.addEventListener('contextmenu', preventContextMenu);
    return () => window.removeEventListener('contextmenu', preventContextMenu);
  }, []);

  // Mouse controls (canvas only)
  useEffect(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    const onPointerDown = (e: MouseEvent) => {
      if (e.button === 2) { // right mouse
        dragging.current = true;
        lastPointer.current = { x: e.clientX, y: e.clientY };
      }
    };
    const onPointerMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      setRotation((prev: number) => prev - dx * 0.008);
      setSkew((prev: number) => {
        let newSkew = prev - dy * 0.008;
        newSkew = Math.max(0.1, Math.min(Math.PI / 2, newSkew));
        return newSkew;
      });
    };
    const onPointerUp = (e: MouseEvent) => {
      if (e.button === 2) {
        dragging.current = false;
      }
    };
    const onWheel = (e: WheelEvent) => {
      setDistance((prev: number) => {
        let next = prev + e.deltaY * 0.02;
        next = Math.max(3, Math.min(40, next));
        return next;
      });
    };
    canvas.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [setRotation, setSkew, setDistance]);

  // Touch controls (canvas only)
  useEffect(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    let pinchStartDist = 0;

    const onTouchStart = (e: TouchEvent) => {
      const nonJoystickTouches = getNonJoystickTouches(e.touches);
      if (nonJoystickTouches.length === 1 && !touchState.current.ignoreNextPan) {
        // Start camera drag
        touchState.current.dragging = true;
        touchState.current.last = { x: nonJoystickTouches[0].clientX, y: nonJoystickTouches[0].clientY };
      }
      if (nonJoystickTouches.length === 2) {
        // Pinch zoom
        touchState.current.pinching = true;
        const dx = nonJoystickTouches[0].clientX - nonJoystickTouches[1].clientX;
        const dy = nonJoystickTouches[0].clientY - nonJoystickTouches[1].clientY;
        pinchStartDist = Math.sqrt(dx * dx + dy * dy);
        touchState.current.pinchDist = pinchStartDist;
        touchState.current.dragging = false;
        touchState.current.ignoreNextPan = true;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const nonJoystickTouches = getNonJoystickTouches(e.touches);
      if (touchState.current.pinching && nonJoystickTouches.length === 2) {
        // Pinch to zoom
        const dx = nonJoystickTouches[0].clientX - nonJoystickTouches[1].clientX;
        const dy = nonJoystickTouches[0].clientY - nonJoystickTouches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const delta = dist - touchState.current.pinchDist;
        setDistance((prev: number) => {
          let next = prev - delta * 0.02;
          next = Math.max(3, Math.min(40, next));
          return next;
        });
        touchState.current.pinchDist = dist;
        e.preventDefault();
        return;
      }
      if (touchState.current.dragging && nonJoystickTouches.length === 1 && !touchState.current.ignoreNextPan) {
        const dx = nonJoystickTouches[0].clientX - touchState.current.last.x;
        const dy = nonJoystickTouches[0].clientY - touchState.current.last.y;
        touchState.current.last = { x: nonJoystickTouches[0].clientX, y: nonJoystickTouches[0].clientY };
        setRotation((prev: number) => prev - dx * 0.008);
        setSkew((prev: number) => {
          let newSkew = prev - dy * 0.008;
          newSkew = Math.max(0.1, Math.min(Math.PI / 2, newSkew));
          return newSkew;
        });
        e.preventDefault();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      const nonJoystickTouches = getNonJoystickTouches(e.touches);
      if (nonJoystickTouches.length === 0) {
        touchState.current.dragging = false;
        touchState.current.pinching = false;
        touchState.current.ignoreNextPan = false;
      }
      if (nonJoystickTouches.length === 1 && touchState.current.pinching) {
        // After pinch, ignore pan until all fingers lifted
        touchState.current.dragging = false;
        touchState.current.ignoreNextPan = true;
      }
    };

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', onTouchEnd);
    canvas.addEventListener('touchcancel', onTouchEnd);
    return () => {
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', onTouchEnd);
      canvas.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [setRotation, setSkew, setDistance]);

  useFrame(() => {
    if (!target.current || !cameraRef.current) return;
    const playerPos = target.current.position.clone();
    smoothedTarget.current.lerp(playerPos, 0.15);

    currentAngle.current = MathUtils.lerp(currentAngle.current, rotation, 0.1);
    currentSkew.current = MathUtils.lerp(currentSkew.current, skew, 0.1);
    setCameraAngle(currentAngle.current);

    const r = distance;
    const y = Math.sin(currentSkew.current) * r;
    const planar = Math.cos(currentSkew.current) * r;
    const offsetX = Math.sin(currentAngle.current) * planar;
    const offsetZ = Math.cos(currentAngle.current) * planar;
    const cameraPosition = new Vector3(
      smoothedTarget.current.x + offsetX,
      smoothedTarget.current.y + y,
      smoothedTarget.current.z + offsetZ
    );
    camera.position.copy(cameraPosition);
    camera.lookAt(smoothedTarget.current);
  }, -101);

  return (
    <PerspectiveCamera
      ref={cameraRef}
      makeDefault
      position={[distance, distance * 0.5, distance]}
      fov={60}
    />
  );
}