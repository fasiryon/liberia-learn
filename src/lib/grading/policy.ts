import { GradePolicy } from "./types";

export function defaultPolicy(term: number): GradePolicy {
  return {
    term,
    weights: [
      { category: "Tests", weight: 0.4 },
      { category: "Homework", weight: 0.2 },
      { category: "Projects", weight: 0.3 },
      { category: "Participation", weight: 0.1 }
    ],
    latePolicy: {
      enabled: true,
      perDayPenaltyPercent: 5,
      maxPenaltyPercent: 30,
      graceDays: 1
    }
  };
}

