type ChatMessageProps = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <div
      className={`w-full flex ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-indigo-600 text-white"
            : "bg-slate-800 text-slate-100"
        }`}
      >
        {content}
      </div>
    </div>
  );
}
