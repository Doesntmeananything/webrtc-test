import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import type { Player } from './game';

export type Message =
  | { type: 'init'; hostPlayer: Player }
  | { type: 'assign'; hostPlayer: Player }
  | { type: 'move'; row: number; col: number }
  | { type: 'rematch' }
  | { type: 'chat'; text: string }
  | { type: 'reset-scores' };

let peer: Peer | null = null;
let conn: DataConnection | null = null;

let onMessageCallback: ((message: Message) => void) | null = null;
let onConnectCallback: (() => void) | null = null;
let onDisconnectCallback: (() => void) | null = null;

function setupConnection(connection: DataConnection) {
  conn = connection;

  connection.on('data', (data: unknown) => {
    onMessageCallback?.(data as Message);
  });

  connection.on('close', () => {
    onDisconnectCallback?.();
  });

  if (connection.open) {
    onConnectCallback?.();
  } else {
    connection.on('open', () => {
      onConnectCallback?.();
    });
  }
}

function generateCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function createHost(): Promise<string> {
  let attempts = 0;
  const maxAttempts = 10;

  return new Promise((resolve, reject) => {
    function tryCreate() {
      if (attempts >= maxAttempts) {
        reject(new Error('Could not find an available room code'));
        return;
      }
      attempts++;

      const code = generateCode();
      peer = new Peer(code);

      peer!.on('open', () => {
        resolve(code);
      });

      peer!.on('connection', (connection: DataConnection) => {
        setupConnection(connection);
      });

      peer!.on('error', (err) => {
        if ((err as any).type === 'unavailable-id') {
          peer?.destroy();
          peer = null;
          tryCreate();
        } else {
          reject(err);
        }
      });
    }

    tryCreate();
  });
}

export async function joinGame(hostCode: string): Promise<void> {
  peer = new Peer();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Connection timed out'));
    }, 15000);

    peer!.on('open', () => {
      const connection = peer!.connect(hostCode);
      setupConnection(connection);
      clearTimeout(timeout);
      resolve();
    });

    peer!.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

export function sendMessage(message: Message): void {
  if (conn?.open) {
    conn.send(message);
  }
}

export function onMessage(callback: (message: Message) => void): void {
  onMessageCallback = callback;
}

export function onConnect(callback: () => void): void {
  onConnectCallback = callback;
}

export function onDisconnect(callback: () => void): void {
  onDisconnectCallback = callback;
}
