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
5. For each returned MCP task, use the proven Higgsfield flow:
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
- `imageModel`: `gpt_image_2`.
- `stillPrompt`: prompt for the identity-preserving still image.
- `videoPrompt`: prompt for animating the approved still silently.
- `sceneId`: the Supabase scene id that must be updated when assets are ready.

The worker should process each task like this:

1. Upload `leadPhotoUrl` into Higgsfield MCP media.
2. Generate a GPT Image 2 still using that uploaded media as the image reference.
3. Confirm the still preserves the lead likeness strongly enough for cold outreach.
4. Animate the approved still into a silent scene clip.
5. Patch the scene record with media id, still job/url, animation job/url, and `status: "ready"`.

Until this worker is connected, the operator can still paste those values manually in the creative review page. Once connected, the manual fields become a fallback and QA surface.

## Current constraints

- Use the official Higgsfield MCP connector: `https://mcp.higgsfield.ai/mcp`.
- Do not use the older Higgsfield API-key MCP package for this workflow.
- Do not use Soul 2 for lead likeness stills unless explicitly testing; use GPT Image 2.
- The app stores assets in the Supabase `creative-assets` bucket.
- Local rendering needs HyperFrames and an environment that can bind/run the renderer.
