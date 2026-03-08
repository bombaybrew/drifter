# Drifter Architecture

## Purpose
Drifter is a generic, zero-maintenance UI testing engine.
Its importance lies in automatically catching frontend regressions (console errors, warnings, crashes) across all pages of an app. This ensures reliability without the burden of constantly updating hard-coded test scripts whenever the product's UI or routing changes.

## Tech Stack
*   **Node.js**: Runtime environment
*   **Puppeteer (Headless Chrome)**: To render the UI and scrape logs
*   **SSE (Server-Sent Events)**: To stream live screenshots and logs to the monitor dashboard

## Design
*   **Entry Point**: Navigates to a target homepage (e.g., `localhost:7800`).
*   **Auto-Discovery**: Recursively clicks and queues all internal `<a>` links found on the rendered page.
*   **Live Monitoring**: Serves a dashboard on port `7801` that provides a visual "Brawler Viewport" and real-time logs.
*   **Reporting**: Hooks into the browser's console and network events, captures failures, and prints an aggregated summary.
