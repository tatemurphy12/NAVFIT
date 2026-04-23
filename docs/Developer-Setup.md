# Developer Setup

## Prerequisites

- **Node.js** 18.0 or higher (with npm)
- **Git**
- Windows 10/11 or Ubuntu 20.04+ (macOS support in development)

---

## Clone and Install

```bash
git clone https://github.com/tatemurphy12/NAVFIT.git
cd NAVFIT
npm run install-all
```

`install-all` installs dependencies for `frontend2.1`, `electron2.1`, and `backend2.1`.

---

## Run in Development

```bash
npm start
```

Builds the React frontend (Vite), copies the backend source, and launches the Electron window.

### Individual build steps

```bash
npm run build-ui       # Vite build → electron2.1/frontend_build/
npm run build-backend  # Copy backend source to electron2.1/backend_src/
```

After changing `electron2.1/main.js`, restart with `npm start`. After changing React code only, `npm run build-ui` is sufficient.

---

## Run Tests

```bash
cd frontend2.1
npm test
```

Tests use [Vitest](https://vitest.dev/) with React Testing Library.

---

## Project Layout

```
NAVFIT/
├── frontend2.1/    # React + Vite UI (renderer process)
├── backend2.1/     # Data models and PDF/DB logic
├── electron2.1/    # Electron shell, IPC handlers, main.js
├── docs/           # Documentation
├── legal/          # License files and attributions
└── package.json    # Root launcher scripts
```

See [Architecture](Architecture) for how the layers connect.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| White screen on launch | Missing `frontend_build/` folder | Run `npm run build-ui` |
| `Module not found: better-sqlite3` | Deps not installed in `electron2.1/` | Run `npm run install-all` |
| Java converter fails | JRE not executable (Linux) | `chmod +x electron2.1/bin/jre-linux/bin/java` |
| App launches but DB errors appear | Wrong working directory | Run commands from the repo root |

---

## AI Usage Disclosure

In alignment with Capstone licensing policies, Claude Pro and Gemini Pro were used during development for UI/UX structure, IPC refactoring, and documentation drafting. All AI-generated code was reviewed for security and accuracy and is released under CC0.
