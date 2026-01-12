"use client";

import { useState, useRef, useEffect } from "react";
import ChatMessage from "./components/ChatMessage";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type BackendSession = {
  id: string;
  created_at: string;
};

const API_BASE_URL = "http://127.0.0.1:8000"; // change to ngrok URL when needed
const APP_PASSWORD = "12345";
const NO_TOUCH_MODE = true;
const SILENCE_TIMEOUT_MS = 900;

// 🔊 Fixed welcome audio
const DEFAULT_AUDIO_URL = "/default.mp3";

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<BackendSession[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [listeningLang, setListeningLang] =
    useState<"ta" | "te" | "en">("ta");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const transcriptBufferRef = useRef("");
  const sessionFileRef = useRef<string | null>(null);

  /* ---------------- LOAD SESSIONS ---------------- */

  const loadSessions = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/sessions`);
      setSessions(await res.json());
    } catch (e) {
      console.error("Failed to load sessions", e);
    }
  };

  const loadSession = async (id: string) => {
    const res = await fetch(`${API_BASE_URL}/sessions/${id}`);
    const data = await res.json();
    setMessages(data.messages);
    setShowSidebar(false);
  };

  useEffect(() => {
    if (isAuthenticated) loadSessions();
  }, [isAuthenticated]);

  /* ---------------- AUDIO HELPERS ---------------- */

  const playDefaultAudio = (onEnd?: () => void) => {
    if (audioRef.current) audioRef.current.pause();

    const audio = new Audio(DEFAULT_AUDIO_URL);
    audioRef.current = audio;

    audio.onended = () => onEnd && onEnd();
    audio.play().catch(() => {});
  };

  const playAudioFromBase64 = (base64Audio: string, onEnd?: () => void) => {
    const audioBlob = new Blob(
      [Uint8Array.from(atob(base64Audio), (c) => c.charCodeAt(0))],
      { type: "audio/mp3" }
    );

    if (audioRef.current) audioRef.current.pause();

    const audio = new Audio(URL.createObjectURL(audioBlob));
    audioRef.current = audio;

    audio.onended = () => onEnd && onEnd();
    audio.play().catch(() => {});
  };

  /* ---------------- BACKEND CALL ---------------- */

  const sendTextToBackend = async (text: string) => {
    if (!text) return;

    setIsLoading(true);

    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: "Thinking..." },
    ]);

    try {
      const res = await fetch(`${API_BASE_URL}/query/text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          session_file: sessionFileRef.current,
        }),
      });

      const data = await res.json();

      if (!sessionFileRef.current && data.session_file) {
        sessionFileRef.current = data.session_file;
        loadSessions();
      }

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: data.text,
        };
        return updated;
      });

      // 🔤 Language detection unchanged
      if (/[\u0B80-\u0BFF]/.test(data.text)) setListeningLang("ta");
      else if (/[\u0C00-\u0C7F]/.test(data.text)) setListeningLang("te");
      else setListeningLang("en");

      // 🔊 PLAY BACKEND AUDIO (NOT default)
      if (data.audio) {
        playAudioFromBase64(data.audio, () => {
          if (NO_TOUCH_MODE) {
            setTimeout(startListening, 700);
          }
        });
      } else {
        // fallback (rare)
        if (NO_TOUCH_MODE) {
          setTimeout(startListening, 700);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  /* ---------------- LISTENING ---------------- */

  const startListening = () => {
    if (isListening || isLoading) return;

    const SR =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognitionRef.current = recognition;

    recognition.lang =
      listeningLang === "ta"
        ? "ta-IN"
        : listeningLang === "te"
        ? "te-IN"
        : "en-US";

    recognition.continuous = false;
    recognition.interimResults = false;
    transcriptBufferRef.current = "";

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      transcriptBufferRef.current +=
        " " + event.results[0][0].transcript;

      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        recognition.stop();
      }, SILENCE_TIMEOUT_MS);
    };

    recognition.onend = () => {
      clearTimeout(silenceTimerRef.current);
      setIsListening(false);

      const finalText = transcriptBufferRef.current.trim();
      transcriptBufferRef.current = "";

      if (finalText) sendTextToBackend(finalText);
    };

    recognition.onerror = () => {
      clearTimeout(silenceTimerRef.current);
      setIsListening(false);
    };

    recognition.start();
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      startListening();
    }
  };

  /* ---------------- WELCOME ---------------- */

  const speakWelcome = async () => {
    const text = "வணக்கம் பாஸ்… இன்று எப்படி இருக்கிறீர்கள்?";
    setMessages([{ role: "assistant", content: text }]);

    const res = await fetch(`${API_BASE_URL}/query/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    const data = await res.json();
    sessionFileRef.current = data.session_file;
    loadSessions();
    setListeningLang("ta");

    // 🔊 ONLY HERE we play default.mp3
    playDefaultAudio(() => {
      setTimeout(startListening, 800);
    });
  };

  /* ---------------- PASSWORD ---------------- */

  const submitPassword = () => {
    if (passwordInput === APP_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError("");
      setTimeout(speakWelcome, 400);
    } else {
      setPasswordError("Try again");
      setPasswordInput("");
    }
  };

  /* ---------------- UI ---------------- */

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="w-full max-w-sm bg-slate-900 p-6 rounded-xl">
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitPassword()}
            className="w-full p-3 bg-slate-800"
          />
          {passwordError && <div>{passwordError}</div>}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex relative">
      {showSidebar && (
        <aside className="w-64 bg-slate-900 p-4 overflow-y-auto">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => loadSession(s.id)}
              className="block w-full text-left mb-2"
            >
              {new Date(s.created_at).toLocaleString()}
            </button>
          ))}
        </aside>
      )}

      <div className="flex-1 px-4 py-6">
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="absolute top-4 left-4 text-xl"
        >
          ☰
        </button>

        {messages.map((msg, idx) => (
          <ChatMessage key={idx} role={msg.role} content={msg.content} />
        ))}
      </div>

      {/* 🔵 ALWAYS-VISIBLE ORB */}
      <div
        onClick={toggleListening}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 cursor-pointer"
      >
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center
          ${isListening ? "bg-indigo-600/30 animate-pulse" : "bg-indigo-600/10"}`}
        >
          <div className="w-8 h-8 rounded-full bg-indigo-500" />
        </div>
      </div>
    </main>
  );
}
