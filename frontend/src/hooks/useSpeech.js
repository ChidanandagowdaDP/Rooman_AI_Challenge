import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Speech-to-text via the Web Speech API and text-to-speech via
 * speechSynthesis. Both are browser-native — no backend or API keys.
 * Components must handle `sttSupported === false` gracefully.
 */

function getRecognition() {
  const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = "en-US";
  rec.continuous = true;
  rec.interimResults = true;
  return rec;
}

export function useSpeechRecognition({ onFinal }) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [sttError, setSttError] = useState(null);

  const recognitionRef = useRef(null);
  const manualStopRef = useRef(false);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const stop = useCallback(() => {
    manualStopRef.current = true;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setInterim("");
  }, []);

  const start = useCallback(() => {
    if (recognitionRef.current) return;
    const rec = getRecognition();
    if (!rec) {
      setSttError("Speech recognition is not supported in this browser.");
      return;
    }
    setSttError(null);
    manualStopRef.current = false;

    rec.onresult = (event) => {
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          onFinalRef.current?.(result[0].transcript.trim());
        } else {
          pending += result[0].transcript;
        }
      }
      setInterim(pending);
    };
    rec.onerror = (event) => {
      if (event.error === "no-speech") return; // harmless pause
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setSttError("Microphone access was denied. Allow it in your browser settings.");
      } else if (event.error !== "aborted") {
        setSttError("Voice input failed. Try again or type your answer.");
      }
      manualStopRef.current = true;
      recognitionRef.current = null;
      setListening(false);
      setInterim("");
    };
    rec.onend = () => {
      // Chrome ends the session on silence — restart unless the user stopped.
      if (!manualStopRef.current && recognitionRef.current === rec) {
        try {
          rec.start();
          return;
        } catch {
          /* fall through to cleanup */
        }
      }
      if (recognitionRef.current === rec) recognitionRef.current = null;
      setListening(false);
      setInterim("");
    };

    recognitionRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setSttError("Could not start voice input.");
    }
  }, []);

  useEffect(
    () => () => {
      manualStopRef.current = true;
      recognitionRef.current?.abort?.();
    },
    []
  );

  return { listening, interim, sttError, sttSupported: Boolean(getRecognition()), start, stop };
}

export function useSpeechSynthesis() {
  const [speaking, setSpeaking] = useState(false);
  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  const stopSpeaking = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const speak = useCallback(
    (text) => {
      if (!supported || !text) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.02;
      utterance.pitch = 1;
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      setSpeaking(true);
      window.speechSynthesis.speak(utterance);
    },
    [supported]
  );

  useEffect(() => () => supported && window.speechSynthesis.cancel(), [supported]);

  return { speak, stopSpeaking, speaking, ttsSupported: supported };
}
