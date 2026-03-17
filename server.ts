import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";

type Difficulty = 'easy' | 'medium' | 'hard';
interface Equation {
  text: string;
  answer: string;
  difficulty: Difficulty;
  damage: number;
}

function generateDeck(): Equation[] {
  const deck: Equation[] = [];
  
  for (let i = 0; i < 3; i++) {
    const difficulty = i === 0 ? 'easy' : i === 1 ? 'medium' : 'hard';
    let text = '', answer = '', damage = 1;
    
    if (difficulty === 'easy') {
      // Easy: 1 to 9 + 1 to 9 OR 1 to 9 - 1 to 9 (positive)
      const isAdd = Math.random() > 0.5;
      if (isAdd) {
        const a = Math.floor(Math.random() * 9) + 1;
        const b = Math.floor(Math.random() * 9) + 1;
        text = `${a} + ${b}`;
        answer = (a + b).toString();
      } else {
        const a = Math.floor(Math.random() * 9) + 1;
        const b = Math.floor(Math.random() * 9) + 1;
        const max = Math.max(a, b);
        const min = Math.min(a, b);
        text = `${max} - ${min}`;
        answer = (max - min).toString();
      }
      damage = 1;
    } else if (difficulty === 'medium') {
      // Medium: Double digit +/-, simple multiplication, simple division
      const type = Math.floor(Math.random() * 4);
      if (type === 0) {
        const a = Math.floor(Math.random() * 41) + 10;
        const b = Math.floor(Math.random() * 41) + 10;
        text = `${a} + ${b}`;
        answer = (a + b).toString();
      } else if (type === 1) {
        const a = Math.floor(Math.random() * 80) + 20;
        const b = Math.floor(Math.random() * (a - 10)) + 10;
        text = `${a} - ${b}`;
        answer = (a - b).toString();
      } else if (type === 2) {
        const a = Math.floor(Math.random() * 8) + 2;
        const b = Math.floor(Math.random() * 4) + 2;
        text = `${a} x ${b}`;
        answer = (a * b).toString();
      } else {
        const b = Math.floor(Math.random() * 8) + 2;
        const a = Math.floor(Math.random() * 4) + 2;
        text = `${a * b} ÷ ${a}`;
        answer = b.toString();
      }
      damage = 2;
    } else {
      // Hard: Complex multiplication, powers, square roots, complex division
      const type = Math.floor(Math.random() * 4);
      if (type === 0) {
        const a = Math.floor(Math.random() * 7) + 6; // 6 to 12
        const b = Math.floor(Math.random() * 7) + 6; // 6 to 12
        text = `${a} x ${b}`;
        answer = (a * b).toString();
      } else if (type === 1) {
        const a = Math.floor(Math.random() * 11) + 2; // 2 to 12
        text = `${a}²`;
        answer = (a * a).toString();
      } else if (type === 2) {
        const a = Math.floor(Math.random() * 13) + 3; // 3 to 15
        text = `√${a * a}`;
        answer = a.toString();
      } else {
        const b = Math.floor(Math.random() * 11) + 5; // 5 to 15
        const a = Math.floor(Math.random() * 8) + 3; // 3 to 10
        text = `${a * b} ÷ ${a}`;
        answer = b.toString();
      }
      damage = 3;
    }
    
    deck.push({ text, answer, difficulty, damage });
  }
  return deck;
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

const rooms = new Map<string, Room>();

function createRoomId() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function initPlayer(id: string, isBot = false): PlayerData {
  return {
    id,
    isBot,
    hp: 3,
    deck: generateDeck(),
    chosenEquation: null,
    isSubmitting: false,
    isWinner: false,
    feedback: null
  };
}

function startRound(room: Room) {
  room.p1.deck = generateDeck();
  room.p1.chosenEquation = null;
  room.p1.isWinner = false;
  room.p1.feedback = null;
  room.p1.isSubmitting = false;

  if (room.p2) {
    room.p2.deck = generateDeck();
    room.p2.chosenEquation = null;
    room.p2.isWinner = false;
    room.p2.feedback = null;
    room.p2.isSubmitting = false;
  }

  room.gameState = 'CHOOSING';
  room.timer = 3;
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const io = new Server(server);
  const PORT = 3000;

  io.on('connection', (socket) => {
    socket.on('create_room', ({ mode }) => {
      const roomId = createRoomId();
      const room: Room = {
        id: roomId,
        p1: initPlayer(socket.id),
        p2: mode === 'PVE' ? initPlayer('BOT', true) : null,
        gameState: mode === 'PVE' ? 'CHOOSING' : 'LOBBY',
        timer: 3
      };
      rooms.set(roomId, room);
      socket.join(roomId);
      socket.emit('room_created', { roomId, playerIndex: 1 });
      
      if (mode === 'PVE') {
        startRound(room);
        io.to(roomId).emit('game_state', room);
      } else {
        io.to(roomId).emit('game_state', room);
      }
    });

    socket.on('join_room', ({ roomId }) => {
      const room = rooms.get(roomId.toUpperCase());
      if (room && !room.p2 && room.gameState === 'LOBBY') {
        room.p2 = initPlayer(socket.id);
        socket.join(room.id);
        socket.emit('room_joined', { roomId: room.id, playerIndex: 2 });
        startRound(room);
        io.to(room.id).emit('game_state', room);
      } else {
        socket.emit('error', 'Room not found or full');
      }
    });

    socket.on('choose_equation', (eq) => {
      const room = Array.from(rooms.values()).find(r => r.p1.id === socket.id || r.p2?.id === socket.id);
      if (!room || room.gameState !== 'CHOOSING') return;

      const isP1 = room.p1.id === socket.id;
      // Swap logic: P1 chooses for P2, P2 chooses for P1
      if (isP1) {
        if (room.p2) room.p2.chosenEquation = eq;
      } else {
        room.p1.chosenEquation = eq;
      }

      io.to(room.id).emit('game_state', room);

      if (room.p1.chosenEquation && room.p2?.chosenEquation) {
        room.gameState = 'BATTLE';
        io.to(room.id).emit('game_state', room);
        if (room.p2.isBot) handleBotBattle(room);
      }
    });

    socket.on('draw_action', (action) => {
      const room = Array.from(rooms.values()).find(r => r.p1.id === socket.id || r.p2?.id === socket.id);
      if (!room) return;
      socket.to(room.id).emit('opponent_draw_action', action);
    });

    socket.on('submit_answer', (text) => {
      const room = Array.from(rooms.values()).find(r => r.p1.id === socket.id || r.p2?.id === socket.id);
      if (!room || room.gameState !== 'BATTLE') return;

      const isP1 = room.p1.id === socket.id;
      const player = isP1 ? room.p1 : room.p2!;
      const opponent = isP1 ? room.p2! : room.p1;

      if (player.chosenEquation?.answer === text) {
        room.gameState = 'ROUND_END';
        player.isWinner = true;
        player.feedback = `DEALT ${player.chosenEquation.damage} DMG!`;
        opponent.hp = Math.max(0, opponent.hp - player.chosenEquation.damage);
        io.to(room.id).emit('game_state', room);

        setTimeout(() => {
          if (room.p1.hp <= 0 || room.p2!.hp <= 0) {
            room.gameState = 'GAME_OVER';
          } else {
            startRound(room);
          }
          io.to(room.id).emit('game_state', room);
        }, 2000);
      } else {
        player.feedback = text ? `SAW: ${text}` : 'TRY AGAIN!';
        io.to(room.id).emit('game_state', room);
        setTimeout(() => {
          player.feedback = null;
          io.to(room.id).emit('game_state', room);
        }, 1500);
      }
    });

    socket.on('play_again', () => {
      const room = Array.from(rooms.values()).find(r => r.p1.id === socket.id || r.p2?.id === socket.id);
      if (!room || room.gameState !== 'GAME_OVER') return;
      room.p1.hp = 3;
      if (room.p2) room.p2.hp = 3;
      startRound(room);
      io.to(room.id).emit('game_state', room);
    });

    socket.on('disconnect', () => {
      const room = Array.from(rooms.values()).find(r => r.p1.id === socket.id || r.p2?.id === socket.id);
      if (room) {
        io.to(room.id).emit('player_disconnected');
        rooms.delete(room.id);
      }
    });
  });

  function handleBotBattle(room: Room) {
    const eq = room.p2!.chosenEquation!;
    const duration = eq.difficulty === 'easy' ? 3000 : eq.difficulty === 'medium' ? 4500 : 6000;
    io.to(room.id).emit('bot_draw', { text: eq.answer, duration });

    setTimeout(() => {
      if (room.gameState === 'BATTLE') {
        room.gameState = 'ROUND_END';
        room.p2!.isWinner = true;
        room.p2!.feedback = `DEALT ${eq.damage} DMG!`;
        room.p1.hp = Math.max(0, room.p1.hp - eq.damage);
        io.to(room.id).emit('game_state', room);

        setTimeout(() => {
          if (room.p1.hp <= 0 || room.p2!.hp <= 0) {
            room.gameState = 'GAME_OVER';
          } else {
            startRound(room);
          }
          io.to(room.id).emit('game_state', room);
        }, 2000);
      }
    }, duration + 500);
  }

  setInterval(() => {
    for (const room of rooms.values()) {
      if (room.gameState === 'CHOOSING') {
        room.timer--;
        if (room.timer <= 0) {
          // P1 auto-chooses for P2
          if (room.p2 && !room.p2.chosenEquation) {
            room.p2.chosenEquation = room.p1.deck[Math.floor(Math.random() * room.p1.deck.length)];
          }
          // P2 auto-chooses for P1
          if (!room.p1.chosenEquation) {
            const deckToUse = room.p2 ? room.p2.deck : room.p1.deck;
            room.p1.chosenEquation = deckToUse[Math.floor(Math.random() * deckToUse.length)];
          }
          room.gameState = 'BATTLE';
          io.to(room.id).emit('game_state', room);
          if (room.p2?.isBot) handleBotBattle(room);
        } else {
          io.to(room.id).emit('timer_update', room.timer);
          
          // Bot auto-choose
          if (room.p2?.isBot && room.timer === 2 && !room.p1.chosenEquation) {
            // Bot chooses for P1
            room.p1.chosenEquation = room.p2.deck[Math.floor(Math.random() * room.p2.deck.length)];
            io.to(room.id).emit('game_state', room);
            if (room.p2.chosenEquation) { // If P1 already chose for P2
              room.gameState = 'BATTLE';
              io.to(room.id).emit('game_state', room);
              handleBotBattle(room);
            }
          }
        }
      }
    }
  }, 1000);

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
