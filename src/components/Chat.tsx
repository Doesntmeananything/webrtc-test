import { createEffect, on, Show } from 'solid-js';
import type { Component } from 'solid-js';
import type { Player } from '../game';

type ChatMessage = {
  text: string;
  isMe: boolean;
  player: Player;
};

type ChatProps = {
  messages: ChatMessage[];
  onSend: (text: string) => void;
};

const Chat: Component<ChatProps> = (props) => {
  let inputRef: HTMLInputElement | undefined;
  let messagesContainerRef: HTMLDivElement | undefined;

  const handleSend = () => {
    if (inputRef?.value) {
      props.onSend(inputRef.value);
      inputRef.value = '';
    }
  };

  createEffect(on(() => props.messages.length, () => {
    if (messagesContainerRef) {
      messagesContainerRef.scrollTop = messagesContainerRef.scrollHeight;
    }
  }));

  return (
    <div class="chat">
      <div class="chat-messages" ref={messagesContainerRef}>
        <Show when={props.messages.length === 0} fallback={
          props.messages.map(msg => (
            <div class={`chat-message ${msg.isMe ? 'chat-message-you' : 'chat-message-partner'}`}>
              {msg.isMe ? `You (${msg.player})` : `Partner (${msg.player})`}: {msg.text}
            </div>
          ))
        }>
          <div class="chat-empty-state">
            💬 No messages yet...
            <br />
            <small>Send a message to your partner!</small>
          </div>
        </Show>
      </div>
      <div class="chat-input-group">
        <input
          class="chat-input"
          type="text"
          ref={inputRef}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
        />
        <button class="btn btn-primary" onClick={handleSend}>Send</button>
      </div>
    </div>
  );
};

export default Chat;
