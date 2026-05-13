import { createEffect, on, For, Show } from 'solid-js';
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

export function Chat(props: ChatProps) {
  let inputRef: HTMLInputElement | undefined;
  let messagesContainerRef: HTMLDivElement | undefined;

  function handleSend() {
    if (inputRef?.value) {
      props.onSend(inputRef.value);
      inputRef.value = '';
    }
  }

  createEffect(on(() => props.messages.length, () => {
    if (messagesContainerRef) {
      messagesContainerRef.scrollTop = messagesContainerRef.scrollHeight;
    }
  }));

  return (
    <div class="chat">
      <div class="chat-messages" ref={messagesContainerRef}>
        <Show when={props.messages.length === 0} fallback={
          <For each={props.messages}>
            {(msg) => (
              <div classList={{ 'chat-message': true, 'chat-message-you': msg.isMe, 'chat-message-partner': !msg.isMe }}>
                {msg.isMe ? 'You' : 'Partner'}: {msg.text}
              </div>
            )}
          </For>
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
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Type a message..."
        />
        <button class="btn btn-primary" onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}
