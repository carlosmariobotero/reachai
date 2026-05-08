# Creative Worker Handoff

The Next.js app does not call Higgsfield REST. It queues scene tasks for an MCP-enabled worker.

This is the correct architecture for the no-API-key Higgsfield workflow: the browser/Vercel app stores the lead, photo, research, script, and scene jobs in Supabase; a separate MCP worker runs in an environment that is signed in to Higgsfield MCP and writes the generated assets back to Supabase.

The web app cannot directly reuse a Codex or Claude desktop MCP login from Vercel. That login is local to the agent session. Full automation requires one of these:

- A local Codex/Claude worker that is signed in to `https://mcp.higgsfield.ai/mcp` and processes queued scene jobs.
- A hosted worker that supports MCP OAuth/session storage for Higgsfield and can run continuously.

## One-lead flow

1. Open `/creative/:leadId`.
2. Upload the lead profile photo.
3. Generate the creative brief.
4. Click `Run Lead Automation` to generate the creative brief if needed and queue the Higgsfield scene jobs.
5. For each returned MCP task, use the preferred Higgsfield flow:
   - If `generationMode` is `marketing_studio_ugc`, try Marketing Studio first:
     - Upload the lead photo to Higgsfield media.
     - Create/reuse a Marketing Studio avatar for the lead.
     - Fetch the campaign website as a Marketing Studio `webproduct`.
     - Generate `marketing_studio_video` with the task's preset, hook id, setting id, and prompt.
     - Save the generated video URL back to the scene.
   - If Marketing Studio fails or cannot preserve the lead identity, use the fallback still-to-video path:
   - Upload the lead photo to Higgsfield media.
   - Save the returned `media_id` as `higgsfieldMediaId`.
   - Generate a still image with `model: gpt_image_2`.
   - Use the uploaded `media_id` as the `image` reference.
   - Review the still for likeness before animation.
   - Save the still job id and still image URL.
   - Animate the approved still with `model: cinematic_studio_video`.
   - Use the GPT Image 2 still job id as the `start_image`.
6. When Higgsfield returns completed assets, save them back:

```http
PATCH /api/leads/:leadId/creative/scenes/:sceneId
Content-Type: application/json

{
  "status": "ready",
  "higgsfieldMediaId": "uploaded-media-id",
  "stillImageJobId": "gpt-image-2-job-id",
  "stillImageUrl": "https://...",
  "videoJobId": "animation-job-id",
  "videoUrl": "https://..."
}
```

7. Generate ElevenLabs voiceover from the creative screen.
8. Create the HyperFrames composition.
9. Render the composition to MP4 with HyperFrames, upload the final MP4, and approve it in the creative screen.

## Worker contract

When the app queues scenes, it returns `mcpTasks`. Each task includes:

- `leadPhotoUrl`: the uploaded LinkedIn profile photo. This must be passed as an actual image reference to Higgsfield, not rewritten as a text description.
- `generationMode`: `marketing_studio_ugc` for the new UGC hook workflow, or `cinematic_still_to_video` for the fallback flow.
- `marketingStudio`: when present, includes `model: marketing_studio_video`, a supported preset, `hookId`, `settingId`, the campaign `productUrl`, an avatar name, and a ready prompt.
- `imageModel`: `gpt_image_2`.
- `stillPrompt`: prompt for the identity-preserving still image.
- `videoPrompt`: prompt for animating the approved still silently.
- `sceneId`: the Supabase scene id that must be updated when assets are ready.

The worker should process a `marketing_studio_ugc` task like this:

1. Upload `leadPhotoUrl` into Higgsfield MCP media.
2. Create or reuse a Marketing Studio avatar using the uploaded lead photo.
3. Fetch the campaign website URL as a Marketing Studio `webproduct`.
4. Generate a `marketing_studio_video` with the task's preset/mode, hook id, setting id, avatar, webproduct, and prompt.
5. Patch the scene record with the video job/url and `status: "ready"`.

If Marketing Studio cannot use the avatar/product cleanly, process the same task through the fallback still-to-video path:

1. Upload `leadPhotoUrl` into Higgsfield MCP media.
2. Generate a GPT Image 2 still using that uploaded media as the image reference.
3. Confirm the still preserves the lead likeness strongly enough for cold outreach.
4. Animate the approved still into a silent scene clip.
5. Patch the scene record with media id, still job/url, animation job/url, and `status: "ready"`.

Until this worker is connected, the operator can still paste those values manually in the creative review page. Once connected, the manual fields become a fallback and QA surface.

## Queue pickup endpoint

The app exposes one worker pickup endpoint:

```http
GET /api/creative/worker/next
```

It returns the next queued lead that has a real uploaded profile photo and queued scene prompts. The response includes the lead, campaign, creative job, queued scenes, and `mcpTasks` ready for a Higgsfield MCP worker.

When a job is picked up, its queued scenes are marked `generating` so two workers do not create duplicate Higgsfield assets for the same lead.

Use preview mode when checking the queue by hand:

```http
GET /api/creative/worker/next?peek=1
```

Preview mode returns the next task without claiming it. If nothing is still waiting in the queue but a worker already claimed a lead, preview mode returns that active lead with `mode: "active"` so the operator can see that generation is already underway.

Use claim mode only from the real worker:

```http
GET /api/creative/worker/next?claim=1
```

Without `claim=1`, browser-opened requests stay in preview mode unless the request is authenticated with a worker secret.

If `CREATIVE_WORKER_SECRET` is set in Vercel, the worker must call it with:

```http
Authorization: Bearer <CREATIVE_WORKER_SECRET>
```

If the secret is not set, the endpoint is open for MVP testing. The normal web app still cannot generate Higgsfield assets by itself; this endpoint gives the signed-in MCP worker everything it needs to generate and save the assets.

## Worker scene update endpoint

Workers can save generated assets without using the operator UI route:

```http
PATCH /api/creative/worker/scenes/:sceneId
Content-Type: application/json
Authorization: Bearer <CREATIVE_WORKER_SECRET>

{
  "status": "ready",
  "higgsfieldMediaId": "uploaded-media-id",
  "stillImageJobId": "gpt-image-2-job-id",
  "stillImageUrl": "https://...",
  "videoJobId": "animation-job-id",
  "videoUrl": "https://..."
}
```

When every scene for a lead is marked `ready`, the app automatically moves the creative job to `scenes_ready`. If a worker marks a scene `failed`, the creative job is marked `failed` so the operator can inspect and requeue.

## Campaign-level queueing

The operator dashboard's `Run All Videos` button calls:

```http
POST /api/campaigns/:campaignId/creative/automate
Content-Type: application/json

{
  "limit": 10
}
```

This generates missing creative briefs and queues Higgsfield scenes for photo-ready leads in that campaign. It preserves the hard gates:

- Leads without LinkedIn are skipped.
- Leads without uploaded profile photos are skipped.
- Leads with scenes already queued, generating, or ready are skipped.

This makes the operator flow scalable: add/verify/upload photos in the campaign table, click `Run All Videos`, then let the MCP worker claim jobs through `/api/creative/worker/next?claim=1`.

## HyperFrames final assembly

Once a lead has all three scene videos and a voiceover, the creative page can create a HyperFrames render package:

```http
POST /api/leads/:leadId/creative/render
```

The route uploads:

- `hyperframes/:leadId/composition.html` — the HTML composition for HyperFrames.
- `hyperframes/:leadId/manifest.json` — render metadata, scene timing, output name, and source URLs.

The current composition is a 1920x1080, 30fps, under-30-second edit. It layers:

- The 3 silent Higgsfield scene videos.
- Lower-third captions from the creative brief.
- The ElevenLabs narrator voiceover.
- A light ReachAI/meta overlay and closing CTA.

After rendering in HyperFrames, upload the final MP4 back through the creative page or call:

```http
POST /api/leads/:leadId/creative/final-video
Content-Type: multipart/form-data

video=<final mp4 file>
approve=true
```

That stores the final video in Supabase, saves it on the lead, and marks the creative job approved when `approve=true`.

## Current constraints

- Use the official Higgsfield MCP connector: `https://mcp.higgsfield.ai/mcp`.
- Do not use the older Higgsfield API-key MCP package for this workflow.
- Do not use Soul 2 for lead likeness stills unless explicitly testing; use GPT Image 2.
- The app stores assets in the Supabase `creative-assets` bucket.
- Local rendering needs HyperFrames plus FFmpeg/FFprobe. This machine currently does not have FFmpeg installed, and running `npx hyperframes` inside the credentialed app workspace should be done only from a clean renderer environment.
