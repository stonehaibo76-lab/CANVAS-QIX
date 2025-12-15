
import React, { useState, useRef, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import { GameState, Difficulty, GameConfig } from './types';
import { DIFFICULTY_SETTINGS } from './constants';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
  
  // Game Config State (initialized with Medium)
  const [gameConfig, setGameConfig] = useState<GameConfig>({
      qixCount: 1,
      hunterCount: DIFFICULTY_SETTINGS.MEDIUM.hunterCount,
      patrollerCount: DIFFICULTY_SETTINGS.MEDIUM.patrollerCount,
      qixSpeed: DIFFICULTY_SETTINGS.MEDIUM.qixSpeed,
      winPercent: DIFFICULTY_SETTINGS.MEDIUM.winPercent
  });
  
  // Image State
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [currentImg, setCurrentImg] = useState<string | null>(null);
  const [unlockedImages, setUnlockedImages] = useState<Set<string>>(new Set());
  const [showGallery, setShowGallery] = useState(false);
  
  // Stats
  const [progress, setProgress] = useState(0);
  const [score, setScore] = useState(0);

  // Fullscreen State
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Update Config when preset changes
  const handleDifficultyChange = (diff: Difficulty) => {
      setDifficulty(diff);
      if (diff !== 'CUSTOM') {
          const settings = DIFFICULTY_SETTINGS[diff];
          setGameConfig({
              qixCount: 1,
              hunterCount: settings.hunterCount,
              patrollerCount: settings.patrollerCount,
              qixSpeed: settings.qixSpeed,
              winPercent: settings.winPercent
          });
      }
  };

  const handleCustomConfigChange = (key: keyof GameConfig, value: number) => {
      setDifficulty('CUSTOM');
      setGameConfig(prev => ({ ...prev, [key]: value }));
  };

  const toggleFullscreen = () => {
      if (!document.fullscreenElement && gameContainerRef.current) {
          gameContainerRef.current.requestFullscreen().catch(err => {
              console.error(`Error attempting to enable fullscreen: ${err.message}`);
          });
      } else {
          if (document.exitFullscreen) {
              document.exitFullscreen();
          }
      }
  };

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
      if (newState === 'WON' && currentImg) {
          setUnlockedImages(prev => new Set(prev).add(currentImg));
      }

      if (newState === 'PLAYING' && (gameState === 'WON' || gameState === 'MENU' || gameState === 'LOST')) {
          pickRandomImage();
          setScore(0); // Reset score on new game
          setProgress(0);
      }
      setGameState(newState);
  };

  const handleRestart = () => {
      setGameState('MENU');
      setProgress(0);
      setScore(0);
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
          setScore(0);
          setUnlockedImages(new Set()); 
      } else {
          alert("未找到有效图片");
      }
    }
  };

  const diffColor = difficulty === 'CUSTOM' ? 'text-purple-400' : DIFFICULTY_SETTINGS[difficulty]?.color;
  const targetPercent = (gameConfig.winPercent * 100).toFixed(0);
  const formattedProgress = (progress * 100).toFixed(1);

  if (showGallery) {
      return (
        <div className="min-h-screen bg-gray-900 flex flex-col items-center p-8 font-sans text-gray-100 overflow-y-auto">
             <div className="w-full max-w-5xl">
                <div className="flex justify-between items-center mb-8 border-b border-gray-700 pb-4 flex-wrap gap-4">
                    <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-yellow-500">
                        解锁画廊
                    </h1>
                    <button 
                        onClick={() => setShowGallery(false)}
                        className="px-6 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-full font-bold transition text-sm sm:text-base"
                    >
                        ← 返回游戏
                    </button>
                </div>

                {unlockedImages.size === 0 ? (
                     <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-xl">暂无解锁图片。</p>
                        <p className="text-sm">通关以解锁更多内容！</p>
                     </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {Array.from(unlockedImages).map((url, idx) => (
                            <div key={idx} className="group relative aspect-[4/3] bg-gray-800 rounded-xl overflow-hidden shadow-xl border border-gray-700 hover:border-pink-500 transition-all transform hover:-translate-y-1">
                                <img src={url} alt={`Unlocked ${idx}`} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                     <a 
                                        href={url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="bg-white text-black px-4 py-2 rounded-full font-bold text-sm hover:scale-105 transition"
                                     >
                                        查看大图
                                     </a>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
             </div>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-4 font-sans text-gray-100 overflow-x-hidden">
      
      <div className="flex flex-col xl:flex-row gap-6 w-full max-w-[1600px] items-center xl:items-start justify-center">
            
            {/* LEFT COLUMN: Instructions */}
            <div className="w-full xl:w-80 flex-shrink-0 flex flex-col gap-4 order-2 xl:order-1">
                 <div className="bg-gray-800/80 p-6 rounded-xl border border-gray-700 shadow-xl backdrop-blur-sm">
                    <h3 className="text-xl font-bold text-cyan-400 mb-4 border-b border-gray-600 pb-2">游戏指南</h3>
                    
                    <div className="mb-4 text-sm text-gray-400 leading-relaxed">
                        <p className="font-bold text-gray-300 mb-1">操作与目标</p>
                        <p className="mb-2">
                            <strong>方向键</strong> 移动圈地。<br/>
                            <strong>空格键</strong> 发射子弹。<br/>
                        </p>
                    </div>

                    <div className="mb-2">
                        <p className="font-bold text-gray-300 mb-3 text-sm">强力道具</p>
                         <div className="space-y-3">
                            {/* Shotgun */}
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-lg">
                                    <div className="flex justify-center gap-0.5 mt-1">
                                         <div className="w-1.5 h-1.5 rounded-full bg-pink-500 translate-y-1 -translate-x-0.5"></div>
                                         <div className="w-1.5 h-1.5 rounded-full bg-pink-500 -translate-y-1"></div>
                                         <div className="w-1.5 h-1.5 rounded-full bg-pink-500 translate-y-1 translate-x-0.5"></div>
                                    </div>
                                </div>
                                <div>
                                    <span className="text-pink-400 font-bold text-xs block">散弹枪 (Shotgun)</span>
                                    <span className="text-[10px] text-gray-500">扇形发射3发子弹</span>
                                </div>
                            </div>
                             {/* Rapid Fire */}
                             <div className="flex items-center gap-3">
                                <div className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-lg">
                                    <div className="flex gap-0.5">
                                        <div className="w-1 h-3 rounded bg-orange-500"></div>
                                        <div className="w-1 h-3 rounded bg-orange-500"></div>
                                        <div className="w-1 h-3 rounded bg-orange-500"></div>
                                    </div>
                                </div>
                                <div>
                                    <span className="text-orange-400 font-bold text-xs block">机枪 (Machine Gun)</span>
                                    <span className="text-[10px] text-gray-500">超高射速</span>
                                </div>
                            </div>
                            {/* Time Slow */}
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-lg">
                                    <svg className="w-5 h-5 text-lime-400 fill-current" viewBox="0 0 24 24"><path d="M6 2h12v6l-4 4 4 4v6H6v-6l4-4-4-4V2z"/></svg>
                                </div>
                                <div>
                                    <span className="text-green-400 font-bold text-xs block">子弹时间 (Slow)</span>
                                    <span className="text-[10px] text-gray-500">敌人动作变慢</span>
                                </div>
                            </div>
                            {/* Freeze */}
                             <div className="flex items-center gap-3">
                                <div className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-lg">
                                    <svg className="w-5 h-5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07L19.07 4.93"/></svg>
                                </div>
                                <div>
                                    <span className="text-cyan-400 font-bold text-xs block">冻结 (Freeze)</span>
                                    <span className="text-[10px] text-gray-500">停止所有敌人</span>
                                </div>
                            </div>
                            {/* Speed */}
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-lg">
                                    <svg className="w-5 h-5 text-yellow-400 fill-current" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                                </div>
                                <div>
                                    <span className="text-yellow-400 font-bold text-xs block">加速 (Speed)</span>
                                    <span className="text-[10px] text-gray-500">大幅提升移速</span>
                                </div>
                            </div>
                            {/* Shield */}
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-lg">
                                    <svg className="w-5 h-5 text-blue-500 fill-current" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
                                </div>
                                <div>
                                    <span className="text-blue-400 font-bold text-xs block">护盾 (Shield)</span>
                                    <span className="text-[10px] text-gray-500">无敌一次</span>
                                </div>
                            </div>
                         </div>
                    </div>

                    <div className="mb-2">
                        <p className="font-bold text-red-400 mb-3 text-sm border-t border-gray-700 pt-2">危险陷阱</p>
                         <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-lg border border-red-900/50">
                                    <div className="flex -space-x-1">
                                        <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                                        <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                                    </div>
                                </div>
                                <div>
                                    <span className="text-purple-400 font-bold text-xs block">分身 (Clone)</span>
                                    <span className="text-[10px] text-gray-500">复制一个敌人</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-lg border border-red-900/50">
                                     <svg className="w-6 h-6 text-red-500" viewBox="0 0 24 24">
                                        <circle cx="12" cy="12" r="10" fill="currentColor" />
                                        <path d="M7 9 L10 11 L7 13 Z M17 9 L14 11 L17 13 Z" fill="black" />
                                        <path d="M9 16 Q12 13 15 16" stroke="black" strokeWidth="2" fill="none" />
                                     </svg>
                                </div>
                                <div>
                                    <span className="text-red-800 font-bold text-xs block">暴怒 (Rage)</span>
                                    <span className="text-[10px] text-gray-500">所有敌人进入狂暴</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-lg border border-red-900/50">
                                     <span className="text-pink-500 font-bold text-lg">?</span>
                                </div>
                                <div>
                                    <span className="text-pink-400 font-bold text-xs block">混乱 (Confusion)</span>
                                    <span className="text-[10px] text-gray-500">方向反转</span>
                                </div>
                            </div>
                             <div className="flex items-center gap-3">
                                <div className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-lg border border-red-900/50">
                                     <svg className="w-5 h-5 text-gray-500 fill-current" viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/><line x1="3" y1="3" x2="21" y2="21" stroke="red" strokeWidth="2"/></svg>
                                </div>
                                <div>
                                    <span className="text-gray-400 font-bold text-xs block">黑暗 (Darkness)</span>
                                    <span className="text-[10px] text-gray-500">视野受限</span>
                                </div>
                            </div>
                         </div>
                    </div>
                 </div>
            </div>

            {/* CENTER COLUMN: Game Area */}
            <div className="flex-1 flex flex-col items-center w-full max-w-[800px] order-1 xl:order-2">
                 <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-4 text-center">
                    CANVAS QIX
                 </h1>
                 
                {gameState === 'MENU' && (
                    <div className="flex gap-2 flex-wrap justify-center mb-4">
                        {(['EASY', 'MEDIUM', 'HARD', 'CUSTOM'] as Difficulty[]).map((key) => {
                            const conf = key === 'CUSTOM' ? { label: '自定义', color: 'text-purple-400' } : DIFFICULTY_SETTINGS[key];
                            const isActive = difficulty === key;
                            return (
                                <button
                                    key={key}
                                    onClick={() => handleDifficultyChange(key)}
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

                 {/* Game Wrapper for Fullscreen API */}
                 <div 
                    ref={gameContainerRef}
                    className={`relative w-full bg-black flex flex-col items-center justify-center transition-all duration-300 ${
                        isFullscreen 
                        ? 'fixed inset-0 z-50 w-screen h-screen max-w-none rounded-none border-none p-0' 
                        : 'rounded-xl border border-gray-700 shadow-2xl p-2 aspect-[4/3] max-h-[600px]'
                    }`}
                 >
                    {/* Fullscreen Button */}
                    <button 
                        onClick={toggleFullscreen}
                        className={`absolute z-30 p-2 bg-black/50 hover:bg-black/80 rounded text-white/70 hover:text-white transition ${isFullscreen ? 'top-4 right-4' : 'top-3 right-3'}`}
                        title={isFullscreen ? "退出全屏" : "全屏模式"}
                    >
                        {isFullscreen ? (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
                        )}
                    </button>

                    {/* Canvas Area */}
                    <div className="relative w-full flex-grow overflow-hidden flex items-center justify-center">
                        <GameCanvas 
                            gameState={gameState} 
                            setGameState={handleSetGameState} 
                            backgroundImg={currentImg}
                            onProgressUpdate={setProgress}
                            onScoreUpdate={setScore}
                            difficulty={difficulty}
                            config={gameConfig}
                            onOpenGallery={() => setShowGallery(true)}
                        />
                    </div>
                    
                    {/* Stats Bar */}
                    <div className={`w-full bg-gray-800 border-t border-gray-700 flex items-center justify-between px-4 py-2 ${isFullscreen ? 'absolute bottom-0 bg-gray-900/90 backdrop-blur-sm pb-4' : 'rounded-b-lg'}`}>
                         <div className="flex gap-8">
                             <div className="flex flex-col">
                                <span className="text-[10px] text-gray-400 uppercase tracking-widest">进度</span>
                                <div className="flex items-baseline gap-2">
                                    <span className={`text-xl font-mono font-bold ${progress >= gameConfig.winPercent ? 'text-green-400' : 'text-white'}`}>
                                        {formattedProgress}%
                                    </span>
                                    <span className="text-xs text-gray-500">/ {targetPercent}%</span>
                                </div>
                             </div>
                             <div className="flex flex-col">
                                <span className="text-[10px] text-gray-400 uppercase tracking-widest">分数</span>
                                <span className="text-xl font-mono font-bold text-yellow-400">
                                    {score.toLocaleString()}
                                </span>
                             </div>
                         </div>

                         <div className="flex items-center gap-4 flex-1 justify-end max-w-[40%]">
                             <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                                <div 
                                className={`h-full transition-all duration-300 ${progress >= gameConfig.winPercent ? 'bg-green-500' : 'bg-cyan-500'}`}
                                style={{ width: `${Math.min(100, progress * 100)}%` }}
                                ></div>
                            </div>
                            {gameState !== 'MENU' && (
                                <button 
                                    onClick={handleRestart}
                                    className="px-3 py-1 bg-red-900/50 hover:bg-red-800 border border-red-700 text-red-200 text-xs rounded transition whitespace-nowrap"
                                >
                                    重置
                                </button>
                            )}
                         </div>
                    </div>
                 </div>
            </div>

            {/* RIGHT COLUMN: Settings */}
            <div className="w-full xl:w-80 flex-shrink-0 flex flex-col gap-4 order-3 xl:order-3">
                 
                 {/* Custom Config Panel */}
                 <div className="bg-gray-800/80 p-6 rounded-xl border border-gray-700 shadow-xl backdrop-blur-sm">
                    <h3 className="text-xl font-bold text-purple-400 mb-4 border-b border-gray-600 pb-2 flex justify-between items-center">
                        <span>游戏设置</span>
                        {difficulty === 'CUSTOM' && <span className="text-xs bg-purple-900 text-purple-200 px-2 py-0.5 rounded">自定义</span>}
                    </h3>
                    
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                                <span>Boss (Qix) 数量</span>
                                <span className="text-purple-300">{gameConfig.qixCount}</span>
                            </div>
                            <input 
                                type="range" min="1" max="4" step="1"
                                value={gameConfig.qixCount}
                                onChange={(e) => handleCustomConfigChange('qixCount', parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                                <span>Hunter (追踪者)</span>
                                <span className="text-purple-300">{gameConfig.hunterCount}</span>
                            </div>
                            <input 
                                type="range" min="0" max="6" step="1"
                                value={gameConfig.hunterCount}
                                onChange={(e) => handleCustomConfigChange('hunterCount', parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                                <span>Patroller (巡逻者)</span>
                                <span className="text-purple-300">{gameConfig.patrollerCount}</span>
                            </div>
                            <input 
                                type="range" min="0" max="10" step="1"
                                value={gameConfig.patrollerCount}
                                onChange={(e) => handleCustomConfigChange('patrollerCount', parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                            />
                        </div>

                        <div>
                            <div className="flex justify-between text-xs text-gray-400 mb-1">
                                <span>Boss 速度</span>
                                <span className="text-purple-300">{gameConfig.qixSpeed.toFixed(1)}</span>
                            </div>
                            <input 
                                type="range" min="1.0" max="8.0" step="0.5"
                                value={gameConfig.qixSpeed}
                                onChange={(e) => handleCustomConfigChange('qixSpeed', parseFloat(e.target.value))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                            />
                        </div>
                    </div>
                 </div>

                 {/* Resource Loader */}
                 <div className="bg-gray-800/80 p-6 rounded-xl border border-gray-700 shadow-xl backdrop-blur-sm">
                    <h3 className="text-xl font-bold text-pink-500 mb-4 border-b border-gray-600 pb-2">资源加载</h3>
                    
                    <label className="flex flex-col items-center justify-center gap-2 cursor-pointer bg-gray-700/50 hover:bg-gray-700 border-2 border-dashed border-gray-600 hover:border-pink-500 rounded-lg p-6 transition group">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400 group-hover:text-pink-400 transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="font-medium text-sm text-gray-300 group-hover:text-white text-center">选择图片文件夹</span>
                        <input 
                            type="file" 
                            {...({ webkitdirectory: "", directory: "" } as any)}
                            multiple
                            onChange={handleFolderUpload} 
                            className="hidden" 
                        />
                    </label>

                    <div className="mt-4 text-xs text-gray-400 flex justify-between items-center bg-gray-900/50 p-3 rounded">
                        <span>当前图库</span>
                        <span className="font-mono text-white">{imageUrls.length} 张</span>
                    </div>

                    <button 
                        onClick={() => setShowGallery(true)}
                        disabled={unlockedImages.size === 0}
                        className={`w-full mt-4 py-2 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2 ${
                            unlockedImages.size > 0 
                            ? 'bg-pink-600 hover:bg-pink-500 text-white shadow-lg' 
                            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        }`}
                    >
                        <span>查看解锁画廊</span>
                        {unlockedImages.size > 0 && <span className="bg-white text-pink-600 px-1.5 rounded-full text-xs">{unlockedImages.size}</span>}
                    </button>
                 </div>
            </div>

      </div>
      
    </div>
  );
};

export default App;
