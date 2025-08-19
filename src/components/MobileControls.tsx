import React, { useRef } from 'react';
import { useMobileControls } from '../contexts/MobileControlsContext';

function useIsTouchDevice() {
  const [isTouch, setIsTouch] = React.useState(false);
  React.useEffect(() => {
    function check() {
      if ("maxTouchPoints" in navigator && navigator.maxTouchPoints > 0) return true;
      if ("ontouchstart" in window) return true;
      if (window.matchMedia("(pointer: coarse)").matches) return true;
      return false;
    }
    setIsTouch(check());
  }, []);
  return isTouch;
}

const JOYSTICK_SMOOTHING = 0.2;
const JOYSTICK_DEADZONE = 0.1;
const RETURN_TO_CENTER_SPEED = 0.15;
const CENTER_THRESHOLD = 0.01;

type TouchZone = 'none' | 'joystick' | 'jump' | 'both';

export function MobileControls() {
  const isTouch = useIsTouchDevice();
  const { setIsJumping, setMovement } = useMobileControls();
  const [joystickPosition, setJoystickPosition] = React.useState({ x: 0, y: 0 });
  const [targetPosition, setTargetPosition] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [activeZone, setActiveZone] = React.useState<TouchZone>('none');
  const [returnToCenter, setReturnToCenter] = React.useState(false);
  const joystickRef = React.useRef<HTMLDivElement>(null);
  const animationFrameRef = React.useRef<number>();
  const movementRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const prevMovementRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const joystickTouchId = useRef<number | null>(null);

  React.useEffect(() => {
    (window as any).__joystickTouchId = joystickTouchId.current;
  });

  React.useEffect(() => {
    const updatePosition = () => {
      setJoystickPosition(prev => {
        let newPosition;
        if (returnToCenter) {
          newPosition = {
            x: prev.x * (1 - RETURN_TO_CENTER_SPEED * 1.5),
            y: prev.y * (1 - RETURN_TO_CENTER_SPEED * 1.5)
          };
          if (Math.abs(newPosition.x) < CENTER_THRESHOLD && Math.abs(newPosition.y) < CENTER_THRESHOLD) {
            setReturnToCenter(false);
            newPosition = { x: 0, y: 0 };
            movementRef.current = { x: 0, y: 0 };
          }
        } else {
          newPosition = {
            x: prev.x + (targetPosition.x - prev.x) * (1 - JOYSTICK_SMOOTHING),
            y: prev.y + (targetPosition.y - prev.y) * (1 - JOYSTICK_SMOOTHING)
          };
        }
        if (joystickRef.current) {
          const rect = joystickRef.current.getBoundingClientRect();
          //const centerX = rect.left + window.scrollX + rect.width / 2;
          //const centerY = rect.top + window.scrollY + rect.height / 2;
          const radius = rect.width / 2;
          const normalizedX = newPosition.x / radius;
          const normalizedY = newPosition.y / radius;
          const magnitude = Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY);
          if (magnitude < JOYSTICK_DEADZONE) {
            movementRef.current = { x: 0, y: 0 };
          } else {
            movementRef.current = {
              x: normalizedX,
              y: normalizedY
            };
          }
        }
        return newPosition;
      });
      animationFrameRef.current = requestAnimationFrame(updatePosition);
    };
    animationFrameRef.current = requestAnimationFrame(updatePosition);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [targetPosition]);

  React.useEffect(() => {
    const updateMovement = () => {
      if (JSON.stringify(movementRef.current) !== JSON.stringify(prevMovementRef.current)) {
        setMovement(movementRef.current);
        prevMovementRef.current = { ...movementRef.current };
      }
      requestAnimationFrame(updateMovement);
    };
    const animationId = requestAnimationFrame(updateMovement);
    return () => cancelAnimationFrame(animationId);
  }, [setMovement]);

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent, zone: TouchZone) => {
    e.preventDefault();
    if (zone === 'joystick') {
      setIsDragging(true);
      setReturnToCenter(false);
      if ('touches' in e && e.touches.length > 0) {
        joystickTouchId.current = e.touches[0].identifier;
        (window as any).__joystickTouchId = joystickTouchId.current;
      }
      updateJoystickPosition(e);
    }
    if (zone === 'jump') {
      setIsJumping(true);
    }
    if (zone === 'joystick' && activeZone === 'jump') return;
    if (zone === 'jump' && activeZone === 'joystick') {
      setActiveZone('both');
    } else {
      setActiveZone(zone);
    }
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDragging || activeZone !== 'joystick') return;
    if ('touches' in e && joystickTouchId.current !== null) {
      const t = Array.from(e.touches).find(touch => touch.identifier === joystickTouchId.current);
      if (!t) return;
      const fakeEvent = {
        touches: [t],
        preventDefault: () => {},
      } as unknown as React.TouchEvent;
      updateJoystickPosition(fakeEvent);
      return;
    }
    updateJoystickPosition(e);
  };

  const handleTouchEnd = (e?: React.TouchEvent | React.MouseEvent) => {
    if (e && 'touches' in e) {
      const stillPresent = Array.from(e.touches).some(
        t => t.identifier === joystickTouchId.current
      );
      if (!stillPresent && joystickTouchId.current !== null) {
        setIsDragging(false);
        setReturnToCenter(true);
        setTargetPosition({ x: 0, y: 0 });
        joystickTouchId.current = null;
        (window as any).__joystickTouchId = null;
      }
    } else {
      setIsDragging(false);
      setReturnToCenter(true);
      setTargetPosition({ x: 0, y: 0 });
      joystickTouchId.current = null;
      (window as any).__joystickTouchId = null;
    }
    if (activeZone === 'jump') {
      setIsJumping(false);
    } else if (activeZone === 'both') {
      setIsJumping(false);
      setActiveZone('joystick');
      return;
    }
    setActiveZone('none');
  };

  React.useEffect(() => {
    const globalTouchEnd = (e: TouchEvent) => {
      if (joystickTouchId.current !== null) {
        const stillPresent = Array.from(e.touches).some(
          t => t.identifier === joystickTouchId.current
        );
        if (!stillPresent) {
          setIsDragging(false);
          setReturnToCenter(true);
          setTargetPosition({ x: 0, y: 0 });
          joystickTouchId.current = null;
          (window as any).__joystickTouchId = null;
        }
      }
    };
    window.addEventListener('touchend', globalTouchEnd);
    window.addEventListener('touchcancel', globalTouchEnd);
    return () => {
      window.removeEventListener('touchend', globalTouchEnd);
      window.removeEventListener('touchcancel', globalTouchEnd);
    };
  }, []);

  const updateJoystickPosition = (e: React.TouchEvent | React.MouseEvent) => {
    if (!joystickRef.current) return;
    let clientX: number, clientY: number;
    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + window.scrollX + rect.width / 2;
    const centerY = rect.top + window.scrollY + rect.height / 2;
    let deltaX = clientX - centerX;
    let deltaY = clientY - centerY;
    const radius = rect.width / 2;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    if (distance > radius) {
      const angle = Math.atan2(deltaY, deltaX);
      deltaX = Math.cos(angle) * radius;
      deltaY = Math.sin(angle) * radius;
    }
    setTargetPosition({ x: deltaX, y: deltaY });
  };

  if (!isTouch) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 pointer-events-none z-50 select-none touch-none">
      {/* Joystick: always bottom left */}
      <div className="absolute left-0 bottom-0 p-6 pointer-events-none">
        <div
          ref={joystickRef}
          className="w-32 h-32 rounded-full bg-white/5 backdrop-blur-sm relative pointer-events-auto touch-none select-none will-change-transform shadow-lg shadow-black/25 border border-white/10"
          onTouchStart={(e) => handleTouchStart(e, 'joystick')}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onMouseDown={(e) => handleTouchStart(e, 'joystick')}
          onMouseMove={handleTouchMove}
          onMouseUp={handleTouchEnd}
          onMouseLeave={handleTouchEnd}
        >
          <div
            className="absolute w-16 h-16 rounded-full bg-white/10 transform will-change-transform z-10 border-2 border-white/30 shadow-lg shadow-black/25 transition-shadow duration-200"
            style={{
              transform: `translate(${joystickPosition.x}px, ${joystickPosition.y}px)`,
              left: 'calc(50% - 2rem)',
              top: 'calc(50% - 2rem)',
              boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.25)'
            }}
          />
        </div>
      </div>
      {/* Jump button: always bottom right */}
      <div className="absolute right-0 bottom-0 p-6 pointer-events-none">
        <button
          className="w-24 h-24 rounded-full bg-white/5 backdrop-blur-sm border-2 border-white/20 pointer-events-auto transform will-change-transform flex items-center justify-center select-none touch-none shadow-lg shadow-black/25 transition-all duration-200"
          style={{
            transform: `scale(${activeZone === 'jump' ? '0.92' : '1'})`,
            boxShadow: activeZone === 'jump' ? '0 8px 24px rgba(0,0,0,0.4)' : '0 4px 12px rgba(0,0,0,0.25)'
          }}
          onTouchStart={(e) => handleTouchStart(e, 'jump')}
          onMouseDown={(e) => handleTouchStart(e, 'jump')}
          onTouchEnd={handleTouchEnd}
          onMouseUp={handleTouchEnd}
          onMouseLeave={handleTouchEnd}
        >
          <div
            className="text-white/70 font-semibold text-lg select-none transition-transform duration-200"
            style={{
              transform: `scale(${activeZone === 'jump' ? '0.95' : '1'}) translateY(${activeZone === 'jump' ? '2px' : '0'})`
            }}
          >
            JUMP
          </div>
        </button>
      </div>
    </div>
  );
}