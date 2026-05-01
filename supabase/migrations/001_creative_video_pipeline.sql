create extension if not exists "pgcrypto";

alter table public.leads
  add column if not exists profile_photo_url text;

alter table public.leads
  add column if not exists video_job_id text;

alter table public.leads
  drop constraint if exists leads_status_check;

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

create table if not exists public.creative_video_jobs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  status text not null default 'draft' check (
    status in (
      'draft',
      'research_ready',
      'prompt_ready',
      'scenes_queued',
      'scenes_ready',
      'voiceover_ready',
      'render_ready',
      'approved',
      'failed'
    )
  ),
  client_research_summary text,
  lead_research_summary text,
  sales_angle text,
  voiceover_script text,
  outreach_message text,
  creative_brief jsonb,
  voiceover_url text,
  hyperframes_composition_url text,
  final_video_url text,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creative_video_jobs_lead_id_idx
  on public.creative_video_jobs(lead_id);

create table if not exists public.creative_video_scenes (
  id uuid primary key default gen_random_uuid(),
  creative_video_job_id uuid not null references public.creative_video_jobs(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  scene_number integer not null check (scene_number between 1 and 3),
  duration_seconds integer not null check (duration_seconds between 5 and 8),
  objective text not null,
  higgsfield_prompt text not null,
  caption_text text not null,
  status text not null default 'draft' check (
    status in ('draft', 'queued', 'generating', 'ready', 'failed')
  ),
  higgsfield_request_id text,
  video_url text,
  thumbnail_url text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creative_video_job_id, scene_number)
);

create index if not exists creative_video_scenes_lead_id_idx
  on public.creative_video_scenes(lead_id);

insert into storage.buckets (id, name, public)
values ('creative-assets', 'creative-assets', true)
on conflict (id) do update set public = excluded.public;
