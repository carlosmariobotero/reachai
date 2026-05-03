<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ReachAI Project Rules

ReachAI builds hyper-personalized cold outreach videos where each lead is the main character. The software is not just a lead scraper or a video toy; it is a sales system meant to impress prospects, prove quality, and help clients book more conversations.

## Non-Negotiables

- Apollo leads must include a LinkedIn URL. A lead without LinkedIn is not usable because the operator needs LinkedIn to verify the person, source the profile photo, and support personalized research.
- The operator dashboard is the source of truth for Syngular/ReachAI. It must show every client campaign, every lead, LinkedIn links, photo upload status, creative progress, and review controls.
- The client campaign page is read-only for clients. It should help the client track campaign progress, not perform operator work.
- Higgsfield work must use the MCP-connected account and real reference images. Do not replace the lead image with text-only similarity prompting.
- The target creative flow is: lead photo -> research -> short persuasive script -> 3 scene prompts -> GPT Image 2 stills in Higgsfield -> animated silent scenes -> ElevenLabs voiceover -> final assembled video -> human approval.
- Keep human approval before sending outreach.
- Do not reintroduce HeyGen or Higgsfield REST API key flows unless explicitly requested.

## Product Quality Bar

- Leads should feel real and reviewable: name, role, company, location, LinkedIn link, and photo status.
- Creative outputs should sell the service clearly in under 30 seconds.
- Voiceover should speak to the lead, not pretend to be the lead.
- Scene prompts should preserve likeness by passing actual image references to Higgsfield MCP.
- Operator workflows should be obvious for a nontechnical user.

## Engineering Workflow

- Before changing Next.js routes, layouts, server actions, or rendering behavior, read the relevant guide in `node_modules/next/dist/docs/`.
- Prefer small, shippable fixes that improve the real end-to-end workflow.
- After changes, run `npx tsc --noEmit`.
- If `npm run build` fails only because Google Fonts cannot be fetched locally, mention it clearly; Vercel can usually fetch those fonts.
- Do not commit `.playwright-mcp/` or local generated tool state.
