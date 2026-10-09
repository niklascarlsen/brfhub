import {randomInt} from 'node:crypto';

// Read aloud or typed off a note, so no 0/o, 1/l/i or upper case.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const GROUPS = 3;
const GROUP_LENGTH = 4;

// Three groups of four from 31 characters: about 59 bits.
export function generatePassword(): string {
  return Array.from({length: GROUPS}, () =>
    Array.from(
      {length: GROUP_LENGTH},
      () => ALPHABET[randomInt(ALPHABET.length)],
    ).join(''),
  ).join('-');
}
