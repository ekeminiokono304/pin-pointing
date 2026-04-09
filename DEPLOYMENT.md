# PINPOINT Deployment Guide (Manual)

This application is a **Full-Stack Node.js (TypeScript)** project. It uses **Express** for the backend and **React/Vite** for the frontend.

## Prerequisites
1. **Node.js**: Install the latest LTS version from [nodejs.org](https://nodejs.org/).
2. **VS Code**: Download from [code.visualstudio.com](https://code.visualstudio.com/).

---

## Step 1: Prepare the Project
1. **Download the Code**: Export the project from AI Studio or copy all files into a new folder on your computer.
2. **Open in VS Code**:
   - Open VS Code.
   - Go to `File > Open Folder...` and select your project folder.

## Step 2: Install Dependencies
1. Open the **Terminal** in VS Code (`Ctrl + ` ` or `Terminal > New Terminal`).
2. Run the following command to install all required packages:
   ```bash
   npm install
   ```

## Step 3: Configure Environment Variables
1. Create a file named `.env` in the root directory (copy from `.env.example`).
2. Add your `APP_URL` (e.g., `http://localhost:3000` for local testing).
   ```env
   APP_URL="http://localhost:3000"
   ```

## Step 4: Run the Application

### For Development (with Hot Reload)
Run this command to start the server and the Vite development environment:
```bash
npm run dev
```
Open your browser to `http://localhost:3000`.

### For Production (Manual Deployment)
If you are deploying to a server (like Railway, Render, or a VPS):
1. **Build the Frontend**:
   ```bash
   npm run build
   ```
2. **Start the Production Server**:
   ```bash
   npm start
   ```
The server will serve the static files from the `dist` folder and handle the API/Redirection routes.

---

## Troubleshooting
- **Port 3000 Busy**: If the port is in use, you can change the `PORT` constant in `server.ts`.
- **Missing Types**: If you see TypeScript errors, ensure you ran `npm install`.
