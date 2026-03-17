import React, { useState, useEffect, useRef } from 'react';
import { initOCR, recognizeDigit } from './utils/ocr';
import { PlayerArea } from './components/PlayerArea';
import { DrawingCanvasRef } from './components/DrawingCanvas';
import confetti from 'canvas-confetti';
import { io, Socket } from 'socket.io-client';

type Difficulty = 'easy' | 'medium' | 'hard';
interface Equation {
  text: string;
  answer: string;
  difficulty: Difficulty;
  damage: number;
}

interface PlayerData {
  id: string;
  isBot: boolean;
  hp: number;
  deck: Equation[];
  chosenEquation: Equation | null;
  isSubmitting: boolean;
  isWinner: boolean;
  feedback: string | null;
}

interface Room {
  id: string;
  p1: PlayerData;
  p2: PlayerData | null;
  gameState: 'LOBBY' | 'CHOOSING' | 'BATTLE' | 'ROUND_END' | 'GAME_OVER';
  timer: number;
}

export default function App() {
  const [appState, setAppState] = useState<'MENU' | 'LOADING_OCR' | 'IN_GAME'>('MENU');
  const [roomState, setRoomState] = useState<Room | null>(null);
  const [myPlayerIndex, setMyPlayerIndex] = useState<1 | 2 | null>(null);
  const [roomIdInput, setRoomIdInput] = useState('');
  const [timer, setTimer] = useState(3);
  const [error, setError] = useState('');

  const socketRef = useRef<Socket | null>(null);
  const p1CanvasRef = useRef<DrawingCanvasRef>(null);
  const p2CanvasRef = useRef<DrawingCanvasRef>(null);

  useEffect(() => {
    socketRef.current = io();

    socketRef.current.on('room_created', ({ roomId, playerIndex }) => {
      setMyPlayerIndex(playerIndex);
      setAppState('IN_GAME');
    });

    socketRef.current.on('room_joined', ({ roomId, playerIndex }) => {
      setMyPlayerIndex(playerIndex);
      setAppState('IN_GAME');
    });

    socketRef.current.on('game_state', (state: Room) => {
      setRoomState(state);
      if (state.gameState === 'CHOOSING') {
        setTimer(state.timer);
        p1CanvasRef.current?.clear();
        p2CanvasRef.current?.clear();
      }
      if (state.gameState === 'GAME_OVER') {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
    });

    socketRef.current.on('timer_update', (t) => setTimer(t));

    socketRef.current.on('bot_draw', ({ text, duration }) => {
      p2CanvasRef.current?.simulateDrawing(text, duration);
    });

    socketRef.current.on('opponent_draw_action', (action) => {
      setMyPlayerIndex(prevIndex => {
        if (prevIndex === 1) {
          p2CanvasRef.current?.executeDrawAction(action);
        } else if (prevIndex === 2) {
          p1CanvasRef.current?.executeDrawAction(action);
        }
        return prevIndex;
      });
    });

    socketRef.current.on('error', (msg) => {
      setError(msg);
      setAppState('MENU');
    });

    socketRef.current.on('player_disconnected', () => {
      alert('Opponent disconnected!');
      setAppState('MENU');
      setRoomState(null);
      setMyPlayerIndex(null);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const handleCreateRoom = async (mode: 'PVE' | 'PVP') => {
    setAppState('LOADING_OCR');
    await initOCR();
    socketRef.current?.emit('create_room', { mode });
  };

  const handleJoinRoom = async () => {
    if (!roomIdInput.trim()) return;
    setAppState('LOADING_OCR');
    await initOCR();
    socketRef.current?.emit('join_room', { roomId: roomIdInput.trim() });
  };

  const handleChoose = (eq: any) => {
    socketRef.current?.emit('choose_equation', eq);
  };

  const handleDrawAction = (action: any) => {
    socketRef.current?.emit('draw_action', action);
  };

  const handleSubmit = async (canvasRef: any) => {
    const canvas = canvasRef.current?.getCanvas();
    if (!canvas) return;
    
    // Set local submitting state for immediate feedback
    if (roomState) {
      const isP1 = myPlayerIndex === 1;
      setRoomState(prev => {
        if (!prev) return prev;
        const next = { ...prev };
        if (isP1) next.p1.isSubmitting = true;
        else if (next.p2) next.p2.isSubmitting = true;
        return next;
      });
    }

    const text = await recognizeDigit(canvas);
    socketRef.current?.emit('submit_answer', text);
  };

  if (appState === 'MENU') {
    return (
      <div className="min-h-screen bg-[#1a1c2c] flex flex-col items-center justify-center text-white p-4" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=2342&auto=format&fit=crop")', backgroundSize: 'cover', backgroundPosition: 'center', backgroundBlendMode: 'overlay' }}>
        <div className="bg-black/60 p-8 border-4 border-[#4a3b52] shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)] flex flex-col items-center">
          <h1 className="text-4xl md:text-6xl mb-8 text-[#f4b41b] text-center leading-relaxed pixel-text-shadow">
            MATH MAGE<br/>DUEL
          </h1>
          <p className="text-sm md:text-base mb-12 max-w-md text-center text-[#d1d1d1] leading-relaxed">
            Combat: Math is Power! Resolve equations faster to defeat your rival in a pixelated duel.
          </p>
          
          {error && <div className="text-red-500 mb-4 font-bold">{error}</div>}

          <div className="flex flex-col gap-4 w-full max-w-xs">
            <button 
              onClick={() => handleCreateRoom('PVE')}
              className="pixel-btn text-sm md:text-base py-4 px-8 uppercase tracking-widest w-full"
            >
              1 PLAYER (VS BOT)
            </button>
            <button 
              onClick={() => handleCreateRoom('PVP')}
              className="pixel-btn text-sm md:text-base py-4 px-8 uppercase tracking-widest w-full bg-[#3b82f6] hover:bg-[#2563eb]"
            >
              CREATE ONLINE ROOM
            </button>
            <div className="flex gap-2 mt-4">
              <input 
                type="text" 
                placeholder="ROOM CODE" 
                value={roomIdInput}
                onChange={(e) => setRoomIdInput(e.target.value.toUpperCase())}
                className="flex-1 bg-black/50 border-2 border-[#4a3b52] text-white px-4 py-2 uppercase tracking-widest outline-none focus:border-[#f4b41b]"
                maxLength={4}
              />
              <button 
                onClick={handleJoinRoom}
                className="pixel-btn text-sm md:text-base py-2 px-4 uppercase tracking-widest bg-[#10b981] hover:bg-[#059669]"
              >
                JOIN
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (appState === 'LOADING_OCR') {
    return (
      <div className="min-h-screen bg-[#1a1c2c] flex flex-col items-center justify-center text-white">
        <div className="w-16 h-16 border-8 border-[#4a3b52] border-t-[#f4b41b] animate-spin mb-8"></div>
        <h2 className="text-sm md:text-base animate-pulse uppercase tracking-widest">Summoning Magic...</h2>
      </div>
    );
  }

  if (!roomState) return null;

  if (roomState.gameState === 'LOBBY') {
    return (
      <div className="min-h-screen bg-[#1a1c2c] flex flex-col items-center justify-center text-white p-4" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=2342&auto=format&fit=crop")', backgroundSize: 'cover', backgroundPosition: 'center', backgroundBlendMode: 'overlay' }}>
        <div className="bg-black/60 p-8 border-4 border-[#4a3b52] shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)] flex flex-col items-center text-center">
          <h2 className="text-2xl md:text-4xl mb-4 text-[#f4b41b] pixel-text-shadow">WAITING FOR OPPONENT</h2>
          <p className="mb-4 text-[#d1d1d1]">Share this code with your friend:</p>
          <div className="text-6xl tracking-widest bg-black/80 p-6 border-4 border-[#f4b41b] text-white mb-8">
            {roomState.id}
          </div>
          <div className="w-12 h-12 border-4 border-[#4a3b52] border-t-[#f4b41b] animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] bg-[#1a1c2c] flex flex-col md:flex-row overflow-hidden touch-none" style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=2342&auto=format&fit=crop")', backgroundSize: 'cover', backgroundPosition: 'center', backgroundBlendMode: 'overlay' }}>
      {/* Timer Overlay */}
      {roomState.gameState === 'CHOOSING' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
          <div className="text-6xl md:text-9xl text-[#f4b41b] pixel-text-shadow">
            {timer}
          </div>
        </div>
      )}

      {roomState.gameState === 'GAME_OVER' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-50 text-white">
          <div className="pixel-panel p-8 flex flex-col items-center">
            <h1 className="text-2xl md:text-4xl mb-8 text-[#f4b41b] text-center leading-relaxed pixel-text-shadow">
              {roomState.p1.hp > 0 ? 'PLAYER 1 WINS!' : roomState.p2?.hp! > 0 ? 'PLAYER 2 WINS!' : 'DRAW!'}
            </h1>
            <button 
              onClick={() => socketRef.current?.emit('play_again')}
              className="mt-8 pixel-btn text-sm md:text-base py-4 px-8 uppercase tracking-widest"
            >
              PLAY AGAIN
            </button>
          </div>
        </div>
      )}

      {/* Player 1 (Left/Top) */}
      <PlayerArea 
        isPlayer1={true}
        isMe={myPlayerIndex === 1}
        hp={roomState.p1.hp}
        deck={roomState.p1.deck}
        chosenEquation={roomState.p1.chosenEquation}
        opponentEquation={roomState.p2?.chosenEquation || null}
        gameState={roomState.gameState}
        onChooseEquation={handleChoose}
        onSubmitAnswer={() => handleSubmit(p1CanvasRef)}
        canvasRef={p1CanvasRef}
        isSubmitting={roomState.p1.isSubmitting}
        isWinner={roomState.p1.isWinner}
        feedback={roomState.p1.feedback}
        isBot={roomState.p1.isBot}
        onDrawAction={myPlayerIndex === 1 ? handleDrawAction : undefined}
      />

      {/* Player 2 (Right/Bottom) */}
      {roomState.p2 && (
        <PlayerArea 
          isPlayer1={false}
          isMe={myPlayerIndex === 2}
          hp={roomState.p2.hp}
          deck={roomState.p2.deck}
          chosenEquation={roomState.p2.chosenEquation}
          opponentEquation={roomState.p1.chosenEquation}
          gameState={roomState.gameState}
          onChooseEquation={handleChoose}
          onSubmitAnswer={() => handleSubmit(p2CanvasRef)}
          canvasRef={p2CanvasRef}
          isSubmitting={roomState.p2.isSubmitting}
          isWinner={roomState.p2.isWinner}
          feedback={roomState.p2.feedback}
          isBot={roomState.p2.isBot}
          onDrawAction={myPlayerIndex === 2 ? handleDrawAction : undefined}
        />
      )}
    </div>
  );
}
