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

export async function createHost(): Promise<string> {
  peer = new Peer();

  return new Promise((resolve, reject) => {
    peer!.on('open', (id: string) => {
      resolve(id);
    });

    peer!.on('connection', (connection: DataConnection) => {
      setupConnection(connection);
    });

    peer!.on('error', (err) => {
      reject(err);
    });
  });
}

export async function joinGame(hostId: string): Promise<void> {
  peer = new Peer();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Connection timed out'));
    }, 15000);

    peer!.on('open', () => {
      const connection = peer!.connect(hostId);
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


