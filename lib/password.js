import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

// scrypt 파라미터 (OWASP 권장 수준). 형식: scrypt:N:r:p:saltHex:hashHex
const N = 16384; // CPU/메모리 cost (2^14)
const R = 8;
const P = 1;
const KEYLEN = 64;

export function hashPassword(plain) {
  const salt = randomBytes(16);
  const hash = scryptSync(String(plain), salt, KEYLEN, { N, r: R, p: P });
  return `scrypt:${N}:${R}:${P}:${salt.toString('hex')}:${hash.toString('hex')}`;
}

// 상수시간 검증. 형식이 깨졌거나 사용자가 없을 때도 더미 연산을 수행해
// 타이밍 차이로 계정 존재 여부가 새지 않도록 한다.
export function verifyPassword(plain, stored) {
  const parts = typeof stored === 'string' ? stored.split(':') : [];
  if (parts[0] !== 'scrypt' || parts.length !== 6) {
    // 더미 연산 (타이밍 평탄화) 후 실패 반환
    scryptSync(String(plain), 'dummy-salt', KEYLEN, { N, r: R, p: P });
    return false;
  }
  const [, nStr, rStr, pStr, saltHex, hashHex] = parts;
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(String(plain), salt, expected.length, {
    N: Number(nStr),
    r: Number(rStr),
    p: Number(pStr),
  });
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
