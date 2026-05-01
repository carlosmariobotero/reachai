# Creative Worker Handoff

The Next.js app does not call Higgsfield REST. It queues scene tasks for an MCP-enabled worker.

## One-lead flow

1. Open `/creative/:leadId`.
2. Upload the lead profile photo.
3. Generate the creative brief.
4. Click `Queue MCP Tasks`.
5. For each returned MCP task, call Higgsfield MCP with:
   - `image_url`: task `imageUrl`
   - `prompt`: task `prompt`
   - preferred tool: `generate_video_seedance`
6. When Higgsfield returns a request id or completed video URL, save it back:

```http
PATCH /api/leads/:leadId/creative/scenes/:sceneId
Content-Type: application/json

{
  "status": "ready",
  "higgsfieldRequestId": "request-id",
  "videoUrl": "https://..."
}
```

7. Generate ElevenLabs voiceover from the creative screen.
8. Create the HyperFrames composition.
9. Render the composition to MP4 with HyperFrames, upload the final MP4, and approve it in the creative screen.

## Current constraints

- Higgsfield MCP credentials must be configured outside the app.
- The app stores assets in the Supabase `creative-assets` bucket.
- Local rendering needs HyperFrames and an environment that can bind/run the renderer.
