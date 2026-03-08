# Drifter

Drifter is a high-performance, standalone UI crawling engine. It uses Headless Chrome to automatically "drift" through any web application, detecting console errors, network failures, and UI regressions.

Designed to be zero-maintenance and extremely portable.

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```
2. **Launch the engine**:
   ```bash
   npm start
   ```
3. **Monitor**: Open **[http://localhost:7801](http://localhost:7801)** and click **"Run Drift Session"**.

## Configuration

Drifter is highly generic. You can configure it via the `CONFIG` object in `src/config.js` or via Environment Variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `TARGET_URL` | The application you want to test | `http://localhost:7800` |
| `TESTER_PORT` | Port for the Drifter dashboard | `7801` |

Example targeting a production site:
```bash
TARGET_URL=https://myapp.com npm start
```

## Performance Architecture

Drifter is optimized for speed and human observability:

- **Background Heartbeat**: Screenshots are captured as non-blocking background tasks. The engine never pauses to wait for the camera.
- **SPA Fast-Path**: Unlike standard tools that wait for absolute page "load" events, Drifter polls for content and proceeds as soon as the UI is interactive.
- **Visual Intelligence**: Includes a 2-second "Visual Pause" on every page so human eyes can actually follow the crawl in the dashboard.
- **Zero-Bloat**: A simple engine with minimal dependencies. Move the folder to any project and it just works.

## Error Detection
- Console `error` and `warning` messages.
- Uncaught Javascript Exceptions.
- Network failures (4xx/5xx status codes).
- Navigation timeouts.
