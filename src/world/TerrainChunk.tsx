import { useRef, useEffect, useMemo } from 'react';
import {
  Mesh,
  BufferGeometry,
  BufferAttribute,
  MeshStandardMaterial,
  TextureLoader,
  RepeatWrapping,
} from 'three';
import { RigidBody } from '@react-three/rapier';
import { useLoader } from '@react-three/fiber';
import { WorldChunk } from './types';
import { TerrainData } from './types';

interface TerrainChunkProps {
  chunk: WorldChunk;
  terrainData: TerrainData;
  onLoaded?: (chunk: WorldChunk) => void;
}

export function TerrainChunk({ chunk, terrainData, onLoaded }: TerrainChunkProps) {
  const meshRef = useRef<Mesh>(null);

  // Load all textures
  const grassDiffuse = useLoader(TextureLoader, '/textures/diffuse/grass.webp');
  const rockDiffuse = useLoader(TextureLoader, '/textures/diffuse/rock.webp');
  const sandDiffuse = useLoader(TextureLoader, '/textures/diffuse/sand.webp');
  const iceDiffuse  = useLoader(TextureLoader, '/textures/diffuse/ice.webp');

  // Geometry setup: smooth normals, UVs
  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(terrainData.vertices, 3));
    geo.setAttribute('normal', new BufferAttribute(terrainData.normals, 3));
    geo.setIndex(new BufferAttribute(terrainData.indices, 1));
    const uvs = new Float32Array(terrainData.vertices.length / 3 * 2);
    for (let i = 0; i < terrainData.vertices.length; i += 3) {
      const x = terrainData.vertices[i];
      const z = terrainData.vertices[i + 2];
      uvs[(i / 3) * 2] = (chunk.position.x + x) * 0.05;
      uvs[(i / 3) * 2 + 1] = (chunk.position.z + z) * 0.05;
    }
    geo.setAttribute('uv', new BufferAttribute(uvs, 2));
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    return geo;
  }, [terrainData, chunk.position]);

  const material = useMemo(() => {
    [grassDiffuse, rockDiffuse, sandDiffuse, iceDiffuse].forEach(
      (texture) => { texture.wrapS = texture.wrapT = RepeatWrapping; }
    );

    const mat = new MeshStandardMaterial({
      map: grassDiffuse,
      roughness: 0.8,
      metalness: 0.0,
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.rockDiffuse = { value: rockDiffuse };
      shader.uniforms.sandDiffuse = { value: sandDiffuse };
      shader.uniforms.iceDiffuse  = { value: iceDiffuse };
      shader.uniforms.textureScale = { value: 0.05 };
      shader.uniforms.waterLevel = { value: 10.0 };

      // Pass world position and world normal to fragment shader
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `
        #include <common>
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        `
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <worldpos_vertex>',
        `
        #include <worldpos_vertex>
        vWorldPosition = worldPosition.xyz;
        vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
        `
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `
        #include <common>
        varying vec3 vWorldPosition;
        varying vec3 vWorldNormal;
        uniform sampler2D rockDiffuse;
        uniform sampler2D sandDiffuse;
        uniform sampler2D iceDiffuse;
        uniform float textureScale;
        uniform float waterLevel;
        vec4 calculateSplatWeights(float height, float terrainNormalY) {
          float slope = 1.0 - abs(terrainNormalY);
          float grassWeight = 1.0;
          float rockWeight = 0.0;
          float sandWeight = 0.0;
          float iceWeight  = 0.0;

          // Rock on steep slopes
          if (slope > 0.2) {
            float slopeFactor = min(1.0, (slope - 0.2) / 0.4);
            rockWeight = slopeFactor * slopeFactor;
          }
          // Sand at low elevations near water
          if (height < waterLevel + 12.0) {
            float elevationFromWater = height - waterLevel;
            if (elevationFromWater < 8.0) {
              float sandFactor = max(0.0, (8.0 - elevationFromWater) / 8.0);
              sandWeight = sandFactor * sandFactor * (1.0 - rockWeight * 0.7);
            }
          }
          // Ice at high elevations (with smooth transition)
          if (height > waterLevel + 38.0) {
            float iceFactor = min(1.0, (height - waterLevel - 38.0) / 25.0);
            iceWeight = iceFactor * iceFactor;
          }
          grassWeight = max(0.0, 1.0 - rockWeight - sandWeight - iceWeight);
          float totalWeight = grassWeight + rockWeight + sandWeight + iceWeight;
          if (totalWeight > 0.0) {
            grassWeight /= totalWeight;
            rockWeight  /= totalWeight;
            sandWeight  /= totalWeight;
            iceWeight   /= totalWeight;
          }
          return vec4(grassWeight, rockWeight, sandWeight, iceWeight);
        }
        `
      );

      // Compute splat weights and blend in map_fragment
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `
        vec2 worldUV = vWorldPosition.xz * textureScale;
        vec4 splatWeights = calculateSplatWeights(vWorldPosition.y, vWorldNormal.y);
        vec4 grassColor = texture2D(map, worldUV);
        vec4 rockColor  = texture2D(rockDiffuse, worldUV * 0.8);
        vec4 sandColor  = texture2D(sandDiffuse, worldUV * 1.1);
        vec4 iceColor   = texture2D(iceDiffuse, worldUV * 0.7);
        diffuseColor.rgb = grassColor.rgb * splatWeights.x +
                           rockColor.rgb  * splatWeights.y +
                           sandColor.rgb  * splatWeights.z +
                           iceColor.rgb   * splatWeights.w;
        `
      );
    };

    return mat;
  }, [grassDiffuse, rockDiffuse, sandDiffuse, iceDiffuse]);

  useEffect(() => {
    if (meshRef.current && onLoaded && !chunk.isLoaded) {
      chunk.isLoaded = true;
      chunk.mesh = meshRef.current;
      onLoaded(chunk);
    }
  }, [chunk, onLoaded]);

  return (
    <>
      <RigidBody
        type="fixed"
        colliders="trimesh"
        position={[chunk.position.x, chunk.position.y, chunk.position.z]}
        friction={1.2}
        restitution={0.1}
      >
        <mesh
          ref={meshRef}
          geometry={geometry}
          material={material}
          receiveShadow
          castShadow
        />
      </RigidBody>
      {/* Render random cubes */}
      {terrainData.cubes?.map((cube, idx) => (
        <RigidBody
          key={idx}
          type="fixed"
          colliders="cuboid"
          position={[
            chunk.position.x + cube.x,
            cube.y,
            chunk.position.z + cube.z,
          ]}
          friction={1}
          restitution={0}
        >
          <mesh castShadow receiveShadow>
            <boxGeometry args={[cube.size, cube.size, cube.size]} />
            <meshStandardMaterial color="#666" roughness={0.7} metalness={0.2} />
          </mesh>
        </RigidBody>
      ))}
      {terrainData.balls?.map((ball, idx) => (
        <RigidBody
          key={`ball-${idx}`}
          colliders="ball"
          position={[
            chunk.position.x + ball.x,
            ball.y,
            chunk.position.z + ball.z,
          ]}
          restitution={0.6}
          friction={0.7}
          linearDamping={0.3}
          angularDamping={0.3}
          mass={1}
        >
          <mesh castShadow receiveShadow>
            <sphereGeometry args={[ball.radius, 24, 24]} />
            <meshStandardMaterial color="#51BCFF" roughness={0.5} metalness={0.2} />
          </mesh>
        </RigidBody>
      ))}
    </>
  );
}