export interface AnimationHandle {
  cancel: () => void;
}

/**
 * Animate from one position to another using spring physics.
 * Converts RN-style friction/tension to damping/stiffness.
 */
export function animateSpring(
  from: { x: number; y: number },
  to: { x: number; y: number },
  config: { friction: number; tension: number },
  onUpdate: (pos: { x: number; y: number }) => void,
  onComplete: () => void,
): AnimationHandle {
  let cancelled = false;
  let animationFrame: number | null = null;

  // Convert RN friction/tension to damping ratio and angular frequency
  // RN Animated.spring uses: acceleration = -tension * (pos - target) - friction * velocity
  const stiffness = config.tension;
  const damping = config.friction;

  let posX = from.x;
  let posY = from.y;
  let velX = 0;
  let velY = 0;

  const targetX = to.x;
  const targetY = to.y;

  let lastTime = performance.now();

  const REST_THRESHOLD = 0.5;
  const VELOCITY_THRESHOLD = 0.5;

  const step = (now: number) => {
    if (cancelled) return;

    const dt = Math.min((now - lastTime) / 1000, 0.064); // Cap at ~16fps minimum
    lastTime = now;

    // Spring force calculation
    const forceX = -stiffness * (posX - targetX) - damping * velX;
    const forceY = -stiffness * (posY - targetY) - damping * velY;

    velX += forceX * dt;
    velY += forceY * dt;
    posX += velX * dt;
    posY += velY * dt;

    // Check if at rest
    const distX = Math.abs(posX - targetX);
    const distY = Math.abs(posY - targetY);
    const speedX = Math.abs(velX);
    const speedY = Math.abs(velY);

    if (
      distX < REST_THRESHOLD &&
      distY < REST_THRESHOLD &&
      speedX < VELOCITY_THRESHOLD &&
      speedY < VELOCITY_THRESHOLD
    ) {
      // Snap to target
      onUpdate({ x: targetX, y: targetY });
      onComplete();
      return;
    }

    onUpdate({ x: posX, y: posY });
    animationFrame = requestAnimationFrame(step);
  };

  animationFrame = requestAnimationFrame(step);

  return {
    cancel: () => {
      cancelled = true;
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }
    },
  };
}

/**
 * Animate from one position to another over a fixed duration (linear timing).
 * Mirrors RN's Animated.timing.
 */
export function animateTiming(
  from: { x: number; y: number },
  to: { x: number; y: number },
  duration: number,
  onUpdate: (pos: { x: number; y: number }) => void,
  onComplete: () => void,
): AnimationHandle {
  let cancelled = false;
  let animationFrame: number | null = null;
  const startTime = performance.now();

  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;

  const step = (now: number) => {
    if (cancelled) return;

    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Ease-out cubic for smoother feel
    const eased = 1 - Math.pow(1 - progress, 3);

    const x = from.x + deltaX * eased;
    const y = from.y + deltaY * eased;

    onUpdate({ x, y });

    if (progress >= 1) {
      onComplete();
      return;
    }

    animationFrame = requestAnimationFrame(step);
  };

  animationFrame = requestAnimationFrame(step);

  return {
    cancel: () => {
      cancelled = true;
      if (animationFrame !== null) {
        cancelAnimationFrame(animationFrame);
      }
    },
  };
}

/**
 * Animate a single value using spring physics.
 */
export function animateSpringValue(
  from: number,
  to: number,
  config: { friction: number; tension: number },
  onUpdate: (value: number) => void,
  onComplete: () => void,
): AnimationHandle {
  return animateSpring(
    { x: from, y: 0 },
    { x: to, y: 0 },
    config,
    (pos) => onUpdate(pos.x),
    onComplete,
  );
}

/**
 * Animate a single value over a fixed duration.
 */
export function animateTimingValue(
  from: number,
  to: number,
  duration: number,
  onUpdate: (value: number) => void,
  onComplete: () => void,
): AnimationHandle {
  return animateTiming(
    { x: from, y: 0 },
    { x: to, y: 0 },
    duration,
    (pos) => onUpdate(pos.x),
    onComplete,
  );
}

/**
 * Linear interpolation between input/output ranges.
 * Mirrors RN Animated.interpolate.
 */
export function interpolate(
  value: number,
  inputRange: number[],
  outputRange: number[],
): number {
  if (inputRange.length < 2 || outputRange.length < 2) return outputRange[0] ?? 0;

  // Clamp to range
  if (value <= inputRange[0]!) return outputRange[0]!;
  if (value >= inputRange[inputRange.length - 1]!) return outputRange[outputRange.length - 1]!;

  // Find the segment
  for (let i = 0; i < inputRange.length - 1; i++) {
    const inStart = inputRange[i]!;
    const inEnd = inputRange[i + 1]!;
    if (value >= inStart && value <= inEnd) {
      const outStart = outputRange[i]!;
      const outEnd = outputRange[i + 1]!;
      const t = (value - inStart) / (inEnd - inStart);
      return outStart + (outEnd - outStart) * t;
    }
  }

  return outputRange[outputRange.length - 1]!;
}

/**
 * Interpolate to string values (e.g., rotation degrees).
 * Parses numeric values from strings like "-10deg".
 */
export function interpolateString(
  value: number,
  inputRange: number[],
  outputRange: string[],
): string {
  const numericOutputs = outputRange.map((s) => parseFloat(s));
  const suffix = outputRange[0]?.replace(/[-\d.]/g, "") ?? "";
  const result = interpolate(value, inputRange, numericOutputs);
  return `${result}${suffix}`;
}
