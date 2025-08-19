import { useGLTF, useAnimations } from '@react-three/drei';
import { useEffect, useRef, useState } from 'react';
import { Group, Mesh, SkinnedMesh } from 'three';

type CharacterModelProps = {
  isMoving: boolean;
  isSprinting?: boolean;
  isGrounded: boolean;
  animationSpeed?: number;
  locomotionType?: 'idle' | 'walk' | 'run';
};

export function CharacterModel({
  isGrounded,
  animationSpeed = 1.0,
  locomotionType = 'idle',
}: CharacterModelProps) {
  const group = useRef<Group>(null);
  const [currentAnimation, setCurrentAnimation] = useState<string | null>(null);
  const { scene, animations } = useGLTF('/models/character.glb', true);
  const { actions } = useAnimations(animations, group);

  // --- Enable shadows on all meshes and skinned meshes ---
  useEffect(() => {
    scene.traverse((child) => {
      if ((child as Mesh).isMesh || (child as SkinnedMesh).isSkinnedMesh) {
        (child as Mesh).castShadow = true;
        (child as Mesh).receiveShadow = true;
      }
    });
  }, [scene]);

  useEffect(() => {
    let targetAnimation = 'Idle';
    if (!isGrounded) {
      targetAnimation = 'FallingIdle';
    } else if (locomotionType === 'run') {
      targetAnimation = 'StandardRun';
    } else if (locomotionType === 'walk') {
      targetAnimation = 'Walking';
    }

    if (currentAnimation !== targetAnimation) {
      const prevAction = currentAnimation ? actions[currentAnimation] : null;
      const nextAction = actions[targetAnimation];

      if (nextAction) {
        nextAction.reset().play();
        if (targetAnimation === 'StandardRun' || targetAnimation === 'Walking') {
          nextAction.timeScale = animationSpeed;
        } else {
          nextAction.timeScale = 1.0;
        }
        if (prevAction) {
          prevAction.crossFadeTo(nextAction, 0.2, true);
        }
        setCurrentAnimation(targetAnimation);
      }
    }
  }, [actions, locomotionType, isGrounded, currentAnimation, animationSpeed]);

  useEffect(() => {
    if ((currentAnimation === 'StandardRun' || currentAnimation === 'Walking') && actions[currentAnimation]) {
      actions[currentAnimation].timeScale = animationSpeed;
    }
  }, [animationSpeed, currentAnimation, actions]);

  return <primitive ref={group} object={scene} />;
}