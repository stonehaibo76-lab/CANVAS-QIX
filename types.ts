
export type GameState = 'MENU' | 'PLAYING' | 'WON' | 'LOST';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'CUSTOM';

export interface GameConfig {
  qixCount: number;
  hunterCount: number;
  patrollerCount: number;
  qixSpeed: number;
  winPercent: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Velocity {
  dx: number;
  dy: number;
}

export interface Player {
  x: number;
  y: number;
  isDrawing: boolean;
}

export type EnemyType = 'QIX' | 'HUNTER' | 'PATROLLER';

export interface Enemy {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  dx: number;
  dy: number;
  speed: number;
  radius: number;
  color: string;
  angle?: number; // For circular/wavy movement
}

export type PowerUpType = 'FREEZE' | 'SPEED' | 'SHIELD' | 'SLOW';

export interface PowerUp {
  id: number;
  type: PowerUpType;
  x: number;
  y: number;
}

export interface ActiveEffects {
  frozenUntil: number;
  speedUntil: number;
  shieldUntil: number;
  slowUntil: number;
}
