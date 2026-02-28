# Contributing to TradePilot

Thanks for contributing.

## Development Setup

Requirements:
- Node.js 20+
- npm 10+

Install dependencies:

```bash
npm run setup
```

Run the app locally (default port `3001`):

```bash
npm run dev
```

Run quality checks:

```bash
npm run lint
npm run build
```

## Branching

- Create feature/fix branches from `main`.
- Keep pull requests focused and small.
- Use descriptive commit messages.

## Pull Request Checklist

- `npm run lint` passes.
- `npm run build` passes.
- New behavior is documented in `README.md` or `GETTING_STARTED.md` when user-facing.
- Screenshots included for UI changes.

## Code Guidelines

- Keep changes scoped to the task.
- Prefer clear names and small functions over clever abstractions.
- Avoid introducing global state unless necessary.
- Preserve local-first behavior and browser storage compatibility.

## Non-Technical User Experience

If your change affects startup, import/export, backup, or account flows:
- Update `GETTING_STARTED.md`.
- Keep wording simple and task-oriented.
