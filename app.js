const STORAGE_KEY = "chantCounterStateV1";
const DEFAULT_TARGET = 108;
const DEFAULT_CHANT = "Om Namah Shivaya";
const DEFAULT_RECOGNITION_LANGUAGE = "en-US";
const DEFAULT_CONFIDENCE_THRESHOLD = 0.65;
const DEFAULT_COOLDOWN_MS = 1200;
const MIN_CONFIDENCE_THRESHOLD = 0.1;
const MAX_CONFIDENCE_THRESHOLD = 1;
const MIN_COOLDOWN_MS = 300;
const MAX_COOLDOWN_MS = 5000;
const SUPPORTED_RECOGNITION_LANGUAGES = ["en-US", "hi-IN", "sa-IN"];

const countDisplay = document.getElementById("countDisplay");
const progressText = document.getElementById("progressText");
const statusMessage = document.getElementById("statusMessage");
const chantLabel = document.getElementById("chantLabel");
const chantNameInput = document.getElementById("chantName");
const targetCountInput = document.getElementById("targetCount");
const recognitionLanguageInput = document.getElementById("recognitionLanguage");
const confidenceThresholdInput = document.getElementById("confidenceThreshold");
const cooldownMsInput = document.getElementById("cooldownMs");
const saveSettingsBtn = document.getElementById("saveSettings");
const incrementBtn = document.getElementById("incrementBtn");
const decrementBtn = document.getElementById("decrementBtn");
const resetBtn = document.getElementById("resetBtn");
const voiceAlertCheckbox = document.getElementById("voiceAlert");
const startListeningBtn = document.getElementById("startListeningBtn");
const stopListeningBtn = document.getElementById("stopListeningBtn");
const listeningStatus = document.getElementById("listeningStatus");
const lastHeardText = document.getElementById("lastHeardText");

let state = {
  chantName: DEFAULT_CHANT,
  target: DEFAULT_TARGET,
  count: 0,
  alertAnnounced: false,
  voiceAlert: true,
  recognitionLanguage: DEFAULT_RECOGNITION_LANGUAGE,
  confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
  cooldownMs: DEFAULT_COOLDOWN_MS
};
let recognition = null;
let isSpeechSupported = false;
let shouldKeepListening = false;
let isListening = false;
let lastMatchTimestamp = 0;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
function toNumberInRange(value, fallback, min, max) {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, min, max);
}

function sanitizeChantName(value) {
  const trimmed = String(value || "").trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_CHANT;
}

function sanitizeRecognitionLanguage(value) {
  const code = String(value || "").trim();
  if (SUPPORTED_RECOGNITION_LANGUAGES.includes(code)) {
    return code;
  }
  return DEFAULT_RECOGNITION_LANGUAGE;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);

    state.chantName = sanitizeChantName(parsed.chantName);
    state.target = toPositiveInt(parsed.target, DEFAULT_TARGET);
    state.count = Math.max(0, toPositiveInt(parsed.count, 0));
    state.alertAnnounced = Boolean(parsed.alertAnnounced);
    state.voiceAlert = parsed.voiceAlert !== false;
    state.recognitionLanguage = sanitizeRecognitionLanguage(parsed.recognitionLanguage);
    state.confidenceThreshold = toNumberInRange(
      parsed.confidenceThreshold,
      DEFAULT_CONFIDENCE_THRESHOLD,
      MIN_CONFIDENCE_THRESHOLD,
      MAX_CONFIDENCE_THRESHOLD
    );
    state.cooldownMs = Math.round(
      toNumberInRange(parsed.cooldownMs, DEFAULT_COOLDOWN_MS, MIN_COOLDOWN_MS, MAX_COOLDOWN_MS)
    );
  } catch {
    state = {
      chantName: DEFAULT_CHANT,
      target: DEFAULT_TARGET,
      count: 0,
      alertAnnounced: false,
      voiceAlert: true,
      recognitionLanguage: DEFAULT_RECOGNITION_LANGUAGE,
      confidenceThreshold: DEFAULT_CONFIDENCE_THRESHOLD,
      cooldownMs: DEFAULT_COOLDOWN_MS
    };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function setListeningStatus(text, type = "info") {
  listeningStatus.classList.remove("info", "success", "alert");
  listeningStatus.classList.add(type);
  listeningStatus.textContent = text;
}

function setLastHeard(transcript, confidence) {
  if (!transcript) {
    lastHeardText.textContent = "Last heard: —";
    return;
  }
  const confidenceText = `${Math.round(confidence * 100)}%`;
  lastHeardText.textContent = `Last heard: "${transcript}" (${confidenceText} confidence)`;
}

function updateListeningButtons() {
  const canListen = isSpeechSupported && recognition;
  startListeningBtn.disabled = !canListen || isListening;
  stopListeningBtn.disabled = !canListen || !isListening;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function transcriptMatchesChant(transcript, chantName) {
  const normalizedTranscript = normalizeText(transcript);
  const normalizedChant = normalizeText(chantName);
  if (!normalizedTranscript || !normalizedChant) return false;
  return normalizedTranscript.includes(normalizedChant);
}

function getPrimaryAlternative(result) {
  let best = result[0];
  for (let i = 1; i < result.length; i += 1) {
    const current = result[i];
    if ((current.confidence || 0) > (best.confidence || 0)) {
      best = current;
    }
  }
  return best;
}

function playBeep() {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = 880;
  gainNode.gain.value = 0.08;

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.35);
}

function speakAlert(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

function announceExceeded() {
  playBeep();
  if (state.voiceAlert) {
    speakAlert("You have exceeded your target chant count.");
  }
}
function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    setListeningStatus("Voice counting is not supported in this browser.", "alert");
    updateListeningButtons();
    return;
  }

  recognition = new SpeechRecognition();
  isSpeechSupported = true;
  recognition.lang = state.recognitionLanguage;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;

  recognition.onstart = () => {
    isListening = true;
    updateListeningButtons();
    setListeningStatus("Listening... chant your selected phrase.", "info");
  };

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const bestAlternative = getPrimaryAlternative(result);
      const transcript = String(bestAlternative.transcript || "").trim();
      const confidence = bestAlternative.confidence > 0 ? bestAlternative.confidence : 1;

      if (!transcript) continue;
      setLastHeard(transcript, confidence);

      if (!result.isFinal) continue;
      if (confidence < state.confidenceThreshold) {
        setListeningStatus("Heard voice but confidence was too low, so count was skipped.", "info");
        continue;
      }
      if (!transcriptMatchesChant(transcript, state.chantName)) {
        continue;
      }

      const now = Date.now();
      if (now - lastMatchTimestamp < state.cooldownMs) {
        setListeningStatus("Duplicate chant detected too quickly, skipped by cooldown.", "info");
        continue;
      }

      state.count += 1;
      state.alertAnnounced = false;
      lastMatchTimestamp = now;
      render();
      setListeningStatus("Voice counted +1 chant.", "success");
    }
  };

  recognition.onerror = (event) => {
    const errorName = event.error || "unknown";
    if (errorName === "not-allowed" || errorName === "service-not-allowed") {
      shouldKeepListening = false;
      setListeningStatus("Microphone access denied. Please allow mic permission and retry.", "alert");
      return;
    }
    if (errorName === "no-speech") {
      setListeningStatus("No speech detected. Keep mic close and try again.", "info");
      return;
    }
    setListeningStatus(`Voice recognition error: ${errorName}`, "alert");
  };

  recognition.onend = () => {
    isListening = false;
    updateListeningButtons();
    if (shouldKeepListening) {
      try {
        recognition.start();
        return;
      } catch {
        setListeningStatus("Voice counting stopped unexpectedly. Press Start Listening again.", "alert");
        shouldKeepListening = false;
        return;
      }
    }
    setListeningStatus("Voice counting is idle.", "info");
  };

  updateListeningButtons();
}

function startListening() {
  if (!recognition || isListening) return;
  shouldKeepListening = true;
  try {
    recognition.start();
  } catch {
    shouldKeepListening = false;
    setListeningStatus("Unable to start listening right now. Please try again.", "alert");
  }
}

function stopListening() {
  if (!recognition) return;
  shouldKeepListening = false;
  if (isListening) {
    recognition.stop();
  } else {
    setListeningStatus("Voice counting is idle.", "info");
  }
}

function updateStatus() {
  const remaining = state.target - state.count;
  statusMessage.classList.remove("info", "success", "alert");

  if (state.count < state.target) {
    statusMessage.classList.add("info");
    statusMessage.innerHTML = `Keep going. ${remaining} chants remaining to reach your target.`;
    state.alertAnnounced = false;
    return;
  }

  if (state.count === state.target) {
    statusMessage.classList.add("success");
    statusMessage.innerHTML = "You reached your target. Great chanting!";
    state.alertAnnounced = false;
    return;
  }

  const exceededBy = state.count - state.target;
  statusMessage.classList.add("alert");
  statusMessage.innerHTML = `Alert: You exceeded the target by ${exceededBy} chant${exceededBy === 1 ? "" : "s"}.`;

  if (!state.alertAnnounced) {
    announceExceeded();
    state.alertAnnounced = true;
  }
}

function render() {
  countDisplay.textContent = String(state.count);
  progressText.textContent = `${state.count} / ${state.target}`;
  chantLabel.textContent = `Current chant: ${state.chantName}`;

  chantNameInput.value = state.chantName;
  targetCountInput.value = String(state.target);
  recognitionLanguageInput.value = state.recognitionLanguage;
  confidenceThresholdInput.value = String(state.confidenceThreshold.toFixed(2));
  cooldownMsInput.value = String(state.cooldownMs);
  voiceAlertCheckbox.checked = state.voiceAlert;

  updateStatus();
  updateListeningButtons();
  saveState();
}

function saveSettings() {
  state.chantName = sanitizeChantName(chantNameInput.value);
  state.target = toPositiveInt(targetCountInput.value, DEFAULT_TARGET);
  state.recognitionLanguage = sanitizeRecognitionLanguage(recognitionLanguageInput.value);
  state.confidenceThreshold = toNumberInRange(
    confidenceThresholdInput.value,
    DEFAULT_CONFIDENCE_THRESHOLD,
    MIN_CONFIDENCE_THRESHOLD,
    MAX_CONFIDENCE_THRESHOLD
  );
  state.cooldownMs = Math.round(
    toNumberInRange(cooldownMsInput.value, DEFAULT_COOLDOWN_MS, MIN_COOLDOWN_MS, MAX_COOLDOWN_MS)
  );
  if (state.count <= state.target) {
    state.alertAnnounced = false;
  }
  if (recognition) {
    recognition.lang = state.recognitionLanguage;
  }
  render();
}

incrementBtn.addEventListener("click", () => {
  state.count += 1;
  render();
});

decrementBtn.addEventListener("click", () => {
  state.count = Math.max(0, state.count - 1);
  if (state.count <= state.target) {
    state.alertAnnounced = false;
  }
  render();
});

resetBtn.addEventListener("click", () => {
  state.count = 0;
  state.alertAnnounced = false;
  render();
});
startListeningBtn.addEventListener("click", startListening);
stopListeningBtn.addEventListener("click", stopListening);

saveSettingsBtn.addEventListener("click", saveSettings);

chantNameInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    saveSettings();
  }
});

targetCountInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    saveSettings();
  }
});

recognitionLanguageInput.addEventListener("change", saveSettings);
confidenceThresholdInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    saveSettings();
  }
});

cooldownMsInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    saveSettings();
  }
});

voiceAlertCheckbox.addEventListener("change", (event) => {
  state.voiceAlert = event.target.checked;
  saveState();
});

loadState();
setupSpeechRecognition();
render();
