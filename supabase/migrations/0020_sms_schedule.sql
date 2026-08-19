-- =====================================================================
-- WASIF LAY — 0020: SMS scheduling
--
-- Vercel's Hobby plan allows one cron run per day, which is useless for
-- "someone answered your question" — and the invalid schedule blocked
-- every deployment, not just the cron.
--
-- Scheduling from Postgres instead: no new service, no new bill, and it
-- runs whether or not a deployment is healthy.
--
-- RUN THIS ONLY ONCE TWILIO IS FUNDED AND THE ENV VARS ARE SET. Until
-- then the endpoint no-ops and this would just be noise every 5 minutes.
--
-- Before running, set the two values in the DO block at the bottom.
-- =====================================================================

begin;

create extension if not exists pg_cron;
create extension if not exists pg_net;

commit;

-- ---------------------------------------------------------------------
-- Schedule. Replace both placeholders first:
--
--   <CRON_SECRET>  the same random string set in Vercel's env vars
--
-- The secret is stored in the job definition, which only the postgres
-- role can read.
-- ---------------------------------------------------------------------
select cron.unschedule('wasiflay-send-sms')
where exists (
  select 1 from cron.job where jobname = 'wasiflay-send-sms'
);

select cron.schedule(
  'wasiflay-send-sms',
  '*/5 * * * *',
  $job$
  select net.http_get(
    url     := 'https://www.wasiflay.com/api/notifications/send',
    headers := jsonb_build_object(
                 'Authorization', 'Bearer <CRON_SECRET>'
               ),
    timeout_milliseconds := 20000
  );
  $job$
);

-- Check it's registered:
--   select jobname, schedule, active from cron.job;
--
-- Check recent runs:
--   select job_pid, status, return_message, start_time
--   from cron.job_run_details
--   where jobname = 'wasiflay-send-sms'
--   order by start_time desc limit 10;
--
-- Turn it off without deleting it:
--   update cron.job set active = false where jobname = 'wasiflay-send-sms';
