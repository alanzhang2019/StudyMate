// Minimal ambient type declarations for the `qrcode` package.
// `qrcode` ships no bundled types and we intentionally avoid adding
// `@types/qrcode` (which would touch pnpm-lock.yaml again); this covers
// the surface we actually use (client-side toDataURL).
declare module 'qrcode' {
  interface QRCodeOptions {
    width?: number;
    margin?: number;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    color?: { dark?: string; light?: string };
    type?: 'image/png' | 'image/jpeg' | 'image/webp';
  }

  interface QRCode {
    toDataURL(text: string, options?: QRCodeOptions): Promise<string>;
    toCanvas(
      canvas: HTMLCanvasElement,
      text: string,
      options?: QRCodeOptions,
    ): Promise<HTMLCanvasElement>;
    toString(text: string, options?: QRCodeOptions): Promise<string>;
  }

  const QRCode: QRCode;
  export default QRCode;
}
