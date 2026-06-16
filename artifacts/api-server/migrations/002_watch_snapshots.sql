-- Migration 002: watch_snapshots
-- Latest local-first phone snapshot for direct Apple Watch reads.
-- Run once in Supabase Dashboard -> SQL Editor.

CREATE TABLE IF NOT EXISTS watch_snapshots (
  user_id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  payload          jsonb NOT NULL,
  ask_bills        jsonb NOT NULL,
  persona          text,
  currency         text,
  country_name     text,
  country_code     text,
  monthly_income   numeric,
  income_by_month  jsonb,
  pay_cycle        text,
  payday_day       int,
  payday_semi      jsonb,
  payday_weekday   int
);

CREATE INDEX IF NOT EXISTS watch_snapshots_updated_at_idx ON watch_snapshots(updated_at);

ALTER TABLE watch_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS watch_snapshots_select_own ON watch_snapshots;
CREATE POLICY watch_snapshots_select_own ON watch_snapshots
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS watch_snapshots_insert_own ON watch_snapshots;
CREATE POLICY watch_snapshots_insert_own ON watch_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS watch_snapshots_update_own ON watch_snapshots;
CREATE POLICY watch_snapshots_update_own ON watch_snapshots
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
