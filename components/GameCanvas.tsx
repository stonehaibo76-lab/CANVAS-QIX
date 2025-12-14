import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  GAME_WIDTH, GAME_HEIGHT, PLAYER_SPEED_BASE, PLAYER_RADIUS, 
  STATE_MASKED, STATE_CLEARED, STATE_TRAIL, TRAIL_COLOR, 
  DIFFICULTY_SETTINGS, ENEMY_STYLES, POWERUP_RADIUS, POWERUP_DURATION, PLAYER_COLOR,
  GAME_DURATION
} from '../constants';
import { GameState, Point, Player, Enemy, Difficulty, PowerUp, ActiveEffects, PowerUpType } from '../types';
import { getBossReachableArea, getIndex, getPointsOnLine } from '../utils/gameLogic';
import { 
  initAudio, playBounce, playCapture, playGameOver, 
  setDrawingSound, startMusic, stopMusic, playPowerUp, playEnemyKill,
  playPatrollerBounce, playHunterPulse, playQixMove 
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

interface GameCanvasProps {
  gameState: GameState;
  setGameState: (state: GameState) => void;
  backgroundImg: string | null;
  onProgressUpdate: (percent: number) => void;
  difficulty: Difficulty;
  onOpenGallery?: () => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ 
  gameState, 
  setGameState, 
  backgroundImg,
  onProgressUpdate,
  difficulty,
  onOpenGallery
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
  
  // Visual Effects Refs
  const particlesRef = useRef<Particle[]>([]);
  
  // New Gameplay Refs
  const timeLeftRef = useRef<number>(GAME_DURATION);
  const lastTimeRef = useRef<number>(0);
  const flashIntensityRef = useRef<number>(0);

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
        img.crossOrigin = "Anonymous"; // In case of external URL, though we use Blob URLs mostly
        img.onload = () => {
            const tmpCanvas = document.createElement('canvas');
            tmpCanvas.width = GAME_WIDTH;
            tmpCanvas.height = GAME_HEIGHT;
            const ctx = tmpCanvas.getContext('2d');
            if (ctx) {
                // Draw image stretched to fit game dimensions
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

    playerRef.current = { x: GAME_WIDTH / 2, y: 0, isDrawing: false };
    trailRef.current = [];
    powerUpsRef.current = [];
    effectsRef.current = { frozenUntil: 0, speedUntil: 0, shieldUntil: 0, slowUntil: 0 };
    particlesRef.current = [];
    setDrawingSound(false);
    timeLeftRef.current = GAME_DURATION;
    flashIntensityRef.current = 0;

    // Spawn Enemies based on Difficulty
    const diffConfig = DIFFICULTY_SETTINGS[difficulty];
    const newEnemies: Enemy[] = [];
    let idCounter = 0;
    const spawnX = GAME_WIDTH / 2;
    const spawnY = GAME_HEIGHT / 2;

    // Qix - The Chaotic Line Entity
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
            speed: 1.2, 
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
    lastTimeRef.current = Date.now();

  }, [difficulty, onProgressUpdate]);

  useEffect(() => {
    if (gameState === 'PLAYING') {
      initGame();
      startMusic();
      reqRef.current = requestAnimationFrame(gameLoop);
    } else {
        stopMusic();
        setDrawingSound(false);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
             // If won, we clear to reveal background. If lost/menu, clear also but overlay handles UI.
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

  const spawnParticles = (x: number, y: number, color: string, count: number = 5) => {
    for(let i=0; i<count; i++) {
        const speed = Math.random() * 2 + 0.5;
        const angle = Math.random() * Math.PI * 2;
        particlesRef.current.push({
            x: x, 
            y: y,
            dx: Math.cos(angle) * speed,
            dy: Math.sin(angle) * speed,
            life: 20 + Math.random() * 15,
            maxLife: 35,
            color: color,
            size: Math.random() * 3 + 1
        });
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
        p.dx *= 0.95; // friction
        p.dy *= 0.95;
        if (p.life <= 0) particlesRef.current.splice(i, 1);
    }

    // --- Timer Logic ---
    if (timeLeftRef.current > 0) {
        timeLeftRef.current -= dt;
        if (timeLeftRef.current < 0) timeLeftRef.current = 0;
    }

    const isRageMode = timeLeftRef.current <= 0;

    // --- Power Up Spawning ---
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

        if (enemy.type === 'HUNTER' && Math.random() < 0.005) {
            playHunterPulse();
        }
        if (enemy.type === 'QIX' && Math.random() < 0.01) {
            playQixMove();
        }

        let effectiveSpeed = enemy.speed;
        if (isSlowed) effectiveSpeed *= 0.5;
        if (isRageMode) effectiveSpeed *= 2.0;

        enemy.angle = (enemy.angle || 0) + 0.05;

        let nextEx = enemy.x;
        let nextEy = enemy.y;
        let bounced = false;

        if (enemy.type === 'QIX') {
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
            spawnParticles(enemy.x, enemy.y, enemy.color);
            if (enemy.type === 'PATROLLER') {
                patrollerBounceTriggered = true;
            } else if (enemy.type !== 'HUNTER') {
                standardBounceTriggered = true;
            }
        }

        const distToPlayer = Math.hypot(player.x - enemy.x, player.y - enemy.y);
        
        if (!isShielded) {
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

    if (flashIntensityRef.current > 0) {
        flashIntensityRef.current -= 0.05;
        if (flashIntensityRef.current < 0) flashIntensityRef.current = 0;
    }
  };

  const handleDeath = () => {
      setDrawingSound(false);
      playGameOver();
      setGameState('LOST');
      gameStateRef.current = 'LOST';
  };

  const captureArea = () => {
    // ... same capture logic ...
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
    
    flashIntensityRef.current = 0.8;
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
        if (grid[i] === STATE_CLEARED && srcData) {
            // Copy Sharp Pixel
            data[ptr] = srcData.data[ptr];
            data[ptr+1] = srcData.data[ptr+1];
            data[ptr+2] = srcData.data[ptr+2];
            data[ptr+3] = 255;
        } else {
            // Mask Effect
            data[ptr] = mr;
            data[ptr+1] = mg;
            data[ptr+2] = mb;
            data[ptr+3] = maskAlpha; 
        }
    }
    ctx.putImageData(imgData, 0, 0);

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
                for(let i=0; i<3; i++) {
                    const angle = (Math.PI / 3) * i;
                    ctx.moveTo(p.x + Math.cos(angle) * -r, p.y + Math.sin(angle) * -r);
                    ctx.lineTo(p.x + Math.cos(angle) * r, p.y + Math.sin(angle) * r);
                }
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(p.x, p.y, r*0.2, 0, Math.PI*2);
                ctx.fillStyle = 'white';
                ctx.fill();
                break;
            case 'SPEED': 
                color = '#facc15'; // Yellow
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.moveTo(p.x + r*0.2, p.y - r); 
                ctx.lineTo(p.x - r*0.5, p.y + r*0.1); 
                ctx.lineTo(p.x + r*0.1, p.y + r*0.1); 
                ctx.lineTo(p.x - r*0.2, p.y + r); 
                ctx.lineTo(p.x + r*0.5, p.y - r*0.1); 
                ctx.lineTo(p.x - r*0.1, p.y - r*0.1); 
                ctx.closePath();
                ctx.fill();
                break;
            case 'SHIELD': 
                color = '#e2e8f0'; // Silver
                ctx.fillStyle = '#3b82f6';
                ctx.strokeStyle = color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(p.x - r*0.8, p.y - r*0.8);
                ctx.lineTo(p.x + r*0.8, p.y - r*0.8);
                ctx.bezierCurveTo(p.x + r*0.8, p.y, p.x + r*0.5, p.y + r, p.x, p.y + r);
                ctx.bezierCurveTo(p.x - r*0.5, p.y + r, p.x - r*0.8, p.y, p.x - r*0.8, p.y - r*0.8);
                ctx.closePath();
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(p.x, p.y - r*0.5); ctx.lineTo(p.x, p.y + r*0.3);
                ctx.moveTo(p.x - r*0.4, p.y - r*0.1); ctx.lineTo(p.x + r*0.4, p.y - r*0.1);
                ctx.stroke();
                break;
            case 'SLOW': 
                color = '#a3e635'; // Lime
                ctx.fillStyle = color;
                ctx.beginPath();
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
    const isRage = timeLeftRef.current <= 0;

    enemiesRef.current.forEach(enemy => {
        const angle = enemy.angle || 0;
        const rageColor = '#ef4444'; // Red
        const baseColor = isRage ? rageColor : enemy.color;
        
        if (isFrozen) {
            ctx.fillStyle = '#94a3b8';
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        
        // Jiggle effect for Rage
        if (isRage) {
            ctx.translate(Math.random()*2 - 1, Math.random()*2 - 1);
        }

        if (enemy.type === 'QIX') {
            ctx.shadowBlur = 20;
            ctx.shadowColor = baseColor;
            
            const pulse = Math.sin(now * 0.008) * 3;
            
            // Core
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(0, 0, enemy.radius * 0.4 + Math.abs(pulse)*0.5, 0, Math.PI*2);
            ctx.fill();

            // Rotating Rings
            ctx.strokeStyle = baseColor;
            ctx.lineWidth = 2;
            for(let i=0; i<3; i++) {
                ctx.beginPath();
                ctx.rotate(angle * (i === 1 ? -1 : 1) + (i * Math.PI/3)); 
                ctx.ellipse(0, 0, enemy.radius * 1.5 + pulse, enemy.radius * 0.6 - pulse*0.5, 0, 0, Math.PI * 2);
                ctx.stroke();
            }

        } else if (enemy.type === 'HUNTER') {
                const moveAngle = Math.atan2(enemy.dy, enemy.dx);
                ctx.rotate(moveAngle); 
                
                ctx.shadowBlur = 10;
                ctx.shadowColor = baseColor;

                ctx.fillStyle = baseColor;
                ctx.beginPath();
                ctx.moveTo(enemy.radius * 1.5, 0); 
                ctx.lineTo(-enemy.radius, enemy.radius); 
                ctx.lineTo(-enemy.radius * 0.5, 0); 
                ctx.lineTo(-enemy.radius, -enemy.radius); 
                ctx.closePath();
                ctx.fill();

                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(enemy.radius * 0.5, 0, enemy.radius * 0.3, 0, Math.PI*2);
                ctx.fill();
        
        } else if (enemy.type === 'PATROLLER') {
            ctx.rotate(angle * 4); 

            ctx.shadowBlur = 8;
            ctx.shadowColor = baseColor;
            
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

    // HUD Effects Text
    const activeList = [];
    if (isSpeed) activeList.push({ text: '加速中', color: '#fde047' });
    if (isShield) activeList.push({ text: '护盾开启', color: '#ffffff' });
    if (isFrozen) activeList.push({ text: '全屏冻结', color: '#22d3ee' });
    if (now < effectsRef.current.slowUntil) activeList.push({ text: '敌人减速', color: '#a3e635' });
    if (isRage) activeList.push({ text: '暴走模式!', color: '#ef4444' });

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

  const diffConfig = DIFFICULTY_SETTINGS[difficulty];

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
          </div>
      );
  } else if (gameState === 'LOST') {
      overlay = (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm p-4 text-center">
             <h1 className="text-3xl sm:text-4xl font-bold text-red-500 mb-4">游戏结束</h1>
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
                <p className="text-white mb-4 text-sm opacity-90">图片已解锁</p>
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

  // Layout Fix:
  // We revert to a simple absolute filling layout.
  // The Parent container (in App.tsx) controls the 4:3 Aspect Ratio.
  // Crucial: The image uses object-fill. This forces the image to stretch to match the canvas's 4:3 grid.
  // This solves the issue where mask and image were misaligned due to object-contain scaling differences.
  return (
    <div className="relative w-full h-full bg-gray-900 overflow-hidden select-none">
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