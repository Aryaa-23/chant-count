# Chant Counter App
A simple and accessible chant counter web app designed to help users (especially elderly users) track chanting repetitions with both manual and voice-based counting.

## Features
- Large, easy-to-read interface
- Manual counter controls:
  - `+1 Chant`
  - `-1 Undo`
  - `Reset`
- Configurable chant name and target count (default: `108`)
- Voice recognition counting mode:
  - Start/stop listening
  - Language selection (`English`, `Hindi`, `Sanskrit (experimental)`)
  - Confidence threshold filtering
  - Duplicate cooldown protection
- Exceeded-target alert:
  - Visual alert message
  - Beep sound
  - Optional spoken voice alert
- Local persistence using browser `localStorage`

## Tech Stack
- HTML
- CSS
- Vanilla JavaScript
- Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)

## Project Structure
- `index.html` - App structure and UI controls
- `styles.css` - Styling and accessibility-friendly layout
- `app.js` - Counter logic, voice recognition, state persistence, alerts

## Getting Started
### Option 1: Open directly in browser
1. Go to the project folder.
2. Open `index.html` in a supported browser (Chrome/Edge recommended).

### Option 2: Run a local server (optional)
If you prefer serving through HTTP:

```bash
python -m http.server 8000
```

Then open: `http://localhost:8000`

## How to Use
1. Enter your chant name.
2. Set target count.
3. (Optional) Choose voice recognition language.
4. Set confidence threshold and cooldown if needed.
5. Click **Save Settings**.
6. Use either:
   - Manual counting buttons, or
   - **Start Listening** for voice counting.
7. The app will alert when the count exceeds target.

## Voice Recognition Notes
- Best experience is in Chromium-based browsers (Chrome/Edge).
- Microphone permission is required.
- Recognition quality depends on pronunciation, background noise, and browser support.
- Sanskrit mode is marked experimental and may vary by browser/device.

## Troubleshooting
- **Mic denied**: Allow microphone access in browser site permissions and retry.
- **Not counting voice input**:
  - Make sure the spoken phrase matches the saved chant text.
  - Lower confidence threshold (example: `0.55`).
  - Increase cooldown only if duplicate counts happen too often.
- **Voice feature unavailable**:
  - Try latest Chrome or Edge.
  - Use manual `+1 Chant` as fallback.

## Future Improvements
- Progressive Web App (PWA) install support
- Offline-first enhancements
- Optional vibration/haptic feedback for mobile
- Export chant history/statistics
