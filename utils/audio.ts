// Audio Context Singleton
let ctx: AudioContext | null = null;
let drawingOsc: OscillatorNode | null = null;
let drawingGain: GainNode | null = null;

// Music State
let isPlayingMusic = false;
let nextNoteTime = 0;
let beatCount = 0;
let schedulerTimer: number | null = null;
const TEMPO = 110; // Slightly slower, more chill
const SECONDS_PER_BEAT = 60.0 / TEMPO;
const LOOKAHEAD = 25.0; // ms
const SCHEDULE_AHEAD_TIME = 0.1; // s

// Initialize Audio Context
export const initAudio = () => {
  if (!ctx) {
    ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
};

// --- Sound Effects ---

export const playBounce = () => {
  if (!ctx) return;
  const t = ctx.currentTime;
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  // Softer bounce
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(200, t);
  osc.frequency.exponentialRampToValueAtTime(100, t + 0.1);
  
  gain.gain.setValueAtTime(0.05, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  
  osc.start(t);
  osc.stop(t + 0.1);
};

export const playPatrollerBounce = () => {
  if (!ctx) return;
  const t = ctx.currentTime;
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  // Metallic Clang
  osc.type = 'square';
  // Fast frequency modulation for metallic texture
  osc.frequency.setValueAtTime(600, t);
  osc.frequency.exponentialRampToValueAtTime(100, t + 0.15);
  
  gain.gain.setValueAtTime(0.08, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  
  osc.start(t);
  osc.stop(t + 0.15);
};

export const playHunterPulse = () => {
    if (!ctx) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Sonar Ping
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.05);
    
    gain.gain.setValueAtTime(0.03, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);

    osc.start(t);
    osc.stop(t + 0.1);
};

export const playQixMove = () => {
    if (!ctx) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    // Electrical Zap/Hum
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.linearRampToValueAtTime(40, t + 0.3);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.linearRampToValueAtTime(100, t + 0.3);

    gain.gain.setValueAtTime(0.04, t); // Low volume ambient
    gain.gain.linearRampToValueAtTime(0, t + 0.3);

    osc.start(t);
    osc.stop(t + 0.3);
};

export const playCapture = () => {
  if (!ctx) return;
  const t = ctx.currentTime;
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, t);
  osc.frequency.linearRampToValueAtTime(800, t + 0.15);
  osc.frequency.linearRampToValueAtTime(1200, t + 0.3);
  
  gain.gain.setValueAtTime(0.1, t);
  gain.gain.linearRampToValueAtTime(0, t + 0.4);
  
  osc.start(t);
  osc.stop(t + 0.4);
};

export const playPowerUp = () => {
  if (!ctx) return;
  const t = ctx.currentTime;
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  // High pitched sparkle
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(600, t);
  osc.frequency.linearRampToValueAtTime(1200, t + 0.1);
  osc.frequency.linearRampToValueAtTime(1800, t + 0.2);
  
  gain.gain.setValueAtTime(0.1, t);
  gain.gain.linearRampToValueAtTime(0, t + 0.3);
  
  osc.start(t);
  osc.stop(t + 0.3);
};

export const playEnemyKill = () => {
  if (!ctx) return;
  const t = ctx.currentTime;
  
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  // Explosion-like sound
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(30, t + 0.3);
  
  gain.gain.setValueAtTime(0.2, t);
  gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
  
  osc.start(t);
  osc.stop(t + 0.3);
};

export const playGameOver = () => {
  if (!ctx) return;
  const t = ctx.currentTime;
  
  // White noise
  const bufferSize = ctx.sampleRate * 0.6; 
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = ctx.createGain();
  
  noise.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  
  noiseGain.gain.setValueAtTime(0.2, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  noise.start(t);
  
  // Descending tone
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, t);
  osc.frequency.exponentialRampToValueAtTime(10, t + 0.6);
  
  gain.gain.setValueAtTime(0.2, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  
  osc.start(t);
  osc.stop(t + 0.6);
};

export const setDrawingSound = (isDrawing: boolean) => {
  if (!ctx) return;

  if (isDrawing) {
    if (!drawingOsc) {
      drawingOsc = ctx.createOscillator();
      drawingGain = ctx.createGain();
      
      drawingOsc.connect(drawingGain);
      drawingGain.connect(ctx.destination);
      
      // Softer buzz for drawing
      drawingOsc.type = 'square'; 
      drawingOsc.frequency.setValueAtTime(110, ctx.currentTime);
      
      // Use a lowpass to muffle the harsh square wave
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 400;
      drawingOsc.disconnect();
      drawingOsc.connect(filter);
      filter.connect(drawingGain);
      
      drawingGain.gain.setValueAtTime(0.02, ctx.currentTime);
      
      drawingOsc.start();
    }
  } else {
    if (drawingOsc && drawingGain) {
      const t = ctx.currentTime;
      drawingGain.gain.setTargetAtTime(0, t, 0.015);
      drawingOsc.stop(t + 0.05);
      
      drawingOsc = null;
      drawingGain = null;
    }
  }
};

// --- Music Sequencer (Synthwave Style) ---

const playKick = (time: number) => {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.setValueAtTime(100, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.3);
    
    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);

    osc.start(time);
    osc.stop(time + 0.3);
};

const playHiHat = (time: number) => {
     if (!ctx) return;
     const bufferSize = ctx.sampleRate * 0.05;
     const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
     const data = buffer.getChannelData(0);
     for (let i = 0; i < bufferSize; i++) {
         data[i] = Math.random() * 2 - 1;
     }
     
     const noise = ctx.createBufferSource();
     noise.buffer = buffer;
     
     // Highpass filter for crispness
     const filter = ctx.createBiquadFilter();
     filter.type = 'highpass';
     filter.frequency.value = 5000;
     
     const gain = ctx.createGain();
     
     noise.connect(filter);
     filter.connect(gain);
     gain.connect(ctx.destination);
     
     gain.gain.setValueAtTime(0.05, time);
     gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
     
     noise.start(time);
};

const playSynth = (time: number, freq: number, duration: number) => {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(freq, time);
    // Slight detune effect could be added with a second osc, but keeping it simple.

    // Filter Envelope (Pluck sound)
    filter.type = 'lowpass';
    filter.Q.value = 5;
    filter.frequency.setValueAtTime(200, time);
    filter.frequency.exponentialRampToValueAtTime(2000, time + 0.05);
    filter.frequency.exponentialRampToValueAtTime(200, time + duration);

    // Amp Envelope
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.1, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + duration);
}

const scheduleNote = (beatNumber: number, time: number) => {
    // 4/4 Beat
    const beatIndex = beatNumber % 16;
    
    // Kick on 1, 5, 9, 13 (Quarter notes)
    if (beatIndex % 4 === 0) playKick(time);
    
    // HiHats on off-beats
    if (beatIndex % 2 !== 0) playHiHat(time);

    // Simple Arpeggio Pattern (Am - F - C - G)
    // Root notes: A(220), F(174.6), C(261.6), G(196)
    // 4 bars loop, each bar is 16 steps? No, let's do 1 bar per chord.
    // Total loop = 64 steps.
    
    const measure = Math.floor(beatNumber / 16) % 4;
    const stepInMeasure = beatNumber % 16;

    let baseFreq = 220; // Am
    if (measure === 1) baseFreq = 174.6; // F
    if (measure === 2) baseFreq = 130.8; // C (Low)
    if (measure === 3) baseFreq = 196.0; // G

    // Arpeggio pattern: Root - 5th - Octave - 5th
    // 5th is roughly 1.5x freq. Octave is 2x.
    const root = baseFreq;
    const fifth = baseFreq * 1.5;
    const octave = baseFreq * 2;

    let noteToPlay = 0;
    
    // Play on every 2nd 16th note (8th notes)
    if (stepInMeasure % 2 === 0) {
        const arpStep = (stepInMeasure / 2) % 4;
        if (arpStep === 0) noteToPlay = root;
        if (arpStep === 1) noteToPlay = fifth;
        if (arpStep === 2) noteToPlay = octave;
        if (arpStep === 3) noteToPlay = fifth;
        
        if (noteToPlay > 0) {
            playSynth(time, noteToPlay, 0.4);
        }
    }
}

const nextNote = () => {
    // 16th notes
    const secondsPerNote = SECONDS_PER_BEAT / 4; 
    nextNoteTime += secondsPerNote;
    beatCount++;
}

const scheduler = () => {
    if (!ctx) return;
    while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD_TIME) {
        scheduleNote(beatCount, nextNoteTime);
        nextNote();
    }
    if (isPlayingMusic) {
        schedulerTimer = window.setTimeout(scheduler, LOOKAHEAD);
    }
}

export const startMusic = () => {
    if (isPlayingMusic) return;
    initAudio(); // Ensure ctx is ready
    if (!ctx) return;
    
    isPlayingMusic = true;
    beatCount = 0;
    // Start slightly in the future
    nextNoteTime = ctx.currentTime + 0.1;
    scheduler();
}

export const stopMusic = () => {
    isPlayingMusic = false;
    if (schedulerTimer) {
        clearTimeout(schedulerTimer);
        schedulerTimer = null;
    }
}