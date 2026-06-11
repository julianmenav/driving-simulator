/**
 * Parámetros físicos y de conducción del vehículo. Vive en dominio: es la
 * definición del coche, no del motor de físicas. La infraestructura (Rapier)
 * la consume para configurar el raycast vehicle controller.
 *
 * Convención de ejes (espacio local del chasis): +z = frente del coche,
 * +y = arriba, +x = izquierda del conductor.
 */
export interface VehicleSpec {
  /** Semiejes del chasis (collider), en metros. */
  chassisHalfExtents: [number, number, number];
  /** Masa del chasis en kg. */
  chassisMass: number;
  wheelRadius: number;
  /** Puntos de anclaje de la suspensión en espacio local: FL, FR, RL, RR. */
  wheelPositions: [number, number, number][];
  suspensionRestLength: number;
  suspensionStiffness: number;
  suspensionCompression: number;
  suspensionRelaxation: number;
  /** Fuerza máxima de motor en N (tracción trasera), disponible a baja velocidad. */
  maxEngineForce: number;
  /**
   * Potencia máxima del motor en W. A velocidad v la fuerza disponible es
   * min(maxEngineForce, maxPowerWatts / v): curva de aceleración realista
   * que decae con la velocidad.
   */
  maxPowerWatts: number;
  /** Freno por rueda (escala empírica del raycast vehicle de Rapier/Bullet). */
  maxBrakeForce: number;
  /** Freno motor + rodadura aplicado al soltar el acelerador (escala de freno). */
  engineBrakeForce: number;
  /** Resistencia aerodinámica: F = -coef · |v| · v sobre el chasis (N·s²/m²). */
  aeroDragCoefficient: number;
  /** Fracción de la fuerza de motor disponible marcha atrás. */
  reverseForceRatio: number;
  /** Giro máximo de las ruedas delanteras en radianes (a baja velocidad). */
  maxSteeringAngle: number;
  /** Velocidad de respuesta del volante (1/s, para el suavizado). */
  steeringSpeed: number;
}

export const DEFAULT_VEHICLE_SPEC: VehicleSpec = {
  chassisHalfExtents: [0.85, 0.35, 2.1],
  chassisMass: 800,
  wheelRadius: 0.34,
  wheelPositions: [
    [0.78, -0.15, 1.35],
    [-0.78, -0.15, 1.35],
    [0.78, -0.15, -1.35],
    [-0.78, -0.15, -1.35],
  ],
  suspensionRestLength: 0.35,
  suspensionStiffness: 24,
  suspensionCompression: 4.4,
  suspensionRelaxation: 2.3,
  maxEngineForce: 2400,
  maxPowerWatts: 50_000,
  maxBrakeForce: 45,
  engineBrakeForce: 3,
  aeroDragCoefficient: 0.45,
  reverseForceRatio: 0.5,
  maxSteeringAngle: 0.5,
  steeringSpeed: 6,
};
