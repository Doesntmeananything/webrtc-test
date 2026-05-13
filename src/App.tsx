import { createSignal, Show, Switch, Match } from 'solid-js';
import { GameBoard } from './components/GameBoard';
import { ScoreBoard } from './components/ScoreBoard';
import { Chat } from './components/Chat';
import { type Board, type Player, createInitialBoard, createInitialScore, makeMove, checkWinner, checkDraw, getWinningCells } from './game';
import { createHost, joinGame, sendMessage, onMessage, onConnect, onDisconnect, type Message } from './webrtc';

type ChatMessage = {
  text: string;
  isMe: boolean;
  player: Player;
};

type ConnectionStep = 'initial' | 'host-waiting' | 'connected';

export function App() {
  const [connectionStep, setConnectionStep] = createSignal<ConnectionStep>('initial');
  const [player, setPlayer] = createSignal<Player | null>(null);
  const [isHost, setIsHost] = createSignal(false);
  const [board, setBoard] = createSignal<Board>(createInitialBoard());
  const [currentPlayer, setCurrentPlayer] = createSignal<Player>('X');
  const [score, setScore] = createSignal(createInitialScore());
  const [chatMessages, setChatMessages] = createSignal<ChatMessage[]>([]);
  const [winningCells, setWinningCells] = createSignal<[number, number][] | null>(null);
  const [gameOver, setGameOver] = createSignal(false);
  const [roomCode, setRoomCode] = createSignal('');
  const [joinCode, setJoinCode] = createSignal('');
  const [isJoining, setIsJoining] = createSignal(false);
  const [joinError, setJoinError] = createSignal('');
  const [copyStatus, setCopyStatus] = createSignal('');

  function isMyTurn() {
    return connectionStep() === 'connected' && player() === currentPlayer() && !gameOver();
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopyStatus('Copied!');
      setTimeout(() => setCopyStatus(''), 2000);
    });
  }

  async function handleCreateHost() {
    try {
      const id = await createHost();
      setRoomCode(id);
      setPlayer(Math.random() < 0.5 ? 'X' : 'O');
      setIsHost(true);
      setConnectionStep('host-waiting');
    } catch (err) {
      console.error('Failed to create host', err);
    }
  }

  async function handleJoinGame() {
    const code = joinCode().trim();
    if (code.length !== 4 || !/^\d{4}$/.test(code)) return;
    setIsJoining(true);
    setJoinError('');
    try {
      await joinGame(code);
    } catch (err) {
      setJoinError('Failed to connect. Check the code and try again.');
      setIsJoining(false);
    }
  }

  function handleCellClick(row: number, col: number) {
    if (!isMyTurn() || gameOver()) return;
    const newBoard = makeMove(board(), row, col, player()!);
    if (newBoard) {
      setBoard(newBoard);
      sendMessage({ type: 'move', row, col });
      const winner = checkWinner(newBoard);
      if (winner) {
        const cells = getWinningCells(newBoard, winner);
        setWinningCells(cells);
        setGameOver(true);
        setScore(prev => ({
          ...prev,
          [winner === 'X' ? 'xWins' : 'oWins']: prev[winner === 'X' ? 'xWins' : 'oWins'] + 1
        }));
      } else if (checkDraw(newBoard)) {
        setGameOver(true);
        setScore(prev => ({ ...prev, draws: prev.draws + 1 }));
      } else {
        setCurrentPlayer(prev => prev === 'X' ? 'O' : 'X');
      }
    }
  }

  function handleRematch() {
    if (isHost()) {
      const newAssignment = Math.random() < 0.5 ? 'X' : 'O';
      setPlayer(newAssignment);
      sendMessage({ type: 'assign', hostPlayer: newAssignment });
    }
    setBoard(createInitialBoard());
    setWinningCells(null);
    setGameOver(false);
    setCurrentPlayer('X');
    sendMessage({ type: 'rematch' });
  }

  function handleSendChat(text: string) {
    sendMessage({ type: 'chat', text });
    setChatMessages(prev => [...prev, { text, isMe: true, player: player()! }]);
  }

  function handleResetScores() {
    setScore(createInitialScore());
    sendMessage({ type: 'reset-scores' });
  }

  onConnect(() => {
    if (isHost()) {
      sendMessage({ type: 'init', hostPlayer: player()! });
      setConnectionStep('connected');
    }
  });

  onDisconnect(() => {
    setConnectionStep('initial');
    setBoard(createInitialBoard());
    setCurrentPlayer('X');
    setWinningCells(null);
    setGameOver(false);
    setPlayer(null);
    setIsHost(false);
    setChatMessages([]);
    setScore(createInitialScore());
    setRoomCode('');
    setJoinCode('');
    setIsJoining(false);
    setJoinError('');
  });

  onMessage((message: Message) => {
    switch (message.type) {
      case 'init': {
        setPlayer(message.hostPlayer === 'X' ? 'O' : 'X');
        setCurrentPlayer('X');
        setIsJoining(false);
        setConnectionStep('connected');
        break;
      }
      case 'move': {
        const newBoard = makeMove(board(), message.row, message.col, currentPlayer());
        if (newBoard) {
          setBoard(newBoard);
          const winner = checkWinner(newBoard);
          if (winner) {
            const cells = getWinningCells(newBoard, winner);
            setWinningCells(cells);
            setGameOver(true);
            setScore(prev => ({
              ...prev,
              [winner === 'X' ? 'xWins' : 'oWins']: prev[winner === 'X' ? 'xWins' : 'oWins'] + 1
            }));
          } else if (checkDraw(newBoard)) {
            setGameOver(true);
            setScore(prev => ({ ...prev, draws: prev.draws + 1 }));
          } else {
            setCurrentPlayer(prev => prev === 'X' ? 'O' : 'X');
          }
        }
        break;
      }
      case 'assign': {
        setPlayer(message.hostPlayer === 'X' ? 'O' : 'X');
        break;
      }
      case 'rematch': {
        if (isHost()) {
          const newAssignment = Math.random() < 0.5 ? 'X' : 'O';
          setPlayer(newAssignment);
          sendMessage({ type: 'assign', hostPlayer: newAssignment });
        }
        setBoard(createInitialBoard());
        setWinningCells(null);
        setGameOver(false);
        setCurrentPlayer('X');
        break;
      }
      case 'chat': {
        const partnerPlayer = player() === 'X' ? 'O' : 'X';
        setChatMessages(prev => [...prev, { text: message.text, isMe: false, player: partnerPlayer }]);
        break;
      }
      case 'reset-scores': {
        setScore(createInitialScore());
        break;
      }
    }
  });

  return (
    <div class="app">
      <Switch>
        <Match when={connectionStep() === 'initial'}>
          <div class="connection-panel">
            <h2>Tic-Tac-Toe with Bae ❤️</h2>
            <div class="button-group">
              <button class="btn btn-primary" onClick={handleCreateHost}>Host Game</button>
            </div>
            <div style="margin-top: 1rem; border-top: 1px solid #e0d0ff; padding-top: 1rem;">
              <div class="input-group">
                <label>Or join a game:</label>
                <div style="display: flex; gap: 0.5rem;">
                  <input
                    type="text"
                    value={joinCode()}
                    onInput={(e) => setJoinCode(e.currentTarget.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="Enter 4-digit code..."
                    maxLength={4}
                    disabled={isJoining()}
                    style="flex: 1; padding: 0.5rem; border: 2px solid #e0d0ff; border-radius: 0.5rem; font-size: 0.8rem; text-align: center; letter-spacing: 0.25rem;"
                  />
                  <button class="btn btn-primary" onClick={handleJoinGame} disabled={isJoining() || !joinCode().trim()}>
                    {isJoining() ? 'Joining...' : 'Join'}
                  </button>
                </div>
                <Show when={joinError()}>
                  <p style="color: #dc3545; font-size: 0.85rem; margin-top: 0.25rem;">{joinError()}</p>
                </Show>
              </div>
            </div>
          </div>
        </Match>

        <Match when={connectionStep() === 'host-waiting'}>
          <div class="connection-panel" style="text-align: center;">
            <h2>Your Room Code</h2>
            <div
              style="font-size: 3rem; font-weight: bold; color: #ff6b9d; padding: 1.5rem; background: #f9f0ff; border-radius: 1rem; margin: 1rem 0; letter-spacing: 0.25rem; user-select: all;"
              onClick={() => handleCopy(roomCode())}
            >
              {roomCode()}
            </div>
            <div style="display: flex; gap: 0.5rem; justify-content: center; margin-bottom: 1rem;">
              <button class="btn btn-copy" style="max-width: 200px;" onClick={() => handleCopy(roomCode())}>
                {copyStatus() || 'Copy Code'}
              </button>
            </div>
            <p style="color: #666;">Share this code with your partner to play!</p>
            <div class="loading-spinner" style="margin-top: 1rem;">
              <div class="spinner" />
            </div>
            <p style="color: #999; font-size: 0.9rem; margin-top: 0.5rem;">Waiting for partner to connect...</p>
          </div>
        </Match>

        <Match when={connectionStep() === 'connected'}>
          <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            <div style="text-align: center; padding: 0.75rem; background-color: #d4edda; color: #155724; border-radius: 0.75rem; font-weight: bold;">
              Connected! You are {player()} ❤️
            </div>
            <GameBoard
              board={board()}
              onCellClick={handleCellClick}
              winningCells={winningCells()}
              currentPlayer={currentPlayer()}
              isMyTurn={isMyTurn()}
            />
            <Show when={gameOver()}>
              <div style="display: flex; flex-direction: column; align-items: center; gap: 0.75rem;">
                <div class="game-over">
                  {checkWinner(board()) ? `${checkWinner(board())} Wins!` : 'Draw!'}
                </div>
                <button class="rematch-btn" onClick={handleRematch}>Rematch</button>
              </div>
            </Show>
            <ScoreBoard score={score()} onReset={handleResetScores} />
            <Chat messages={chatMessages()} onSend={handleSendChat} />
          </div>
        </Match>
      </Switch>
    </div>
  );
}
