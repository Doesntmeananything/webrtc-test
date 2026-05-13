import type { Score } from '../game';

type ScoreBoardProps = {
  score: Score;
  onReset: () => void;
};

export function ScoreBoard(props: ScoreBoardProps) {
  return (
    <div class="score-board">
      <div class="score-item">
        <div class="score-label">X Wins</div>
        <div class="score-value">{props.score.xWins}</div>
      </div>
      <div class="score-item">
        <div class="score-label">O Wins</div>
        <div class="score-value">{props.score.oWins}</div>
      </div>
      <div class="score-item">
        <div class="score-label">Draws</div>
        <div class="score-value">{props.score.draws}</div>
        <button class="score-reset" onClick={props.onReset}>Reset</button>
      </div>
    </div>
  );
}
