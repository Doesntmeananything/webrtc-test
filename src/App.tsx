import { createSignal, onMount, Show, Switch, Match, type Component } from 'solid-js';
import GameBoard from './components/GameBoard';
import ScoreBoard from './components/ScoreBoard';
import Chat from './components/Chat';
import QRCodeDisplay from './components/QRCodeDisplay';
import { type Board, type Player, createInitialBoard, createInitialScore, makeMove, checkWinner, checkDraw, getWinningCells } from './game';
import { createHost, joinGame, completeConnection, sendMessage, onMessage, onConnect, onDisconnect, type Message } from './webrtc';
import './index.css';

type ChatMessage = {
  text: string;
  isMe: boolean;
  player: Player;
};

type ConnectionStep = 'initial' | 'host-offer-ready' | 'guest-offer-detected' | 'guest-answer-ready' | 'guest-page-reloaded' | 'connected';

const App: Component = () => {
  let pasteAnswerRef: HTMLInputElement | undefined;
  const [connectionStep, setConnectionStep] = createSignal<ConnectionStep>('initial');
  const [player, setPlayer] = createSignal<Player | null>(null);
  const [board, setBoard] = createSignal<Board>(createInitialBoard());
  const [currentPlayer, setCurrentPlayer] = createSignal<Player>('X');
  const [score, setScore] = createSignal(createInitialScore());
  const [chatMessages, setChatMessages] = createSignal<ChatMessage[]>([]);
  const [offerCode, setOfferCode] = createSignal('');
  const [winningCells, setWinningCells] = createSignal<[number, number][] | null>(null);
  const [gameOver, setGameOver] = createSignal(false);
  const [appUrl, setAppUrl] = createSignal('');
  const [answerCode, setAnswerCode] = createSignal('');
  const [copyStatus, setCopyStatus] = createSignal('');

  const isMyTurn = () => {
    return connectionStep() === 'connected' && player() === currentPlayer() && !gameOver();
  };

  const getBaseUrl = () => {
    return window.location.origin + window.location.pathname;
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopyStatus('Copied!');
      setTimeout(() => setCopyStatus(''), 2000);
    });
  };

  const handleCreateHost = async () => {
    // Clear any previous guest state
    localStorage.removeItem('ttt-offer');
    localStorage.removeItem('ttt-answer');
    
    setConnectionStep('host-offer-ready');
    const offer = await createHost();
    setOfferCode(offer);
    setPlayer('X');
    const url = `${getBaseUrl()}#offer=${offer}`;
    setAppUrl(url);
    setConnectionStep('host-offer-ready');
  };

  const handlePasteAnswer = async (answer: string) => {
    if (!answer.trim()) return;
    await completeConnection(answer.trim());
    setConnectionStep('connected');
  };

  const handleGuestOfferDetected = async (offer: string, isReload: boolean = false) => {
    // If this is a page reload, we can't restore the connection (peer connection is lost)
    // Show the page-reloaded message instead
    if (isReload) {
      setConnectionStep('guest-page-reloaded');
      return;
    }
    
    setOfferCode(offer);
    setConnectionStep('guest-offer-detected');
    const answer = await joinGame(offer);
    setPlayer('O');
    setAnswerCode(answer);
    
    // Save to localStorage so we can detect page reloads
    localStorage.setItem('ttt-offer', offer);
    localStorage.setItem('ttt-answer', answer);
    
    setConnectionStep('guest-answer-ready');
  };

  const handleCellClick = (row: number, col: number) => {
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
  };

  const handleRematch = () => {
    setBoard(createInitialBoard());
    setWinningCells(null);
    setGameOver(false);
    setCurrentPlayer('X');
    sendMessage({ type: 'rematch' });
  };

  const handleSendChat = (text: string) => {
    sendMessage({ type: 'chat', text });
    setChatMessages(prev => [...prev, { text, isMe: true, player: player()! }]);
  };

  const handleResetScores = () => {
    setScore(createInitialScore());
    sendMessage({ type: 'reset-scores' });
  };

  onConnect(() => {
    // Clear saved state since connection is established
    localStorage.removeItem('ttt-offer');
    localStorage.removeItem('ttt-answer');
    setConnectionStep('connected');
  });

  onDisconnect(() => {
    setConnectionStep('initial');
  });

  onMessage((message: Message) => {
    switch (message.type) {
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
      case 'rematch': {
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

  onMount(() => {
    const hash = window.location.hash.slice(1);
    if (hash.startsWith('offer=')) {
      const offer = hash.slice(6);
      
      // Check if this is a page reload by looking for saved state
      const savedOffer = localStorage.getItem('ttt-offer');
      const savedAnswer = localStorage.getItem('ttt-answer');
      
      if (savedOffer === offer && savedAnswer) {
        // Page reloaded, restore the state
        handleGuestOfferDetected(offer, true);
      } else {
        // First time processing this offer
        handleGuestOfferDetected(offer, false);
      }
    }
  });

  const renderStepIndicator = (step: number, total: number) => (
    <div class="step-indicator">
      {Array(total).fill(0).map((_, i) => (
        <div class={`step-dot ${i + 1 === step ? 'active' : i + 1 < step ? 'completed' : ''}`} />
      ))}
    </div>
  );

  return (
    <div class="app">
      <Switch>
        <Match when={connectionStep() === 'initial'}>
          <div class="connection-panel">
            <h2>Tic-Tac-Toe with Bae ❤️</h2>
            <div class="button-group">
              <button class="btn btn-primary" onClick={handleCreateHost}>Host Game</button>
            </div>
          </div>
        </Match>

        <Match when={connectionStep() === 'host-offer-ready'}>
          {renderStepIndicator(1, 3)}
          <div class="status-indicator status-step-1">
            Step 1: Share this code with your partner
          </div>
          <div class="connection-panel">
            <Show when={!offerCode()} fallback={
              <>
                <QRCodeDisplay text={appUrl()} />
                <div class="input-group" style="margin-top: 1rem;">
                  <label>Copy this link to send to your partner:</label>
                  <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <input type="text" value={appUrl()} readOnly style="flex: 1; padding: 0.5rem; border: 2px solid #e0d0ff; border-radius: 0.5rem; font-size: 0.8rem;" />
                    <button class="btn btn-copy" onClick={() => handleCopy(appUrl())}>
                      {copyStatus() || 'Copy'}
                    </button>
                  </div>
                </div>
                <div class="status-indicator status-step-2" style="margin-top: 1rem;">
                  Step 2: Paste the answer code from your partner below
                </div>
                <div class="input-group" style="margin-top: 1rem;">
                  <label>Paste answer code or URL here:</label>
                  <div style="display: flex; gap: 0.5rem;">
                    <input
                      ref={pasteAnswerRef}
                      type="text"
                      placeholder="Paste answer code or URL here..."
                      style="flex: 1; padding: 0.5rem; border: 2px solid #e0d0ff; border-radius: 0.5rem; font-size: 0.8rem;"
                    />
                    <button class="btn btn-primary" onClick={() => handlePasteAnswer(pasteAnswerRef?.value || '')}>Submit</button>
                  </div>
                </div>
              </>
            }>
              <div class="loading-spinner">
                <div class="spinner" />
              </div>
            </Show>
          </div>
        </Match>

        <Match when={connectionStep() === 'guest-offer-detected'}>
          {renderStepIndicator(2, 3)}
          <div class="status-indicator status-step-2">
            Step 2: Generating your answer code...
          </div>
          <div class="loading-spinner">
            <div class="spinner" />
          </div>
        </Match>

        <Match when={connectionStep() === 'guest-answer-ready'}>
          {renderStepIndicator(2, 3)}
          <div class="status-indicator status-step-2">
            Step 2: Send this code to your partner
          </div>
          <div class="connection-panel">
            <div class="input-group" style="margin-top: 1rem;">
              <label>Copy this answer code to send to your partner:</label>
              <div style="display: flex; gap: 0.5rem; align-items: center;">
                <input type="text" value={answerCode()} readOnly style="flex: 1; padding: 0.5rem; border: 2px solid #e0d0ff; border-radius: 0.5rem; font-size: 0.8rem;" />
                <button class="btn btn-copy" onClick={() => handleCopy(answerCode())}>
                  {copyStatus() || 'Copy'}
                </button>
              </div>
            </div>
            <div class="status-indicator status-step-2" style="margin-top: 1rem;">
              ⚠️ Don't close this page! After sending the code, wait here for the host to connect.
            </div>
          </div>
        </Match>

        <Match when={connectionStep() === 'guest-page-reloaded'}>
          {renderStepIndicator(2, 3)}
          <div class="status-indicator status-step-2">
            Step 2: Page Reloaded
          </div>
          <div class="connection-panel" style="text-align: center;">
            <p style="color: #856404; margin: 1rem 0; padding: 1rem; background-color: #fff3cd; border-radius: 0.75rem;">
              ⚠️ The page reloaded and the connection was lost.
              <br /><br />
              Please ask your partner to create a new game and send you a new offer code.
            </p>
            <button class="btn btn-secondary" onClick={() => {
              localStorage.removeItem('ttt-offer');
              localStorage.removeItem('ttt-answer');
              setConnectionStep('initial');
            }}>
              Start New Game
            </button>
          </div>
        </Match>

        <Match when={connectionStep() === 'connected'}>
          {renderStepIndicator(3, 3)}
          <div class="status-indicator status-step-3">
            Step 3: Connected! You are {player()} ❤️
          </div>
          <div class="connected-content">
            <GameBoard
              board={board()}
              onCellClick={handleCellClick}
              winningCells={winningCells()}
              currentPlayer={currentPlayer()}
              isMyTurn={isMyTurn()}
            />
            <Show when={gameOver()}>
              <div class="game-over">
                {checkWinner(board()) ? `${checkWinner(board())} Wins!` : 'Draw!'}
              </div>
              <button class="rematch-btn" onClick={handleRematch}>Rematch</button>
            </Show>
            <ScoreBoard score={score()} onReset={handleResetScores} />
            <Chat messages={chatMessages()} onSend={handleSendChat} />
          </div>
        </Match>
      </Switch>
    </div>
  );
};

export default App;
