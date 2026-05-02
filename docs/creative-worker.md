# Creative Worker Handoff

The Next.js app does not call Higgsfield REST. It queues scene tasks for an MCP-enabled worker.

## One-lead flow

1. Open `/creative/:leadId`.
2. Upload the lead profile photo.
3. Generate the creative brief.
4. Click `Prepare MCP Tasks`.
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

## Current constraints

- Use the official Higgsfield MCP connector: `https://mcp.higgsfield.ai/mcp`.
- Do not use the older Higgsfield API-key MCP package for this workflow.
- Do not use Soul 2 for lead likeness stills unless explicitly testing; use GPT Image 2.
- The app stores assets in the Supabase `creative-assets` bucket.
- Local rendering needs HyperFrames and an environment that can bind/run the renderer.
