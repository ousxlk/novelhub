# Novel Hub — Windows Desktop

A desktop novel-library and reading experience built with React, Vite, and Electron.

## Features
- Discover and search a curated set of sample novels.
- Save titles to your personal library during the current session.
- Read chapters with previous/next navigation.
- Download an individual chapter or all chapters as UTF-8 text files.
- English, French, Spanish, German, and Arabic interface options (including RTL layout).
- Dark and light themes; responsive desktop and mobile layout.

## Run locally
```bash
npm install
npm run dev
```

## Build the Windows installer locally
```bash
npm install
npm run dist:win
```
The installer is written to `release/`.

## Automatic build
Every push to `main` runs the GitHub Actions workflow in `.github/workflows/build-windows.yml`. When it succeeds, open the workflow run and download the **Novel-Hub-Windows-Installer** artifact. It contains the Windows `.exe` installer.

The repository's sample stories are demonstration content. Add your own novel catalogue and chapter text in `src/App.tsx`.
