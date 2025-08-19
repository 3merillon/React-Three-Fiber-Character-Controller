import React, { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, MathUtils, Group } from 'three';
import { CapsuleCollider, RigidBody, useRapier } from '@react-three/rapier';
import { useKeyboardControls } from '@react-three/drei';
import { useCharacterControls } from '../hooks/useCharacterControls';
import { calculateMovement } from '../utils/physics';
import { useMobileControls } from '../contexts/MobileControlsContext';
import { CharacterModel } from './CharacterModel';
import { detectDevice } from '../utils/deviceDetection';

export type CharacterState = {
  moveSpeed: number;
  jumpForce: number;
  airControl: number;
  isGrounded: boolean;
  velocity: { x: number; y: number; z: number };
};

type LocomotionType = 'idle' | 'walk' | 'run';

export const CharacterController = React.forwardRef<any, { spawnY?: number; spawnX?: number; spawnZ?: number }>((props, ref) => {
  const rigidBody = useRef<any>(null);
  const modelRef = useRef<Group>(null);
  const { world, rapier } = useRapier();
  const Ray = rapier.Ray;
  const { isJumping: isMobileJumping, movement: mobileMovement } = useMobileControls();
  const { camera } = useThree();
  const [, getKeys] = useKeyboardControls();

  // Device detection
  const deviceInfo = useRef(detectDevice());
  const isMobileDevice = deviceInfo.current.isMobileDevice;
  
  // Mobile-specific position smoothing
  const smoothedPosition = useRef(new Vector3());
  const targetPosition = useRef(new Vector3());
  const smoothedRotation = useRef(0);
  const targetModelRotation = useRef(0);
  const isInitialized = useRef(false);
  
  // Jump/coyote/buffer timers
  const jumpCooldown = useRef(0);
  const coyoteTime = useRef(0);
  const jumpBuffer = useRef(0);

  // Ground detection smoothing
  const groundedHistory = useRef<boolean[]>([]);

  // Animation state smoothing
  const [isSprinting, setIsSprinting] = useState(false);
  const [isMoving, setIsMoving] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(1.0);
  const [locomotionType, setLocomotionType] = useState<LocomotionType>('idle');
  const targetRotation = useRef(0);
  const currentRotation = useRef(0);

  // Animation smoothing variables
  const movementIntentHistory = useRef<boolean[]>([]);
  const velocityHistory = useRef<number[]>([]);
  const lastStableMovementState = useRef(false);
  const lastStableSprintState = useRef(false);
  const movementStateTimer = useRef(0);
  const sprintStateTimer = useRef(0);

  const [state, setState] = useState<CharacterState>({
    moveSpeed: 0,
    jumpForce: 0,
    airControl: 0,
    isGrounded: false,
    velocity: { x: 0, y: 0, z: 0 }
  });

  const controls = useCharacterControls();

  // Mobile-specific physics adjustments
  const getPhysicsMultipliers = () => {
    if (isMobileDevice) {
      return {
        moveForceMultiplier: 2.0,
        smoothingMultiplier: 0.4,
        jumpForceMultiplier: 1.2,
        groundDetectionMultiplier: 1.5,
        airControlMultiplier: 1.5,
        slopeAssistMultiplier: 0.5,
        positionSmoothingFactor: 0.15,
        rotationSmoothingFactor: 0.12,
      };
    }
    return {
      moveForceMultiplier: 1.0,
      smoothingMultiplier: 0.25,
      jumpForceMultiplier: 1.0,
      groundDetectionMultiplier: 1.0,
      airControlMultiplier: 1.0,
      slopeAssistMultiplier: 0.0,
      positionSmoothingFactor: 0.0,
      rotationSmoothingFactor: 0.0,
    };
  };

  useFrame((_, delta) => {
    if (!rigidBody.current) return;

    const physicsMultipliers = getPhysicsMultipliers();

    // Get current physics position
    const translation = rigidBody.current.translation();
    const currentPhysicsPos = new Vector3(translation.x, translation.y, translation.z);

    // Initialize smoothed position on first frame
    if (!isInitialized.current) {
      smoothedPosition.current.copy(currentPhysicsPos);
      targetPosition.current.copy(currentPhysicsPos);
      isInitialized.current = true;
    }

    // Update target position
    targetPosition.current.copy(currentPhysicsPos);

    // Apply mobile-specific position smoothing
    if (isMobileDevice) {
      smoothedPosition.current.lerp(targetPosition.current, physicsMultipliers.positionSmoothingFactor);
      if (modelRef.current) {
        modelRef.current.parent?.position.copy(smoothedPosition.current);
      }
    } else {
      smoothedPosition.current.copy(currentPhysicsPos);
    }

    // --- GROUND DETECTION WITH MOBILE SUPPORT ---
    const rayLength = 1.4 * physicsMultipliers.groundDetectionMultiplier;
    const rayOffsets = isMobileDevice ? [
      { x: 0, z: 0 },
      { x: 0.4, z: 0 },
      { x: -0.4, z: 0 },
      { x: 0, z: 0.4 },
      { x: 0, z: -0.4 },
      { x: 0.3, z: 0.3 },
      { x: -0.3, z: -0.3 },
      { x: 0.3, z: -0.3 },
      { x: -0.3, z: 0.3 },
    ] : [
      { x: 0, z: 0 },
      { x: 0.2, z: 0 },
      { x: -0.2, z: 0 },
      { x: 0, z: 0.2 },
      { x: 0, z: -0.2 },
    ];

    let isGrounded = false;
    let closestHit: any = null;
    let groundNormal = new Vector3(0, 1, 0);
    
    for (const offsetRay of rayOffsets) {
      const ray = new Ray(
        { x: translation.x + offsetRay.x, y: translation.y, z: translation.z + offsetRay.z },
        { x: 0, y: -1, z: 0 }
      );
      const hit = world.castRay(ray, rayLength, true, undefined, undefined, undefined, rigidBody.current);
      if (hit && (!closestHit || (hit as any).toi < (closestHit as any).toi)) {
        closestHit = hit;
        isGrounded = true;
        if ((hit as any).normal) {
          groundNormal.set((hit as any).normal.x, (hit as any).normal.y, (hit as any).normal.z);
        }
      }
    }

    groundedHistory.current.push(isGrounded);
    const historyLength = isMobileDevice ? 6 : 3;
    if (groundedHistory.current.length > historyLength) {
      groundedHistory.current.shift();
    }
    
    const recentGroundCount = groundedHistory.current.filter(g => g).length;
    const requiredGroundFrames = isMobileDevice ? 4 : 2;
    const smoothedGrounded = recentGroundCount >= requiredGroundFrames;

    // --- COYOTE/JUMP BUFFER LOGIC ---
    const linvel = rigidBody.current.linvel();
    const input = getKeys() as any;
    const shouldJump = input.jump || isMobileJumping;

    if (smoothedGrounded) {
      coyoteTime.current = isMobileDevice ? 0.25 : 0.15;
    } else {
      coyoteTime.current = Math.max(0, coyoteTime.current - delta);
    }
    jumpCooldown.current = Math.max(0, jumpCooldown.current - delta);
    jumpBuffer.current = Math.max(0, jumpBuffer.current - delta);

    if (shouldJump) jumpBuffer.current = isMobileDevice ? 0.25 : 0.15;

    // --- MOVEMENT INPUT ---
    let movement;
    let joystickMagnitude = 0;

    if (
      mobileMovement &&
      (Math.abs(mobileMovement.x) > 0.05 || Math.abs(mobileMovement.y) > 0.05)
    ) {
      const cameraDir = new Vector3();
      camera.getWorldDirection(cameraDir);
      cameraDir.y = 0;
      cameraDir.normalize();
      const cameraRight = new Vector3();
      cameraRight.crossVectors(cameraDir, new Vector3(0, 1, 0)).normalize();

      const moveVec = new Vector3();
      moveVec.addScaledVector(cameraDir, -mobileMovement.y);
      moveVec.addScaledVector(cameraRight, mobileMovement.x);

      movement = {
        sprint: false,
        normalizedX: moveVec.x,
        normalizedZ: moveVec.z,
      };
      joystickMagnitude = Math.sqrt(mobileMovement.x * mobileMovement.x + mobileMovement.y * mobileMovement.y);
    } else {
      movement = calculateMovement(input, controls.moveSpeed, camera);
    }

    // --- HORIZONTAL MOVEMENT FOR MOBILE ---
    if (smoothedGrounded && movement) {
      const sprintMultiplier = movement.sprint ? controls.sprintMultiplier : 1;
      const baseForce = controls.moveSpeed * sprintMultiplier * physicsMultipliers.moveForceMultiplier;
      let intended = new Vector3(movement.normalizedX, 0, movement.normalizedZ).multiplyScalar(baseForce);
      
      // Enhanced mobile-specific slope assistance
      if (isMobileDevice) {
        const slopeAngle = Math.acos(Math.max(0.1, groundNormal.y));
        const slopeStrength = Math.min(slopeAngle / (Math.PI / 4), 1);
        
        if (slopeStrength > 0.1) {
          const slopeAssist = baseForce * physicsMultipliers.slopeAssistMultiplier * slopeStrength;
          intended.y += slopeAssist;
          
          const horizontalBoost = 1 + (slopeStrength * 0.5);
          intended.x *= horizontalBoost;
          intended.z *= horizontalBoost;
        }
      }
      
      const smoothing = physicsMultipliers.smoothingMultiplier;
      const velocity = {
        x: intended.x * smoothing + linvel.x * (1 - smoothing),
        y: isMobileDevice ? 
           (intended.y * 0.3 + linvel.y * 0.7) : linvel.y,
        z: intended.z * smoothing + linvel.z * (1 - smoothing),
      };
      
      rigidBody.current.setLinvel(velocity, true);
      
      // Additional impulse for mobile on steep slopes
      if (isMobileDevice && groundNormal.y < 0.8) {
        const impulseStrength = (1 - groundNormal.y) * 0.5;
        const impulse = new Vector3(movement.normalizedX, 0.3, movement.normalizedZ)
          .multiplyScalar(impulseStrength);
        rigidBody.current.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z }, true);
      }
      
    } else if (!smoothedGrounded && movement && controls.airControl > 0) {
      const sprintMultiplier = movement.sprint ? controls.sprintMultiplier : 1;
      const moveForce = controls.moveSpeed * controls.airControl * sprintMultiplier * physicsMultipliers.airControlMultiplier;
      let intended = new Vector3(movement.normalizedX, 0, movement.normalizedZ).multiplyScalar(moveForce);
      const current = new Vector3(linvel.x, 0, linvel.z);

      const airControlStrength = isMobileDevice ? 0.02 : 0.01;
      const force = intended.sub(current).multiplyScalar(airControlStrength);

      rigidBody.current.applyImpulse({ x: force.x, y: 0, z: force.z }, true);

      const maxAirSpeed = moveForce;
      const newLinvel = rigidBody.current.linvel();
      const horizSpeed = Math.sqrt(newLinvel.x * newLinvel.x + newLinvel.z * newLinvel.z);
      if (horizSpeed > maxAirSpeed) {
        const scale = maxAirSpeed / horizSpeed;
        rigidBody.current.setLinvel(
          { x: newLinvel.x * scale, y: newLinvel.y, z: newLinvel.z * scale },
          true
        );
      }
    }

    // --- JUMP LOGIC WITH MOBILE ADJUSTMENTS ---
    const minGroundNormal = isMobileDevice ? 0.5 : 0.7;
    if (
      jumpBuffer.current > 0 &&
      (smoothedGrounded || coyoteTime.current > 0) &&
      jumpCooldown.current <= 0 &&
      groundNormal.y > minGroundNormal
    ) {
      const jumpForce = controls.jumpForce * 7.5 * physicsMultipliers.jumpForceMultiplier;
      rigidBody.current.setLinvel(
        { x: linvel.x, y: jumpForce, z: linvel.z },
        true
      );
      jumpCooldown.current = isMobileDevice ? 0.3 : 0.2;
      coyoteTime.current = 0;
      jumpBuffer.current = 0;
      groundedHistory.current = new Array(historyLength).fill(false);
    }

    // --- ANIMATION AND ROTATION LOGIC ---
    const horizontalSpeed = Math.sqrt(linvel.x * linvel.x + linvel.z * linvel.z);
    const hasMovementInput = movement !== null;
    movementIntentHistory.current.push(hasMovementInput);
    velocityHistory.current.push(horizontalSpeed);
    if (movementIntentHistory.current.length > 8) movementIntentHistory.current.shift();
    if (velocityHistory.current.length > 8) velocityHistory.current.shift();
    const recentIntentCount = movementIntentHistory.current.filter(intent => intent).length;
    const avgVelocity = velocityHistory.current.reduce((sum, vel) => sum + vel, 0) / velocityHistory.current.length;
    const hasConsistentIntent = recentIntentCount >= Math.ceil(movementIntentHistory.current.length * 0.6);
    const hasConsistentMovement = avgVelocity > 0.8;
    const targetMoving = smoothedGrounded && (hasConsistentIntent || hasConsistentMovement);

    let nextLocomotionType: LocomotionType = 'idle';
    if (!targetMoving) {
      nextLocomotionType = 'idle';
    } else if (
      (input.sprint && avgVelocity > controls.moveSpeed * 0.5) ||
      (joystickMagnitude >= 0.95)
    ) {
      nextLocomotionType = 'run';
    } else {
      nextLocomotionType = 'walk';
    }
    setLocomotionType(nextLocomotionType);

    if (targetMoving && avgVelocity > 0.1) {
      const baseWalkSpeed = controls.moveSpeed;
      let speedMultiplier = 1.0;
      if (nextLocomotionType === 'run') {
        speedMultiplier = Math.max(0.7, Math.min(2.0, avgVelocity / (baseWalkSpeed * controls.sprintMultiplier)));
      } else if (nextLocomotionType === 'walk') {
        speedMultiplier = Math.max(0.7, Math.min(1.3, avgVelocity / baseWalkSpeed));
      }
      setAnimationSpeed(prevSpeed => prevSpeed + (speedMultiplier - prevSpeed) * 0.15);
    } else {
      setAnimationSpeed(1.0);
    }

    // Hysteresis logic
    movementStateTimer.current += delta;
    sprintStateTimer.current += delta;
    if (targetMoving !== lastStableMovementState.current) {
      if (movementStateTimer.current >= 0.1) {
        setIsMoving(targetMoving);
        lastStableMovementState.current = targetMoving;
        movementStateTimer.current = 0;
      }
    } else {
      movementStateTimer.current = 0;
    }
    const targetSprinting = nextLocomotionType === 'run';
    if (targetSprinting !== lastStableSprintState.current) {
      if (sprintStateTimer.current >= 0.15) {
        setIsSprinting(targetSprinting);
        lastStableSprintState.current = targetSprinting;
        sprintStateTimer.current = 0;
      }
    } else {
      sprintStateTimer.current = 0;
    }

    // --- ROTATION WITH MOBILE SMOOTHING ---
    if (Math.abs(linvel.x) > 0.1 || Math.abs(linvel.z) > 0.1) {
      targetRotation.current = Math.atan2(linvel.x, linvel.z);
      let angleDiff = targetRotation.current - currentRotation.current;
      if (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      else if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      targetRotation.current = currentRotation.current + angleDiff;
    }

    if (modelRef.current) {
      if (isMobileDevice) {
        targetModelRotation.current = targetRotation.current;
        smoothedRotation.current = MathUtils.lerp(
          smoothedRotation.current,
          targetModelRotation.current,
          physicsMultipliers.rotationSmoothingFactor
        );
        modelRef.current.rotation.y = smoothedRotation.current;
      } else {
        currentRotation.current = MathUtils.lerp(
          currentRotation.current,
          targetRotation.current,
          0.2
        );
        modelRef.current.rotation.y = currentRotation.current;
      }
    }

    setState({
      moveSpeed: controls.moveSpeed,
      jumpForce: controls.jumpForce,
      airControl: controls.airControl,
      isGrounded: smoothedGrounded,
      velocity: linvel,
    });

    if (modelRef.current) {
      modelRef.current.position.set(0, -1.15, 0);
    }
  });

  React.useImperativeHandle(ref, () => ({
    position: {
      clone: () => {
        if (isMobileDevice) {
          return smoothedPosition.current.clone();
        }
        const translation = rigidBody.current?.translation();
        return new Vector3(
          translation?.x || 0,
          translation?.y || 0,
          translation?.z || 0
        );
      }
    },
    teleportTo: (x: number, y: number, z: number) => {
      if (rigidBody.current) {
        rigidBody.current.setTranslation({ x, y, z }, true);
        rigidBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        rigidBody.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
        smoothedPosition.current.set(x, y, z);
        targetPosition.current.set(x, y, z);
        isInitialized.current = true;
      }
    },
    resetVelocity: () => {
      if (rigidBody.current) {
        rigidBody.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        rigidBody.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
      }
    }
  }), [rigidBody.current]);

  return (
    <RigidBody
      ref={rigidBody}
      colliders={false}
      mass={10}
      position={[props.spawnX ?? 0, props.spawnY ?? 6, props.spawnZ ?? 0]}
      enabledRotations={[false, false, false]}
      lockRotations
      gravityScale={3}
      friction={0}
      linearDamping={controls.linearDamping}
      angularDamping={controls.angularDamping}
      restitution={0}
      ccd={true}
      type="dynamic"
    >
      <CapsuleCollider args={[0.8, 0.4]} friction={0}/>
      <group ref={modelRef} scale={1.5} position={[0, -1.15, 0]}>
        <CharacterModel
          isMoving={isMoving}
          isSprinting={isSprinting}
          isGrounded={state.isGrounded}
          animationSpeed={animationSpeed}
          locomotionType={locomotionType}
        />
      </group>
    </RigidBody>
  );
});