import { createSignal } from "solid-js";

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export type PeerMessage =
  | { type: "move"; index: number }
  | { type: "reset" }
  | { type: "play-again" };

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  { urls: "stun:stun01.sipphone.com" },
  { urls: "stun:stun.ekiga.net" },
  { urls: "stun:stun.fwdnet.net" },
  { urls: "stun:stun.ideasip.com" },
  { urls: "stun:stun.iptel.org" },
  { urls: "stun:stun.rixtelecom.se" },
  { urls: "stun:stun.schlund.de" },
  { urls: "stun:stunserver.org" },
  { urls: "stun:stun.softjoys.com" },
  { urls: "stun:stun.voiparound.com" },
  { urls: "stun:stun.voipbuster.com" },
  { urls: "stun:stun.voipstunt.com" },
  { urls: "stun:stun.voxgratia.org" },
  { urls: "stun:stun.xten.com" },
  { urls: "stun:freestun.net:3478" },
  { urls: "turn:freestun.net:3478", username: "free", credential: "free" },
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
];

function log(msg: string, ...args: unknown[]) {
  console.log(`[WebRTC] ${msg}`, ...args);
}

export function createPeerConnection() {
  const [status, setStatus] = createSignal<ConnectionStatus>("disconnected");
  const [localOffer, setLocalOffer] = createSignal<string>("");
  const [error, setError] = createSignal<string>("");

  let pc: RTCPeerConnection | null = null;
  let dataChannel: RTCDataChannel | null = null;
  let onMessage: ((msg: PeerMessage) => void) | null = null;

  function handleMessage(event: MessageEvent) {
    log("Received message:", event.data);
    const data = JSON.parse(event.data) as PeerMessage;
    onMessage?.(data);
  }

function createOffer(): string {
    log("Creating offer...");
    cleanup();
    pc = new RTCPeerConnection({ 
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 0,
    });

    pc.oniceconnectionstatechange = () => {
      log("ICE connection state:", pc?.iceConnectionState);
      if (pc?.iceConnectionState === "connected" || pc?.iceConnectionState === "completed") {
        log("ICE connected!");
      }
    };

    log("Created peer connection, creating data channel");
    dataChannel = pc.createDataChannel("game", { ordered: true });
    dataChannel.onmessage = handleMessage;
    dataChannel.onopen = () => {
      log("Data channel OPEN!");
      setStatus("connected");
    };
    dataChannel.onerror = (e) => log("Data channel error:", e);
    dataChannel.onclose = () => log("Data channel closed");

    pc.createOffer().then((desc) => {
      log("Offer created, setting local description");
      pc!.setLocalDescription(desc);
    });

    pc.onicecandidate = (event) => {
      log("ICE candidate:", event.candidate?.address, event.candidate?.port, event.candidate?.type);
      if (event.candidate === null) {
        log("All ICE candidates gathered, emitting offer");
        setLocalOffer(JSON.stringify(pc!.localDescription));
      }
    };
    setStatus("connecting");
    return "";
  }

  function createAnswer(offer: string): string {
    log("Creating answer...");
    cleanup();
    pc = new RTCPeerConnection({ 
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 0,
    });

    pc.oniceconnectionstatechange = () => {
      log("ICE connection state:", pc?.iceConnectionState);
    };

    pc.ondatachannel = (event) => {
      log("Received data channel");
      dataChannel = event.channel;
      dataChannel.onmessage = handleMessage;
      dataChannel.onopen = () => {
        log("Data channel OPEN!");
        setStatus("connected");
      };
      dataChannel.onerror = (e) => log("Data channel error:", e);
      dataChannel.onclose = () => log("Data channel closed");
    };

    const desc = JSON.parse(offer);
    log("Setting remote description (offer)");
    pc.setRemoteDescription(desc).then(() => {
      log("Remote description set, creating answer");
      pc!.createAnswer().then((a) => {
        log("Answer created, setting local description");
        pc!.setLocalDescription(a);
      });
    });

    pc.onicecandidate = (event) => {
      log("ICE candidate:", event.candidate?.address, event.candidate?.port, event.candidate?.type);
      if (event.candidate === null) {
        log("All ICE candidates gathered, emitting answer");
        setLocalOffer(JSON.stringify(pc!.localDescription));
      }
    };
    setStatus("connecting");
    return "";
  }

  async function completeConnection(answer: string) {
    log("Completing connection with answer");
    if (!pc) {
      log("No peer connection!");
      return;
    }
    try {
      await pc.setRemoteDescription(JSON.parse(answer));
      log("Remote description (answer) set successfully, waiting for ICE...");

      pc.onnegotiationneeded = () => {
        log("Negotiation needed");
      };

      const checkInterval = setInterval(() => {
        log("Current ICE state:", pc?.iceConnectionState);
        if (pc?.iceConnectionState === "connected" || pc?.iceConnectionState === "completed") {
          log("ICE connected!");
          setStatus("connected");
          clearInterval(checkInterval);
        } else if (pc?.iceConnectionState === "failed" || pc?.iceConnectionState === "disconnected") {
          log("ICE failed/disconnected");
          setError("Connection failed");
          clearInterval(checkInterval);
        }
      }, 1000);
    } catch (e) {
      log("Failed to complete connection:", e);
      setError("Failed to complete connection");
    }
  }

  function send(msg: PeerMessage) {
    log("Sending:", msg);
    if (dataChannel?.readyState === "open") {
      dataChannel.send(JSON.stringify(msg));
    } else {
      log("Cannot send, data channel not open. State:", dataChannel?.readyState);
    }
  }

  function cleanup() {
    log("Cleaning up");
    dataChannel?.close();
    pc?.close();
    pc = null;
    dataChannel = null;
  }

  function reset() {
    cleanup();
    setLocalOffer("");
    setStatus("disconnected");
    setError("");
  }

  return {
    status,
    localOffer,
    error,
    onMessage: (fn: (msg: PeerMessage) => void) => {
      onMessage = fn;
    },
    createOffer,
    createAnswer,
    completeConnection,
    send,
    reset,
  };
}