import {describe, expect, test} from 'vitest';

import {sv} from '../i18n/sv';
import {enableFailure, qrCodeOf, secretOf, verifyFailure} from './twoFactor';

const URI =
  'otpauth://totp/Boka:admin%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Boka';

describe('qrCodeOf', () => {
  test('gives a square of cells', () => {
    const qr = qrCodeOf(URI);

    expect(qr.size).toBeGreaterThan(20);
    expect(qr.cells).toHaveLength(qr.size);
    expect(qr.cells.every((row) => row.length === qr.size)).toBe(true);
    // The finder pattern in the top left corner is dark.
    expect(qr.cells[0]?.[0]).toBe(true);
  });
});

describe('secretOf', () => {
  test('spells the secret out in groups of four', () => {
    expect(secretOf(URI)).toBe('JBSW Y3DP EHPK 3PXP');
  });
});

describe('failures', () => {
  test('name what went wrong', () => {
    expect(enableFailure({status: 400, code: 'INVALID_PASSWORD'}, sv)).toBe(
      sv.twoFactor.wrongPassword,
    );
    expect(verifyFailure({status: 401, code: 'INVALID_CODE'}, sv)).toBe(
      sv.twoFactor.wrongCode,
    );
    expect(verifyFailure(null, sv)).toBe(sv.errors.NETWORK);
  });
});
