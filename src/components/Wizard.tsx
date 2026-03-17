import React from 'react';
import { cn } from '../utils/cn';

interface WizardProps {
  isPlayer1: boolean;
  state: 'idle' | 'casting' | 'attack' | 'hurt' | 'dead';
}

const WIZARD_SPRITE = [
  "...........GG...",
  "......hhhh.GG...",
  ".....hHHHHh.S...",
  "....hHHHHHHh.S..",
  "...hHHHHHHHHhS..",
  "......FFFF...S..",
  ".....F0FF0F..S..",
  ".....FFFFFF.S...",
  "......BBBB..S...",
  ".....BBBBBB.S...",
  "....dRRRRRRdS...",
  "...dRRRRRRRdS...",
  "..dRRRRRRRRdS...",
  "..ddRRRRRRdd....",
  "...LL......LL...",
  "................"
];

export const Wizard: React.FC<WizardProps> = ({ isPlayer1, state }) => {
  const colors: Record<string, string> = {
    'H': isPlayer1 ? '#3b82f6' : '#ef4444',
    'h': isPlayer1 ? '#1d4ed8' : '#b91c1c',
    'R': isPlayer1 ? '#1e3a8a' : '#7f1d1d',
    'd': isPlayer1 ? '#172554' : '#450a0a',
    'G': isPlayer1 ? '#93c5fd' : '#fca5a5',
    'F': '#fcd34d',
    '0': '#000000',
    'B': '#e5e7eb',
    'S': '#78350f',
    'L': '#451a03',
  };

  return (
    <div className={cn("relative w-32 h-32 md:w-48 md:h-48 z-30", !isPlayer1 && "scale-x-[-1]")}>
      <div className={cn(
        "w-full h-full",
        state === 'idle' && "anim-float",
        state === 'casting' && "anim-cast",
        state === 'attack' && "anim-attack",
        state === 'hurt' && "anim-hurt",
        state === 'dead' && "opacity-50 grayscale rotate-90 translate-y-12 transition-all duration-500"
      )}>
        <svg viewBox="0 0 16 16" className="w-full h-full drop-shadow-[4px_4px_0px_rgba(0,0,0,0.5)]" shapeRendering="crispEdges">
          {WIZARD_SPRITE.map((row, y) => 
            row.split('').map((char, x) => {
              if (char === '.') return null;
              return (
                <rect 
                  key={`${x}-${y}`} 
                  x={x} 
                  y={y} 
                  width="1" 
                  height="1" 
                  fill={colors[char]} 
                  className={cn(
                    char === 'G' && state === 'casting' && "anim-pulse-gem"
                  )}
                />
              );
            })
          )}
        </svg>
      </div>
      
      {/* Projectile for attack state */}
      {state === 'attack' && (
        <div className="absolute top-1/4 left-3/4 w-8 h-8 rounded-full blur-[2px] anim-shoot z-50"
             style={{ 
               backgroundColor: colors['G'], 
               boxShadow: `0 0 20px ${colors['G']}, 0 0 40px ${colors['H']}` 
             }} 
        />
      )}
    </div>
  );
};
