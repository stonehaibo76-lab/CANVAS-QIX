import React, { useState } from 'react';
import GameCanvas from './components/GameCanvas';
import { GameState, Difficulty } from './types';
import { DIFFICULTY_SETTINGS } from './constants';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
  
  // Image State
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [currentImg, setCurrentImg] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const pickRandomImage = () => {
      if (imageUrls.length > 0) {
          let rand = Math.floor(Math.random() * imageUrls.length);
          // Try to pick a different image if possible
          if (imageUrls.length > 1 && imageUrls[rand] === currentImg) {
               rand = (rand + 1) % imageUrls.length;
          }
          setCurrentImg(imageUrls[rand]);
      }
  };

  const handleSetGameState = (newState: GameState) => {
      if (newState === 'PLAYING' && (gameState === 'WON' || gameState === 'MENU' || gameState === 'LOST')) {
          pickRandomImage();
      }
      setGameState(newState);
  };

  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const urls: string[] = [];
      Array.from(files).forEach((file: any) => {
          if (file.type.startsWith('image/')) {
              urls.push(URL.createObjectURL(file));
          }
      });
      
      if (urls.length > 0) {
          setImageUrls(urls);
          setCurrentImg(urls[Math.floor(Math.random() * urls.length)]);
          setGameState('MENU');
          setProgress(0);
      } else {
          alert("No valid images found in folder.");
      }
    }
  };

  const diffConfig = DIFFICULTY_SETTINGS[difficulty];
  const targetPercent = (diffConfig.winPercent * 100).toFixed(0);
  const formattedProgress = (progress * 100).toFixed(1);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 font-sans text-gray-100">
      
      <div className="w-full max-w-2xl mb-4 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-2">
          CANVAS QIX
        </h1>
        <p className="text-gray-400 text-xs sm:text-sm">
          Capture <span className={diffConfig.color}>{targetPercent}%</span> of the area.
          Pick up <span className="text-yellow-300">S</span> for Speed and <span className="text-cyan-300">F</span> to Freeze enemies.
        </p>
      </div>

      {/* Difficulty Selector (Only visible in MENU) */}
      {gameState === 'MENU' && (
        <div className="flex gap-2 mb-4">
            {(Object.keys(DIFFICULTY_SETTINGS) as Difficulty[]).map((key) => {
                const conf = DIFFICULTY_SETTINGS[key];
                const isActive = difficulty === key;
                return (
                    <button
                        key={key}
                        onClick={() => setDifficulty(key)}
                        className={`px-4 py-1 rounded-full border text-sm font-bold transition-all ${
                            isActive 
                            ? `${conf.color} border-current bg-gray-800 shadow-[0_0_10px_currentColor]` 
                            : 'text-gray-500 border-gray-700 hover:border-gray-500'
                        }`}
                    >
                        {conf.label}
                    </button>
                )
            })}
        </div>
      )}

      <div className="relative mb-6">
        <GameCanvas 
          gameState={gameState} 
          setGameState={handleSetGameState} 
          backgroundImg={currentImg}
          onProgressUpdate={setProgress}
          difficulty={difficulty}
        />
        
        {/* Stats Bar */}
        <div className="mt-4 flex justify-between items-center bg-gray-800 p-4 rounded-lg shadow-lg border border-gray-700 w-full">
          <div>
            <span className="text-xs text-gray-400 uppercase tracking-widest block">Progress</span>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-mono font-bold ${progress >= diffConfig.winPercent ? 'text-green-400' : 'text-white'}`}>
                {formattedProgress}%
              </span>
              <span className="text-sm text-gray-500">/ {targetPercent}%</span>
            </div>
          </div>

          <div className="w-1/2 bg-gray-700 h-4 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-300 ${progress >= diffConfig.winPercent ? 'bg-green-500' : 'bg-cyan-500'}`}
              style={{ width: `${Math.min(100, progress * 100)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-2 items-center">
        <label className="flex items-center gap-2 cursor-pointer bg-gray-800 hover:bg-gray-700 px-6 py-3 rounded-lg border border-gray-600 transition shadow-lg">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          <span className="font-medium text-lg">Select Image Folder</span>
          <input 
            type="file" 
            {...({ webkitdirectory: "", directory: "" } as any)}
            multiple
            onChange={handleFolderUpload} 
            className="hidden" 
          />
        </label>
        <p className="text-xs text-gray-500">
            {imageUrls.length > 0 ? `${imageUrls.length} images loaded` : 'No folder loaded'}
        </p>
      </div>
      
    </div>
  );
};

export default App;