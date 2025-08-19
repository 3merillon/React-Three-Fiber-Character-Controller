import { Camera, Vector3 } from 'three';

export function calculateMovement(
  input: {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    sprint: boolean;
  },
  _moveSpeed: number,
  camera: Camera
) {
  // Determine input direction in screen space
  let inputX = 0;
  let inputZ = 0;

  if (input.forward) inputZ += 1;
  if (input.backward) inputZ -= 1;
  if (input.left) inputX -= 1;
  if (input.right) inputX += 1;

  // No input
  if (inputX === 0 && inputZ === 0) return null;

  // Normalize input
  const length = Math.sqrt(inputX * inputX + inputZ * inputZ);
  inputX /= length;
  inputZ /= length;

  // Get camera's forward and right vectors (projected onto XZ plane)
  const cameraDir = new Vector3();
  camera.getWorldDirection(cameraDir);
  cameraDir.y = 0;
  cameraDir.normalize();

  const cameraRight = new Vector3();
  cameraRight.crossVectors(cameraDir, new Vector3(0, 1, 0)).normalize();

  // Calculate world-space movement vector
  const moveVec = new Vector3();
  moveVec.addScaledVector(cameraDir, inputZ);
  moveVec.addScaledVector(cameraRight, inputX);
  moveVec.normalize();

  return {
    sprint: input.sprint,
    normalizedX: moveVec.x,
    normalizedZ: moveVec.z,
  };
}