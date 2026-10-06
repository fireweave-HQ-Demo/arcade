import type { Role } from "@arcade/shared";
import type { SessionRepository } from "../../domain/ports";
import { sql } from "./client";

export const sessionRepo: SessionRepository = {
  async create(token, userId, expiresAt) {
    await sql`
      INSERT INTO sessions (token, user_id, expires_at)
      VALUES (${token}, ${userId}, ${expiresAt})
    `;
  },

  async delete(token) {
    await sql`DELETE FROM sessions WHERE token = ${token}`;
  },

  async findUserByToken(token) {
    const [row] = await sql`
      SELECT u.id, u.username, u.role, s.token
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ${token} AND s.expires_at > NOW()
    `;
    if (!row) return null;
    return {
      id: row.id as number,
      username: row.username as string,
      role: row.role as Role,
      token: row.token as string,
    };
  },
};
