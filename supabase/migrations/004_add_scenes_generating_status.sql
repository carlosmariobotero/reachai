alter table public.creative_video_jobs
  drop constraint if exists creative_video_jobs_status_check;

update public.creative_video_jobs
set status = 'scenes_generating',
    updated_at = now()
where status = 'scenes_queued'
  and exists (
    select 1
    from public.creative_video_scenes scenes
    where scenes.creative_video_job_id = creative_video_jobs.id
      and scenes.status = 'generating'
  );

alter table public.creative_video_jobs
  add constraint creative_video_jobs_status_check check (
    status in (
      'draft',
      'research_ready',
      'prompt_ready',
      'scenes_queued',
      'scenes_generating',
      'scenes_ready',
      'voiceover_ready',
      'render_ready',
      'approved',
      'failed'
    )
  );
