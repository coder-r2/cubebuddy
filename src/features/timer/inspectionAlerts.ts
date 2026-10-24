// Inspection call-outs at 8 s and 12 s (SPEC §5.4, D-018): spoken where supported, otherwise a beep.

let audio: AudioContext | null = null;

function beep(highPitch: boolean) {
  try {
    audio ??= new AudioContext();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.frequency.value = highPitch ? 1200 : 880;
    gain.gain.setValueAtTime(0.2, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.25);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.25);
  } catch {
    // No audio available; the on-screen countdown still shows the time.
  }
}

export function announceInspection(seconds: 8 | 12) {
  if ('speechSynthesis' in window && window.speechSynthesis.getVoices().length > 0) {
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(`${seconds} seconds`));
  } else {
    beep(seconds === 12);
  }
}
