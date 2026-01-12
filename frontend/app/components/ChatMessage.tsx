"use client";

import { useEffect, useRef } from "react";

type ChatMessageProps = {
  role: "user" | "assistant";
  content: string;
  isLatest?: boolean;
};

export default function ChatMessage({ role, content, isLatest = false }: ChatMessageProps) {
  const isUser = role === "user";
  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLatest && messageRef.current) {
      messageRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [isLatest, content]);

  return (
    <div
      ref={messageRef}
      className={`w-full flex mb-3 sm:mb-4 animate-fade-in ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {/* Avatar for Assistant */}
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mr-2 sm:mr-3 shadow-lg shadow-indigo-500/20">
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
              d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19 14.5M14.25 3.104c.251.023.501.05.75.082M19 14.5l-2.47 2.47a3.375 3.375 0 01-4.06.56l-.97-.58a3.375 3.375 0 00-4.06.56L5 19.5"
            />
          </svg>
        </div>
      )}

      {/* Message Bubble */}
      <div
        className={`max-w-[85%] sm:max-w-[75%] md:max-w-[65%] rounded-2xl px-4 py-3 text-sm sm:text-base leading-relaxed transition-all duration-200 ${
          isUser
            ? "bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-br-md shadow-lg shadow-indigo-500/25"
            : "glass text-slate-100 rounded-bl-md"
        } ${
          content === "Thinking..."
            ? "animate-shimmer"
            : ""
        }`}
      >
        <p className="whitespace-pre-wrap break-words">{content}</p>
      </div>

      {/* Avatar for User */}
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center ml-2 sm:ml-3 shadow-lg shadow-emerald-500/20">
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
              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
