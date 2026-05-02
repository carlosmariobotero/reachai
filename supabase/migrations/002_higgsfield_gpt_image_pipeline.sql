alter table public.creative_video_scenes
  add column if not exists higgsfield_media_id text,
  add column if not exists still_image_job_id text,
  add column if not exists still_image_url text,
  add column if not exists video_job_id text;
