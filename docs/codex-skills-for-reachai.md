# Codex Skills for ReachAI

This project now has a ReachAI-specific skill at:

`codex-skills/reachai-creative-agent/SKILL.md`

It captures the rules that matter most for this product: LinkedIn-required Apollo leads, operator dashboard workflows, real lead photo references for Higgsfield MCP, GPT Image 2 stills, ElevenLabs voiceover, final review, and no sending before approval.

## What From the Video Applies Here

The video is mostly about Claude Code plugins. Some commands shown there, like `/plugin install ...`, `/review`, and `/ultrareview`, are Claude Code commands. They are not the same thing as Codex skills.

For this Codex project, the useful equivalent is:

- Keep persistent project rules in `AGENTS.md`.
- Add a project-specific skill file for the ReachAI workflow.
- Use TypeScript checks before deploy.
- Use code review behavior before important changes.
- Keep the workflow grounded in the actual business outcome, not generic automation.

## Optional Local Install

If you want Codex to have this ReachAI skill available outside this repo too, copy it into your local Codex skills folder:

```bash
mkdir -p ~/.codex/skills/reachai-creative-agent
cp /Users/carlosmariobotero/Desktop/reachai/codex-skills/reachai-creative-agent/SKILL.md ~/.codex/skills/reachai-creative-agent/SKILL.md
```

Then restart Codex.

## Practical ReachAI Quality Checklist

Use this checklist before calling a ReachAI change finished:

- Apollo lead has LinkedIn.
- Dashboard shows the campaign.
- Dashboard lead row has LinkedIn link.
- Operator can upload profile photo.
- Creative page uses the uploaded photo.
- Research and script are visible for review.
- Higgsfield MCP tasks use actual image references.
- Final video remains under 30 seconds.
- Human approval is required before sending.
