import { createSignal, createEffect, Show, For } from "solid-js";
import { createPeerConnection, type PeerMessage } from "./webrtc";

type Player = "X" | "O";
type Cell = Player | null;

const WIN_PATTERNS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function checkWinner(cells: Cell[]): { winner: Player | "draw" | null; line: number[] | null } {
  for (const pattern of WIN_PATTERNS) {
    const [a, b, c] = pattern;
    if (cells[a] && cells[a] === cells[b] && cells[a] === cells[c]) {
      return { winner: cells[a], line: pattern };
    }
  }
  if (cells.every((c) => c !== null)) {
    return { winner: "draw", line: null };
  }
  return { winner: null, line: null };
}

export default function App() {
  const [mode, setMode] = createSignal<"menu" | "host" | "guest">("menu");
  const [offerInput, setOfferInput] = createSignal("");
  const [answer, setAnswer] = createSignal("");
  const [copied, setCopied] = createSignal(false);

  const [cells, setCells] = createSignal<Cell[]>(Array(9).fill(null));
  const [myPlayer, setMyPlayer] = createSignal<Player>("X");
  const [isMyTurn, setIsMyTurn] = createSignal(true);
  const [gameResult, setGameResult] = createSignal<{ winner: Player | "draw" | null; line: number[] | null }>({ winner: null, line: null });

  const { status, localOffer, error, onMessage, createOffer, createAnswer, completeConnection, send, reset } = createPeerConnection();

  const isConnected = () => status() === "connected";

  createEffect(() => {
    onMessage((msg: PeerMessage) => {
      if (msg.type === "move") {
        const newCells = [...cells()];
        newCells[msg.index] = myPlayer() === "X" ? "O" : "X";
        setCells(newCells);
        setIsMyTurn(true);
        setGameResult(checkWinner(newCells));
      } else if (msg.type === "reset" || msg.type === "play-again") {
        setCells(Array(9).fill(null));
        setGameResult({ winner: null, line: null });
        setIsMyTurn(true);
      }
    });
  });

  function handleCellClick(index: number) {
    if (!isConnected() || !isMyTurn() || cells()[index] || gameResult().winner) return;
    const newCells = [...cells()];
    newCells[index] = myPlayer();
    setCells(newCells);
    setIsMyTurn(false);
    send({ type: "move", index });
    setGameResult(checkWinner(newCells));
  }

  function handleHost() {
    createOffer();
    setMode("host");
  }

  function handleGuest() {
    createAnswer(offerInput());
    setMode("guest");
    setMyPlayer("O");
    setIsMyTurn(false);
    const ans = localOffer();
    setTimeout(() => setAnswer(ans), 500);
  }

  function handleReset() {
    setCells(Array(9).fill(null));
    setGameResult({ winner: null, line: null });
    setIsMyTurn(myPlayer() === "X");
    send({ type: "reset" });
  }

  function copyOffer() {
    navigator.clipboard.writeText(localOffer());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function getStatusText() {
    if (status() === "connected") return "Connected!";
    if (status() === "connecting") return "Connecting...";
    return "Disconnected";
  }

  return (
    <div class="container">
      <h1 class="title">Tic Tac Toe 💕</h1>

      <Show when={!isConnected()}>
        <div class="menu">
          <Show when={mode() === "menu"}>
            <button class="btn btn-primary" onClick={handleHost}>Create Room</button>
            <button class="btn btn-secondary" onClick={() => setMode("guest")}>Join Room</button>
          </Show>

          <Show when={mode() === "host"}>
            <p class="info">Share this code with your partner:</p>
            <textarea class="code-box" readonly value={localOffer()} onClick={copyOffer} />
            <button class="btn btn-copy" onClick={copyOffer}>{copied() ? "Copied! 📋" : "Copy"}</button>
            <p class="info">Paste their answer here:</p>
            <textarea class="code-box" placeholder="Paste answer code..." value={offerInput()} onInput={(e) => setOfferInput(e.currentTarget.value)} />
            <button class="btn btn-primary" onClick={() => { completeConnection(offerInput()); setOfferInput(""); }}>Complete Connection</button>
            <p class="status">Status: {getStatusText()}</p>
          </Show>

          <Show when={mode() === "guest"}>
            <p class="info">Paste the code from your partner:</p>
            <textarea class="code-box" placeholder="Paste offer code here..." value={offerInput()} onInput={(e) => setOfferInput(e.currentTarget.value)} />
            <button class="btn btn-primary" onClick={handleGuest}>Connect</button>
            <Show when={answer()}>
              <p class="info">Send this back to your partner:</p>
              <textarea class="code-box" readonly value={answer()} onClick={() => navigator.clipboard.writeText(answer())} />
              <p class="status">Status: {getStatusText()}</p>
            </Show>
          </Show>

          <Show when={error()}>
            <p class="error">{error()}</p>
          </Show>
        </div>
      </Show>

      <Show when={isConnected()}>
        <div class="game-area">
          <p class="turn-indicator">
            {gameResult().winner
              ? gameResult().winner === "draw"
                ? "It's a draw! 🤝"
                : `${gameResult().winner === myPlayer() ? "You won! 🎉" : "You lost 😢"}`
              : isMyTurn()
                ? "Your turn! ✨"
                : "Waiting for partner..."}
          </p>

          <div class="board">
            <For each={cells()}>
              {(cell, i) => (
                <button
                  class="cell"
                  classList={{
                    "cell-x": cell === "X",
                    "cell-o": cell === "O",
                    "cell-winning": gameResult().line?.includes(i()),
                  }}
                  onClick={() => handleCellClick(i())}
                  disabled={!isMyTurn() || cell !== null || !!gameResult().winner}
                >
                  {cell}
                </button>
              )}
            </For>
          </div>

          <button class="btn btn-reset" onClick={handleReset}>Play Again 🔄</button>
          <button class="btn btn-disconnect" onClick={() => { reset(); setMode("menu"); setCells(Array(9).fill(null)); setGameResult({ winner: null, line: null }); }}>Disconnect</button>
        </div>
      </Show>
    </div>
  );
}