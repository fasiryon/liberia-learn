export function generateJitsiRoomId(classId: string, date: string, period: string): string {
  const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  const raw = `ll-${sanitize(classId)}-${sanitize(date)}-${sanitize(period)}`;
  return raw.slice(0, 64);
}

export function buildJoinUrl(roomId: string): string {
  return `https://meet.jit.si/${roomId}?config.startWithAudioMuted=false&config.prejoinPageEnabled=false`;
}
