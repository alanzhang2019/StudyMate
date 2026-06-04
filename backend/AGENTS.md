# Superpowers Workflow For This Project

This repository uses the `Superpowers` workflow as the default development methodology.

## Skill Location

Installed skills live under:

- `.trae/skills/using-superpowers`
- `.trae/skills/brainstorming`
- `.trae/skills/writing-plans`
- `.trae/skills/test-driven-development`
- `.trae/skills/using-git-worktrees`
- `.trae/skills/executing-plans`
- `.trae/skills/subagent-driven-development`
- `.trae/skills/requesting-code-review`
- `.trae/skills/finishing-a-development-branch`
- `.trae/skills/systematic-debugging`
- `.trae/skills/verification-before-completion`

## Required Default Process

For any non-trivial feature, architecture change, or behavior change, use this sequence:

1. `brainstorming`
2. `writing-plans`
3. `using-git-worktrees` when isolation is needed
4. `test-driven-development` during implementation
5. `subagent-driven-development` or `executing-plans`
6. `requesting-code-review`
7. `verification-before-completion`
8. `finishing-a-development-branch`

For bugs, use:

1. `systematic-debugging`
2. `test-driven-development`
3. `verification-before-completion`

## Project-Specific Constraints

- Product scope stays aligned with `SKILL.md`
- MVP stays focused on grades 4-6 math only
- Prefer short, measurable wrong-problem loops over broad tutoring flows
- Reuse `OpenMAIC` only where it helps shell, provider abstraction, and workflow infrastructure
- Do not expand to full multi-subject or open-ended tutoring without explicit approval

## Expected Artifacts

- Specs: `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
- Plans: `docs/superpowers/plans/YYYY-MM-DD-<topic>.md`

## Testing Rule

No production behavior change without a failing test first, unless the user explicitly asks to skip TDD for a prototype or documentation-only task.
