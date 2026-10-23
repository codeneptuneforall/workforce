/**
 * `lottie-web` ships the light player as a plain deep import with no type
 * declarations beside it. This points that path at the package's own types.
 */
declare module 'lottie-web/build/player/lottie_light' {
  import type { LottiePlayer } from 'lottie-web';

  const player: LottiePlayer;
  export default player;
}
