# Coding Prompt

Use this when writing application code in knowledge-cloud.

## Project Context

- Next.js 16 App Router, React 19, TypeScript.
- Tailwind CSS v4 + shadcn/ui (Base UI components).
- Prisma 5 + PostgreSQL.
- Auth.js v5 with Google OAuth + email/password credentials.
- YouTube Data API v3 via `lib/youtube.ts`.

## Workflow

1. Prefer server components and Server Actions.
2. Use `revalidatePath()` after mutations to refresh server components.
3. Keep files focused and modular.
4. Update `AGENTS.md` if you change architecture or conventions.

## Quality Gates

Always run before committing:

```bash
npm run lint -- --max-warnings=0
npx tsc --noEmit
npm run build
```

## Git

- Branch from `main` with prefix `feat/`, `fix/`, `refactor/`, `chore/`, or `docs/`.
- Use Conventional Commits: `feat(scope): description`.
