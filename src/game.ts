export type Player = 'X' | 'O';
export type Cell = Player | null;
export type Board = Cell[][];

export function createInitialBoard(): Board {
  return Array(3).fill(null).map(() => Array(3).fill(null));
}

export function makeMove(board: Board, row: number, col: number, player: Player): Board | null {
  if (board[row][col] !== null) return null;
  const newBoard = board.map(r => [...r]);
  newBoard[row][col] = player;
  return newBoard;
}

export function checkWinner(board: Board): Player | null {
  // Rows
  for (let i = 0; i < 3; i++) {
    if (board[i][0] && board[i][0] === board[i][1] && board[i][1] === board[i][2]) {
      return board[i][0];
    }
  }
  // Columns
  for (let j = 0; j < 3; j++) {
    if (board[0][j] && board[0][j] === board[1][j] && board[1][j] === board[2][j]) {
      return board[0][j];
    }
  }
  // Diagonals
  if (board[0][0] && board[0][0] === board[1][1] && board[1][1] === board[2][2]) {
    return board[0][0];
  }
  if (board[0][2] && board[0][2] === board[1][1] && board[1][1] === board[2][0]) {
    return board[0][2];
  }
  return null;
}

export function checkDraw(board: Board): boolean {
  return board.every(row => row.every(cell => cell !== null)) && !checkWinner(board);
}

export type Score = {
  xWins: number;
  oWins: number;
  draws: number;
};

export function createInitialScore(): Score {
  return { xWins: 0, oWins: 0, draws: 0 };
}

export function getWinningCells(board: Board, winner: Player): [number, number][] | null {
  // Rows
  for (let i = 0; i < 3; i++) {
    if (board[i][0] === winner && board[i][1] === winner && board[i][2] === winner) {
      return [[i, 0], [i, 1], [i, 2]];
    }
  }
  // Columns
  for (let j = 0; j < 3; j++) {
    if (board[0][j] === winner && board[1][j] === winner && board[2][j] === winner) {
      return [[0, j], [1, j], [2, j]];
    }
  }
  // Diagonals
  if (board[0][0] === winner && board[1][1] === winner && board[2][2] === winner) {
    return [[0, 0], [1, 1], [2, 2]];
  }
  if (board[0][2] === winner && board[1][1] === winner && board[2][0] === winner) {
    return [[0, 2], [1, 1], [2, 0]];
  }
  return null;
}
