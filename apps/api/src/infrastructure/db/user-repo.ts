import type { PublicUser, Role } from "@arcade/shared";
import type { UserRecord, UserRepository } from "../../domain/ports";
import { sql } from "./client";

export const userRepo: UserRepository = {
  async create(username, passwordHash, role: Role = "user") {
    const [row] = await sql`
      INSERT INTO users (username, password_hash, role)
      VALUES (${username}, ${passwordHash}, ${role})
      RETURNING id, username, role
    `;
    return { id: row.id, username: row.username, role: row.role as Role };
  },

  async findByUsername(username) {
    const [row] = await sql`
      SELECT id, username, password_hash, role FROM users WHERE username = ${username}
    `;
    if (!row) return null;
    return {
      id: row.id as number,
      username: row.username as string,
      role: row.role as Role,
      passwordHash: row.password_hash as string,
    } satisfies UserRecord;
  },

  async findById(id) {
    const [row] = await sql`SELECT id, username, role FROM users WHERE id = ${id}`;
    if (!row) return null;
    return { id: row.id, username: row.username, role: row.role as Role };
  },

  async ensureAdmin(username, passwordHash) {
    const existing = await this.findByUsername(username);
    if (existing) {
      await sql`
        UPDATE users SET role = 'admin', password_hash = ${passwordHash}
        WHERE username = ${username}
      `;
      return;
    }
    await this.create(username, passwordHash, "admin");
  },
};

export function toPublic(u: { id: number; username: string; role: Role }): PublicUser {
  return { id: u.id, username: u.username, role: u.role };
}
