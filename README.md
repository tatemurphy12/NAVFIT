# NAVFIT26 - Navy FITREP Management System #

## 1. Project Overview
NAVFIT26 is a desktop-based modernization of the Navy Fitness Report (FITREP) entry process. This application provides a streamlined, intuitive interface for managing performance evaluations. It is currently in the development phase and is run via the Linux terminal.

## 2. Prerequisites
Before running the application, ensure your Linux environment has the following:
* **Node.js**: Version 18.0 or higher
* **npm**: Node Package Manager (comes with Node.js)
* **Git**: To clone the project from GitLab

## 2. Prerequisites
Before running the application, ensure your Linux environment has the following:
* **Node.js**: Version 18.0 or higher
* **npm**: Node Package Manager (comes with Node.js)
* **Git**: To clone the project from GitLab

### 3. Downloading the Project
NAVFIT26 can be downloaded as either an AppImage or .deb installer from https://tatemurphy12.github.io/NAVFIT/


### 4a. Setup & Installation (Linux)
* To install the .deb file, navigate to the folder in which it was downloaded and run:
```bash
sudo apt install ./navfit26_1.0.0_amd64.deb
```

### 4b. Setup and Installation (Windows)
Not yet updated

### 5. How to Launch the UI
To run NAVFIT26 from the AppImage:
```bash
./NAVFIT26-1.0.0.AppImage --no-sandbox
```

To run NAVFIT26 when installed as a package:
```bash
navfit26
```
### 5. How to Launch the UI
* Ensure you are in the root `NAVFIT26` directory. Run the following command to build the interface and launch the desktop window:
```bash
npm start
```
### 6. Navigating the Project Folders
* **NAVFIT26**: This is your "Home Base." Always run your commands from here.
* **frontend2.1**: Contains the React source code for the user interface.
* **electron2.1**: Contains the desktop window settings and local database.
* **backend2.1**: Contains the data processing logic.

### 7. Runnning Unit Tests (vitest)
* For the frontend:
```bash
cd frontend2.1
npm test
```

### 8. Licensing
This project is dedicated to the **Public Domain** under the [CC0 1.0 Universal](LICENSE) license, following USDS Open Source guidelines.

### Third-Party Encumbrances
Original code in this repository is Public Domain. However, the application bundles several third-party components subject to their own licenses:
* **Electron/React/pdf-lib**: MIT License.
* **UCanAccess/Jackcess**: Apache 2.0 License.
* **Java Runtime (JRE)**: GPLv2 with Classpath Exception.

A comprehensive list of these dependencies and their mandatory legal attributions can be found in [legal/ATTRIBUTIONS.md](legal/ATTRIBUTIONS.md).