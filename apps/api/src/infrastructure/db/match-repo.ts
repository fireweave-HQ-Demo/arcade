import type { MatchResult, MatchStatus, ScoreRow } from "@arcade/shared";
import type { MatchRecord, MatchRepository } from "../../domain/ports";
import { sql } from "./client";

function mapMatch(row: Record<string, unknown>): MatchRecord {
  return {
    id: row.id as number,
    userId: row.user_id as number,
    gameId: row.game_id as string,
    state: row.state,
    status: row.status as MatchStatus,
    winner: (row.winner as MatchResult) ?? null,
  };
}

export const matchRepo: MatchRepository = {
  async findActive(userId, gameId) {
    const [row] = await sql`
      SELECT id, user_id, game_id, state, status, winner
      FROM matches
      WHERE user_id = ${userId} AND game_id = ${gameId} AND status = 'playing'
      ORDER BY id DESC LIMIT 1
    `;
    return row ? mapMatch(row) : null;
  },

  async create(userId, gameId, state) {
    const [row] = await sql`
      INSERT INTO matches (user_id, game_id, state, status)
      VALUES (${userId}, ${gameId}, ${sql.json(state as never)}, 'playing')
      RETURNING id, user_id, game_id, state, status, winner
    `;
    return mapMatch(row);
  },

  async update(match) {
    const [row] = await sql`
      UPDATE matches
      SET state = ${sql.json(match.state as never)},
          status = ${match.status},
          winner = ${match.winner},
          updated_at = NOW()
      WHERE id = ${match.id}
      RETURNING id, user_id, game_id, state, status, winner
    `;
    return mapMatch(row);
  },

  async abandonActive(userId, gameId) {
    await sql`
      UPDATE matches SET status = 'abandoned', updated_at = NOW()
      WHERE user_id = ${userId} AND game_id = ${gameId} AND status = 'playing'
    `;
  },

  async addEvent(event) {
    await sql`
      INSERT INTO match_events (match_id, actor, move, trace_id)
      VALUES (
        ${event.matchId},
        ${event.actor},
        ${sql.json((event.move ?? null) as never)},
        ${event.traceId ?? null}
      )
    `;
  },

  async scoreboardForUser(userId) {
    const rows = await sql`
      SELECT
        game_id AS "gameId",
        COUNT(*) FILTER (WHERE status = 'finished')::int AS played,
        COUNT(*) FILTER (WHERE winner = 'human_win')::int AS wins,
        COUNT(*) FILTER (WHERE winner = 'bot_win')::int AS losses,
        COUNT(*) FILTER (WHERE winner = 'draw')::int AS draws
      FROM matches
      WHERE user_id = ${userId}
      GROUP BY game_id
      ORDER BY game_id
    `;
    return rows as unknown as ScoreRow[];
  },

  async globalScoreboard(limit = 20) {
    const rows = await sql`
      SELECT
        u.username,
        COUNT(*) FILTER (WHERE m.status = 'finished')::int AS played,
        COUNT(*) FILTER (WHERE m.winner = 'human_win')::int AS wins,
        COUNT(*) FILTER (WHERE m.winner = 'bot_win')::int AS losses,
        COUNT(*) FILTER (WHERE m.winner = 'draw')::int AS draws
      FROM matches m
      JOIN users u ON u.id = m.user_id
      WHERE u.role = 'user'
      GROUP BY u.id, u.username
      HAVING COUNT(*) FILTER (WHERE m.status = 'finished') > 0
      ORDER BY wins DESC, played DESC
      LIMIT ${limit}
    `;
    return rows as unknown as Array<{
      username: string;
      played: number;
      wins: number;
      losses: number;
      draws: number;
    }>;
  },

  async popularity() {
    const rows = await sql`
      SELECT
        game_id AS "gameId",
        COUNT(*)::int AS plays,
        COUNT(*) FILTER (WHERE winner = 'human_win')::int AS "humanWins",
        COUNT(*) FILTER (WHERE winner = 'bot_win')::int AS "botWins",
        COUNT(*) FILTER (WHERE winner = 'draw')::int AS draws,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS "plays24h"
      FROM matches
      GROUP BY game_id
      ORDER BY plays DESC
    `;
    return rows as unknown as Array<{
      gameId: string;
      plays: number;
      humanWins: number;
      botWins: number;
      draws: number;
      plays24h: number;
    }>;
  },

  async recentMatches(limit = 25) {
    const rows = await sql`
      SELECT
        m.id,
        u.username,
        m.game_id AS "gameId",
        m.status,
        m.winner,
        m.created_at AS "createdAt"
      FROM matches m
      JOIN users u ON u.id = m.user_id
      ORDER BY m.id DESC
      LIMIT ${limit}
    `;
    return rows.map((r) => ({
      id: r.id as number,
      username: r.username as string,
      gameId: r.gameId as string,
      status: r.status as string,
      winner: (r.winner as MatchResult) ?? null,
      createdAt: String(r.createdAt),
    }));
  },
};
