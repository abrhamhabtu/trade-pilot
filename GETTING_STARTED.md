# Getting Started with TradePilot

> A simple guide to help you set up and use TradePilot — no coding experience needed!

---

## Table of Contents

1. [What is TradePilot?](#what-is-tradepilot)
2. [Choose Your Setup Method](#choose-your-setup-method)
3. [Option A: AI Assistant (Easiest)](#option-a-ai-assistant-easiest)
4. [Option B: Docker](#option-b-docker-recommended)
5. [Option C: Manual Setup](#option-c-manual-setup-for-developers)
6. [Importing Your Trades](#importing-your-trades)
7. [Backing Up Your Data](#backing-up-your-data)
8. [Troubleshooting](#troubleshooting)
9. [FAQ](#faq)

---

## What is TradePilot?

TradePilot is a **free trading journal** that runs on your own computer. It helps you:

- 📊 Track your trades from multiple prop firm accounts
- 📈 See your P&L, win rate, and other important stats
- 📅 View your trading calendar
- 🎯 Set profit targets and track your journey
- 💾 Keep your data private — it never leaves your computer

---

## Choose Your Setup Method

| Method | Best For | Difficulty |
|--------|----------|------------|
| **AI Assistant** | Complete beginners | ⭐ Easiest |
| **Docker** | Most users | ⭐ Easy |
| **Manual** | Developers | ⭐⭐ Medium |

**Don't know which to pick?** If you've never coded before, try the AI Assistant option first!

---

## Option A: AI Assistant (Easiest)

Tools like **Cursor** and **Windsurf** are code editors with built-in AI that can help you. You just talk to them in plain English, and they do the technical stuff for you.

### Step 1: Download an AI Code Editor

Pick one:
- **Cursor** — [cursor.com](https://cursor.com) (free tier available)
- **Windsurf** — [codeium.com/windsurf](https://codeium.com/windsurf) (free)

Download and install it like any other app.

### Step 2: Download TradePilot

1. Go to [github.com/abrhamhabtu/trade-pilot](https://github.com/abrhamhabtu/trade-pilot)
2. Click the green **Code** button
3. Click **Download ZIP**
4. Unzip the folder somewhere you'll remember

### Step 3: Open the Folder in Your AI Editor

1. Open Cursor or Windsurf
2. Click **File** → **Open Folder**
3. Select the TradePilot folder you unzipped

### Step 4: Ask the AI to Start the App

Open the AI chat panel (usually on the right side) and paste this prompt:

```
I just downloaded TradePilot (a Next.js 14 app) and I want to run it locally.
Can you help me:
1. Install the dependencies (npm run setup)
2. Start the development server (npm run dev)
3. Tell me what URL to open in my browser

Please run the commands for me and let me know when it's ready.
```

The AI will run the commands and tell you when it's ready. Usually it opens at **http://localhost:3001**.

### That's It!

The AI handles all the technical stuff. If something goes wrong, just describe the error to it and it will help you fix it.

> **Tip:** You can also ask the AI questions like "How do I import my trades?" or "Where is my data stored?" and it will help you.

---

## Option B: Docker (Recommended)

Docker is like a "container" that runs the app for you. You don't need to install anything else.

### Step 1: Install Docker

1. Go to [docker.com/get-started](https://www.docker.com/get-started/)
2. Download **Docker Desktop** for your computer (Mac, Windows, or Linux)
3. Install it and open Docker Desktop
4. Wait until it says "Docker is running" (green icon)

### Step 2: Download TradePilot

1. Go to [github.com/abrhamhabtu/trade-pilot](https://github.com/abrhamhabtu/trade-pilot)
2. Click the green **Code** button
3. Click **Download ZIP**
4. Unzip the folder somewhere you'll remember (like your Desktop)

### Step 3: Start TradePilot

**On Mac:**
1. Open **Terminal** (search for it in Spotlight)
2. Type `cd ` (with a space after it)
3. Drag the TradePilot folder into Terminal
4. Press Enter
5. Type `docker-compose up -d` and press Enter
6. Wait about 1-2 minutes for it to build

**On Windows:**
1. Open **Command Prompt** or **PowerShell**
2. Type `cd ` and then the path to your TradePilot folder
3. Type `docker-compose up -d` and press Enter
4. Wait about 1-2 minutes for it to build

### Step 4: Open TradePilot

1. Open your web browser (Chrome, Firefox, Edge, etc.)
2. Go to: **http://localhost:3001**
3. You should see TradePilot! 🎉

### To Stop TradePilot

```
docker-compose down
```

### To Start It Again Later

```
docker-compose up -d
```

---

## Option C: Manual Setup (For Developers)

This method requires Node.js 20+. Only use this if you're comfortable with code.

### Step 1: Install Node.js

1. Go to [nodejs.org](https://nodejs.org/)
2. Download the **LTS** version (20 or newer)
3. Install it

### Step 2: Download TradePilot

Same as Docker method — download from GitHub and unzip.

### Step 3: Install & Run

Open Terminal/Command Prompt in the TradePilot folder, then:

```bash
npm run install:web
npm run dev
```

This starts the Next.js development server.

### Step 4: Open TradePilot

Go to: **http://localhost:3001**

---

## Importing Your Trades

TradePilot can import trades from these platforms:

| Platform | Where to Export |
|----------|-----------------|
| **Topstep (ProjectX)** | Trade History → Download CSV |
| **TradingView** | Account → History → Export |
| **Tradovate** | Reports → Trade Activity → Export |
| **NinjaTrader** | Control Center → Account Data → Export |
| **Apex Trader** | Dashboard → Export |

### How to Import

1. Open TradePilot
2. Go to **Accounts** page
3. Click **Add new account** (if you haven't already)
4. Click the **+** button next to your account
5. Drag your CSV file into the upload area (or click to browse)
6. Done! Your trades will appear

---

## Backing Up Your Data

**Important:** Your data is stored in your browser. If you clear your browser data, you'll lose your trades!

### How to Backup

1. Go to **Accounts** page
2. Scroll down to **Data Management**
3. Click **Export Backup**
4. Save the file somewhere safe (like Google Drive, Dropbox, or a USB drive)

### How to Restore

1. Go to **Accounts** page
2. Scroll down to **Data Management**
3. Click **Restore from Backup**
4. Select your backup file
5. Wait for the page to refresh

### When to Backup

- ✅ After importing new trades
- ✅ At least once a week
- ✅ Before clearing browser data
- ✅ Before switching computers

---

## Troubleshooting

### "I can't access localhost:3001"

- **Docker users:** Make sure Docker Desktop is running (green icon), try `docker-compose up -d` again, and wait 1-2 minutes for it to fully start
- **Manual users:** Make sure you ran `npm run dev` and see "ready" output in your terminal. Requires Node.js 20+.

### "My trades disappeared!"

- Did you clear your browser data? Your trades are stored in `localStorage`.
- Try restoring from a backup (see above)
- Check if you're using a different browser than before

### "The CSV import isn't working"

- Make sure your file is a `.csv` file (not Excel `.xlsx`)
- Check that the file isn't empty
- Try exporting from your platform again

### "Docker says 'port already in use'"

Another app is using port 3001. Either:
- Close that app, or
- Edit `docker-compose.yml` and change `3001:3000` to another open port like `3002:3000`, then use that new port in your browser

### "next: command not found" or build errors

Make sure you installed dependencies first:
```bash
npm run install:web
```
This must be run before `npm run dev`.

---

## FAQ

### Is my data safe?

Yes! Your data stays on your computer. TradePilot has no servers, no accounts, and no way to see your trades.

### Can I use this on multiple computers?

Yes, but your data won't sync automatically. You'll need to:
1. Export a backup on Computer A
2. Transfer the backup file to Computer B
3. Import the backup on Computer B

### Is this really free?

Yes! The self-hosted version (what you're using) is 100% free forever. We may offer a paid hosted version in the future for people who don't want to run it themselves.

### How do I update TradePilot?

1. Download the latest version from GitHub
2. Stop the current version (`docker-compose down`)
3. Replace the old folder with the new one
4. Start it again (`docker-compose up -d --build`)

### I found a bug / have a feature request

Open an issue on GitHub: [github.com/abrhamhabtu/trade-pilot/issues](https://github.com/abrhamhabtu/trade-pilot/issues)

---

## Need More Help?

- 📖 Check the [README](README.md) for more details
- 🏗️ See [ARCHITECTURE.md](ARCHITECTURE.md) to understand how data is stored and how the Next.js App Router is structured
- 🔄 See [CHANGES.md](CHANGES.md) for a history of what changed and why
- 💬 Open an issue on GitHub if you're stuck

---

*Happy trading! 📈*
