# DevOrbit

DevOrbit is a browser-based developer toolkit designed around a single idea: your tools should get out of your way. The interface is built on a pure black canvas with Geist Sans and Geist Mono, taking visual cues from precision design systems like Resend. Every panel is intentional, every control is visible, and nothing competes for attention.

## What it does

- **HTTP Formatter** — parse curl, PowerShell, and fetch commands into structured request views with headers, query params, body, and auth
- **HAR Analyzer** — drop a HAR file exported from Chrome DevTools or Safari and filter, inspect, and export every captured request
- **JWT Decoder** — decode and validate JSON Web Tokens with expiry status
- **JSON Pathfinder and Extractor** — navigate and query JSON structures with JSONPath
- **Base64 Toolkit** — encode, decode, detect media types, and inspect ASCII tables
- **Utilities** — UUID, HashID, timestamps, URL encoding, API key generation, and security headers
- **Request History** — persistent local history with tagging, pinning, HAR import/export, and side-by-side comparison

All processing happens client-side. No accounts, no telemetry, no data sent anywhere.

## Stack

- React + Vite
- Tailwind CSS
- Geist Sans + Geist Mono (self-hosted via `@fontsource`)

## Running locally

```bash
npm install
npm run dev
```
