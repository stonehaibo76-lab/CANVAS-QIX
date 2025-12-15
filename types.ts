
export type GameState = 'MENU' | 'PLAYING' | 'WON' | 'LOST';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'CUSTOM';

export interface GameConfig {
  qixCount: number;
  hunterCount: number;
  patrollerCount: number;
  qixSpeed: number;
  winPercent: number;
  gameDuration: number; // Added duration config
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
  lastDir: { x: number, y: number }; // For shooting direction
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
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
  angle?: number; 
  // Transformation Logic
  isEnraged?: boolean;
  enrageTimer?: number;
  stunnedUntil?: number;
}

export type PowerUpType = 'FREEZE' | 'SPEED' | 'SHIELD' | 'SLOW' | 'RAPID_FIRE' | 'SHOTGUN' | 'LIFE';
export type DebuffType = 'CONFUSION' | 'DARKNESS' | 'ENEMY_RAGE' | 'ENEMY_CLONE';

export interface PowerUp {
  id: number;
  type: PowerUpType;
  x: number;
  y: number;
  isDebuff?: boolean; // If true, it is a trap (DebuffType cast as PowerUpType mostly for storage convenience or separate list)
  debuffType?: DebuffType;
}

export interface ActiveEffects {
  frozenUntil: number;
  speedUntil: number;
  shieldUntil: number;
  slowUntil: number; // This is "Time Slow"
  rapidFireUntil: number; // Machine Gun
  shotgunUntil: number; // Shotgun
  
  // Debuffs / Traps
  confusionUntil: number;
  darknessUntil: number;
  enemyRageUntil: number;
}
