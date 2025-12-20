---
task: fix dockerfile copy chown
date: 2025-12-18
scope:
  - Dockerfile
goal:
  - Ensure files copied into runner stage are owned by nextjs user for runtime consistency.
non-goals:
  - Refactor Docker build stages
  - Change base image, package manager, or build commands
plan:
  - Inspect Dockerfile runner stage user/group creation and current COPY statements.
  - Add `--chown=nextjs:nodejs` to `COPY --from=builder /app/package.json ./package.json`.
  - (Optional) Validate by running `docker build` locally; otherwise perform a syntax sanity check.
expected_result:
  - `package.json` is owned by `nextjs:nodejs` in the final image, consistent with `.next` ownership.
