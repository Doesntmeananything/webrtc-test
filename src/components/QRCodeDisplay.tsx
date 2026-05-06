import type { Component } from 'solid-js';
import { onMount, createSignal, Show } from 'solid-js';

type QRCodeDisplayProps = {
  text: string;
  size?: number;
};

const QRCodeDisplay: Component<QRCodeDisplayProps> = (props) => {
  const [qrUrl, setQrUrl] = createSignal('');

  onMount(async () => {
    try {
      const QRCode = await import('qrcode');
      const url = await QRCode.toDataURL(props.text, {
        width: props.size || 200,
        margin: 2,
      });
      setQrUrl(url);
    } catch (e) {
      console.error('Failed to generate QR code', e);
    }
  });

  return (
    <div class="qr-container">
      <Show when={qrUrl()}>
        <img src={qrUrl()} alt="QR Code" class="qr-code" />
      </Show>

    </div>
  );
};

export default QRCodeDisplay;
