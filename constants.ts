
// Game Dimensions
export const GAME_WIDTH = 600;
export const GAME_HEIGHT = 450;

// Colors
export const MASK_COLOR = '#1e3a8a'; // Blue-900
export const PLAYER_COLOR = '#06b6d4'; // Cyan-500
export const TRAIL_COLOR = '#ffffff'; // White
export const SAFE_COLOR = '#10b981'; // Green-500
export const PROJECTILE_COLOR = '#fcd34d'; // Amber-300

// Gameplay
export const PLAYER_SPEED_BASE = 3;
export const PLAYER_RADIUS = 4;
export const GAME_DURATION = 60; // Default/Fallback duration
export const PROJECTILE_SPEED = 6;
export const PROJECTILE_RADIUS = 3;
export const FIRE_COOLDOWN = 400; // ms
export const RAPID_FIRE_COOLDOWN = 100; // ms
export const SHOTGUN_SPREAD = 0.3; // Radians approx 17 degrees

// Difficulty Configs
export const DIFFICULTY_SETTINGS = {
  EASY: {
    label: '简单',
    qixSpeed: 0.75,
    hunterCount: 0,
    patrollerCount: 2,
    winPercent: 0.60,
    initialLives: 3,
    gameDuration: 90, // 1.5 Minutes
    color: 'text-green-400'
  },
  MEDIUM: {
    label: '普通',
    qixSpeed: 2.5,
    hunterCount: 1,
    patrollerCount: 3,
    winPercent: 0.75,
    initialLives: 2,
    gameDuration: 180, // 3 Minutes
    color: 'text-yellow-400'
  },
  HARD: {
    label: '困难',
    qixSpeed: 4.0,
    hunterCount: 3,
    patrollerCount: 4,
    winPercent: 0.85,
    initialLives: 1,
    gameDuration: 300, // 5 Minutes
    color: 'text-red-500'
  }
};

// Base Enemy Styles (Counts/Speeds are overwritten by Difficulty)
export const ENEMY_STYLES = {
  QIX: { 
    radius: 12, // Increased visual radius
    color: '#f87171' // Red-400
  },
  HUNTER: { 
    radius: 8, 
    color: '#c084fc' // Purple-400
  },
  PATROLLER: { 
    radius: 6, 
    color: '#fb923c' // Orange-400
  }
};

// PowerUps & Debuffs
export const POWERUP_RADIUS = 8;
export const POWERUP_DURATION = 5000; // Increased to 5s

// Grid States
export const STATE_MASKED = 1;
export const STATE_CLEARED = 0;
export const STATE_TRAIL = 2;
