import React from 'react';
import { cn } from '../utils/cn';
import { Equation } from '../utils/equations';
import { DrawingCanvas, DrawingCanvasRef } from './DrawingCanvas';
import { Wizard } from './Wizard';

interface PlayerAreaProps {
  isPlayer1: boolean;
  isMe: boolean;
  hp: number;
  deck: Equation[];
  chosenEquation: Equation | null;
  opponentEquation: Equation | null;
  gameState: 'MENU' | 'LOBBY' | 'LOADING_OCR' | 'CHOOSING' | 'BATTLE' | 'ROUND_END' | 'GAME_OVER';
  onChooseEquation: (eq: Equation) => void;
  onSubmitAnswer: (canvasRef: any) => void;
  canvasRef: any;
  isSubmitting: boolean;
  isWinner: boolean;
  feedback: string | null;
  isBot?: boolean;
  onDrawAction?: (action: any) => void;
}

export const PlayerArea: React.FC<PlayerAreaProps> = ({
  isPlayer1,
  isMe,
  hp,
  deck,
  chosenEquation,
  opponentEquation,
  gameState,
  onChooseEquation,
  onSubmitAnswer,
  canvasRef,
  isSubmitting,
  isWinner,
  feedback,
  isBot,
  onDrawAction
}) => {
  const isDead = hp <= 0;

  let actionState: 'idle' | 'casting' | 'attack' | 'hurt' | 'dead' = 'idle';
  if (isDead) {
    actionState = 'dead';
  } else if (gameState === 'ROUND_END') {
    actionState = isWinner ? 'attack' : 'hurt';
  } else if (gameState === 'BATTLE') {
    actionState = 'casting';
  }

  return (
    <div className={cn(
      "flex-1 flex flex-col p-2 md:p-4 relative min-h-0",
      isPlayer1 ? "bg-[#1a1c2c]/80" : "bg-[#2a1b32]/80"
    )}>
      {/* Math Symbols in Sky */}
      <div className="hidden md:block absolute top-10 left-10 text-white/20 text-4xl font-pixel">π</div>
      <div className="hidden md:block absolute top-20 right-20 text-white/20 text-4xl font-pixel">Σ</div>
      <div className="hidden md:block absolute bottom-40 left-1/4 text-white/20 text-4xl font-pixel">√</div>

      {/* HP Bar */}
      <div className={cn(
        "flex gap-1 md:gap-2 absolute top-2 md:top-4 z-10",
        isPlayer1 ? "left-2 md:left-4" : "right-2 md:right-4 flex-row-reverse"
      )}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="relative w-6 h-6 md:w-8 md:h-8">
            {/* Pixel Heart Outline */}
            <div className="absolute inset-0 bg-black" style={{ clipPath: 'polygon(10% 30%, 30% 10%, 50% 30%, 70% 10%, 90% 30%, 90% 60%, 50% 100%, 10% 60%)' }}></div>
            {/* Pixel Heart Fill */}
            <div className={cn(
              "absolute inset-[2px]",
              i < hp ? "bg-[#e52521]" : "bg-[#2a1b32]"
            )} style={{ clipPath: 'polygon(10% 30%, 30% 10%, 50% 30%, 70% 10%, 90% 30%, 90% 60%, 50% 100%, 10% 60%)' }}></div>
          </div>
        ))}
      </div>

      {/* Character Area */}
      <div className="flex-1 flex items-center justify-center relative min-h-[60px] md:min-h-[100px]">
        <Wizard isPlayer1={isPlayer1} state={actionState} />
        
        {/* Attack Balloon */}
        {gameState === 'BATTLE' && chosenEquation && (
          <div className={cn(
            "absolute top-1/4 text-xs md:text-base p-2 md:p-4 pixel-panel animate-bounce z-20",
            isPlayer1 ? "right-1/4" : "left-1/4"
          )}>
            {chosenEquation.text}
          </div>
        )}
      </div>

      {/* Action Area */}
      <div className="h-36 md:h-64 flex flex-col gap-2 md:gap-4">
        {gameState === 'CHOOSING' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 md:gap-4 z-10">
            <h3 className="text-white text-xs md:text-base text-center leading-relaxed pixel-text-shadow">
              {!isMe ? "Opponent is choosing..." : isBot ? "Bot is choosing..." : "Choose an attack for your opponent!"}
            </h3>
            {isMe && !isBot && (
              <div className="flex gap-2 md:gap-4">
                {deck.map((eq, i) => (
                  <button
                    key={i}
                    onClick={() => onChooseEquation(eq)}
                    disabled={isBot}
                    className={cn(
                      "w-12 h-12 md:w-20 md:h-20 flex items-center justify-center text-[10px] md:text-sm shadow-[2px_2px_0px_0px_rgba(0,0,0,0.5)] md:shadow-[4px_4px_0px_0px_rgba(0,0,0,0.5)] border-2 md:border-4 transition-transform",
                      !isBot && "hover:scale-110 active:scale-95 active:translate-y-1 active:shadow-[0px_0px_0px_0px_rgba(0,0,0,0.5)]",
                      isBot && "opacity-80 cursor-not-allowed",
                      eq.difficulty === 'easy' ? "bg-[#4ade80] border-[#166534] text-[#14532d]" :
                      eq.difficulty === 'medium' ? "bg-[#facc15] border-[#854d0e] text-[#713f12]" :
                      "bg-[#f87171] border-[#991b1b] text-[#7f1d1d]"
                    )}
                  >
                    {eq.text}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {gameState === 'BATTLE' && chosenEquation && (
          <div className="flex-1 flex flex-col gap-1 md:gap-2 z-10 min-h-0">
            <div className="text-center text-white text-[10px] md:text-sm pixel-text-shadow">
              Solve to counter: <span className="text-[#f4b41b] ml-1 md:ml-2 text-sm md:text-lg font-bold">{chosenEquation.text}</span>
            </div>
            {opponentEquation && (
              <div className="text-center text-[#f87171] text-[8px] md:text-xs mb-1 pixel-text-shadow">
                Opponent solving: {opponentEquation.text} ({opponentEquation.damage} DMG)
              </div>
            )}
            <div className="flex-1 relative min-h-0">
              <DrawingCanvas 
                ref={canvasRef} 
                disabled={!isMe || isSubmitting || isDead || isBot}
                onDrawAction={onDrawAction}
                className="w-full h-full border-2 md:border-4 border-[#4a3b52] shadow-[inset_2px_2px_0px_0px_rgba(0,0,0,0.5)] md:shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,0.5)]"
              />
              {feedback && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pixel-panel px-2 py-1 md:px-4 md:py-2 text-[10px] md:text-sm font-bold z-20 animate-pulse whitespace-nowrap">
                  {feedback}
                </div>
              )}
              {isMe && !isBot && (
                <button
                  onClick={() => onSubmitAnswer(canvasRef)}
                  disabled={isSubmitting || isDead}
                  className="absolute bottom-1 right-1 md:bottom-2 md:right-2 pixel-btn px-2 py-1 md:px-4 md:py-2 text-[10px] md:text-xs z-10 disabled:opacity-50"
                >
                  {isSubmitting ? '...' : 'SUBMIT'}
                </button>
              )}
            </div>
          </div>
        )}

        {gameState === 'ROUND_END' && (
          <div className="flex-1 flex items-center justify-center z-10">
            <h2 className="text-xl md:text-2xl text-[#f4b41b] text-center leading-relaxed pixel-text-shadow">
              {isWinner ? 'WINNER!' : 'TOO SLOW!'}
            </h2>
          </div>
        )}
      </div>
    </div>
  );
};
