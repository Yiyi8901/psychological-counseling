import { useState, useRef, useEffect } from "react";
import { Send, User, Bot } from "lucide-react";
import SkillButtons from "./SkillButtons";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  type?: "text" | "card";
  cardData?: any;
  triageOptions?: { label: string; value: string; description: string }[];
  triageType?: string;
}

interface ChatWindowProps {
  conversationTitle: string;
  messages: Message[];
  onSendMessage: (content: string) => void;
  onSkillTrigger: (skillType: "sleep" | "cbt" | "emotion") => void;
  onTriageSelect: (value: string) => void;
  isTyping: boolean;
}

export default function ChatWindow({
  conversationTitle,
  messages,
  onSendMessage,
  onSkillTrigger,
  onTriageSelect,
  isTyping,
}: ChatWindowProps) {
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue("");
    }
  };

  const handleTriageClick = (value: string) => {
    onTriageSelect(value);
  };

  return (
    <div className="w-3/4 h-full bg-white flex flex-col">
      <div className="h-14 bg-morandi-cream border-b border-morandi-gray flex items-center justify-between px-6">
        <h2 className="text-lg font-semibold text-morandi-text">
          {conversationTitle || "新对话"}
        </h2>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400"></div>
          <span className="text-sm text-morandi-dark">在线</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 bg-morandi-cream">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-full bg-morandi-peach flex items-center justify-center mb-4">
              <Bot size={40} className="text-morandi-text" />
            </div>
            <h3 className="text-lg font-medium text-morandi-text mb-2">
              你好，我是心语
            </h3>
            <p className="text-sm text-morandi-dark max-w-xs">
              我可以陪你聊天，或者帮你进行助眠引导、认知重构、情绪急救。
              请选择下方的功能按钮开始吧！
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div className={`flex items-start gap-3 max-w-[70%] ${
                  msg.role === "user" ? "flex-row-reverse" : ""
                }`}>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      msg.role === "user"
                        ? "bg-morandi-blue"
                        : "bg-morandi-peach"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <User size={16} className="text-morandi-text" />
                    ) : (
                      <Bot size={16} className="text-morandi-text" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <div
                      className={`px-4 py-3 rounded-2xl ${
                        msg.role === "user"
                          ? "bg-morandi-blue text-morandi-text rounded-tr-sm"
                          : "bg-white text-morandi-text rounded-tl-sm shadow-sm border border-morandi-gray"
                      }`}
                    >
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    </div>
                    
                    {msg.type === "card" && msg.cardData && (
                      <div className="bg-white rounded-xl p-4 shadow-sm border border-morandi-gray">
                        {renderCard(msg.cardData)}
                      </div>
                    )}
                    
                    {msg.triageOptions && msg.triageOptions.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {msg.triageOptions.map((option) => (
                          <button
                            key={option.value}
                            onClick={() => handleTriageClick(option.value)}
                            className="px-4 py-2 bg-morandi-peach/30 hover:bg-morandi-peach/50 border border-morandi-peach rounded-full transition-colors"
                          >
                            <span className="text-sm font-medium text-morandi-text">
                              {option.description}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    <p className="text-xs text-morandi-dark/50 ml-1">
                      {msg.timestamp}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-morandi-peach flex items-center justify-center flex-shrink-0">
                    <Bot size={16} className="text-morandi-text" />
                  </div>
                  <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-morandi-gray">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-morandi-dark/40 rounded-full animate-bounce"></span>
                      <span className="w-2 h-2 bg-morandi-dark/40 rounded-full animate-bounce delay-75"></span>
                      <span className="w-2 h-2 bg-morandi-dark/40 rounded-full animate-bounce delay-150"></span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <SkillButtons onSkillTrigger={onSkillTrigger} />

      <form onSubmit={handleSubmit} className="p-4 border-t border-morandi-gray bg-white">
        <div className="flex items-end gap-3">
          <div className="flex-1 bg-morandi-gray rounded-2xl px-4 py-3">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="输入你想说的话..."
              className="w-full bg-transparent text-sm text-morandi-text resize-none outline-none placeholder:text-morandi-dark/40"
              rows={1}
              style={{ maxHeight: "120px" }}
            />
          </div>
          <button
            type="submit"
            disabled={!inputValue.trim() || isTyping}
            className="w-10 h-10 rounded-full bg-morandi-peach flex items-center justify-center flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-morandi-pink transition-colors"
          >
            <Send size={18} className="text-morandi-text" />
          </button>
        </div>
      </form>
    </div>
  );
}

function renderCard(cardData: any) {
  if (cardData.type === "sleep_action") {
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🌙</span>
          <h4 className="font-semibold text-morandi-text">助眠行动卡</h4>
        </div>
        <div className="space-y-3">
          {cardData.steps?.map((step: any, index: number) => (
            <div key={index} className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-morandi-blue text-white text-xs flex items-center justify-center flex-shrink-0">
                {index + 1}
              </span>
              <p className="text-sm text-morandi-text">{step}</p>
            </div>
          ))}
        </div>
        {cardData.affirmation && (
          <div className="mt-4 p-3 bg-morandi-peach rounded-lg">
            <p className="text-sm text-morandi-text italic">
              " {cardData.affirmation} "
            </p>
          </div>
        )}
      </div>
    );
  }

  if (cardData.type === "cbt_worksheet") {
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🧩</span>
          <h4 className="font-semibold text-morandi-text">思维纠错表</h4>
        </div>
        <div className="space-y-4">
          <div className="p-3 bg-morandi-blue/10 rounded-lg">
            <p className="text-xs font-semibold text-morandi-dark mb-1">🔍 自动思维</p>
            <p className="text-sm text-morandi-text">{cardData.thought}</p>
          </div>
          <div className="p-3 bg-morandi-green/10 rounded-lg">
            <p className="text-xs font-semibold text-morandi-dark mb-2">✅ 证据支持</p>
            <p className="text-sm text-morandi-text mb-3">{cardData.evidence}</p>
            {cardData.evidenceOptions && (
              <div className="flex gap-2">
                {cardData.evidenceOptions.map((opt: any) => (
                  <button
                    key={opt.value}
                    onClick={() => handleTriageClick(opt.value)}
                    className="px-3 py-1.5 bg-morandi-green/20 hover:bg-morandi-green/40 border border-morandi-green/30 rounded-full text-xs text-morandi-text transition-colors"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="p-3 bg-morandi-pink/10 rounded-lg">
            <p className="text-xs font-semibold text-morandi-dark mb-2">❌ 相反证据</p>
            <p className="text-sm text-morandi-text mb-3">{cardData.opposite}</p>
            {cardData.oppositeOptions && (
              <div className="flex gap-2">
                {cardData.oppositeOptions.map((opt: any) => (
                  <button
                    key={opt.value}
                    onClick={() => handleTriageClick(opt.value)}
                    className="px-3 py-1.5 bg-morandi-pink/20 hover:bg-morandi-pink/40 border border-morandi-pink/30 rounded-full text-xs text-morandi-text transition-colors"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="p-3 bg-morandi-peach/20 rounded-lg">
            <p className="text-xs font-semibold text-morandi-dark mb-2">💡 理性替代</p>
            <button
              onClick={() => handleTriageClick("generate_alternative")}
              className="w-full py-2 bg-morandi-peach hover:bg-morandi-pink text-morandi-text rounded-lg text-sm font-medium transition-colors"
            >
              {cardData.alternative}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (cardData.type === "emotion_prescription") {
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl">🚑</span>
          <h4 className="font-semibold text-morandi-text">急救处方</h4>
        </div>
        <div className="mb-3">
          <p className="text-sm text-morandi-text">
            状态：<span className="font-semibold">{cardData.score}</span>
          </p>
          <p className="text-xs text-morandi-dark mt-1">{cardData.assessment}</p>
        </div>
        <div className="space-y-2">
          {cardData.prescription?.map((item: any, index: number) => (
            <div key={index} className="flex items-center gap-3 text-sm text-morandi-text">
              <span className="w-6 h-6 rounded-full bg-morandi-blue/20 flex items-center justify-center text-xs">
                {index + 1}
              </span>
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}
