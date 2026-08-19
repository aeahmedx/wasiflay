-- =====================================================================
-- WASIF LAY — 0009: image dimensions on messages
--
-- Without width/height the browser doesn't know how tall an image will
-- be until it downloads, so every photo that loads shoves the
-- conversation around. On congested cell service that makes the room
-- feel broken.
--
-- Storing the compressed dimensions lets the renderer reserve the exact
-- space up front.
-- =====================================================================

begin;

alter table messages add column if not exists image_width  integer;
alter table messages add column if not exists image_height integer;

-- Column grants from 0001 do not extend to new columns.
grant select (image_width, image_height) on messages to anon, authenticated;
grant insert (image_width, image_height) on messages to authenticated;

commit;
