import { Plus, MessageCircle, Trash2 } from "lucide-react";

export interface Conversation {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: string;
}

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onNewConversation: () => void;
  onDeleteConversation: (id: string) => void;
}

export default function Sidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}: SidebarProps) {
  return (
    <div className="w-1/4 h-full bg-morandi-cream border-r border-morandi-gray flex flex-col">
      <div className="p-4 border-b border-morandi-gray">
        <h1 className="text-xl font-semibold text-morandi-text">心语</h1>
        <p className="text-xs text-morandi-dark mt-1">心理陪伴助手</p>
      </div>

      <button
        onClick={onNewConversation}
        className="mx-4 mt-4 px-4 py-3 bg-morandi-peach text-morandi-text rounded-xl flex items-center justify-center gap-2 hover:bg-morandi-pink transition-colors"
      >
        <Plus size={18} />
        <span className="font-medium">新建对话</span>
      </button>

      <div className="flex-1 overflow-y-auto p-2 mt-2">
        {conversations.length === 0 ? (
          <div className="text-center text-morandi-dark text-sm py-8">
            <MessageCircle size={48} className="mx-auto mb-3 opacity-30" />
            <p>还没有对话</p>
            <p className="text-xs mt-1">点击上方按钮开始</p>
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => onSelectConversation(conv.id)}
              className={`p-3 rounded-xl cursor-pointer transition-all group ${
                activeConversationId === conv.id
                  ? "bg-morandi-peach"
                  : "hover:bg-morandi-gray"
              }`}
            >
              <div className="flex justify-between items-start">
                <h3 className="font-medium text-morandi-text text-sm truncate flex-1">
                  {conv.title}
                </h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation(conv.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:bg-morandi-pink rounded-lg transition-all"
                >
                  <Trash2 size={14} className="text-morandi-dark" />
                </button>
              </div>
              <p className="text-xs text-morandi-dark mt-1 truncate">
                {conv.lastMessage}
              </p>
              <p className="text-xs text-morandi-dark/50 mt-1">
                {conv.timestamp}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-morandi-gray">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-morandi-blue flex items-center justify-center">
            <span className="text-morandi-text font-medium">心</span>
          </div>
          <div>
            <p className="text-sm font-medium text-morandi-text">访客用户</p>
            <p className="text-xs text-morandi-dark">在线</p>
          </div>
        </div>
      </div>
    </div>
  );
}
