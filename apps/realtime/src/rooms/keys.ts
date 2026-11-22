export function hostKey(roomId: string): string {
  return `lume:room:${roomId}:host`;
}

export function presenceKey(roomId: string): string {
  return `lume:room:${roomId}:presence`;
}

export function playbackKey(roomId: string): string {
  return `lume:room:${roomId}:playback`;
}

export function viewerKey(roomId: string): string {
  return `lume:room:${roomId}:viewers`;
}
