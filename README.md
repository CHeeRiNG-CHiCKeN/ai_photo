# Interactive AI Photo Booth (MVP)

A trendy, kitsch-style AI photo booth with air drawing, sparkles, hearts, and neon UI.

## Setup

```bash
npm install
npm run dev
```

Open the local Vite URL (usually `http://localhost:5173`).

## Controls

- **Pinch (thumb + index):** Draw neon light trails
- **Raised hand:** Emits sparkle particles
- **Heart gesture (tight pinch):** Heart explosion effect
- **Bottom swatches:** Change neon drawing color
- **Trash button:** Clear drawing canvas
- **Record button:** Start/stop short webm recording

## Tech

- React + Hooks
- react-webcam
- MediaPipe Hands
- HTML5 Canvas + requestAnimationFrame
