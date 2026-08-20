-- =====================================================================
-- WASIF LAY — 0026: 'event' as a report target
--
-- Alone in its own migration on purpose: Postgres allows adding an enum
-- value inside a transaction, but not USING it in that same
-- transaction. 0027 uses it, so it has to be added and committed first.
-- =====================================================================

alter type report_target add value if not exists 'event';
