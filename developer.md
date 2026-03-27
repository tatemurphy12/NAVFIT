# NAVFIT26 Developer Guide #

## 1. Project Structure
* **`backend2.1/`**: Business logic. Contains `Database.js` (SQLite operations) and `Fitrep.js` (Class-based data models).
* **`electron2.1/`**: The **Main Process**. Manages the desktop shell (`main.js`), the secure bridge (`preload.js`), and the local database (`MyEvals.sqlite`).
* **`frontend2.1/`**: The **Renderer Process**. A React + Vite UI. The `dist/` folder contains the production assets loaded by Electron.
* **Root `package.json`**: The **Master Launcher**. Orchestrates builds and execution for the sub-projects.

### 2. Installation
* Install dependencies for both the Frontend and Electron processes simultaneously:
```bash
npm run install-all
```
### 3. Execution
* To build the React UI and launch the desktop application in one command:
```bash
npm start
```
### 4. The "Wiring" (IPC Bridge)
* This app follows Electron security best practices using Inter-Process Communication (IPC) and Context Isolation:
* Frontend: App.jsx triggers an event via window.api.saveFitrep(data).
* Bridge: preload.js exposes specific channels to the UI, shielding the system from direct Node.js access.
* Main: main.js listens for these channels, processes the data through the backend2.1 classes, and performs SQLite operations.

### 5. Maintenance & Development
* UI Development
* Location: frontend2.1/src/
* Update Process: Modify the React code. You must run npm run build-ui (or npm start) to re-generate the dist/ folder that Electron reads.
* Vite Config: vite.config.js must have base: './' to ensure asset paths are relative to the local file system.

### 6. Backend & Shell Logic
* Location: backend2.1/ and electron2.1/
* Update Process: Modify the JS classes or main.js. Requires a full app restart.
* Database: SQLite pathing is managed relative to electron2.1/.

### 7. Troubleshooting
* White Screen on Launch: This indicates the dist/ folder is missing or the win.loadFile path in main.js is incorrect. Run npm run build-ui.
* Module Not Found (sqlite3): Ensure npm install was executed inside the electron2.1/ directory.