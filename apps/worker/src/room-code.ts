/**
 * Unambiguous characters for codes read out loud and typed on phones: no
 * 0/O, 1/I/L or U. 30 symbols, so 8 of them are ~39 bits.
 */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 8;
/** Bytes at or over this would favour the first characters: redrawn. */
const UNBIASED_LIMIT = 256 - (256 % ALPHABET.length);

/**
 * A new random room code, e.g. `K7MQ3XPD`. Knowing the code is what lets
 * someone into a private room, so it comes from the CSPRNG and is long
 * enough that guessing one of the live rooms is hopeless (put a rate
 * limit in front of `/rooms` before a public deploy anyway).
 */
export function newRoomCode(): string {
  let code = '';
  while (code.length < CODE_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(CODE_LENGTH))) {
      if (byte < UNBIASED_LIMIT && code.length < CODE_LENGTH) {
        code += ALPHABET[byte % ALPHABET.length];
      }
    }
  }
  return code;
}
