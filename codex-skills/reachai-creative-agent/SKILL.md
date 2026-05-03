---
name: reachai-creative-agent
description: Use this skill when working on the ReachAI/Syngular personalized outreach video platform, including Apollo lead scraping, LinkedIn-required lead validation, client/operator dashboards, lead photo upload, research, Higgsfield MCP scene generation, ElevenLabs voiceover, HyperFrames/final video assembly, approval workflows, and campaign tracking.
metadata:
  short-description: ReachAI creative video pipeline rules
---

# ReachAI Creative Agent

ReachAI is a sales system for hyper-personalized cold outreach videos. The lead is the main character, the likeness must impress them, and the final result should make the client more likely to book meetings.

## Core Workflow

1. Questionnaire creates a campaign.
2. Apollo scrapes leads that match the questionnaire.
3. Save only leads that include a LinkedIn URL.
4. Operator verifies each LinkedIn profile and uploads/saves the profile photo.
5. Research the lead and company.
6. Generate a short sales angle, voiceover script, outreach message, and 3-scene creative brief.
7. Use Higgsfield MCP with the actual lead image reference to create GPT Image 2 stills.
8. Animate approved stills into silent scene clips.
9. Generate ElevenLabs narrator voiceover.
10. Assemble final video under 30 seconds.
11. Operator reviews and approves before sending.

## Hard Rules

- No LinkedIn, no lead.
- Do not save Apollo leads that cannot be reviewed on LinkedIn.
- Do not use text-only likeness descriptions for Higgsfield. The image must be passed as an actual reference/input.
- Use GPT Image 2 for still generation unless the user explicitly asks for another model.
- Do not use Higgsfield REST API keys for the creative workflow. Use MCP-connected Higgsfield access.
- Keep the operator dashboard separate from the client tracking dashboard.
- Never send outreach automatically before human approval.

## Operator Dashboard Expectations

The operator dashboard should support:

- Viewing all campaigns from every client.
- Opening client tracking pages.
- Seeing all leads per campaign.
- Opening each lead's LinkedIn profile.
- Uploading/confirming a lead profile photo.
- Opening the creative review page for each lead.
- Seeing research, prompt, video, voiceover, and approval status.

## Client Dashboard Expectations

The client dashboard should be read-only and polished:

- Campaign progress.
- Lead count and pipeline counts.
- Lead list with LinkedIn links when available.
- Video and activity status.
- No internal controls for photo upload, prompt editing, or approvals.

## Creative Quality Bar

- Script is short, direct, and persuasive.
- Voiceover talks to the lead, not as the lead.
- Scenes are specific to the lead's role/company/pain, not generic business stock video.
- Captions and CTA are clear.
- Final video must feel premium enough that the lead notices the personalization.

## Verification

Before finishing code changes:

- Run `npx tsc --noEmit`.
- Test the exact user flow when possible.
- Check that Apollo test output includes `linkedinUrl`.
- Check that dashboard leads show LinkedIn links and photo upload controls.
- Check that client dashboard remains read-only.
