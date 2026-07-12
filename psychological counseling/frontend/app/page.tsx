"use client";

import { useState, useCallback } from "react";
import Sidebar, { Conversation } from "@/components/Sidebar";
import ChatWindow, { Message } from "@/components/ChatWindow";

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [currentMode, setCurrentMode] = useState<Record<string, string>>({});
  const [isTyping, setIsTyping] = useState(false);

  const createNewConversation = useCallback(() => {
    const newId = Date.now().toString();
    const newConversation: Conversation = {
      id: newId,
      title: "新对话",
      lastMessage: "点击开始聊天",
      timestamp: new Date().toLocaleString("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    setConversations((prev) => [newConversation, ...prev]);
    setActiveConversationId(newId);
    setMessages((prev) => ({ ...prev, [newId]: [] }));
    setCurrentMode((prev) => ({ ...prev, [newId]: "normal" }));
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) => prev.filter((conv) => conv.id !== id));
    if (activeConversationId === id) {
      setActiveConversationId(null);
    }
    setMessages((prev) => {
      const newMessages = { ...prev };
      delete newMessages[id];
      return newMessages;
    });
    setCurrentMode((prev) => {
      const newMode = { ...prev };
      delete newMode[id];
      return newMode;
    });
  }, [activeConversationId]);

  const selectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!activeConversationId) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: new Date().toLocaleString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setMessages((prev) => ({
      ...prev,
      [activeConversationId]: [...(prev[activeConversationId] || []), newMessage],
    }));

    setIsTyping(true);

    try {
      const mode = currentMode[activeConversationId] || "normal";
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...(messages[activeConversationId] || []), newMessage],
          mode,
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (data.message.mode) {
          setCurrentMode((prev) => ({ ...prev, [activeConversationId]: data.message.mode }));
        }

        const aiMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.message.content,
          timestamp: new Date().toLocaleString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          type: data.message.type,
          cardData: data.message.cardData,
          triageOptions: data.message.cardData?.options,
        };

        setMessages((prev) => ({
          ...prev,
          [activeConversationId]: [
            ...(prev[activeConversationId] || []),
            aiMessage,
          ],
        }));

        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === activeConversationId
              ? {
                  ...conv,
                  title: conv.title === "新对话" ? content.substring(0, 20) + (content.length > 20 ? "..." : "") : conv.title,
                  lastMessage: content.substring(0, 30) + (content.length > 30 ? "..." : ""),
                  timestamp: new Date().toLocaleString("zh-CN", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                }
              : conv
          )
        );
      }
    } catch (error) {
      console.error("Send message error:", error);
    } finally {
      setIsTyping(false);
    }
  }, [activeConversationId, currentMode, messages]);

  const handleTriageSelect = useCallback((value: string) => {
    sendMessage(value);
  }, [sendMessage]);

  const triggerSkill = useCallback(async (skillType: "sleep" | "cbt" | "emotion") => {
    if (!activeConversationId) return;

    setIsTyping(true);

    try {
      const response = await fetch("/api/skill-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillType }),
      });

      const data = await response.json();

      if (data.success) {
        setCurrentMode((prev) => ({ ...prev, [activeConversationId]: data.mode }));

        if (data.initialMessage) {
          const initialMessage: Message = {
            id: Date.now().toString(),
            role: "assistant",
            content: data.initialMessage,
            timestamp: new Date().toLocaleString("zh-CN", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            triageOptions: data.triageOptions,
            triageType: data.triageType,
          };

          setMessages((prev) => ({
            ...prev,
            [activeConversationId]: [
              ...(prev[activeConversationId] || []),
              initialMessage,
            ],
          }));

          setConversations((prev) =>
            prev.map((conv) =>
              conv.id === activeConversationId
                ? {
                    ...conv,
                    title: getSkillTitle(skillType),
                    lastMessage: data.message,
                    timestamp: new Date().toLocaleString("zh-CN", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                  }
                : conv
            )
          );
        }
      }
    } catch (error) {
      console.error("Trigger skill error:", error);
    } finally {
      setIsTyping(false);
    }
  }, [activeConversationId]);

  const getSkillTitle = (skillType: string): string => {
    const titles: Record<string, string> = {
      sleep: "🌙 助眠引导",
      cbt: "🧩 认知重构",
      emotion: "🔋 情绪急救",
    };
    return titles[skillType] || "新对话";
  };

  const activeMessages = activeConversationId ? messages[activeConversationId] || [] : [];
  const activeConversation = conversations.find((conv) => conv.id === activeConversationId);

  return (
    <div className="h-screen flex bg-morandi-cream">
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={selectConversation}
        onNewConversation={createNewConversation}
        onDeleteConversation={deleteConversation}
      />
      <ChatWindow
        conversationTitle={activeConversation?.title || ""}
        messages={activeMessages}
        onSendMessage={sendMessage}
        onSkillTrigger={triggerSkill}
        onTriageSelect={handleTriageSelect}
        isTyping={isTyping}
      />
    </div>
  );
}
