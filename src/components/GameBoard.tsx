import type { Component } from 'solid-js';
import type { Board, Player } from '../game';

type GameBoardProps = {
  board: Board;
  onCellClick: (row: number, col: number) => void;
  winningCells: [number, number][] | null;
  currentPlayer: Player;
  isMyTurn: boolean;
};

const GameBoard: Component<GameBoardProps> = (props) => {
  const isWinningCell = (row: number, col: number) => {
    return props.winningCells?.some(([r, c]) => r === row && c === col) ?? false;
  };

  return (
    <div class="game-board">
      <div class="current-turn">Current turn: {props.currentPlayer}</div>
      <div class="board">
        {props.board.map((row, rowIdx) =>
          row.map((cell, colIdx) => (
            <button
              class={`cell ${cell ? `cell-${cell.toLowerCase()}` : ''} ${isWinningCell(rowIdx, colIdx) ? 'winning-cell' : ''}`}
              onClick={() => props.onCellClick(rowIdx, colIdx)}
              disabled={!props.isMyTurn || cell !== null}
            >
              {cell}
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default GameBoard;
