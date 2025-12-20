# Contributing Guide

Thank you for your interest in contributing to this project. This guide covers the development workflow, code standards, and best practices.

## Development Setup

### Prerequisites

- Node.js 18+
- pnpm (recommended package manager)
- PostgreSQL database
- Git

### Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd shipany-template-two

# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Configure environment variables
# Edit .env with your database URL, auth secrets, etc.

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
```

## Available Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server (http://localhost:3000) |
| `pnpm build` | Production build |
| `pnpm build:fast` | Fast production build for larger deployments |
| `pnpm start` | Run production build |
| `pnpm lint` | Run ESLint |
| `pnpm format` | Format code with Prettier |
| `pnpm format:check` | Check formatting without changes |
| `pnpm db:generate` | Generate Drizzle migrations |
| `pnpm db:migrate` | Apply database migrations |
| `pnpm db:studio` | Open Drizzle Studio |

## Code Style

### General Guidelines

- **Language**: TypeScript + React with Next.js App Router
- **Formatting**: Prettier (run `pnpm format` before committing)
- **Linting**: ESLint (run `pnpm lint` to check)

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| React components | PascalCase | `UserProfile.tsx` |
| Types/Interfaces | PascalCase | `interface UserData` |
| Variables/Functions | camelCase | `getUserInfo()` |
| Environment variables | UPPER_SNAKE_CASE | `DATABASE_URL` |
| Files (Next.js) | lowercase | `page.tsx`, `layout.tsx`, `route.ts` |

### File Organization

```
src/
├── app/           # Routes only - keep thin
├── core/          # Domain logic - auth, db, i18n
├── shared/        # Shared code
│   ├── models/    # Data access layer (server-only)
│   ├── services/  # Business logic services
│   ├── lib/       # Utilities
│   ├── components/# Reusable UI components
│   └── blocks/    # Page-level UI blocks
├── extensions/    # Third-party integrations
└── config/        # Configuration files
```

### Server/Client Boundary

- Use `'use client'` only in leaf components that need interactivity
- Keep Server Components as the default
- Never import server-only modules in client components
- ESLint rules enforce these boundaries automatically

## Pull Request Workflow

### Before Submitting

1. **Run checks locally**:
   ```bash
   pnpm lint
   pnpm format:check
   pnpm build
   ```

2. **Write clear commits**:
   - Use Conventional Commit format: `type(scope): description`
   - Examples:
     - `feat(auth): add GitHub OAuth provider`
     - `fix(payment): handle webhook timeout`
     - `docs(readme): update installation steps`

3. **Keep PRs focused**:
   - One feature/fix per PR
   - Small, reviewable changes

### PR Description Template

```markdown
## What
Brief description of changes.

## Why
Context and motivation.

## How to Test
1. Step-by-step testing instructions
2. Expected behavior

## Screenshots (if UI changes)
Before/after screenshots.

## Related Issues
Closes #123
```

### Review Checklist

- [ ] Code follows project style guidelines
- [ ] No TypeScript errors (`pnpm build` passes)
- [ ] No linting errors (`pnpm lint` passes)
- [ ] Documentation updated if needed
- [ ] Tests added/updated for new features

## Architecture Guidelines

### Layer Dependencies

```
app/ → shared/ → core/ → config/
         ↓
    extensions/
```

- `app/` can import from `shared/`, `core/`, `config/`
- `shared/` can import from `core/`, `config/`, `extensions/`
- `core/` can import from `config/`
- `extensions/` should be self-contained

### API Route Patterns

Use the `withApi()` wrapper for consistent error handling:

```typescript
import { withApi } from '@/shared/lib/api/route';
import { requireUser } from '@/shared/lib/api/guard';
import { parseJson } from '@/shared/lib/api/parse';
import { jsonOk } from '@/shared/lib/api/response';

export const POST = withApi(async (req: Request) => {
  const user = await requireUser();
  const body = await parseJson(req, MySchema);
  
  // ... logic
  
  return jsonOk({ data });
});
```

### Database Access

- Always use Drizzle ORM for database operations
- Place data access functions in `src/shared/models/`
- Use `server-only` directive for model files

## Testing

Currently, the project doesn't have a configured test runner. When adding tests:

- Colocate tests with features: `*.test.ts` / `*.test.tsx`
- Prefer unit tests for `src/core/` logic
- Use integration tests for `src/app/` routes
- Keep tests fast and deterministic

## Documentation

When making changes:

1. Update relevant docs in `docs/` if behavior changes
2. Update `README.md` for major features
3. Add JSDoc comments for public APIs
4. Keep code comments minimal but meaningful

## Security

### Reporting Vulnerabilities

If you discover a security vulnerability, please **do not** open a public issue. Instead:

1. **Email**: Send details to the project maintainers privately
2. **Include**:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

3. **Response**: Expect acknowledgment within 48 hours

### Security Best Practices

When contributing code:

- Never commit secrets, API keys, or credentials
- Use environment variables for sensitive configuration
- Validate all user inputs server-side
- Follow the principle of least privilege for permissions
- Keep dependencies up to date

## Getting Help

- Check existing documentation in `docs/`
- Review `AGENTS.md` for repository guidelines
- Open an issue for questions or problems

## License

Please review the [LICENSE](./LICENSE) file before contributing.
