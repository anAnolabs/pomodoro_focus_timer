# 🍅 FocusFlow: Advanced Pomodoro Timer

A beautiful, minimal, yet feature-rich Pomodoro Focus Timer built with **Vanilla HTML, CSS, and JavaScript**. Zero build tools required, but packed with advanced productivity features.

## ✨ Features

- ⏱ **Customizable Timer**: Configure Focus, Short Break, and Long Break durations. 
- 🔁 **Auto-Cycles**: Automatically switches to Long Break after 4 focus sessions.
- 📋 **Task Management**: Add tasks, estimate required Pomodoros, and track completion right from the dashboard.
- 🌱 **Virtual Garden (Gamification)**: Plant a tree during your focus session. If you switch tabs and leave the timer, your tree will die! Successfully complete the session to grow your forest.
- 📊 **Statistics**: Session numbers, focus time, and a 7-day activity chart.
- 🎧 **Ambient Sounds**: Built-in rain, cafe, and ocean sounds to boost concentration.
- 🌙 **Dark / Light Mode**: Smooth, glassmorphism UI that respects your system preference or manual toggle.
- 💾 **Local Storage**: All your tasks, settings, garden history, and statistics are saved locally in your browser.

## 🚀 How to Run

Since it uses standard web technologies, running it is incredibly simple:

1. Serve it locally using any HTTP server:
   ```bash
   # Using Python 3
   python3 -m http.server 8080

   # Or using Node/npx
   npx serve .
   ```
2. Open your browser and navigate to `http://localhost:8080` (or the port provided).

> **Note:** Opening `index.html` directly via the `file://` protocol works for most features, but running a local server is recommended to ensure all `localStorage` and audio features behave perfectly.

## 📁 Project Structure

```
Pomodoro/
├── index.html    ← The main UI layout
├── styles.css    ← Design tokens, flexbox/grid layouts, animations
├── app.js        ← Core timer logic, local storage, gamification
└── README.md     ← This file
```

## 🛠 Tech Stack
- Vanilla HTML5 / CSS3 / JavaScript
- CSS Variables for easy theming
- CSS Grid/Flexbox for responsive design
- LocalStorage API for data persistence
- Page Visibility API for gamification penalty
- Web Audio API / HTML5 Audio for ambient sounds and beeps
