# NAVFIT26 - Navy FITREP Management System #

## 1. Project Overview
NAVFIT26 is a desktop-based modernization of the Navy Fitness Report (FITREP) entry process. This application provides a streamlined, intuitive interface for managing performance evaluations. It is currently in the development phase and is run via the Linux terminal.

## 2. Prerequisites
Before running the application, ensure your Linux environment has the following:
* **Node.js**: Version 18.0 or higher
* **npm**: Node Package Manager (comes with Node.js)
* **Git**: To clone the project from GitLab

### 3. Downloading the Project
* Open your terminal and navigate to the directory where you want the project to live:
```bash
git clone https://gitlab.usna.edu/tatemurphy12/navfit26_ucanaccess.git
```
* cd NAVFIT26

### 4. Setup & Installation
* You must be in the root `NAVFIT26` folder to run the master installation. This command installs dependencies for both the UI and the Electron shell:
```bash
npm run install-all
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