alter table public.leads
  add column if not exists profile_photo_url text,
  add column if not exists research_summary text,
  add column if not exists video_script text,
  add column if not exists outreach_message text,
  add column if not exists video_url text,
  add column if not exists video_job_id text,
  add column if not exists updated_at timestamptz default now();

update public.leads
set updated_at = coalesce(updated_at, created_at, now());

alter table public.leads
  alter column updated_at set default now();

alter table public.leads
  drop constraint if exists leads_status_check;

update public.leads
set status = 'new'
where status not in (
  'new',
  'researching',
  'scripted',
  'photo_needed',
  'photo_ready',
  'prompt_ready',
  'video_generating',
  'video_ready',
  'approved',
  'emailed',
  'responded',
  'failed'
);

alter table public.leads
  add constraint leads_status_check check (
    status in (
      'new',
      'researching',
      'scripted',
      'photo_needed',
      'photo_ready',
      'prompt_ready',
      'video_generating',
      'video_ready',
      'approved',
      'emailed',
      'responded',
      'failed'
    )
  );
