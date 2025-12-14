import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  GAME_WIDTH, GAME_HEIGHT, PLAYER_SPEED_BASE, PLAYER_RADIUS, 
  STATE_MASKED, STATE_CLEARED, STATE_TRAIL, TRAIL_COLOR, 
  DIFFICULTY_SETTINGS, ENEMY_STYLES, POWERUP_RADIUS, POWERUP_DURATION, PLAYER_COLOR
} from '../constants';
import { GameState, Point, Player, Enemy, Difficulty, PowerUp, ActiveEffects, PowerUpType } from '../types';
import { getBossReachableArea, getIndex, getPointsOnLine } from '../utils/gameLogic';
import { 
  initAudio, playBounce, playCapture, playGameOver, 
  setDrawingSound, startMusic, stopMusic, playPowerUp, playEnemyKill,
  playPatrollerBounce, playHunterPulse, playQixMove 
} from '../utils/audio';

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  backgroundImg: string | null;
  onProgressUpdate: (percent: number) => void;
  difficulty: Difficulty;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ 
  gameState, 
  setGameState, 
  backgroundImg,
  onProgressUpdate,
  difficulty
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reqRef = useRef<number>();
  const gameStateRef = useRef<GameState>(gameState);
  
  // State Refs
  const gridRef = useRef<Uint8Array>(new Uint8Array(GAME_WIDTH * GAME_HEIGHT));
  const playerRef = useRef<Player>({ x: 0, y: 0, isDrawing: false });
  const enemiesRef = useRef<Enemy[]>([]);
  const trailRef = useRef<Point[]>([]);
  const powerUpsRef = useRef<PowerUp[]>([]);
  const effectsRef = useRef<ActiveEffects>({ frozenUntil: 0, speedUntil: 0, shieldUntil: 0, slowUntil: 0 });
  const keysPressed = useRef<Set<string>>(new Set());

  // Sync Ref
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

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

    playerRef.current = { x: GAME_WIDTH / 2, y: 0, isDrawing: false };
    trailRef.current = [];
    powerUpsRef.current = [];
    effectsRef.current = { frozenUntil: 0, speedUntil: 0, shieldUntil: 0, slowUntil: 0 };
    setDrawingSound(false);

    // Spawn Enemies based on Difficulty
    const diffConfig = DIFFICULTY_SETTINGS[difficulty];
    const newEnemies: Enemy[] = [];
    let idCounter = 0;
    const spawnX = GAME_WIDTH / 2;
    const spawnY = GAME_HEIGHT / 2;

    // Qix - The Chaotic Line Entity
    // Needs a non-zero initial angle for rendering rotation
    newEnemies.push({
      id: idCounter++,
      type: 'QIX',
      x: spawnX,
      y: spawnY,
      dx: (Math.random() > 0.5 ? 1 : -1) * diffConfig.qixSpeed,
      dy: (Math.random() > 0.5 ? 1 : -1) * diffConfig.qixSpeed,
      speed: diffConfig.qixSpeed,
      radius: ENEMY_STYLES.QIX.radius,
      color: ENEMY_STYLES.QIX.color,
      angle: 0 
    });

    // Hunters (Slow but relentless)
    for(let i=0; i<diffConfig.hunterCount; i++) {
        newEnemies.push({
            id: idCounter++,
            type: 'HUNTER',
            x: spawnX + (Math.random() * 100 - 50),
            y: spawnY + (Math.random() * 100 - 50),
            dx: 0, dy: 0,
            speed: 1.2, // Slightly faster than before but less than Qix
            radius: ENEMY_STYLES.HUNTER.radius,
            color: ENEMY_STYLES.HUNTER.color,
            angle: 0
        });
    }

    // Patrollers (Fast bouncers)
    for(let i=0; i<diffConfig.patrollerCount; i++) {
        const pSpeed = 2.5; 
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

  }, [difficulty, onProgressUpdate]);

  useEffect(() => {
    if (gameState === 'PLAYING') {
      initGame();
      startMusic();
      reqRef.current = requestAnimationFrame(gameLoop);
    } else {
        stopMusic();
        setDrawingSound(false);
        // Specifically clear canvas when game ends (WON/LOST) to remove lingering frame
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
             ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        }
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
    const handleKeyDown = (e: KeyboardEvent) => keysPressed.current.add(e.code);
    const handleKeyUp = (e: KeyboardEvent) => keysPressed.current.delete(e.code);
    window.addEventListener('keydown', handleKeyDown);
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

  const update = () => {
    const now = Date.now();
    const player = playerRef.current;
    const grid = gridRef.current;
    const trail = trailRef.current;
    const effects = effectsRef.current;

    // --- Power Up Spawning ---
    // Max 3 powerups active.
    if (powerUpsRef.current.length < 3 && Math.random() < 0.005) {
        const px = Math.floor(Math.random() * (GAME_WIDTH - 40)) + 20;
        const py = Math.floor(Math.random() * (GAME_HEIGHT - 40)) + 20;
        if (grid[getIndex(px, py)] === STATE_MASKED) {
             const types: PowerUpType[] = ['FREEZE', 'SPEED', 'SHIELD', 'SLOW'];
             powerUpsRef.current.push({
                 id: Math.random(),
                 type: types[Math.floor(Math.random() * types.length)],
                 x: px,
                 y: py
             });
        }
    }

    // --- Player Movement ---
    let speed = PLAYER_SPEED_BASE;
    if (now < effects.speedUntil) speed *= 1.7; // Fast Mode

    let nextX = player.x;
    let nextY = player.y;

    if (keysPressed.current.has('ArrowUp')) nextY -= speed;
    if (keysPressed.current.has('ArrowDown')) nextY += speed;
    if (keysPressed.current.has('ArrowLeft')) nextX -= speed;
    if (keysPressed.current.has('ArrowRight')) nextX += speed;

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

    let standardBounceTriggered = false;
    let patrollerBounceTriggered = false;

    enemiesRef.current.forEach(enemy => {
        if (isFrozen) return;

        // Ambient Sound Triggers
        if (enemy.type === 'HUNTER' && Math.random() < 0.005) {
            playHunterPulse();
        }
        if (enemy.type === 'QIX' && Math.random() < 0.01) {
            playQixMove();
        }

        let effectiveSpeed = enemy.speed;
        if (isSlowed) effectiveSpeed *= 0.5;

        // Update Rotation Angles
        enemy.angle = (enemy.angle || 0) + 0.05;

        let nextEx = enemy.x;
        let nextEy = enemy.y;
        let bounced = false;

        if (enemy.type === 'QIX') {
            // Chaotic movement
            if (Math.random() < 0.02) {
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
            // Wave movement
            const vx = enemy.dx;
            const vy = enemy.dy;
            const mag = Math.sqrt(vx*vx + vy*vy);
            
            // Perpendicular vector
            const perpX = -vy / mag;
            const perpY = vx / mag;
            
            // Sine wave offset - Scaled by effective speed to prevent getting stuck
            const wave = Math.sin(enemy.angle! * 2) * (effectiveSpeed * 0.5); 
            
            nextEx += vx + perpX * wave;
            nextEy += vy + perpY * wave;

        } else if (enemy.type === 'HUNTER') {
            // Smooth seeking (Inertia)
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

        // 1. Bounds Check
        // Explicit checks to prevent "sticking" when wave forces enemy into wall
        if (nextEx <= enemy.radius) {
            nextEx = enemy.radius;
            if (enemy.type !== 'HUNTER' && enemy.dx < 0) enemy.dx *= -1; // Only flip if moving INTO wall
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

        // 2. Grid Cleared Check
        const centerX = Math.floor(nextEx);
        const centerY = Math.floor(nextEy);
        
        // Simple 4-point collision check for grid
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

             // IMPORTANT FIX: Ignore the pre-cleared boundary lines (indices 0 and WIDTH-1/HEIGHT-1).
             // The Bounds Check above already handles wall collisions. 
             // Checking grid here causes a double-bounce effect (flip -> flip back) which sticks the enemy to the wall.
             if (px <= 0 || px >= GAME_WIDTH - 1 || py <= 0 || py >= GAME_HEIGHT - 1) continue;

             const idx = getIndex(Math.max(0, Math.min(GAME_WIDTH-1, px)), Math.max(0, Math.min(GAME_HEIGHT-1, py)));
             if (grid[idx] === STATE_CLEARED) {
                 hitCleared = true;
                 break;
             }
        }

        if (hitCleared) {
             if (enemy.type === 'HUNTER') {
                 // Hunters stop at edge
                 nextEx = enemy.x;
                 nextEy = enemy.y;
                 enemy.dx *= -1;
                 enemy.dy *= -1;
             } else {
                 // Bounce back
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
            if (enemy.type === 'PATROLLER') {
                patrollerBounceTriggered = true;
            } else if (enemy.type !== 'HUNTER') {
                standardBounceTriggered = true;
            }
        }

        // 3. Collision with Player/Trail
        const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        
        if (!isShielded) {
             if (player.isDrawing && distToPlayer < enemy.radius + PLAYER_RADIUS) {
                  handleDeath();
                  return;
             }
        }

        // Check Trail Collision
        const r = Math.ceil(enemy.radius);
        for(let dy = -r; dy <= r; dy+=4) {
            for(let dx = -r; dx <= r; dx+=4) {
                 if (dx*dx + dy*dy <= r*r) {
                      const cx = Math.floor(enemy.x + dx);
                      const cy = Math.floor(enemy.y + dy);
                      if (cx >= 0 && cx < GAME_WIDTH && cy >= 0 && cy < GAME_HEIGHT) {
                          if (grid[getIndex(cx, cy)] === STATE_TRAIL) {
                              handleDeath();
                              return;
                          }
                      }
                 }
            }
        }
    });

    if (patrollerBounceTriggered) playPatrollerBounce();
    else if (standardBounceTriggered) playBounce();
  };

  const handleDeath = () => {
      setDrawingSound(false);
      playGameOver();
      setGameState('LOST');
      gameStateRef.current = 'LOST';
  };

  const captureArea = () => {
    const grid = gridRef.current;
    const qix = enemiesRef.current.find(e => e.type === 'QIX');
    const qx = qix ? qix.x : GAME_WIDTH/2;
    const qy = qix ? qix.y : GAME_HEIGHT/2;

    const bossReachable = getBossReachableArea(grid, qx, qy);

    let clearedCount = 0;
    const totalPixels = GAME_WIDTH * GAME_HEIGHT;

    for (let i = 0; i < totalPixels; i++) {
      if ((grid[i] === STATE_MASKED || grid[i] === STATE_TRAIL)) {
        if (!bossReachable.has(i)) {
          grid[i] = STATE_CLEARED;
        }
      }
      if (grid[i] === STATE_CLEARED) {
        clearedCount++;
      }
    }
    
    playCapture();

    const survivingEnemies: Enemy[] = [];
    let enemyKilled = false;

    enemiesRef.current.forEach(enemy => {
        if (enemy.type === 'QIX') {
            survivingEnemies.push(enemy);
            return;
        }
        const eIdx = getIndex(Math.floor(enemy.x), Math.floor(enemy.y));
        if (!bossReachable.has(eIdx)) {
            enemyKilled = true;
        } else {
            survivingEnemies.push(enemy);
        }
    });

    if (enemyKilled) {
        playEnemyKill();
    }
    enemiesRef.current = survivingEnemies;

    const remainingPowerUps: PowerUp[] = [];
    powerUpsRef.current.forEach(p => {
        const idx = getIndex(Math.floor(p.x), Math.floor(p.y));
        if (grid[idx] === STATE_CLEARED) {
            playPowerUp();
            const now = Date.now();
            switch (p.type) {
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
                    break;
            }
        } else {
            remainingPowerUps.push(p);
        }
    });
    powerUpsRef.current = remainingPowerUps;

    const diffConfig = DIFFICULTY_SETTINGS[difficulty];
    const percent = clearedCount / totalPixels;
    onProgressUpdate(percent);

    if (percent >= diffConfig.winPercent) {
      setGameState('WON');
      gameStateRef.current = 'WON';
      setDrawingSound(false);
      stopMusic();
    }
  };

  const render = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    if (gameStateRef.current !== 'WON') {
        const imgData = ctx.createImageData(GAME_WIDTH, GAME_HEIGHT);
        const data = imgData.data;
        const grid = gridRef.current;
        const mr = 30, mg = 58, mb = 138;

        for (let i = 0; i < grid.length; i++) {
          if (grid[i] !== STATE_CLEARED) {
            const ptr = i * 4;
            data[ptr] = mr;
            data[ptr + 1] = mg;
            data[ptr + 2] = mb;
            data[ptr + 3] = 255; 
          }
        }
        ctx.putImageData(imgData, 0, 0);

        // Draw Trail
        const trail = trailRef.current;
        if (trail.length > 0) {
          ctx.strokeStyle = TRAIL_COLOR;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(trail[0].x, trail[0].y);
          for (let i = 1; i < trail.length; i++) {
            ctx.lineTo(trail[i].x, trail[i].y);
          }
          ctx.lineTo(playerRef.current.x, playerRef.current.y); 
          ctx.stroke();
        }

        // Draw Player
        const now = Date.now();
        ctx.fillStyle = PLAYER_COLOR;
        
        const isSpeed = now < effectsRef.current.speedUntil;
        const isShield = now < effectsRef.current.shieldUntil;

        if (isSpeed) {
             ctx.fillStyle = '#fde047'; 
             ctx.shadowColor = '#fde047';
             ctx.shadowBlur = 10;
        }
        
        ctx.beginPath();
        ctx.arc(playerRef.current.x, playerRef.current.y, PLAYER_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        if (isShield) {
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(playerRef.current.x, playerRef.current.y, PLAYER_RADIUS + 4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.strokeStyle = '#60a5fa';
            ctx.beginPath();
            ctx.arc(playerRef.current.x, playerRef.current.y, PLAYER_RADIUS + 2, 0, Math.PI * 2);
            ctx.stroke();
        }

        // Draw PowerUps
        powerUpsRef.current.forEach(p => {
            let color = '#fff';
            let r = POWERUP_RADIUS;
            
            ctx.shadowBlur = 8;
            ctx.shadowColor = 'white';

            switch(p.type) {
                case 'FREEZE': 
                    color = '#22d3ee'; // Cyan
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    // Snowflake shape (3 lines intersecting)
                    for(let i=0; i<3; i++) {
                        const angle = (Math.PI / 3) * i;
                        ctx.moveTo(p.x + Math.cos(angle) * -r, p.y + Math.sin(angle) * -r);
                        ctx.lineTo(p.x + Math.cos(angle) * r, p.y + Math.sin(angle) * r);
                    }
                    ctx.stroke();
                    // Small circle in center
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, r*0.2, 0, Math.PI*2);
                    ctx.fillStyle = 'white';
                    ctx.fill();
                    break;

                case 'SPEED': 
                    color = '#facc15'; // Yellow
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    // Lightning bolt
                    ctx.moveTo(p.x + r*0.2, p.y - r); // Top rightish
                    ctx.lineTo(p.x - r*0.5, p.y + r*0.1); // Middle left
                    ctx.lineTo(p.x + r*0.1, p.y + r*0.1); // Middle center
                    ctx.lineTo(p.x - r*0.2, p.y + r); // Bottom leftish
                    ctx.lineTo(p.x + r*0.5, p.y - r*0.1); // Middle right
                    ctx.lineTo(p.x - r*0.1, p.y - r*0.1); // Middle center
                    ctx.closePath();
                    ctx.fill();
                    break;

                case 'SHIELD': 
                    color = '#e2e8f0'; // Silver
                    ctx.fillStyle = '#3b82f6';
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    // Shield shape
                    ctx.moveTo(p.x - r*0.8, p.y - r*0.8);
                    ctx.lineTo(p.x + r*0.8, p.y - r*0.8);
                    ctx.bezierCurveTo(p.x + r*0.8, p.y, p.x + r*0.5, p.y + r, p.x, p.y + r);
                    ctx.bezierCurveTo(p.x - r*0.5, p.y + r, p.x - r*0.8, p.y, p.x - r*0.8, p.y - r*0.8);
                    ctx.closePath();
                    ctx.stroke();
                    // Cross inside
                    ctx.beginPath();
                    ctx.moveTo(p.x, p.y - r*0.5); ctx.lineTo(p.x, p.y + r*0.3);
                    ctx.moveTo(p.x - r*0.4, p.y - r*0.1); ctx.lineTo(p.x + r*0.4, p.y - r*0.1);
                    ctx.stroke();
                    break;

                case 'SLOW': 
                    color = '#a3e635'; // Lime
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    // Hourglass / Time
                    ctx.moveTo(p.x - r*0.7, p.y - r*0.8);
                    ctx.lineTo(p.x + r*0.7, p.y - r*0.8);
                    ctx.lineTo(p.x, p.y);
                    ctx.lineTo(p.x + r*0.7, p.y + r*0.8);
                    ctx.lineTo(p.x - r*0.7, p.y + r*0.8);
                    ctx.lineTo(p.x, p.y);
                    ctx.closePath();
                    ctx.fill();
                    break;
            }
            
            ctx.shadowBlur = 0;
        });

        // Draw Enemies
        const isFrozen = now < effectsRef.current.frozenUntil;
        enemiesRef.current.forEach(enemy => {
            const angle = enemy.angle || 0;
            
            if (isFrozen) {
                // Frozen state - just gray circle
                ctx.fillStyle = '#94a3b8';
                ctx.beginPath();
                ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
                ctx.fill();
                return;
            }

            ctx.save();
            ctx.translate(enemy.x, enemy.y);
            
            if (enemy.type === 'QIX') {
                // Atomic / Electric Entity
                ctx.shadowBlur = 15;
                ctx.shadowColor = enemy.color;
                
                // Pulsing core
                const pulse = Math.sin(now * 0.01);
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(0, 0, enemy.radius * 0.4 + pulse, 0, Math.PI*2);
                ctx.fill();

                // Rotating orbits
                ctx.strokeStyle = enemy.color;
                ctx.lineWidth = 2;
                for(let i=0; i<3; i++) {
                    ctx.beginPath();
                    ctx.rotate(angle * (i === 1 ? -1 : 1) + (i * Math.PI/3)); 
                    ctx.ellipse(0, 0, enemy.radius * 1.5, enemy.radius * 0.6 + pulse*2, 0, 0, Math.PI * 2);
                    ctx.stroke();
                }

            } else if (enemy.type === 'HUNTER') {
                 // Seeker Drone (Directional)
                 // Rotate to face movement
                 const moveAngle = Math.atan2(enemy.dy, enemy.dx);
                 ctx.rotate(moveAngle); 
                 
                 ctx.shadowBlur = 10;
                 ctx.shadowColor = enemy.color;

                 // Main Body (Arrow shape)
                 ctx.fillStyle = enemy.color;
                 ctx.beginPath();
                 ctx.moveTo(enemy.radius * 1.5, 0); // Nose
                 ctx.lineTo(-enemy.radius, enemy.radius); // Left Wing
                 ctx.lineTo(-enemy.radius * 0.5, 0); // Indent
                 ctx.lineTo(-enemy.radius, -enemy.radius); // Right Wing
                 ctx.closePath();
                 ctx.fill();

                 // Glowing Eye
                 ctx.fillStyle = '#fff';
                 ctx.beginPath();
                 ctx.arc(enemy.radius * 0.5, 0, enemy.radius * 0.3, 0, Math.PI*2);
                 ctx.fill();
            
            } else if (enemy.type === 'PATROLLER') {
                // Spiked Mine / Buzzsaw
                ctx.rotate(angle * 4); // Fast spin

                ctx.shadowBlur = 8;
                ctx.shadowColor = enemy.color;
                
                ctx.fillStyle = enemy.color;
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
                
                // Flashing center
                const flash = Math.floor(now / 200) % 2 === 0;
                ctx.fillStyle = flash ? '#fff' : '#000';
                ctx.beginPath();
                ctx.arc(0, 0, inner * 0.6, 0, Math.PI*2);
                ctx.fill();
            }

            ctx.restore();
        });

        // HUD Effects Text
        const activeList = [];
        if (isSpeed) activeList.push({ text: 'SPEED UP', color: '#fde047' });
        if (isShield) activeList.push({ text: 'SHIELD', color: '#ffffff' });
        if (isFrozen) activeList.push({ text: 'FROZEN', color: '#22d3ee' });
        if (now < effectsRef.current.slowUntil) activeList.push({ text: 'SLOWED', color: '#a3e635' });

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
    }
  };

  const diffConfig = DIFFICULTY_SETTINGS[difficulty];

  let overlay = null;

  if (gameState === 'MENU') {
      overlay = (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
            <h1 className="text-4xl font-bold text-white mb-4 animate-pulse">PRESS START</h1>
            <button 
                onClick={() => {
                initAudio();
                setGameState('PLAYING');
                }}
                className="px-6 py-2 text-white font-bold rounded shadow-lg transition bg-indigo-600 hover:bg-indigo-500"
            >
                START GAME
            </button>
            <div className="mt-4 text-sm text-gray-400">
                Difficulty: <span className={diffConfig.color}>{diffConfig.label}</span>
            </div>
          </div>
      );
  } else if (gameState === 'LOST') {
      overlay = (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
             <h1 className="text-4xl font-bold text-red-500 mb-4">GAME OVER</h1>
             <button 
                onClick={() => {
                initAudio();
                setGameState('PLAYING');
                }}
                className="px-6 py-2 text-white font-bold rounded shadow-lg transition bg-red-600 hover:bg-red-500"
            >
                TRY AGAIN
            </button>
        </div>
      );
  } else if (gameState === 'WON') {
      overlay = (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-end pb-10 pointer-events-none">
             <div className="bg-black/60 backdrop-blur-md p-6 rounded-xl border border-white/20 flex flex-col items-center pointer-events-auto">
                <h1 className="text-4xl font-bold text-green-400 mb-2 drop-shadow-[0_0_10px_rgba(74,222,128,0.8)]">YOU WIN!</h1>
                <p className="text-white mb-4 text-sm opacity-90">Image Unlocked</p>
                <button 
                    onClick={() => {
                    initAudio();
                    setGameState('PLAYING');
                    }}
                    className="px-6 py-2 text-white font-bold rounded shadow-lg transition bg-indigo-600 hover:bg-indigo-500"
                >
                    NEXT IMAGE
                </button>
             </div>
        </div>
      );
  }

  return (
    <div className="relative border-4 border-gray-700 shadow-2xl bg-black" style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}>
      <div 
        className="absolute inset-0 z-0 flex items-center justify-center bg-gray-800 overflow-hidden"
      >
        {backgroundImg ? (
           <img src={backgroundImg} alt="bg" className="w-full h-full object-cover" />
        ) : (
          <div className="text-gray-500 font-mono text-sm p-4 text-center">
            Select a folder to load random images.<br/>
          </div>
        )}
      </div>

      <canvas
        ref={canvasRef}
        width={GAME_WIDTH}
        height={GAME_HEIGHT}
        className="absolute inset-0 z-10 block"
      />
      
      {overlay}
    </div>
  );
};

export default GameCanvas;