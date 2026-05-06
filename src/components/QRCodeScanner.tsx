import type { Component } from 'solid-js';
import { onMount, onCleanup } from 'solid-js';

type QRCodeScannerProps = {
  onScan: (text: string) => void;
  onError?: (error: any) => void;
};

const QRCodeScanner: Component<QRCodeScannerProps> = (props) => {
  let scannerRef: HTMLDivElement | undefined;
  let html5Qrcode: any;

  onMount(async () => {
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      html5Qrcode = new Html5Qrcode('qr-reader');
      
      const config = { fps: 10, qrbox: { width: 250, height: 250 } };
      
      await html5Qrcode.start(
        { facingMode: 'environment' },
        config,
        (decodedText: string) => {
          props.onScan(decodedText);
        },
        (errorMessage: string) => {
          props.onError?.(errorMessage);
        }
      );
    } catch (err) {
      console.error('Failed to start QR scanner', err);
      props.onError?.(err);
    }
  });

  onCleanup(() => {
    if (html5Qrcode) {
      html5Qrcode.stop().catch(() => {});
    }
  });

  return (
    <div class="qr-scanner">
      <div id="qr-reader" ref={scannerRef} />
    </div>
  );
};

export default QRCodeScanner;
