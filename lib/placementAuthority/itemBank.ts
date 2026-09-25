/**
 * Server-only fallback placement item bank (mathematics). Used when AI item
 * generation is unavailable so a placement never stalls offline-adjacent
 * schools. Answer keys live here, server-side only - a test forbids importing this module
 * from a client component. (Migrated from the former components/PlacementTest.tsx;
 * item h6 was dropped because its keyed answer was not among its options.)
 */

export type BankItem = {
  key: string;
  difficulty: number;
  prompt: string;
  options: string[];
  correctIndex: number;
};

export const PLACEMENT_ITEM_BANK: readonly BankItem[] = [
  { key: "e1", difficulty: 1, prompt: "What is 3 + 4?", options: ["5","6","7","9"], correctIndex: 2 },
  { key: "e2", difficulty: 1, prompt: "Which number is bigger?", options: ["12","9","7","5"], correctIndex: 0 },
  { key: "e3", difficulty: 1, prompt: "What is 9 - 3?", options: ["5","6","7","9"], correctIndex: 1 },
  { key: "e4", difficulty: 2, prompt: "What is half of 10?", options: ["2","3","4","5"], correctIndex: 3 },
  { key: "e5", difficulty: 2, prompt: "Which fraction is larger?", options: ["1/2","1/4","1/8","1/10"], correctIndex: 0 },
  { key: "e6", difficulty: 2, prompt: "What is 6 × 4?", options: ["20","22","24","26"], correctIndex: 2 },
  { key: "e7", difficulty: 3, prompt: "Solve: 35 + 27", options: ["62","52","57","64"], correctIndex: 0 },
  { key: "e8", difficulty: 3, prompt: "What is 81 ÷ 9?", options: ["7","8","9","10"], correctIndex: 2 },
  { key: "e9", difficulty: 3, prompt: "Which is the smallest number?", options: ["0.4","0.09","0.15","0.5"], correctIndex: 1 },
  { key: "e10", difficulty: 3, prompt: "A bag has 24 candies shared equally among 6 children. How many each?", options: ["3","4","5","6"], correctIndex: 1 },
  { key: "m1", difficulty: 2, prompt: "What is 3/4 + 1/2?", options: ["1","1 1/4","1 1/2","2"], correctIndex: 1 },
  { key: "m2", difficulty: 2, prompt: "Solve: 7 × 8", options: ["54","56","58","64"], correctIndex: 1 },
  { key: "m3", difficulty: 3, prompt: "What is 25% of 80?", options: ["15","18","20","25"], correctIndex: 2 },
  { key: "m4", difficulty: 3, prompt: "Solve for x: 3x = 27", options: ["6","7","8","9"], correctIndex: 3 },
  { key: "m5", difficulty: 3, prompt: "Which is equivalent to 0.75?", options: ["1/2","2/3","3/4","4/5"], correctIndex: 2 },
  { key: "m6", difficulty: 4, prompt: "The area of a rectangle is 48. If the length is 8, what is the width?", options: ["4","5","6","8"], correctIndex: 2 },
  { key: "m7", difficulty: 4, prompt: "Solve: 2(x + 3) = 16", options: ["4","5","6","7"], correctIndex: 1 },
  { key: "m8", difficulty: 4, prompt: "What is 1.2 × 0.5?", options: ["0.5","0.6","0.7","0.8"], correctIndex: 1 },
  { key: "h1", difficulty: 3, prompt: "Solve: 2x + 5 = 17", options: ["4","5","6","7"], correctIndex: 2 },
  { key: "h2", difficulty: 3, prompt: "Simplify: (x + 2)(x - 2)", options: ["x^2 + 4","x^2 - 4","x^2 - 2","x^2 + 2"], correctIndex: 1 },
  { key: "h3", difficulty: 4, prompt: "The line y = 2x + 1 has slope:", options: ["1","2","1/2","0"], correctIndex: 1 },
  { key: "h4", difficulty: 4, prompt: "Solve: x^2 = 81 (positive solution)", options: ["7","8","9","10"], correctIndex: 2 },
  { key: "h5", difficulty: 4, prompt: "What is 30% of 250?", options: ["50","60","70","75"], correctIndex: 3 },
  { key: "h7", difficulty: 5, prompt: "Simplify: 5x - 2x + 7", options: ["3x + 7","7x - 2","5x + 5","2x + 7"], correctIndex: 0 },
  { key: "h8", difficulty: 5, prompt: "If a line is perpendicular to y = 2x, its slope is:", options: ["-1/2","2","-2","1/2"], correctIndex: 0 },
];
