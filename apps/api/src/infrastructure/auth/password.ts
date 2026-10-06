export function hashPassword(password: string, salt: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(`${salt}:${password}`);
  return hasher.digest("hex");
}

export function makePasswordHash(password: string): string {
  const salt = crypto.randomUUID();
  return `${salt}$${hashPassword(password, salt)}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  return hashPassword(password, salt) === hash;
}

export function makeToken(): string {
  return crypto.randomUUID() + crypto.randomUUID().replaceAll("-", "");
}
