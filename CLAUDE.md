# ReachAI / Syngular Handoff For Claude Code

Read `AGENTS.md` first. This project uses a newer Next.js version with changed conventions, so read relevant docs in `node_modules/next/dist/docs/` before editing routes, rendering, server actions, or layouts.

## What This Product Is

ReachAI/Syngular is a hyper-personalized cold outreach video system.

The goal is not to make generic AI videos. The goal is to find qualified leads, verify them through LinkedIn, use their real profile photo as the identity reference, create a cinematic 3-scene outreach video where the lead is the main character, and help the client book more meetings.

## Non-Negotiable Workflow

1. Client fills the questionnaire.
2. Apollo scrapes leads.
3. Only save leads with LinkedIn URLs.
4. Operator verifies the LinkedIn profile and uploads the profile photo.
5. The app researches the client, lead, and lead company.
6. The app creates:
   - client research summary
   - lead research summary
   - sales angle
   - short voiceover script
   - outreach message
   - three scene prompts
7. Higgsfield MCP creates GPT Image 2 stills using the uploaded lead photo as the actual image reference.
8. Higgsfield MCP animates those stills into silent scene videos.
9. ElevenLabs creates narrator voiceover.
10. HyperFrames assembles the final video under 30 seconds.
11. Human operator approves before outreach is sent.

## Hard Rules

- No LinkedIn URL, no lead.
- Do not use text-only face descriptions for likeness. Higgsfield must receive the actual lead image as an image reference.
- Use GPT Image 2 for still images unless Carlos explicitly asks for another model.
- Do not use Soul 2 for likeness stills.
- Do not use Higgsfield REST API keys for the creative workflow. Use MCP-connected Higgsfield access.
- Keep the client dashboard read-only.
- Keep operator controls in the operator dashboard / creative review pages.
- Never auto-send outreach without human approval.

## Current App Shape

- Main operator dashboard: `/dashboard`
- Client campaign tracking page: `/client/[campaignId]`
- Creative lead review page: `/creative/[leadId]`
- Questionnaire flow creates campaigns and triggers Apollo scraping.
- Apollo lead scraping is in `lib/agent/tools.ts` and `lib/integrations/apollo.ts`.
- Creative brief generation is in `app/api/leads/[leadId]/creative/research/route.ts` and `lib/creative/agent.ts`.
- Higgsfield task creation is in `lib/creative/higgsfield-mcp.ts`.
- Scene queue endpoint is `app/api/leads/[leadId]/creative/scenes/queue/route.ts`.
- A newer automation endpoint exists at `app/api/leads/[leadId]/creative/automate/route.ts`.
- Voiceover is in `app/api/leads/[leadId]/creative/voiceover/route.ts`.
- HyperFrames render prep is in `app/api/leads/[leadId]/creative/render/route.ts`.

## Current Important Context

The app now supports a real queue-based architecture:

- The Vercel web app cannot directly reuse a local Codex/Claude Higgsfield MCP login.
- The correct architecture is: web app queues scene jobs in Supabase, then an MCP worker running in an authenticated Codex/Claude/Higgsfield environment processes them and writes image/video URLs back to Supabase.
- The creative page has been changed to add `Run Lead Automation`, which can generate the brief if needed and queue the Higgsfield scene jobs.
- Manual scene URL fields still exist as fallback and QA controls.

See `docs/creative-worker.md` for the worker contract.

## Environment Keys Already Used

The app expects these environment variables in Vercel:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_KEY`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`
- `APOLLO_API_KEY`
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_VOICE_ID`
- `NEXT_PUBLIC_APP_URL`

Higgsfield MCP is not a Vercel env key flow. It requires MCP login/connector auth.

## Verification Commands

Run this after code changes:

```bash
npx tsc --noEmit
```

For Apollo sanity checks, use the app’s Apollo test route or the existing local test flow. A good Apollo result must include `linkedinUrl`.

## Git Notes

Do not commit:

- `.playwright-mcp/`
- local generated tool state
- exposed secrets or API keys

Carlos usually pushes to `main`, and Vercel deploys from GitHub.

## If You Are Claude Code Continuing This

Start by checking:

```bash
git status --short
```

Then read:

- `AGENTS.md`
- this file
- `docs/creative-worker.md`
- `codex-skills/reachai-creative-agent/SKILL.md`

If Carlos asks to continue the automation, the next major build step is the Higgsfield MCP worker:

1. Find pending/queued creative scenes.
2. Upload the lead photo to Higgsfield MCP.
3. Generate GPT Image 2 stills with the actual uploaded photo as reference.
4. Save still job IDs and image URLs.
5. Animate each still into a silent scene video.
6. Save video job IDs and video URLs.
7. Trigger or enable voiceover and final video assembly.

Always preserve the sales purpose: the video must feel premium, personal, and persuasive enough for cold outreach.
