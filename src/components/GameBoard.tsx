import { For } from 'solid-js';
import type { Board, Player } from '../game';

type GameBoardProps = {
  board: Board;
  onCellClick: (row: number, col: number) => void;
  winningCells: [number, number][] | null;
  currentPlayer: Player;
  isMyTurn: boolean;
};

export function GameBoard(props: GameBoardProps) {
  function isWinningCell(row: number, col: number) {
    return props.winningCells?.some(([r, c]) => r === row && c === col) ?? false;
  }

  return (
    <div class="game-board">
      <div class="current-turn">Current turn: {props.currentPlayer}</div>
      <div class="board">
        <For each={props.board}>
          {(row, rowIdx) => (
            <For each={row}>
              {(cell, colIdx) => (
                <button
                  classList={{
                    cell: true,
                    'cell-x': cell === 'X',
                    'cell-o': cell === 'O',
                    'winning-cell': isWinningCell(rowIdx(), colIdx()),
                  }}
                  onClick={() => props.onCellClick(rowIdx(), colIdx())}
                  disabled={!props.isMyTurn || cell !== null}
                >
                  {cell}
                </button>
              )}
            </For>
          )}
        </For>
      </div>
    </div>
  );
}
