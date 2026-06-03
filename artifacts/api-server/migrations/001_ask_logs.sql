-- Migration 001: ask_logs
-- Run once in Supabase Dashboard → SQL Editor
-- Safe to re-run (IF NOT EXISTS on all statements)

CREATE TABLE IF NOT EXISTS ask_logs (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at    timestamptz DEFAULT now(),
  persona       text,
  language      text,
  input_chars   int,
  reply_chars   int,
  tts_ok        boolean,
  input_tokens  int,
  output_tokens int
);

CREATE INDEX IF NOT EXISTS ask_logs_user_id_idx    ON ask_logs(user_id);
CREATE INDEX IF NOT EXISTS ask_logs_created_at_idx ON ask_logs(created_at);

ALTER TABLE ask_logs ENABLE ROW LEVEL SECURITY;
