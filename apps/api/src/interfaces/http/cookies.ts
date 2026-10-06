const COOKIE = "arcade_session";

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

export function sessionTokenFromRequest(req: Request): string | undefined {
  return parseCookies(req.headers.get("cookie"))[COOKIE];
}

export { COOKIE };
