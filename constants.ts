// Game Dimensions
export const GAME_WIDTH = 600;
export const GAME_HEIGHT = 450;

// Colors
export const MASK_COLOR = '#1e3a8a'; // Blue-900
export const PLAYER_COLOR = '#06b6d4'; // Cyan-500
export const TRAIL_COLOR = '#ffffff'; // White
export const SAFE_COLOR = '#10b981'; // Green-500

// Gameplay
export const PLAYER_SPEED_BASE = 3;
export const PLAYER_RADIUS = 4;

// Difficulty Configs
export const DIFFICULTY_SETTINGS = {
  EASY: {
    label: 'Easy',
    qixSpeed: 1.5, // Reduced from 2.0
    hunterCount: 0,
    patrollerCount: 2,
    winPercent: 0.60,
    color: 'text-green-400'
  },
  MEDIUM: {
    label: 'Normal',
    qixSpeed: 2.5, // Reduced from 3.5
    hunterCount: 1,
    patrollerCount: 3,
    winPercent: 0.75,
    color: 'text-yellow-400'
  },
  HARD: {
    label: 'Hard',
    qixSpeed: 4.0, // Reduced from 5.5
    hunterCount: 3,
    patrollerCount: 4,
    winPercent: 0.85,
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

// PowerUps
export const POWERUP_RADIUS = 8;
export const POWERUP_DURATION = 5000; // Increased to 5s

// Grid States
export const STATE_MASKED = 1;
export const STATE_CLEARED = 0;
export const STATE_TRAIL = 2;