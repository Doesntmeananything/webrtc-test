const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export type Message = 
  | { type: 'move'; row: number; col: number }
  | { type: 'rematch' }
  | { type: 'chat'; text: string }
  | { type: 'reset-scores' };

let peerConnection: RTCPeerConnection | null = null;
let dataChannel: RTCDataChannel | null = null;
let onMessageCallback: ((message: Message) => void) | null = null;
let onConnectCallback: (() => void) | null = null;
let onDisconnectCallback: (() => void) | null = null;

function encodeSDP(desc: RTCSessionDescriptionInit): string {
  const json = JSON.stringify(desc);
  const base64 = btoa(unescape(encodeURIComponent(json)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeSDP(str: string): RTCSessionDescriptionInit {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '=='.slice(0, (4 - base64.length % 4) % 4);
  const json = atob(padded);
  return JSON.parse(json);
}

function setupDataChannel(channel: RTCDataChannel) {
  channel.onopen = () => onConnectCallback?.();
  channel.onclose = () => onDisconnectCallback?.();
  channel.onmessage = (e) => {
    const message: Message = JSON.parse(e.data);
    onMessageCallback?.(message);
  };
}

function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
  return new Promise(resolve => {
    if (pc.iceGatheringState === 'complete') {
      resolve();
    } else {
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') resolve();
      };
    }
  });
}

export async function createHost(): Promise<string> {
  peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  dataChannel = peerConnection.createDataChannel('game');
  setupDataChannel(dataChannel);

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  await waitForIceGathering(peerConnection);

  return encodeSDP(peerConnection.localDescription!);
}

export async function joinGame(offerStr: string): Promise<string> {
  const offerDesc = decodeSDP(offerStr);
  peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  
  peerConnection.ondatachannel = (e) => {
    dataChannel = e.channel;
    setupDataChannel(dataChannel);
  };

  await peerConnection.setRemoteDescription(offerDesc);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  await waitForIceGathering(peerConnection);

  return encodeSDP(peerConnection.localDescription!);
}

export async function completeConnection(answerStr: string): Promise<void> {
  const answerDesc = decodeSDP(answerStr);
  await peerConnection!.setRemoteDescription(answerDesc);
}

export function sendMessage(message: Message): void {
  if (dataChannel?.readyState === 'open') {
    dataChannel.send(JSON.stringify(message));
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
