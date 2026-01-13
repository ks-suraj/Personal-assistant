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

const API_BASE_URL = "https://4fd167f69e6f.ngrok-free.app";
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
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);

  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<BackendSession[]>([]);
  const [showSidebar, setShowSidebar] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [listeningLang, setListeningLang] = useState<"ta" | "te" | "en">("ta");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const transcriptBufferRef = useRef("");
  const sessionFileRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  /* ---------------- LOAD SESSIONS ---------------- */

  const loadSessions = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/sessions`, {
        headers: { "ngrok-skip-browser-warning": "true" }
      });
      setSessions(await res.json());
    } catch (e) {
      console.error("Failed to load sessions", e);
    }
  };

  const loadSession = async (id: string) => {
    const res = await fetch(`${API_BASE_URL}/sessions/${id}`, {
      headers: { "ngrok-skip-browser-warning": "true" }
    });
    const data = await res.json();
    setMessages(data.messages);
    setShowSidebar(false);
  };

  useEffect(() => {
    if (isAuthenticated) loadSessions();
  }, [isAuthenticated]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
        headers: { 
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true"
        },
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
      if (/[஀-௿]/.test(data.text)) setListeningLang("ta");
      else if (/[ఀ-౿]/.test(data.text)) setListeningLang("te");
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

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
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
      transcriptBufferRef.current += " " + event.results[0][0].transcript;

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
      headers: { 
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true"
      },
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
      setPasswordError("Incorrect password. Try again.");
      setPasswordInput("");
    }
  };

  /* ---------------- NEW SESSION ---------------- */

  const startNewSession = () => {
    sessionFileRef.current = null;
    setMessages([]);
    setShowSidebar(false);
    speakWelcome();
  };

  /* ---------------- LANGUAGE LABELS ---------------- */

  const getLanguageLabel = () => {
    switch (listeningLang) {
      case "ta":
        return "தமிழ்";
      case "te":
        return "తెలుగు";
      default:
        return "English";
    }
  };

  /* ---------------- UI ---------------- */

  // Login Screen
  if (!isAuthenticated) {
    return (
      <main className="min-h-screen min-h-[100dvh] gradient-bg flex items-center justify-center p-4 safe-area-top safe-area-bottom">
        <div className="w-full max-w-sm animate-fade-in">
          {/* Logo/Brand */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/30 animate-float">
              <svg
                className="w-10 h-10 sm:w-12 sm:h-12 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              Personal Assistant
            </h1>
            <p className="text-slate-400 text-sm sm:text-base">
              Your intelligent voice companion
            </p>
          </div>

          {/* Login Card */}
          <div className="glass rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl">
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Enter Password
              </label>
              <div
                className={`relative transition-all duration-300 ${
                  isPasswordFocused ? "scale-[1.02]" : ""
                }`}
              >
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitPassword()}
                  onFocus={() => setIsPasswordFocused(true)}
                  onBlur={() => setIsPasswordFocused(false)}
                  placeholder="••••••••"
                  className={`w-full px-4 py-3 sm:py-4 bg-slate-800/50 border-2 rounded-xl text-white placeholder-slate-500 focus:outline-none transition-all duration-300 text-base ${
                    isPasswordFocused
                      ? "border-indigo-500 shadow-lg shadow-indigo-500/20"
                      : "border-slate-700/50"
                  } ${passwordError ? "border-red-500/50" : ""}`}
                  autoComplete="off"
                  data-testid="password-input"
                />
                <div
                  className={`absolute right-3 top-1/2 -translate-y-1/2 transition-opacity ${
                    passwordInput ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <svg
                    className="w-5 h-5 text-indigo-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                    />
                  </svg>
                </div>
              </div>
              {passwordError && (
                <p className="mt-2 text-red-400 text-sm animate-fade-in flex items-center gap-1">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  {passwordError}
                </p>
              )}
            </div>

            <button
              onClick={submitPassword}
              disabled={!passwordInput}
              className="w-full py-3 sm:py-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-indigo-500/25 disabled:shadow-none text-base"
              data-testid="login-button"
            >
              Unlock Assistant
            </button>
          </div>

          {/* Footer */}
          <p className="text-center text-slate-500 text-xs sm:text-sm mt-6">
            Supports Tamil, Telugu & English
          </p>
        </div>
      </main>
    );
  }

  // Main Chat Screen
  return (
    <main className="min-h-screen min-h-[100dvh] bg-[#0f0f1a] text-slate-100 flex flex-col relative overflow-hidden">
      {/* Sidebar Overlay */}
      {showSidebar && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full w-72 sm:w-80 glass z-50 transform transition-transform duration-300 ease-out ${
          showSidebar ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full safe-area-top">
          {/* Sidebar Header */}
          <div className="p-4 sm:p-5 border-b border-slate-700/50">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Conversations
              </h2>
              <button
                onClick={() => setShowSidebar(false)}
                className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
                data-testid="close-sidebar-button"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* New Chat Button */}
          <div className="p-4">
            <button
              onClick={startNewSession}
              className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium rounded-xl transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
              data-testid="new-chat-button"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New Conversation
            </button>
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {sessions.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">
                No previous conversations
              </p>
            ) : (
              <div className="space-y-2">
                {sessions.map((s, index) => (
                  <button
                    key={s.id}
                    onClick={() => loadSession(s.id)}
                    className="w-full text-left p-3 sm:p-4 bg-slate-800/40 hover:bg-slate-700/50 rounded-xl transition-all duration-200 group"
                    style={{ animationDelay: `${index * 50}ms` }}
                    data-testid={`session-${s.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
                        <svg
                          className="w-5 h-5 text-slate-400 group-hover:text-indigo-400 transition-colors"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                          />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">
                          Session
                        </p>
                        <p className="text-xs text-slate-500">
                          {new Date(s.created_at).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <svg
                        className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 transition-colors"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Header */}
      <header className="sticky top-0 z-30 glass border-b border-slate-700/30 safe-area-top">
        <div className="flex items-center justify-between px-4 py-3 sm:py-4">
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-2 sm:p-2.5 hover:bg-slate-700/50 rounded-xl transition-colors touchable"
            data-testid="menu-button"
          >
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </div>
            <span className="font-semibold text-sm sm:text-base">Assistant</span>
          </div>

          {/* Language Indicator */}
          <div className="px-3 py-1.5 bg-slate-800/60 rounded-full text-xs sm:text-sm font-medium text-slate-300">
            {getLanguageLabel()}
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 pb-32">
        <div className="max-w-3xl mx-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[50vh] text-center animate-fade-in">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mb-4 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-600/20 flex items-center justify-center">
                <svg
                  className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h2 className="text-lg sm:text-xl font-semibold text-slate-200 mb-2">
                Ready to assist
              </h2>
              <p className="text-slate-500 text-sm sm:text-base max-w-xs">
                Tap the microphone to start speaking
              </p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <ChatMessage
                key={idx}
                role={msg.role}
                content={msg.content}
                isLatest={idx === messages.length - 1}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Voice Orb */}
      <div className="fixed bottom-0 left-0 right-0 z-30 safe-area-bottom">
        <div className="flex flex-col items-center pb-4 sm:pb-6">
          {/* Status Text */}
          <div
            className={`mb-3 px-4 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-300 ${
              isListening
                ? "bg-indigo-500/20 text-indigo-300"
                : isLoading
                ? "bg-amber-500/20 text-amber-300"
                : "bg-slate-800/60 text-slate-400"
            }`}
          >
            {isListening
              ? "Listening..."
              : isLoading
              ? "Processing..."
              : "Tap to speak"}
          </div>

          {/* Orb Button */}
          <button
            onClick={toggleListening}
            disabled={isLoading}
            className="relative touchable focus:outline-none"
            data-testid="voice-orb-button"
          >
            {/* Outer Glow Rings */}
            {isListening && (
              <>
                <div className="absolute inset-0 w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-indigo-500/20 animate-pulse-ring" />
                <div
                  className="absolute inset-0 w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-indigo-500/10 animate-pulse-ring"
                  style={{ animationDelay: "0.5s" }}
                />
              </>
            )}

            {/* Main Orb */}
            <div
              className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all duration-300 transform ${
                isListening
                  ? "bg-gradient-to-br from-indigo-500 to-purple-600 scale-110 shadow-2xl shadow-indigo-500/50"
                  : isLoading
                  ? "bg-gradient-to-br from-amber-500 to-orange-600 shadow-xl shadow-amber-500/30"
                  : "bg-gradient-to-br from-slate-700 to-slate-800 hover:from-indigo-600 hover:to-purple-700 shadow-xl"
              } ${isListening ? "animate-pulse-core" : ""}`}
            >
              {/* Icon */}
              {isLoading ? (
                <svg
                  className="w-7 h-7 sm:w-8 sm:h-8 text-white animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <svg
                  className={`w-7 h-7 sm:w-8 sm:h-8 text-white transition-transform ${
                    isListening ? "scale-110" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
              )}
            </div>
          </button>
        </div>
      </div>
    </main>
  );
}