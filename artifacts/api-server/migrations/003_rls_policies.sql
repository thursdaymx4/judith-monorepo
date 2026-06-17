-- Migration 003: RLS policies for ask_logs + missing DELETE policies on
-- profiles & watch_snapshots.
-- Run once in Supabase Dashboard → SQL Editor.
-- Safe to re-run — every statement is IF NOT EXISTS or DROP-and-recreate.

-- ──────────────────────────────────────────────────────────────────────
-- ask_logs: 001_ask_logs.sql enabled RLS but never added policies. With
-- RLS on and no policy, the table is locked down (so this isn't a leak),
-- but the asymmetry is dangerous — anyone who ever flips RLS off in a
-- "let's debug" moment would expose every row. Add the three policies
-- we'd want (no DELETE: ask_logs is append-only telemetry, kept for
-- usage analytics).
-- ──────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS ask_logs_select_own ON ask_logs;
CREATE POLICY ask_logs_select_own
  ON ask_logs FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS ask_logs_insert_own ON ask_logs;
CREATE POLICY ask_logs_insert_own
  ON ask_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS ask_logs_update_own ON ask_logs;
CREATE POLICY ask_logs_update_own
  ON ask_logs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ──────────────────────────────────────────────────────────────────────
-- profiles: missing DELETE policy. Cascading delete from auth.users
-- handles forced cleanup, but user-initiated profile deletion paths
-- (currently only the api-server with service-role) bypass this. Add
-- an explicit policy so a future client-side delete works without RLS
-- panic.
-- ──────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS profiles_delete_own ON profiles;
CREATE POLICY profiles_delete_own
  ON profiles FOR DELETE
  USING (auth.uid() = id);

-- ──────────────────────────────────────────────────────────────────────
-- watch_snapshots: same — cascading delete handles forced cleanup but
-- there's no policy for user-initiated row removal.
-- ──────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS watch_snapshots_delete_own ON watch_snapshots;
CREATE POLICY watch_snapshots_delete_own
  ON watch_snapshots FOR DELETE
  USING (auth.uid() = user_id);
