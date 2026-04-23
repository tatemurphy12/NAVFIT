# Installation

## Requirements

- Windows 10/11 (64-bit) or Debian-based Linux (Ubuntu 20.04+)
- No additional software required — Electron and a Java Runtime are bundled with the installer

---

## Windows

1. Download the latest `NAVFIT26-x.x.x.exe` from the [Releases page](https://github.com/tatemurphy12/NAVFIT/releases).
2. Run the installer and follow the prompts.
3. Launch **NAVFIT26** from the Start Menu or desktop shortcut.

> The installer is code-signed via Azure Trusted Signing. If Windows SmartScreen prompts, click **More info → Run anyway**.

---

## Linux (Debian/Ubuntu)

### Option A — .deb package (recommended)

```bash
sudo apt install ./navfit26_x.x.x_amd64.deb
navfit26
```

### Option B — AppImage

```bash
chmod +x NAVFIT26-x.x.x.AppImage
./NAVFIT26-x.x.x.AppImage --no-sandbox
```

Download both formats from the [Releases page](https://github.com/tatemurphy12/NAVFIT/releases) or the [project site](https://tatemurphy12.github.io/NAVFIT/).

---

## Running from Source

See [Developer Setup](Developer-Setup).
