# Build and Release

## Local Builds

### Windows Installer
```bash
cd electron2.1
npm run build:win
```
Output: `electron2.1/release/NAVFIT26-x.x.x.exe`

### Linux Package
```bash
cd electron2.1
npx electron-builder --linux --publish never
```
Output: `electron2.1/release/navfit26_x.x.x_amd64.deb`

> On Linux, ensure the JRE binaries are executable before building:
> ```bash
> chmod +x electron2.1/bin/jre-linux/bin/java
> ```

---

## CI/CD Pipeline

Builds are automated via GitHub Actions (`.github/workflows/build.yml`) and run on every push to any branch.

### Windows Build Job (`build-and-sign`)
Runs on `windows-latest`:
1. Checks out the repo
2. Logs into Azure via OIDC (for code signing)
3. Installs dependencies (`npm run install-all`)
4. Builds frontend and backend
5. Packages with Electron Builder
6. Signs the `.exe` using the [Azure Trusted Signing](https://learn.microsoft.com/en-us/azure/trusted-signing/) service
7. Uploads the signed installer as a GitHub Actions artifact
8. On version tags (`v*`): publishes to GitHub Releases

### Linux Build Job (`build-linux`)
Runs on `ubuntu-latest`:
1. Checks out the repo
2. Installs dependencies
3. Fixes JRE executable permissions
4. Packages with Electron Builder (`--linux`)
5. Uploads `.deb` as a GitHub Actions artifact
6. On version tags: publishes to GitHub Releases

---

## Code Signing

Windows builds are signed using **Microsoft Artifact Signing** (Trusted Signing). Required GitHub secrets and variables:

| Secret / Variable | Purpose |
|---|---|
| `AZURE_CLIENT_ID` | Azure app client ID (OIDC) |
| `AZURE_TENANT_ID` | Azure tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID |
| `ARTIFACT_ENDPOINT` | Trusted Signing endpoint URL |
| `ARTIFACT_ACCOUNT_NAME` | Trusted Signing account name |
| `ARTIFACT_PROFILE_NAME` | Certificate profile name |

---

## Creating a Release

1. Tag the commit: `git tag v1.x.x && git push origin v1.x.x`
2. The CI pipeline builds, signs, and uploads both Windows and Linux artifacts to a new GitHub Release automatically.
3. Update the download links on the [project site](https://tatemurphy12.github.io/NAVFIT/) if needed.

---

## Versioning

Version numbers live in `electron2.1/package.json` under the `version` field. Update this before tagging a release.
