import React, { useState, useRef, useEffect } from 'react';
import GameCanvas from './components/GameCanvas';
import { GameState, Difficulty } from './types';
import { DIFFICULTY_SETTINGS } from './constants';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>('MENU');
  const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
  
  // Image State
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [currentImg, setCurrentImg] = useState<string | null>(null);
  const [unlockedImages, setUnlockedImages] = useState<Set<string>>(new Set());
  const [showGallery, setShowGallery] = useState(false);
  const [progress, setProgress] = useState(0);

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
      }
      setGameState(newState);
  };

  const handleRestart = () => {
      setGameState('MENU');
      setProgress(0);
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
          setUnlockedImages(new Set()); 
      } else {
          alert("未找到有效图片");
      }
    }
  };

  const diffConfig = DIFFICULTY_SETTINGS[difficulty];
  const targetPercent = (diffConfig.winPercent * 100).toFixed(0);
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
            
            {/* LEFT COLUMN: Instructions (Hidden in Fullscreen) */}
            <div className="w-full xl:w-80 flex-shrink-0 flex flex-col gap-4 order-2 xl:order-1">
                 <div className="bg-gray-800/80 p-6 rounded-xl border border-gray-700 shadow-xl backdrop-blur-sm">
                    <h3 className="text-xl font-bold text-cyan-400 mb-4 border-b border-gray-600 pb-2">游戏指南</h3>
                    
                    <div className="mb-4 text-sm text-gray-400 leading-relaxed">
                        <p className="font-bold text-gray-300 mb-1">目标</p>
                        <p className="mb-2">使用方向键控制光标画线，圈出区域以解锁背景图片。</p>
                        <p className="mb-2">避开红色的 <strong>Qix</strong> 和其他敌人。移动到深色区域时会留下轨迹，轨迹未闭合前被敌人触碰即判定失败。</p>
                        <p>达到 <span className={diffConfig.color}>{targetPercent}%</span> 覆盖率即可过关。</p>
                    </div>

                    <div className="mb-2">
                        <p className="font-bold text-gray-300 mb-3 text-sm">道具说明</p>
                         <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-lg">
                                    <svg viewBox="0 0 20 20" className="w-5 h-5 text-cyan-400 stroke-current" style={{fill:'none', strokeWidth: 2}}><path d="M10 2 L17 6 L17 14 L10 18 L3 14 L3 6 Z" /><circle cx="10" cy="10" r="2" fill="currentColor" className="text-white border-none" /></svg>
                                </div>
                                <div>
                                    <span className="text-cyan-400 font-bold text-sm block">冻结</span>
                                    <span className="text-xs text-gray-500">停止所有敌人</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-lg">
                                    <svg viewBox="0 0 20 20" className="w-5 h-5 text-yellow-400 fill-current"><path d="M13 2 L6 10 L11 10 L7 18 L15 8 L10 8 Z" /></svg>
                                </div>
                                <div>
                                    <span className="text-yellow-400 font-bold text-sm block">加速</span>
                                    <span className="text-xs text-gray-500">大幅提升移速</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-lg">
                                    <svg viewBox="0 0 20 20" className="w-5 h-5 text-blue-500 stroke-white" style={{fill:'currentColor', strokeWidth: 1.5}}><path d="M10 2 C10 2 16 4 16 9 C16 14 10 18 10 18 C10 18 4 14 4 9 C4 4 10 2 10 2 Z" /></svg>
                                </div>
                                <div>
                                    <span className="text-blue-400 font-bold text-sm block">护盾</span>
                                    <span className="text-xs text-gray-500">免疫一次伤害</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 flex items-center justify-center bg-gray-700 rounded-lg">
                                     <svg viewBox="0 0 20 20" className="w-5 h-5 text-lime-400 fill-current"><path d="M5 2 L15 2 L10 9 L15 16 L5 16 L10 9 Z" /></svg>
                                </div>
                                <div>
                                    <span className="text-lime-400 font-bold text-sm block">减速</span>
                                    <span className="text-xs text-gray-500">敌人速度减半</span>
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
                 
                 {/* Difficulty Selector (Only visible in MENU) */}
                {gameState === 'MENU' && (
                    <div className="flex gap-2 flex-wrap justify-center mb-4">
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

                    {/* Canvas Area - Flex Grow to take available space in fullscreen */}
                    <div className="relative w-full flex-grow overflow-hidden flex items-center justify-center">
                        <GameCanvas 
                            gameState={gameState} 
                            setGameState={handleSetGameState} 
                            backgroundImg={currentImg}
                            onProgressUpdate={setProgress}
                            difficulty={difficulty}
                            onOpenGallery={() => setShowGallery(true)}
                        />
                    </div>
                    
                    {/* Stats Bar */}
                    <div className={`w-full bg-gray-800 border-t border-gray-700 flex items-center justify-between px-4 py-2 ${isFullscreen ? 'absolute bottom-0 bg-gray-900/90 backdrop-blur-sm pb-4' : 'rounded-b-lg'}`}>
                         <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 uppercase tracking-widest">进度</span>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-xl font-mono font-bold ${progress >= diffConfig.winPercent ? 'text-green-400' : 'text-white'}`}>
                                    {formattedProgress}%
                                </span>
                                <span className="text-xs text-gray-500">/ {targetPercent}%</span>
                            </div>
                         </div>

                         <div className="flex items-center gap-4 flex-1 justify-end max-w-[50%]">
                             <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                                <div 
                                className={`h-full transition-all duration-300 ${progress >= diffConfig.winPercent ? 'bg-green-500' : 'bg-cyan-500'}`}
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

            {/* RIGHT COLUMN: Loader & Settings */}
            <div className="w-full xl:w-80 flex-shrink-0 flex flex-col gap-4 order-3 xl:order-3">
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