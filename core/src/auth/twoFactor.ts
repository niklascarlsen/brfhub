import {encode} from 'uqr';

// The QR code an authenticator app scans, as the cells each client draws
// in its own way: true is dark.
export type QrCode = {size: number; cells: boolean[][]};

export function qrCodeOf(text: string): QrCode {
  const {size, data} = encode(text, {border: 0});
  return {size, cells: data};
}

// The secret spelled out for an app that cannot scan, in groups of four.
export function secretOf(totpUri: string): string {
  const secret = new URL(totpUri).searchParams.get('secret') ?? '';
  return secret.match(/.{1,4}/g)?.join(' ') ?? secret;
}
