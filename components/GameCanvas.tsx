
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  GAME_WIDTH, GAME_HEIGHT, PLAYER_SPEED_BASE, PLAYER_RADIUS, 
  STATE_MASKED, STATE_CLEARED, STATE_TRAIL, TRAIL_COLOR, 
  DIFFICULTY_SETTINGS, ENEMY_STYLES, POWERUP_RADIUS, POWERUP_DURATION, PLAYER_COLOR,
  GAME_DURATION, PROJECTILE_RADIUS, PROJECTILE_SPEED, FIRE_COOLDOWN, RAPID_FIRE_COOLDOWN, PROJECTILE_COLOR, SHOTGUN_SPREAD
} from '../constants';
import { GameState, Point, Player, Enemy, Difficulty, PowerUp, ActiveEffects, PowerUpType, GameConfig, DebuffType, Projectile } from '../types';
import { getBossReachableArea, getIndex, getPointsOnLine, getRandomMaskedPoint } from '../utils/gameLogic';
import { 
  initAudio, playBounce, playCapture, playGameOver, 
  setDrawingSound, startMusic, stopMusic, playPowerUp, playEnemyKill,
  playPatrollerBounce, playHunterPulse, playQixMove, playShoot, playDebuff
} from '../utils/audio';

// Internal Particle Interface for visual effects
interface Particle {
  x: number;
  y: number;
  dx: number;
  dy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

// Floating Text Interface (Score numbers, combos)
interface FloatingText {
    x: number;
    y: number;
    text: string;
    life: number;
    color: string;
    dy: number;
}

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  backgroundImg: string | null;
  onProgressUpdate: (percent: number) => void;
  onScoreUpdate: (score: number) => void;
  difficulty: Difficulty;
  config: GameConfig;
  onOpenGallery?: () => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ 
  gameState, 
  setGameState, 
  backgroundImg,
  onProgressUpdate,
  onScoreUpdate,
  difficulty,
  config,
  onOpenGallery
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reqRef = useRef<number>();
  const gameStateRef = useRef<GameState>(gameState);
  
  // State Refs
  const gridRef = useRef<Uint8Array>(new Uint8Array(GAME_WIDTH * GAME_HEIGHT));
  const playerRef = useRef<Player>({ x: 0, y: 0, isDrawing: false, lastDir: {x:0, y:-1}, lives: 1, invulnerableUntil: 0 });
  const enemiesRef = useRef<Enemy[]>([]);
  const trailRef = useRef<Point[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]); // Includes Debuffs
  const projectilesRef = useRef<Projectile[]>([]);
  
  const effectsRef = useRef<ActiveEffects>({ 
      frozenUntil: 0, speedUntil: 0, shieldUntil: 0, slowUntil: 0, rapidFireUntil: 0, shotgunUntil: 0,
      confusionUntil: 0, darknessUntil: 0, enemyRageUntil: 0
  });
  const keysPressed = useRef<Set<string>>(new Set());
  
  // Visual Effects Refs
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  
  // Gameplay Refs
  const timeLeftRef = useRef<number>(GAME_DURATION);
  const lastTimeRef = useRef<number>(0);
  const flashIntensityRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);
  const comboMultiplierRef = useRef<number>(1);
  const comboTimerRef = useRef<number>(0);
  const lastFireTimeRef = useRef<number>(0);

  // Image Data Ref (For drawing sharp pixels)
  const sourceImageDataRef = useRef<ImageData | null>(null);

  // Sync Ref
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Load Image Data for Pixel Manipulation
  useEffect(() => {
    sourceImageDataRef.current = null;
    if (backgroundImg) {
        const img = new Image();
        img.src = backgroundImg;
        img.crossOrigin = "Anonymous"; 
        img.onload = () => {
            const tmpCanvas = document.createElement('canvas');
            tmpCanvas.width = GAME_WIDTH;
            tmpCanvas.height = GAME_HEIGHT;
            const ctx = tmpCanvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, GAME_WIDTH, GAME_HEIGHT);
                sourceImageDataRef.current = ctx.getImageData(0, 0, GAME_WIDTH, GAME_HEIGHT);
            }
        };
    }
  }, [backgroundImg]);

  // Initialize Game
  const initGame = useCallback(() => {
    const grid = gridRef.current;
    grid.fill(STATE_MASKED);
    
    // Clear edges
    for (let x = 0; x < GAME_WIDTH; x++) {
      grid[getIndex(x, 0)] = STATE_CLEARED;
      grid[getIndex(x, GAME_HEIGHT - 1)] = STATE_CLEARED;
    }
    for (let y = 0; y < GAME_HEIGHT; y++) {
      grid[getIndex(0, y)] = STATE_CLEARED;
      grid[getIndex(GAME_WIDTH - 1, y)] = STATE_CLEARED;
    }

    const initialLives = difficulty === 'CUSTOM' ? 2 : (DIFFICULTY_SETTINGS[difficulty]?.initialLives || 1);
    
    playerRef.current = { 
        x: GAME_WIDTH / 2, 
        y: 0, 
        isDrawing: false, 
        lastDir: {x:0, y:-1},
        lives: initialLives,
        invulnerableUntil: 0 
    };
    trailRef.current = [];
    powerUpsRef.current = [];
    projectilesRef.current = [];
    effectsRef.current = { 
        frozenUntil: 0, speedUntil: 0, shieldUntil: 0, slowUntil: 0, rapidFireUntil: 0, shotgunUntil: 0,
        confusionUntil: 0, darknessUntil: 0, enemyRageUntil: 0
    };
    particlesRef.current = [];
    floatingTextsRef.current = [];
    
    setDrawingSound(false);
    // Use configured game duration
    timeLeftRef.current = config.gameDuration || GAME_DURATION;
    flashIntensityRef.current = 0;
    
    scoreRef.current = 0;
    comboMultiplierRef.current = 1;
    comboTimerRef.current = 0;
    onScoreUpdate(0);

    // Spawn Enemies based on Custom Config
    const newEnemies: Enemy[] = [];
    let idCounter = 0;
    const spawnX = GAME_WIDTH / 2;
    const spawnY = GAME_HEIGHT / 2;
    
    // Scale minion speeds for EASY difficulty
    const minionSpeedScale = difficulty === 'EASY' ? 0.5 : 1.0;

    for (let i = 0; i < config.qixCount; i++) {
        const offsetX = (Math.random() - 0.5) * 40;
        const offsetY = (Math.random() - 0.5) * 40;
        newEnemies.push({
            id: idCounter++,
            type: 'QIX',
            x: spawnX + offsetX,
            y: spawnY + offsetY,
            dx: (Math.random() > 0.5 ? 1 : -1) * config.qixSpeed,
            dy: (Math.random() > 0.5 ? 1 : -1) * config.qixSpeed,
            speed: config.qixSpeed,
            radius: ENEMY_STYLES.QIX.radius,
            color: ENEMY_STYLES.QIX.color,
            angle: Math.random() * Math.PI * 2,
            isEnraged: false,
            enrageTimer: Math.random() * 500 // Random start for enrage cycle
        });
    }

    for(let i=0; i<config.hunterCount; i++) {
        newEnemies.push({
            id: idCounter++,
            type: 'HUNTER',
            x: spawnX + (Math.random() * 100 - 50),
            y: spawnY + (Math.random() * 100 - 50),
            dx: 0, dy: 0,
            speed: 1.2 * minionSpeedScale, 
            radius: ENEMY_STYLES.HUNTER.radius,
            color: ENEMY_STYLES.HUNTER.color,
            angle: 0
        });
    }

    for(let i=0; i<config.patrollerCount; i++) {
        const pSpeed = 2.5 * minionSpeedScale; 
        newEnemies.push({
            id: idCounter++,
            type: 'PATROLLER',
            x: spawnX + (Math.random() * 100 - 50),
            y: spawnY + (Math.random() * 100 - 50),
            dx: (Math.random() > 0.5 ? 1 : -1) * pSpeed,
            dy: (Math.random() > 0.5 ? 1 : -1) * pSpeed,
            speed: pSpeed,
            radius: ENEMY_STYLES.PATROLLER.radius,
            color: ENEMY_STYLES.PATROLLER.color,
            angle: Math.random() * Math.PI * 2
        });
    }

    enemiesRef.current = newEnemies;
    onProgressUpdate(0);
    lastTimeRef.current = Date.now();

  }, [config, onProgressUpdate, onScoreUpdate, difficulty]);

  useEffect(() => {
    if (gameState === 'PLAYING') {
      initGame();
      startMusic();
      reqRef.current = requestAnimationFrame(gameLoop);
    } else {
        stopMusic();
        setDrawingSound(false);
    }

    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
      stopMusic();
      setDrawingSound(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  // Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Prevent browser scrolling and button triggering for game control keys
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', ' '].includes(e.key) || e.code === 'Space') {
            e.preventDefault();
        }
        keysPressed.current.add(e.code);
    };
    const handleKeyUp = (e: KeyboardEvent) => keysPressed.current.delete(e.code);
    window.addEventListener('keydown', handleKeyDown, { passive: false });
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const gameLoop = () => {
    if (gameStateRef.current !== 'PLAYING') {
        return;
    }

    update();
    render();

    if (gameStateRef.current === 'PLAYING') {
      reqRef.current = requestAnimationFrame(gameLoop);
    }
  };

  const addFloatingText = (x: number, y: number, text: string, color: string = '#fff') => {
      floatingTextsRef.current.push({
          x, y, text, color,
          life: 60, // frames
          dy: -1 // float up
      });
  };

  const spawnParticles = (x: number, y: number, color: string, count: number = 5) => {
    for(let i=0; i<count; i++) {
        const speed = Math.random() * 3 + 1;
        const angle = Math.random() * Math.PI * 2;
        particlesRef.current.push({
            x: x, 
            y: y,
            dx: Math.cos(angle) * speed,
            dy: Math.sin(angle) * speed,
            life: 20 + Math.random() * 10,
            maxLife: 30,
            color: color,
            size: Math.random() * 3 + 1
        });
    }
  };

  const handleDeath = () => {
      const now = Date.now();
      // Check for life and invulnerability
      if (playerRef.current.lives > 1) {
          playerRef.current.lives--;
          playerRef.current.invulnerableUntil = now + 2000; // 2 Seconds I-Frames
          
          playDebuff(); // Use debuff sound as "hurt" sound
          addFloatingText(playerRef.current.x, playerRef.current.y, "-1 ❤", '#ef4444');
          spawnParticles(playerRef.current.x, playerRef.current.y, '#ef4444', 15);
          
          // Reset player to safe drawing state
          playerRef.current.isDrawing = false;
          trailRef.current = [];
          
          // Clear trail from grid for safety (in case player was mid-draw)
          const grid = gridRef.current;
          for(let i=0; i<grid.length; i++) {
              if (grid[i] === STATE_TRAIL) grid[i] = STATE_MASKED;
          }
          
          return;
      }

      playGameOver();
      setGameState('LOST');
      spawnParticles(playerRef.current.x, playerRef.current.y, PLAYER_COLOR, 15);
  };

  // Triggered when an ENEMY touches a trap
  const handleDebuffActivation = (debuffType: DebuffType, x: number, y: number) => {
      const now = Date.now();
      playDebuff();
      // Penalty score
      scoreRef.current = Math.max(0, scoreRef.current - 500);
      onScoreUpdate(scoreRef.current);
      
      addFloatingText(x, y, "TRAP TRIGGERED!", '#ef4444');
      spawnParticles(x, y, '#ef4444', 10);

      if (debuffType === 'CONFUSION') {
          effectsRef.current.confusionUntil = now + 4000;
          addFloatingText(playerRef.current.x, playerRef.current.y - 30, "CONFUSION!", '#ef4444');
      } else if (debuffType === 'DARKNESS') {
          effectsRef.current.darknessUntil = now + 5000;
          addFloatingText(playerRef.current.x, playerRef.current.y - 30, "DARKNESS!", '#71717a');
      } else if (debuffType === 'ENEMY_RAGE') {
          effectsRef.current.enemyRageUntil = now + 6000;
          addFloatingText(playerRef.current.x, playerRef.current.y - 30, "ENEMY RAGE!", '#ef4444');
      } else if (debuffType === 'ENEMY_CLONE') {
          addFloatingText(playerRef.current.x, playerRef.current.y - 30, "DUPLICATION!", '#9333ea');
          // Clone logic: Duplicate a random enemy
          const sourceEnemy = enemiesRef.current[Math.floor(Math.random() * enemiesRef.current.length)];
          if (sourceEnemy) {
              const spawnPt = getRandomMaskedPoint(gridRef.current);
              enemiesRef.current.push({
                  ...sourceEnemy,
                  id: Math.random(),
                  x: spawnPt.x,
                  y: spawnPt.y,
                  angle: Math.random() * Math.PI * 2
              });
          }
      }
  };

  const captureArea = () => {
      const grid = gridRef.current;
      const enemies = enemiesRef.current;
      
      // 1. Identify Boss Positions
      const bosses = enemies.filter(e => e.type === 'QIX');
      const bossPoints = bosses.map(b => ({x: b.x, y: b.y}));
      
      // 2. Flood fill from Boss positions to find what stays MASKED.
      const safeIndices = getBossReachableArea(grid, bossPoints);
      
      let capturedCount = 0;
      let totalCleared = 0;
      
      // 3. Clear everything that is MASKED but not safe
      for (let i = 0; i < grid.length; i++) {
          if (grid[i] === STATE_MASKED) {
              if (!safeIndices.has(i)) {
                  grid[i] = STATE_CLEARED;
                  capturedCount++;
              }
          } else if (grid[i] === STATE_TRAIL) {
              // Convert trail to cleared as well
              grid[i] = STATE_CLEARED;
              // Treat trail as part of the fill
          }
          
          if (grid[i] === STATE_CLEARED) {
              totalCleared++;
          }
      }

      if (capturedCount > 0) {
          playCapture();
          flashIntensityRef.current = 0.5;
          
          const combo = comboMultiplierRef.current;
          const points = Math.floor(capturedCount / 5) * combo;
          
          scoreRef.current += points;
          onScoreUpdate(scoreRef.current);
          
          addFloatingText(playerRef.current.x, playerRef.current.y, `+${points}`, '#10b981');
          
          // Increase Combo
          comboMultiplierRef.current++;
          comboTimerRef.current = 4.0;
          if (combo > 1) {
              addFloatingText(playerRef.current.x, playerRef.current.y - 25, `${combo}x COMBO`, '#f472b6');
          }

          // Kill enemies trapped in captured area
          for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
              const enemy = enemiesRef.current[i];
              if (enemy.type === 'QIX') continue;
              
              const idx = getIndex(Math.floor(enemy.x), Math.floor(enemy.y));
              if (grid[idx] === STATE_CLEARED) {
                  enemiesRef.current.splice(i, 1);
                  playEnemyKill();
                  scoreRef.current += 1000;
                  addFloatingText(enemy.x, enemy.y, "CRUSHED!", '#ef4444');
                  spawnParticles(enemy.x, enemy.y, enemy.color, 15);
              }
          }
          
          // Check Power Ups & Traps in captured area
          const remainingPowerUps: PowerUp[] = [];
          let powerUpCollected = false;

          powerUpsRef.current.forEach(p => {
              const idx = getIndex(Math.floor(p.x), Math.floor(p.y));
              // Check if the center of the powerup is now in a cleared area
              if (grid[idx] === STATE_CLEARED) {
                  const now = Date.now();
                  powerUpCollected = true;
                  
                  if (p.isDebuff) {
                      playPowerUp(); 
                      scoreRef.current += 500; // Reward for disarming
                      onScoreUpdate(scoreRef.current);
                      
                      addFloatingText(p.x, p.y, "DISARMED", '#10b981'); // Green "Safe"
                      spawnParticles(p.x, p.y, '#10b981', 10);
                  } else {
                      // Normal Buff
                      playPowerUp();
                      scoreRef.current += 1000;
                      addFloatingText(p.x, p.y, "+1000", '#3b82f6');
                      switch (p.type) {
                          case 'LIFE':
                              playerRef.current.lives++;
                              addFloatingText(playerRef.current.x, playerRef.current.y - 40, "EXTRA LIFE!", '#ef4444');
                              break;
                          case 'FREEZE':
                              effectsRef.current.frozenUntil = now + POWERUP_DURATION;
                              break;
                          case 'SPEED':
                              effectsRef.current.speedUntil = now + POWERUP_DURATION;
                              break;
                          case 'SHIELD':
                              effectsRef.current.shieldUntil = now + POWERUP_DURATION;
                              break;
                          case 'SLOW':
                              effectsRef.current.slowUntil = now + POWERUP_DURATION;
                              addFloatingText(playerRef.current.x, playerRef.current.y - 40, "TIME SLOW", '#a3e635');
                              break;
                          case 'RAPID_FIRE':
                              effectsRef.current.rapidFireUntil = now + 8000;
                              break;
                          case 'SHOTGUN':
                              effectsRef.current.shotgunUntil = now + 8000;
                              addFloatingText(playerRef.current.x, playerRef.current.y - 40, "SHOTGUN", '#d946ef');
                              break;
                      }
                  }
              } else {
                  remainingPowerUps.push(p);
              }
          });
          
          if (powerUpCollected) {
              powerUpsRef.current = remainingPowerUps;
          }
      }

      // 4. Update Progress
      const percent = totalCleared / (GAME_WIDTH * GAME_HEIGHT);
      onProgressUpdate(percent);

      if (percent >= config.winPercent) {
          playBounce(); 
          setGameState('WON');
      }
  };

  const update = () => {
    const now = Date.now();
    const dt = (now - lastTimeRef.current) / 1000;
    lastTimeRef.current = now;

    const player = playerRef.current;
    const grid = gridRef.current;
    const trail = trailRef.current;
    const effects = effectsRef.current;

    // --- Update Particles ---
    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.dx;
        p.y += p.dy;
        p.life--;
        p.dx *= 0.92;
        p.dy *= 0.92;
        if (p.life <= 0) particlesRef.current.splice(i, 1);
    }

    // --- Update Floating Texts ---
    for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
        const ft = floatingTextsRef.current[i];
        ft.y += ft.dy;
        ft.life--;
        if (ft.life <= 0) floatingTextsRef.current.splice(i, 1);
    }

    // --- Combo Decay ---
    if (comboTimerRef.current > 0) {
        comboTimerRef.current -= dt;
        if (comboTimerRef.current <= 0) {
            comboMultiplierRef.current = 1;
            comboTimerRef.current = 0;
        }
    }

    // --- Timer Logic ---
    if (timeLeftRef.current > 0) {
        timeLeftRef.current -= dt;
        if (timeLeftRef.current < 0) timeLeftRef.current = 0;
    }

    const isRageMode = timeLeftRef.current <= 0;
    const isGlobalEnemyRage = now < effects.enemyRageUntil;

    // --- Power Up / Trap Spawning ---
    if (powerUpsRef.current.length < 5 && Math.random() < 0.008) {
        // Use helper to spawn only in masked areas
        const pt = getRandomMaskedPoint(grid);
        
        // Additional check: powerups don't respawn on grid state change, but initial placement matters
        const isDebuff = Math.random() < 0.35; // 35% chance for trap
        if (isDebuff) {
            const debuffs: DebuffType[] = ['CONFUSION', 'DARKNESS', 'ENEMY_RAGE', 'ENEMY_CLONE'];
            powerUpsRef.current.push({
                id: Math.random(),
                type: 'SPEED', // Dummy type
                isDebuff: true,
                debuffType: debuffs[Math.floor(Math.random() * debuffs.length)],
                x: pt.x, y: pt.y
            });
        } else {
            const types: PowerUpType[] = ['FREEZE', 'SPEED', 'SHIELD', 'SLOW', 'RAPID_FIRE', 'SHOTGUN', 'LIFE'];
            powerUpsRef.current.push({
                id: Math.random(),
                type: types[Math.floor(Math.random() * types.length)],
                isDebuff: false,
                x: pt.x, y: pt.y
            });
        }
    }

    // --- Projectile Logic ---
    const cooldown = now < effects.rapidFireUntil ? RAPID_FIRE_COOLDOWN : FIRE_COOLDOWN;
    const isShotgun = now < effects.shotgunUntil;

    if (keysPressed.current.has('Space') && now - lastFireTimeRef.current > cooldown) {
        lastFireTimeRef.current = now;
        playShoot();
        
        const baseAngle = Math.atan2(player.lastDir.y, player.lastDir.x);
        
        if (isShotgun) {
            // Spawn 3 bullets
            [-1, 0, 1].forEach(offset => {
                const angle = baseAngle + (offset * SHOTGUN_SPREAD);
                projectilesRef.current.push({
                    id: Math.random(),
                    x: player.x,
                    y: player.y,
                    dx: Math.cos(angle) * PROJECTILE_SPEED,
                    dy: Math.sin(angle) * PROJECTILE_SPEED
                });
            });
        } else {
            projectilesRef.current.push({
                id: Math.random(),
                x: player.x,
                y: player.y,
                dx: player.lastDir.x * PROJECTILE_SPEED,
                dy: player.lastDir.y * PROJECTILE_SPEED
            });
        }
    }

    // Update Projectiles
    for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
        const p = projectilesRef.current[i];
        p.x += p.dx;
        p.y += p.dy;
        
        // Bounds check
        if (p.x < 0 || p.x > GAME_WIDTH || p.y < 0 || p.y > GAME_HEIGHT) {
            projectilesRef.current.splice(i, 1);
            continue;
        }

        // Enemy Collision
        let hitEnemy = false;
        for (const enemy of enemiesRef.current) {
            const dist = Math.hypot(p.x - enemy.x, p.y - enemy.y);
            if (dist < enemy.radius + PROJECTILE_RADIUS) {
                hitEnemy = true;
                spawnParticles(enemy.x, enemy.y, PROJECTILE_COLOR, 5);
                
                if (enemy.type === 'QIX') {
                    // Stun QIX
                    enemy.stunnedUntil = now + 1000;
                    addFloatingText(enemy.x, enemy.y, "STUNNED!", '#fff');
                } else {
                    // Kill Minions
                    playEnemyKill();
                    scoreRef.current += 500;
                    addFloatingText(enemy.x, enemy.y, "+500", '#fbbf24');
                    
                    // Respawn in valid location
                    const respawnPt = getRandomMaskedPoint(gridRef.current);
                    enemy.x = respawnPt.x;
                    enemy.y = respawnPt.y;
                    enemy.stunnedUntil = now + 2000; // Respawn delay
                }
                break;
            }
        }

        if (hitEnemy) {
            projectilesRef.current.splice(i, 1);
        }
    }

    // --- Player Movement ---
    let speed = PLAYER_SPEED_BASE;
    if (now < effects.speedUntil) speed *= 1.7;

    // Handle Confusion
    const isConfused = now < effects.confusionUntil;
    const invert = isConfused ? -1 : 1;

    let moveX = 0;
    let moveY = 0;

    if (keysPressed.current.has('ArrowUp')) moveY -= speed * invert;
    if (keysPressed.current.has('ArrowDown')) moveY += speed * invert;
    if (keysPressed.current.has('ArrowLeft')) moveX -= speed * invert;
    if (keysPressed.current.has('ArrowRight')) moveX += speed * invert;

    let nextX = player.x + moveX;
    let nextY = player.y + moveY;

    // Update Last Dir for shooting (only if moving)
    if (moveX !== 0 || moveY !== 0) {
        const mag = Math.hypot(moveX, moveY);
        player.lastDir = { x: moveX / mag, y: moveY / mag };
    }

    nextX = Math.max(0, Math.min(GAME_WIDTH - 1, nextX));
    nextY = Math.max(0, Math.min(GAME_HEIGHT - 1, nextY));

    const currentIdx = getIndex(Math.floor(player.x), Math.floor(player.y));
    const nextIdx = getIndex(Math.floor(nextX), Math.floor(nextY));
    const isNextSafe = grid[nextIdx] === STATE_CLEARED;
    
    let movingIntoTrail = false;
    if (player.isDrawing && grid[nextIdx] === STATE_TRAIL) {
        movingIntoTrail = true;
    }

    if (!movingIntoTrail) {
      if (!player.isDrawing && !isNextSafe) {
        player.isDrawing = true;
        trail.push({ x: player.x, y: player.y }); 
      }

      if (player.isDrawing) {
        const lastPt = trail[trail.length - 1];
        if (!lastPt || Math.abs(lastPt.x - nextX) > 2 || Math.abs(lastPt.y - nextY) > 2) {
          trail.push({ x: nextX, y: nextY });
          const linePoints = getPointsOnLine(lastPt || {x: player.x, y: player.y}, {x: nextX, y: nextY});
          for(const p of linePoints) {
            grid[getIndex(p.x, p.y)] = STATE_TRAIL;
          }
        }
        if (isNextSafe) {
           trail.push({ x: nextX, y: nextY });
           captureArea();
           player.isDrawing = false;
           trail.length = 0; 
        }
      }
      player.x = nextX;
      player.y = nextY;
    }
    setDrawingSound(player.isDrawing);

    // --- Enemies Logic ---
    const isFrozen = now < effects.frozenUntil;
    const isSlowed = now < effects.slowUntil;
    const isShielded = now < effects.shieldUntil;
    const isInvulnerable = now < player.invulnerableUntil;

    let standardBounceTriggered = false;
    let patrollerBounceTriggered = false;

    // Check Enemy <-> Trap Collision (New Logic)
    for (let i = powerUpsRef.current.length - 1; i >= 0; i--) {
        const p = powerUpsRef.current[i];
        if (!p.isDebuff || !p.debuffType) continue; // Only Dangerous Traps affect player when enemy touches them

        let collision = false;
        // Check collision with any enemy
        for (const enemy of enemiesRef.current) {
             const dist = Math.hypot(enemy.x - p.x, enemy.y - p.y);
             // Enemy radius + Trap radius collision check
             if (dist < enemy.radius + POWERUP_RADIUS) {
                 collision = true;
                 break; 
             }
        }

        if (collision) {
             handleDebuffActivation(p.debuffType, p.x, p.y);
             powerUpsRef.current.splice(i, 1);
        }
    }

    enemiesRef.current.forEach(enemy => {
        if (isFrozen) return;
        if (enemy.stunnedUntil && now < enemy.stunnedUntil) return;

        if (enemy.type === 'HUNTER' && Math.random() < 0.005) {
            playHunterPulse();
        }
        if (enemy.type === 'QIX' && Math.random() < 0.01) {
            playQixMove();
        }

        // Qix Transformation Logic
        if (enemy.type === 'QIX') {
            enemy.enrageTimer = (enemy.enrageTimer || 0) + 1;
            // Cycle every ~10 seconds (600 frames)
            if (enemy.enrageTimer > 600) {
                enemy.isEnraged = !enemy.isEnraged;
                enemy.enrageTimer = 0;
            }
        }

        let effectiveSpeed = enemy.speed;
        if (isSlowed) effectiveSpeed *= 0.5;
        if (isRageMode || isGlobalEnemyRage) effectiveSpeed *= 2.0;
        if (enemy.isEnraged) effectiveSpeed *= 1.8; // Qix Enrage Speed

        enemy.angle = (enemy.angle || 0) + 0.05;

        let nextEx = enemy.x;
        let nextEy = enemy.y;
        let bounced = false;

        if (enemy.type === 'QIX') {
            // Enraged Behavior: loosely track player
            if (enemy.isEnraged || isGlobalEnemyRage) {
                const dx = player.x - enemy.x;
                const dy = player.y - enemy.y;
                const dist = Math.hypot(dx, dy);
                if (dist > 1) {
                    // Mix tracking with chaotic movement
                    const trackingWeight = 0.025;
                    enemy.dx = enemy.dx * (1-trackingWeight) + (dx/dist * enemy.speed) * trackingWeight;
                    enemy.dy = enemy.dy * (1-trackingWeight) + (dy/dist * enemy.speed) * trackingWeight;
                    // Normalize
                    const newSpeed = Math.hypot(enemy.dx, enemy.dy);
                    enemy.dx = (enemy.dx / newSpeed) * enemy.speed;
                    enemy.dy = (enemy.dy / newSpeed) * enemy.speed;
                }
            } else if (Math.random() < 0.02) {
                 const angle = Math.random() * Math.PI * 2;
                 enemy.dx = Math.cos(angle) * enemy.speed;
                 enemy.dy = Math.sin(angle) * enemy.speed;
            }
            
            const currentSpeed = Math.hypot(enemy.dx, enemy.dy);
            if (currentSpeed > 0) {
               nextEx += (enemy.dx / currentSpeed) * effectiveSpeed;
               nextEy += (enemy.dy / currentSpeed) * effectiveSpeed;
            }
        } else if (enemy.type === 'PATROLLER') {
            const vx = enemy.dx;
            const vy = enemy.dy;
            const mag = Math.sqrt(vx*vx + vy*vy);
            const perpX = -vy / mag;
            const perpY = vx / mag;
            const wave = Math.sin(enemy.angle! * 2) * (effectiveSpeed * 0.5); 
            nextEx += vx + perpX * wave;
            nextEy += vy + perpY * wave;

        } else if (enemy.type === 'HUNTER') {
            const dx = player.x - enemy.x;
            const dy = player.y - enemy.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 1) {
                const tx = (dx / dist) * effectiveSpeed;
                const ty = (dy / dist) * effectiveSpeed;
                enemy.dx = enemy.dx * 0.95 + tx * 0.05;
                enemy.dy = enemy.dy * 0.95 + ty * 0.05;
                nextEx += enemy.dx;
                nextEy += enemy.dy;
            }
        }

        if (nextEx <= enemy.radius) {
            nextEx = enemy.radius;
            if (enemy.type !== 'HUNTER' && enemy.dx < 0) enemy.dx *= -1;
            bounced = true;
        } else if (nextEx >= GAME_WIDTH - enemy.radius) {
            nextEx = GAME_WIDTH - enemy.radius;
            if (enemy.type !== 'HUNTER' && enemy.dx > 0) enemy.dx *= -1;
            bounced = true;
        }

        if (nextEy <= enemy.radius) {
            nextEy = enemy.radius;
            if (enemy.type !== 'HUNTER' && enemy.dy < 0) enemy.dy *= -1;
            bounced = true;
        } else if (nextEy >= GAME_HEIGHT - enemy.radius) {
            nextEy = GAME_HEIGHT - enemy.radius;
            if (enemy.type !== 'HUNTER' && enemy.dy > 0) enemy.dy *= -1;
            bounced = true;
        }

        const centerX = Math.floor(nextEx);
        const centerY = Math.floor(nextEy);
        
        const pointsToCheck = [
            {x: centerX, y: centerY},
            {x: centerX + enemy.radius, y: centerY},
            {x: centerX - enemy.radius, y: centerY},
            {x: centerX, y: centerY + enemy.radius},
            {x: centerX, y: centerY - enemy.radius}
        ];
        
        let hitCleared = false;
        for (const p of pointsToCheck) {
             const px = Math.floor(p.x);
             const py = Math.floor(p.y);

             if (px <= 0 || px >= GAME_WIDTH - 1 || py <= 0 || py >= GAME_HEIGHT - 1) continue;

             const idx = getIndex(Math.max(0, Math.min(GAME_WIDTH-1, px)), Math.max(0, Math.min(GAME_HEIGHT-1, py)));
             if (grid[idx] === STATE_CLEARED) {
                 hitCleared = true;
                 break;
             }
        }

        if (hitCleared) {
             if (enemy.type === 'HUNTER') {
                 nextEx = enemy.x;
                 nextEy = enemy.y;
                 enemy.dx *= -1;
                 enemy.dy *= -1;
             } else {
                 enemy.dx *= -1;
                 enemy.dy *= -1;
                 nextEx = enemy.x; 
                 nextEy = enemy.y;
                 bounced = true;
             }
        }

        enemy.x = nextEx;
        enemy.y = nextEy;
        if (bounced) {
            spawnParticles(enemy.x, enemy.y, enemy.color, 12); 
            
            if (enemy.type === 'PATROLLER') {
                patrollerBounceTriggered = true;
            } else if (enemy.type !== 'HUNTER') {
                standardBounceTriggered = true;
            }
        }

        const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        
        if (!isShielded && !isInvulnerable) {
             if (player.isDrawing && distToPlayer < enemy.radius + PLAYER_RADIUS) {
                  handleDeath();
                  return;
             }
        }

        const r = Math.ceil(enemy.radius);
        for(let dy = -r; dy <= r; dy+=4) {
            for(let dx = -r; dx <= r; dx+=4) {
                 if (dx*dx + dy*dy <= r*r) {
                      const cx = Math.floor(enemy.x + dx);
                      const cy = Math.floor(enemy.y + dy);
                      if (cx >= 0 && cx < GAME_WIDTH && cy >= 0 && cy < GAME_HEIGHT) {
                          if (grid[getIndex(cx, cy)] === STATE_TRAIL) {
                              // TRAIL HIT LOGIC
                              if (!isShielded && !isInvulnerable) {
                                handleDeath();
                                return;
                              }
                          }
                      }
                 }
            }
        }
    });

    if (patrollerBounceTriggered) playPatrollerBounce();
    else if (standardBounceTriggered) playBounce();

    if (flashIntensityRef.current > 0) {
        flashIntensityRef.current -= 0.05;
        if (flashIntensityRef.current < 0) flashIntensityRef.current = 0;
    }
  };

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // IF WON: DO NOT RENDER GAME ELEMENTS. Canvas stays transparent to show background.
    if (gameStateRef.current === 'WON') {
        return; 
    }

    const imgData = ctx.createImageData(GAME_WIDTH, GAME_HEIGHT);
    const data = imgData.data;
    const grid = gridRef.current;
    const srcData = sourceImageDataRef.current;
    
    const mr = 10, mg = 15, mb = 30; // Deep dark blue for mask
    const maskAlpha = 140; 

    for (let i = 0; i < grid.length; i++) {
        const ptr = i * 4;
        if (grid[i] === STATE_CLEARED) {
            if (srcData) {
                // Copy Sharp Pixel
                data[ptr] = srcData.data[ptr];
                data[ptr+1] = srcData.data[ptr+1];
                data[ptr+2] = srcData.data[ptr+2];
                data[ptr+3] = 255;
            } else {
                // No Background Image -> Transparent
                data[ptr] = 0;
                data[ptr+1] = 0;
                data[ptr+2] = 0;
                data[ptr+3] = 0;
            }
        } else {
            // Mask Effect
            data[ptr] = mr;
            data[ptr+1] = mg;
            data[ptr+2] = mb;
            data[ptr+3] = maskAlpha; 
        }
    }
    ctx.putImageData(imgData, 0, 0);

    const now = Date.now();
    const isDarkness = now < effectsRef.current.darknessUntil;

    // --- Darkness Effect ---
    if (isDarkness) {
        ctx.save();
        const grad = ctx.createRadialGradient(playerRef.current.x, playerRef.current.y, 50, playerRef.current.x, playerRef.current.y, 150);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.95)');
        ctx.fillStyle = grad;
        ctx.fillRect(0,0, GAME_WIDTH, GAME_HEIGHT);
        ctx.restore();
    }

    // Draw Trail with Glow
    const trail = trailRef.current;
    if (trail.length > 0) {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = TRAIL_COLOR;
        ctx.strokeStyle = TRAIL_COLOR;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(trail[0].x, trail[0].y);
        for (let i = 1; i < trail.length; i++) {
            ctx.lineTo(trail[i].x, trail[i].y);
        }
        ctx.lineTo(playerRef.current.x, playerRef.current.y); 
        ctx.stroke();
        ctx.restore();
    }

    // Draw Particles
    particlesRef.current.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI*2);
        ctx.fill();
        ctx.restore();
    });

    // Draw Projectiles
    ctx.fillStyle = PROJECTILE_COLOR;
    ctx.shadowColor = PROJECTILE_COLOR;
    ctx.shadowBlur = 5;
    projectilesRef.current.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, PROJECTILE_RADIUS, 0, Math.PI*2);
        ctx.fill();
    });
    ctx.shadowBlur = 0;

    // Draw Player
    ctx.fillStyle = PLAYER_COLOR;
    
    const isSpeed = now < effectsRef.current.speedUntil;
    const isShield = now < effectsRef.current.shieldUntil;
    const isConfused = now < effectsRef.current.confusionUntil;
    const isRapid = now < effectsRef.current.rapidFireUntil;
    const isShotgun = now < effectsRef.current.shotgunUntil;
    const isInvulnerable = now < playerRef.current.invulnerableUntil;
    
    const isFrozen = now < effectsRef.current.frozenUntil;
    const isRage = timeLeftRef.current <= 0;
    const isGlobalEnemyRage = now < effectsRef.current.enemyRageUntil;

    if (isSpeed) {
            ctx.fillStyle = '#fde047'; 
            ctx.shadowColor = '#fde047';
            ctx.shadowBlur = 10;
    }
    if (isConfused) {
        ctx.fillStyle = '#db2777'; // Pinkish for confusion
    }
    
    // Player Blink if Invulnerable
    if (isInvulnerable && Math.floor(now / 100) % 2 === 0) {
        ctx.globalAlpha = 0.5;
    }

    ctx.beginPath();
    ctx.arc(playerRef.current.x, playerRef.current.y, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1.0;

    if (isShield) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(playerRef.current.x, playerRef.current.y, PLAYER_RADIUS + 4, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Draw PowerUps / Traps
    powerUpsRef.current.forEach(p => {
        const r = POWERUP_RADIUS;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'white';
        ctx.lineWidth = 2;

        if (p.isDebuff) {
            // DEBUFFS
             if (p.debuffType === 'CONFUSION') {
                 ctx.strokeStyle = '#db2777'; // Pink
                 ctx.shadowColor = '#db2777';
                 ctx.beginPath();
                 // Question Mark
                 ctx.fillStyle = '#db2777';
                 ctx.font = 'bold 20px monospace';
                 ctx.textAlign = 'center';
                 ctx.textBaseline = 'middle';
                 ctx.fillText('?', 0, 1);
             } 
             else if (p.debuffType === 'DARKNESS') {
                 // Gray Eye with red slash
                 ctx.fillStyle = '#71717a'; 
                 ctx.beginPath();
                 ctx.ellipse(0, 0, r, r*0.6, 0, 0, Math.PI*2);
                 ctx.fill();
                 ctx.fillStyle = '#000';
                 ctx.beginPath();
                 ctx.arc(0, 0, r*0.3, 0, Math.PI*2);
                 ctx.fill();
                 // Red Slash
                 ctx.strokeStyle = '#ef4444';
                 ctx.lineWidth = 2;
                 ctx.beginPath();
                 ctx.moveTo(-r, -r); ctx.lineTo(r, r);
                 ctx.stroke();
             } 
             else if (p.debuffType === 'ENEMY_RAGE') {
                 // Red Angry Face
                 ctx.fillStyle = '#ef4444';
                 ctx.beginPath();
                 ctx.arc(0, 0, r, 0, Math.PI*2);
                 ctx.fill();
                 ctx.fillStyle = '#000';
                 // Eyes
                 ctx.beginPath();
                 ctx.moveTo(-4, -2); ctx.lineTo(-1, 0); ctx.lineTo(-4, 2);
                 ctx.moveTo(4, -2); ctx.lineTo(1, 0); ctx.lineTo(4, 2); 
                 ctx.fill();
                 // Mouth
                 ctx.strokeStyle = '#000';
                 ctx.beginPath();
                 ctx.moveTo(-3, 4); ctx.quadraticCurveTo(0, 2, 3, 4);
                 ctx.stroke();
             }
             else if (p.debuffType === 'ENEMY_CLONE') {
                 // Two overlapping purple dots
                 ctx.fillStyle = '#9333ea'; 
                 ctx.beginPath();
                 ctx.arc(-3, 0, r*0.6, 0, Math.PI*2);
                 ctx.fill();
                 ctx.beginPath();
                 ctx.arc(3, 0, r*0.6, 0, Math.PI*2);
                 ctx.fill();
             }

        } else {
            // BUFFS
            if (p.type === 'FREEZE') {
                // Cyan Snowflake
                ctx.strokeStyle = '#22d3ee'; 
                ctx.shadowColor = '#22d3ee';
                ctx.beginPath();
                for(let i=0; i<3; i++) {
                    ctx.save();
                    ctx.rotate(i * Math.PI / 3);
                    ctx.moveTo(0, -r); ctx.lineTo(0, r);
                    ctx.restore();
                }
                ctx.stroke();
            }
            else if (p.type === 'SPEED') {
                // Yellow Lightning
                ctx.fillStyle = '#facc15'; 
                ctx.shadowColor = '#facc15';
                ctx.beginPath();
                ctx.moveTo(2, -r); ctx.lineTo(-3, 0); ctx.lineTo(0, 0);
                ctx.lineTo(-2, r); ctx.lineTo(3, 0); ctx.lineTo(0, 0);
                ctx.fill();
            }
            else if (p.type === 'SHIELD') {
                // Blue Shield
                ctx.strokeStyle = '#3b82f6';
                ctx.fillStyle = '#1e3a8a';
                ctx.beginPath();
                ctx.moveTo(-r*0.7, -r*0.7);
                ctx.lineTo(r*0.7, -r*0.7);
                ctx.lineTo(r*0.7, 0);
                ctx.quadraticCurveTo(0, r, -r*0.7, 0);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
            else if (p.type === 'SLOW') {
                // Lime Hourglass
                ctx.fillStyle = '#a3e635'; 
                ctx.beginPath();
                ctx.moveTo(-r*0.6, -r); ctx.lineTo(r*0.6, -r);
                ctx.lineTo(0, 0);
                ctx.lineTo(r*0.6, r); ctx.lineTo(-r*0.6, r);
                ctx.lineTo(0, 0);
                ctx.fill();
            }
            else if (p.type === 'RAPID_FIRE') {
                // Orange Machine Gun (3 vertical bars)
                ctx.fillStyle = '#f97316'; 
                const w = r * 0.25;
                const h = r * 1.2;
                ctx.fillRect(-r*0.6, -h/2, w, h);
                ctx.fillRect(-w/2, -h/2, w, h);
                ctx.fillRect(r*0.6 - w, -h/2, w, h);
            }
            else if (p.type === 'SHOTGUN') {
                // Pink Triangle Dots
                ctx.fillStyle = '#ec4899'; 
                ctx.beginPath(); ctx.arc(0, -r*0.5, r*0.25, 0, Math.PI*2); ctx.fill(); // Top
                ctx.beginPath(); ctx.arc(-r*0.5, r*0.4, r*0.25, 0, Math.PI*2); ctx.fill(); // Bottom Left
                ctx.beginPath(); ctx.arc(r*0.5, r*0.4, r*0.25, 0, Math.PI*2); ctx.fill(); // Bottom Right
            }
            else if (p.type === 'LIFE') {
                // Red Heart
                ctx.fillStyle = '#ef4444'; // Red-500
                ctx.beginPath();
                // Draw heart shape
                const scale = r * 0.08; 
                ctx.save();
                ctx.scale(scale, scale);
                ctx.moveTo(0, 3);
                ctx.bezierCurveTo(0, 3, -5, -5, -10, -5);
                ctx.bezierCurveTo(-15, -5, -15, 5, -15, 5);
                ctx.bezierCurveTo(-15, 15, 0, 25, 0, 25);
                ctx.bezierCurveTo(0, 25, 15, 15, 15, 5);
                ctx.bezierCurveTo(15, 5, 15, -5, 10, -5);
                ctx.bezierCurveTo(5, -5, 0, 3, 0, 3);
                ctx.restore();
                ctx.fill();
            }
        }
        ctx.restore();
    });

    // Draw Enemies
    enemiesRef.current.forEach(enemy => {
        if (enemy.stunnedUntil && now < enemy.stunnedUntil) {
            // Stunned Visual (Grey Circle)
            ctx.fillStyle = '#52525b'; // Zinc-600
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
            ctx.fill();
            
            // ZZZ text
            ctx.font = '10px sans-serif';
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText('ZZZ', enemy.x, enemy.y - 10);
            return;
        }

        const angle = enemy.angle || 0;
        let baseColor = enemy.color;
        
        if (enemy.isEnraged || isGlobalEnemyRage) {
            baseColor = '#991b1b'; // Dark Red
        } else if (isRage) {
            baseColor = '#ef4444';
        }
        
        if (isFrozen) {
            ctx.fillStyle = '#94a3b8'; // Slate-400
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
            ctx.fill();
            // Important: return here only skips drawing the fancy details, but draws the frozen circle first
            return;
        }

        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        
        // Jiggle effect for Rage/Enrage
        if (isRage || enemy.isEnraged || isGlobalEnemyRage) {
            ctx.translate(Math.random()*2 - 1, Math.random()*2 - 1);
        }

        if (enemy.type === 'QIX') {
            const raging = enemy.isEnraged || isGlobalEnemyRage;
            ctx.shadowBlur = raging ? 30 : 20;
            ctx.shadowColor = baseColor;
            
            const pulse = Math.sin(now * 0.008 + (raging ? now * 0.02 : 0)) * (raging ? 5 : 3);
            
            // Core
            ctx.fillStyle = raging ? '#000' : '#fff'; // Black core when enraged
            ctx.beginPath();
            ctx.arc(0, 0, enemy.radius * 0.4 + Math.abs(pulse)*0.5, 0, Math.PI*2);
            ctx.fill();

            // Rotating Rings (Atom Look)
            ctx.strokeStyle = baseColor;
            ctx.lineWidth = raging ? 3 : 2;
            for(let i=0; i<3; i++) {
                ctx.beginPath();
                ctx.rotate(Math.PI / 3); // Rotate 60 degrees each time
                // Draw ellipse
                ctx.ellipse(0, 0, enemy.radius * (raging ? 2.0 : 1.5) + pulse, enemy.radius * 0.6 - pulse*0.5, angle * (i % 2 === 0 ? 1 : -1), 0, Math.PI * 2);
                ctx.stroke();
            }

        } else if (enemy.type === 'HUNTER') {
                // Rotate to face direction
                const moveAngle = Math.atan2(enemy.dy, enemy.dx);
                ctx.rotate(moveAngle); 
                
                ctx.shadowBlur = 10;
                ctx.shadowColor = baseColor;

                // Triangle / Arrow Shape
                ctx.fillStyle = baseColor;
                ctx.beginPath();
                ctx.moveTo(enemy.radius * 1.5, 0); 
                ctx.lineTo(-enemy.radius, enemy.radius); 
                ctx.lineTo(-enemy.radius * 0.5, 0); 
                ctx.lineTo(-enemy.radius, -enemy.radius); 
                ctx.closePath();
                ctx.fill();

                // Eye
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(enemy.radius * 0.5, 0, enemy.radius * 0.3, 0, Math.PI*2);
                ctx.fill();
        
        } else if (enemy.type === 'PATROLLER') {
            ctx.rotate(angle * 4); 

            ctx.shadowBlur = 8;
            ctx.shadowColor = baseColor;
            
            // Spiky Shape
            ctx.fillStyle = baseColor;
            ctx.beginPath();
            const spikes = 6;
            const outer = enemy.radius * 1.4;
            const inner = enemy.radius * 0.6;
            
            for(let i=0; i < spikes * 2; i++) {
                    const a = (i / (spikes * 2)) * Math.PI * 2;
                    const r = (i % 2 === 0) ? outer : inner;
                    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
            }
            ctx.closePath();
            ctx.fill();
            
            const flash = Math.floor(now / 200) % 2 === 0;
            ctx.fillStyle = flash ? '#fff' : '#000';
            ctx.beginPath();
            ctx.arc(0, 0, inner * 0.6, 0, Math.PI*2);
            ctx.fill();
        }

        ctx.restore();
    });

    // Draw Floating Texts
    floatingTextsRef.current.forEach(ft => {
        ctx.fillStyle = ft.color;
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillText(ft.text, ft.x, ft.y);
    });

    // HUD Effects Text
    const activeList = [];
    if (isSpeed) activeList.push({ text: '加速中', color: '#fde047' });
    if (isShield) activeList.push({ text: '护盾开启', color: '#ffffff' });
    if (isFrozen) activeList.push({ text: '全屏冻结', color: '#22d3ee' });
    if (now < effectsRef.current.slowUntil) activeList.push({ text: '子弹时间', color: '#a3e635' });
    if (isRage) activeList.push({ text: '暴走模式!', color: '#ef4444' });
    if (isRapid) activeList.push({ text: '机枪模式', color: '#f97316' });
    if (isShotgun) activeList.push({ text: '散弹模式', color: '#d946ef' });
    if (isConfused) activeList.push({ text: '混乱状态!', color: '#db2777' });
    if (isDarkness) activeList.push({ text: '视野受限!', color: '#71717a' });
    if (isGlobalEnemyRage) activeList.push({ text: '敌人狂暴!', color: '#991b1b' });

    if (activeList.length > 0) {
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'right';
        let yOff = 24;
        activeList.forEach(effect => {
                ctx.fillStyle = effect.color;
                ctx.fillText(effect.text, GAME_WIDTH - 10, yOff);
                yOff += 20;
        });
    }

    // Draw Hearts (Lives)
    if (playerRef.current.lives > 0) {
        ctx.save();
        ctx.font = '24px sans-serif';
        ctx.fillStyle = '#ef4444';
        ctx.textAlign = 'left';
        ctx.shadowColor = 'black';
        ctx.shadowBlur = 4;
        const heartsStr = "❤ ".repeat(playerRef.current.lives);
        ctx.fillText(heartsStr, 10, 80);
        ctx.restore();
    }

    // Draw Combo Indicator if active
    if (comboMultiplierRef.current > 1 && comboTimerRef.current > 0) {
        ctx.font = 'bold 32px sans-serif';
        ctx.fillStyle = '#f472b6';
        ctx.textAlign = 'left';
        ctx.shadowColor = '#be185d';
        ctx.shadowBlur = 10;
        ctx.fillText(`x${comboMultiplierRef.current}`, 10, 40);
        
        // Combo Timer Bar
        const barWidth = 100;
        const fillWidth = (comboTimerRef.current / 3.0) * barWidth;
        ctx.fillStyle = '#444';
        ctx.fillRect(10, 50, barWidth, 6);
        ctx.fillStyle = '#f472b6';
        ctx.fillRect(10, 50, fillWidth, 6);
        ctx.shadowBlur = 0;
    }

    // Draw Timer
    const timeDisplay = Math.ceil(timeLeftRef.current);
    ctx.font = 'bold 24px monospace';
    ctx.fillStyle = timeDisplay < 10 ? '#ef4444' : '#fff';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 4;
    ctx.shadowColor = 'black';
    ctx.fillText(timeDisplay.toString(), GAME_WIDTH / 2, 30);
    ctx.shadowBlur = 0;

    // Draw Capture Flash
    if (flashIntensityRef.current > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${flashIntensityRef.current})`;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    }
  };

  const diffConfig = difficulty === 'CUSTOM' ? { label: '自定义', color: 'text-purple-400' } : DIFFICULTY_SETTINGS[difficulty];

  let overlay = null;

  if (gameState === 'MENU') {
      overlay = (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm p-4 text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4 animate-pulse">点击开始</h1>
            <button 
                onClick={() => {
                initAudio();
                setGameState('PLAYING');
                }}
                className="px-6 py-2 text-white font-bold rounded shadow-lg transition bg-indigo-600 hover:bg-indigo-500"
            >
                开始游戏
            </button>
            <div className="mt-4 text-sm text-gray-400">
                难度: <span className={diffConfig.color}>{diffConfig.label}</span>
            </div>
            <div className="mt-2 text-xs text-gray-500">
                [空格] 射击 | [方向键] 移动
            </div>
          </div>
      );
  } else if (gameState === 'LOST') {
      overlay = (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm p-4 text-center">
             <h1 className="text-3xl sm:text-4xl font-bold text-red-500 mb-2">游戏结束</h1>
             <p className="text-yellow-400 text-xl font-mono mb-4">最终得分: {scoreRef.current.toLocaleString()}</p>
             <button 
                onClick={() => {
                initAudio();
                setGameState('PLAYING');
                }}
                className="px-6 py-2 text-white font-bold rounded shadow-lg transition bg-red-600 hover:bg-red-500"
            >
                再试一次
            </button>
        </div>
      );
  } else if (gameState === 'WON') {
      overlay = (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-end pb-10 pointer-events-none">
             <div className="bg-black/60 backdrop-blur-md p-6 rounded-xl border border-white/20 flex flex-col items-center pointer-events-auto shadow-2xl mx-4">
                <h1 className="text-3xl sm:text-4xl font-bold text-green-400 mb-2 drop-shadow-[0_0_10px_rgba(74,222,128,0.8)]">胜利!</h1>
                <p className="text-white text-sm opacity-90">图片已解锁</p>
                <p className="text-yellow-400 font-bold font-mono text-lg mb-4">得分: {scoreRef.current.toLocaleString()}</p>
                <div className="flex gap-4">
                    <button 
                        onClick={() => {
                        initAudio();
                        setGameState('PLAYING');
                        }}
                        className="px-4 py-2 sm:px-6 text-white font-bold rounded shadow-lg transition bg-indigo-600 hover:bg-indigo-500 text-sm sm:text-base"
                    >
                        下一关
                    </button>
                    <button 
                        onClick={onOpenGallery}
                        className="px-4 py-2 sm:px-6 text-white font-bold rounded shadow-lg transition bg-pink-600 hover:bg-pink-500 text-sm sm:text-base"
                    >
                        查看画廊
                    </button>
                </div>
             </div>
        </div>
      );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full bg-gray-900 overflow-hidden select-none">
        {backgroundImg ? (
           <img 
                src={backgroundImg} 
                alt="bg" 
                className="absolute inset-0 w-full h-full object-fill transition-all duration-700" 
                style={{ 
                    filter: gameState === 'WON' ? 'blur(0px)' : 'blur(15px)', 
                    transform: gameState === 'WON' ? 'scale(1)' : 'scale(1.1)' 
                }} 
            />
        ) : (
           <div className="w-full h-full flex items-center justify-center text-gray-500 font-mono text-xs sm:text-sm p-4 text-center border border-gray-800">
               选择一个本地文件夹<br/>以加载图片
           </div>
        )}

        <canvas
            ref={canvasRef}
            width={GAME_WIDTH}
            height={GAME_HEIGHT}
            className="absolute inset-0 w-full h-full block"
        />
        
        {overlay}
    </div>
  );
};

export default GameCanvas;
