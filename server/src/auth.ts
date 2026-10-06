import { sql } from "./db";

const SESSION_DAYS = 30;
const COOKIE = "tb_session";

function hashPassword(password: string, salt: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(`${salt}:${password}`);
  return hasher.digest("hex");
}

function makeToken(): string {
  return crypto.randomUUID() + crypto.randomUUID().replaceAll("-", "");
}

export function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").map((p) => {
      const [k, ...rest] = p.trim().split("=");
      return [k, decodeURIComponent(rest.join("="))];
    }),
  );
}

export function sessionCookie(token: string, maxAgeSec: number): string {
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}`;
}

export function clearSessionCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function register(username: string, password: string) {
  const name = username.trim().toLowerCase();
  if (name.length < 3 || name.length > 32) {
    throw new Error("Username must be 3–32 characters");
  }
  if (password.length < 4) {
    throw new Error("Password must be at least 4 characters");
  }

  const salt = crypto.randomUUID();
  const password_hash = `${salt}$${hashPassword(password, salt)}`;

  try {
    const [user] = await sql`
      INSERT INTO users (username, password_hash)
      VALUES (${name}, ${password_hash})
      RETURNING id, username
    `;
    return user;
  } catch (e: unknown) {
    if (String(e).includes("unique") || String(e).includes("duplicate")) {
      throw new Error("Username already taken");
    }
    throw e;
  }
}

export async function login(username: string, password: string) {
  const name = username.trim().toLowerCase();
  const [user] = await sql`
    SELECT id, username, password_hash FROM users WHERE username = ${name}
  `;
  if (!user) throw new Error("Invalid credentials");

  const [salt, hash] = String(user.password_hash).split("$");
  if (hashPassword(password, salt) !== hash) {
    throw new Error("Invalid credentials");
  }

  const token = makeToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await sql`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (${token}, ${user.id}, ${expires})
  `;

  return {
    user: { id: user.id as number, username: user.username as string },
    token,
    maxAge: SESSION_DAYS * 86400,
  };
}

export async function logout(token: string | undefined) {
  if (!token) return;
  await sql`DELETE FROM sessions WHERE token = ${token}`;
}

export async function getUserFromRequest(req: Request) {
  const cookies = parseCookies(req.headers.get("cookie"));
  const token = cookies[COOKIE];
  if (!token) return null;

  const [row] = await sql`
    SELECT u.id, u.username, s.token
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ${token} AND s.expires_at > NOW()
  `;
  if (!row) return null;
  return {
    id: row.id as number,
    username: row.username as string,
    token: row.token as string,
  };
}

export { COOKIE };
