import { GAME_WIDTH, GAME_HEIGHT, STATE_MASKED, STATE_CLEARED, STATE_TRAIL } from '../constants';
import { Point } from '../types';

/**
 * Checks if a point is out of bounds
 */
export const isOutOfBounds = (x: number, y: number): boolean => {
  return x < 0 || x >= GAME_WIDTH || y < 0 || y >= GAME_HEIGHT;
};

/**
 * Returns the index in the flat Uint8Array for coordinates (x, y)
 */
export const getIndex = (x: number, y: number): number => {
  return y * GAME_WIDTH + x;
};

/**
 * Flood Fill Algorithm (BFS)
 * Used to determine which part of the map the BOSS is currently in.
 * We mark all reachable pixels from the boss.
 * 
 * Returns a Set of indices that are "safe" (kept masked) because the boss is there.
 */
export const getBossReachableArea = (
  grid: Uint8Array,
  startX: number,
  startY: number
): Set<number> => {
  const visited = new Set<number>();
  const queue: number[] = [];
  
  const startIndex = getIndex(Math.floor(startX), Math.floor(startY));
  
  // If boss is somehow in a wall or cleared area, just return empty (shouldn't happen ideally)
  if (grid[startIndex] === STATE_CLEARED) return visited;

  queue.push(startIndex);
  visited.add(startIndex);

  // Directions: Up, Down, Left, Right
  const offsets = [-GAME_WIDTH, GAME_WIDTH, -1, 1];

  while (queue.length > 0) {
    const currentIdx = queue.shift()!;
    
    for (const offset of offsets) {
      const neighborIdx = currentIdx + offset;
      
      // Boundary check needs care with 1D array. 
      // Simple check: ensure we didn't wrap around horizontally or go out of vertical bounds.
      if (neighborIdx < 0 || neighborIdx >= grid.length) continue;
      
      // Check horizontal wrap-around
      if (offset === 1 && neighborIdx % GAME_WIDTH === 0) continue; // Wrapped to next line
      if (offset === -1 && (neighborIdx + 1) % GAME_WIDTH === 0) continue; // Wrapped to prev line

      // We can only traverse through MASKED areas.
      // We TREAT the new TRAIL as a wall for the boss fill.
      if (grid[neighborIdx] === STATE_MASKED && !visited.has(neighborIdx)) {
        visited.add(neighborIdx);
        queue.push(neighborIdx);
      }
    }
  }

  return visited;
};

/**
 * Bresenham's Line Algorithm to plot points between two coordinates
 * Used to draw the player's trail into the grid.
 */
export const getPointsOnLine = (p0: Point, p1: Point): Point[] => {
  const points: Point[] = [];
  let x0 = Math.floor(p0.x);
  let y0 = Math.floor(p0.y);
  const x1 = Math.floor(p1.x);
  const y1 = Math.floor(p1.y);

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    points.push({ x: x0, y: y0 });
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
  return points;
};
