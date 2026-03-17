export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Equation {
  text: string;
  answer: string;
  difficulty: Difficulty;
  damage: number;
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateEquation(difficulty: Difficulty): Equation {
  let text = '';
  let answer = 0;
  let damage = 1;

  switch (difficulty) {
    case 'easy':
      damage = 1;
      if (Math.random() > 0.5) {
        const a = randomInt(1, 9);
        const b = randomInt(1, 9);
        text = `${a} + ${b}`;
        answer = a + b;
      } else {
        const a = randomInt(5, 15);
        const b = randomInt(1, a);
        text = `${a} - ${b}`;
        answer = a - b;
      }
      break;
    case 'medium':
      damage = 2;
      if (Math.random() > 0.6) {
        const a = randomInt(2, 9);
        const b = randomInt(2, 9);
        text = `${a} × ${b}`;
        answer = a * b;
      } else if (Math.random() > 0.3) {
        const b = randomInt(2, 9);
        const ans = randomInt(2, 9);
        const a = b * ans;
        text = `${a} ÷ ${b}`;
        answer = ans;
      } else {
        const a = randomInt(2, 12);
        text = `${a}²`;
        answer = a * a;
      }
      break;
    case 'hard':
      damage = 3;
      if (Math.random() > 0.5) {
        const ans = randomInt(10, 20);
        const a = ans * ans;
        text = `√${a}`;
        answer = ans;
      } else {
        const x = randomInt(2, 9);
        const a = randomInt(2, 5);
        const b = a * x;
        text = `${a}x = ${b}`;
        answer = x;
      }
      break;
  }

  return { text, answer: answer.toString(), difficulty, damage };
}

export function generateDeck(): Equation[] {
  return [
    generateEquation('easy'),
    generateEquation('medium'),
    generateEquation('hard'),
  ];
}
