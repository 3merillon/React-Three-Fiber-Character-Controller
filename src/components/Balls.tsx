import { useMemo } from 'react';
import { RigidBody } from '@react-three/rapier';
import { useControls } from 'leva';

export function Balls() {
  const controls = useControls('Balls', {
    bounciness: { value: 0.3, min: 0, max: 1, step: 0.1 },
    friction: { value: 0.8, min: 0, max: 2, step: 0.1 },
    linearDamping: { value: 0.5, min: 0, max: 2, step: 0.1 },
    angularDamping: { value: 0.5, min: 0, max: 2, step: 0.1 },
  });

  const balls = useMemo(() => {
    const ballsArray: { position: [number, number, number]; scale: number }[] = [];
    for (let i = 0; i < 50; i++) {
      const x = (Math.random() - 0.5) * 20;
      const y = Math.random() * 10 + 5;
      const z = (Math.random() - 0.5) * 20;
      const scale = Math.random() * 0.3 + 0.2;
      ballsArray.push({ position: [x, y, z], scale });
    }
    return ballsArray;
  }, []);

  return (
    <>
      {balls.map((ball, index) => (
        <RigidBody
          key={index}
          colliders="ball"
          restitution={controls.bounciness}
          friction={controls.friction}
          linearDamping={controls.linearDamping}
          angularDamping={controls.angularDamping}
          position={ball.position}
          mass={1}
        >
          <mesh castShadow receiveShadow>
            <icosahedronGeometry args={[ball.scale, 3]} />
            <meshStandardMaterial 
              color="#51BCFF" 
              roughness={0.5} 
              metalness={0.2} 
            />
          </mesh>
        </RigidBody>
      ))}
    </>
  );
}