import { getEnv } from "@/lib/cf";

/** A play of at least this many seconds counts as a stream (industry norm). */
export const STREAM_THRESHOLD_SEC = 30;
/** Slack allowed between reported seconds and real elapsed time. */
const WALL_CLOCK_SLACK_SEC = 10;

/**
 * Records listening progress for one play. Safe to call repeatedly (the
 * player sends a heartbeat every 15 s). Seconds can never exceed the real
 * time since the play started, nor the track's length, so a client can't
 * inflate its numbers by sending large values.
 */
export async function recordPlay(input: {
  playId: string;
  userId: string;
  trackId: string;
  bandId: string;
  isOwner: boolean;
  seconds: number;
  durationSec: number | null;
}) {
  const { DB } = await getEnv();
  const now = Date.now();
  const maxByLength = input.durationSec ? input.durationSec + 5 : 4 * 3600;
  await DB.prepare(
    `INSERT INTO plays (id, user_id, track_id, band_id, is_owner, seconds, started_at, updated_at)
     -- A brand-new play can't have lasted longer than the slack yet.
     VALUES (?1, ?2, ?3, ?4, ?5, MIN(?6, ?7, ?8), ?9, ?9)
     ON CONFLICT (id) DO UPDATE SET
       seconds = MIN(
         MAX(plays.seconds, ?6),
         CAST((?9 - plays.started_at) / 1000 AS INTEGER) + ?8,
         ?7
       ),
       updated_at = ?9
     WHERE plays.user_id = ?2 AND plays.track_id = ?3`,
  )
    .bind(
      input.playId,
      input.userId,
      input.trackId,
      input.bandId,
      input.isOwner ? 1 : 0,
      Math.max(0, Math.floor(input.seconds)),
      maxByLength,
      WALL_CLOCK_SLACK_SEC,
      now,
    )
    .run();
}

export type TrackStats = {
  track_id: string;
  streams: number;
  minutes: number;
  listeners: number;
};

/** Streams (≥ 30 s), minutes heard and unique listeners per track. */
export async function bandStats(bandId: string, from: number, to: number) {
  const { DB } = await getEnv();
  const { results } = await DB.prepare(
    `SELECT track_id,
            SUM(CASE WHEN seconds >= ?4 THEN 1 ELSE 0 END) AS streams,
            ROUND(SUM(seconds) / 60.0, 1) AS minutes,
            COUNT(DISTINCT user_id) AS listeners
       FROM plays
      WHERE band_id = ?1 AND started_at >= ?2 AND started_at < ?3 AND is_owner = 0
      GROUP BY track_id`,
  )
    .bind(bandId, from, to, STREAM_THRESHOLD_SEC)
    .all<TrackStats>();
  return results;
}
