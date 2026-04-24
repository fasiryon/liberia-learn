export type GreetingInput = {
  studentName: string;
  time?: Date;
  avgGrade?: number;
  streakDays?: number;
  lastActiveDaysAgo?: number;
};

export type GreetingResult = {
  headline: string;
  subtext: string;
};

export function getStudentGreeting({
  studentName,
  time,
  avgGrade,
  streakDays,
  lastActiveDaysAgo,
}: GreetingInput): GreetingResult {
  const hour = (time ?? new Date()).getHours();
  const timeGreet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const headline = `${timeGreet}, ${studentName}.`;

  if (lastActiveDaysAgo !== undefined && lastActiveDaysAgo >= 3) {
    return { headline, subtext: "Welcome back — let’s pick up where you left off." };
  }
  if (streakDays !== undefined && streakDays >= 7) {
    return { headline, subtext: `${streakDays}-day learning streak — outstanding!` };
  }
  if (streakDays !== undefined && streakDays >= 3) {
    return { headline, subtext: `${streakDays} days in a row. Keep it up!` };
  }
  if (avgGrade !== undefined && avgGrade >= 85) {
    return { headline, subtext: "You’re performing excellently. Stay focused!" };
  }
  if (avgGrade !== undefined && avgGrade < 60) {
    return { headline, subtext: "Today is a great day to strengthen your skills." };
  }
  return { headline, subtext: "Ready to learn?" };
}
