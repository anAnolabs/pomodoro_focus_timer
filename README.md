# 🍅 Pomodoro Focus Timer

A beautiful, minimal Pomodoro Focus Timer built as a **single HTML file** — no installation, no build tools required.

## Features

- ⏱ **25-minute work sessions** + **5-minute break** cycles with automatic switching
- 🔔 **Sound notification** (Web Audio API) when a session ends
- ▶ **Start / Pause / Resume / Reset / Skip** controls
- 📊 **Live stats**: sessions completed, total focus time, streak
- 🌙 **Dark / Light mode** toggle
- ⌨️ **Keyboard shortcuts**: `Space` = start/pause, `R` = reset, `S` = skip
- 💥 Animated SVG ring progress indicator
- 🎨 Glassmorphism card with animated gradient background blobs

## How to Run

1. Open `index.html` directly in any modern browser (Chrome, Firefox, Safari, Edge):
   ```
   open index.html          # macOS
   start index.html         # Windows
   xdg-open index.html      # Linux
   ```
2. Or serve with any local HTTP server:
   ```bash
   npx serve .
   # or
   python3 -m http.server 8080
   ```

## Keyboard Shortcuts

| Key     | Action        |
|---------|--------------|
| `Space` | Start / Pause |
| `R`     | Reset         |
| `S`     | Skip session  |

## Project Structure

```
Pomodoro/
└── index.html    ← Entire app (HTML + CSS + JS, self-contained)
└── README.md     ← This file
```

## Tech Stack

- Vanilla **HTML5 / CSS3 / JavaScript** — zero dependencies
- **Web Audio API** for sound notifications
- **Google Fonts** (Inter + Space Mono) loaded via CDN
