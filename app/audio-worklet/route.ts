import { AUDIO_CAPTURE_WORKLET } from '@/lib/constants/audio-worklet';
export function GET(): Response {
  return new Response(AUDIO_CAPTURE_WORKLET, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
