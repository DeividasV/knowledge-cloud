# Git Workflow Skill

## Project: knowledge-cloud (YouTube Subscription Tracker)

This skill defines the Git conventions for this repository. Follow them on every commit, branch, and merge operation.

---

## Merge Policy: No Fast-Forward

**Always use `--no-ff` when merging.** This preserves branch history and creates a proper merge commit, giving a correct graphical representation in Git log/graph tools.

```bash
# CORRECT
 git merge --no-ff feature/my-feature

# INCORRECT — never do this
 git merge feature/my-feature
```

Repository is configured with:
```bash
git config merge.ff false
git config pull.ff false
```

This means `git merge` and `git pull` will reject fast-forward merges by default.

---

## Branch Naming

Use the following prefixes:

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feat/` | New feature | `feat/video-search` |
| `fix/` | Bug fix | `fix/sync-quota-error` |
| `refactor/` | Code refactoring | `refactor/youtube-api` |
| `chore/` | Maintenance, deps, config | `chore/update-deps` |
| `docs/` | Documentation only | `docs/readme-update` |

Always branch from `main`:
```bash
git checkout main
git pull origin main
git checkout -b feat/my-feature
```

---

## Commit Messages

Use **Conventional Commits** format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:
- `feat` — new feature
- `fix` — bug fix
- `refactor` — code change that neither fixes a bug nor adds a feature
- `chore` — build process, dependencies, tooling
- `docs` — documentation only
- `style` — formatting, missing semicolons, etc.
- `test` — adding or correcting tests

Examples:
```
feat(dashboard): add progress bar to watch stats

fix(sync): handle YouTube API quota exceeded error

chore(deps): bump next-auth to 5.0.0-beta.32
```

---

## Workflow Steps

1. **Create feature branch**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feat/description
   ```

2. **Commit regularly** with conventional commit messages.

3. **Push branch** and open a PR / merge request, or merge locally:
   ```bash
   git push -u origin feat/description
   ```

4. **Merge back to main** with `--no-ff`:
   ```bash
   git checkout main
   git merge --no-ff feat/description
   git push origin main
   ```

Because `merge.ff` is set to `false`, a plain `git merge` is sufficient:
   ```bash
   git checkout main
   git merge feat/description
   ```

---

## Important Rules

- Never commit `.env`, `*.db`, or `node_modules`.
- Always run these checks before merging:
  ```bash
  npm run lint -- --max-warnings=0
  npx tsc --noEmit
  npm run build
  ```
- Run `npx prisma migrate dev` if you changed `prisma/schema.prisma`.
- Update `AGENTS.md` if you changed architecture, build steps, or conventions.
