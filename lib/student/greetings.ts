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
    return { headline, subtext: "Welcome back — let's pick up where you left off." };
  }
  if (streakDays !== undefined && streakDays >= 7) {
    return { headline, subtext: `${streakDays}-day learning streak — outstanding!` };
  }
  if (streakDays !== undefined && streakDays >= 3) {
    return { headline, subtext: `${streakDays} days in a row. Keep it up!` };
  }
  if (avgGrade !== undefined && avgGrade >= 85) {
    return { headline, subtext: "You're performing excellently. Stay focused!" };
  }
  if (avgGrade !== undefined && avgGrade < 60) {
    return { headline, subtext: "Today is a great day to strengthen your skills." };
  }
  return { headline, subtext: "Ready to learn?" };
}

export type TeacherGreetingInput = {
  teacherName?: string | null;
  time?: Date;
  atRiskCount?: number;
  lessonsScheduledToday?: number;
};

export function getTeacherGreeting({
  teacherName,
  time,
  atRiskCount,
  lessonsScheduledToday,
}: TeacherGreetingInput): GreetingResult {
  const hour = (time ?? new Date()).getHours();
  const timeGreet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const headline = teacherName ? `${timeGreet}, ${teacherName}.` : `${timeGreet}.`;

  if (atRiskCount !== undefined && atRiskCount > 0) {
    return {
      headline,
      subtext: `You have ${atRiskCount} student${atRiskCount === 1 ? "" : "s"} needing support today.`,
    };
  }
  if (lessonsScheduledToday !== undefined && lessonsScheduledToday > 0) {
    return {
      headline,
      subtext: `You have ${lessonsScheduledToday} lesson${lessonsScheduledToday === 1 ? "" : "s"} scheduled for today.`,
    };
  }
  return { headline, subtext: "Let's check in on your class." };
}

export type GuardianGreetingInput = {
  guardianName?: string | null;
  time?: Date;
  childName?: string | null;
};

export function getGuardianGreeting({
  guardianName,
  time,
  childName,
}: GuardianGreetingInput): GreetingResult {
  const hour = (time ?? new Date()).getHours();
  const timeGreet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const headline = guardianName ? `${timeGreet}, ${guardianName}.` : `${timeGreet}.`;
  const subtext = childName
    ? `Here's an overview of ${childName}'s learning progress.`
    : "Monitor your child's learning progress and stay connected with their teacher.";
  return { headline, subtext };
}

export type MoeGreetingInput = {
  time?: Date;
};

export function getMoeGreeting({ time }: MoeGreetingInput = {}): GreetingResult {
  const hour = (time ?? new Date()).getHours();
  const timeGreet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return {
    headline: `${timeGreet}. National overview.`,
    subtext: "Aggregated indicators across all districts. No student-level data.",
  };
}
