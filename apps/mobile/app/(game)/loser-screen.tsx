import { EndGameScreen } from '@/components/end-game-panel';

export default function LoserScreen() {
  return <EndGameScreen won={false} />;
}
