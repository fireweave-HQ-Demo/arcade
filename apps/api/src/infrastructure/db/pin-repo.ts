import { sql } from "./client";

export const pinRepo = {
  async list(userId: number): Promise<string[]> {
    const rows = await sql`
      SELECT game_id FROM pins WHERE user_id = ${userId} ORDER BY created_at ASC
    `;
    return rows.map((row) => row.game_id as string);
  },

  async add(userId: number, gameId: string): Promise<void> {
    await sql`INSERT INTO pins (user_id, game_id) VALUES (${userId}, ${gameId})`;
  },

  async remove(userId: number, gameId: string): Promise<boolean> {
    const rows = await sql`
      DELETE FROM pins WHERE user_id = ${userId} AND game_id = ${gameId} RETURNING game_id
    `;
    return rows.length > 0;
  },
};
