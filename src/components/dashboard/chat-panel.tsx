import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User as UserIcon, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";

interface ChatPanelProps {
  reportId: string;
  freeReportsUsed: number;
  isPremium: boolean;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatPanel({ reportId, freeReportsUsed, isPremium }: ChatPanelProps) {
  const { lang } = useLanguage();
  const t = createTranslator(lang);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: t("dashboard.chat.welcome") }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isBlocked = !isPremium && freeReportsUsed >= 2;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading || isBlocked) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch('/api/analysis/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, reportId }),
      });

      if (!res.ok) {
        throw new Error('Failed to send message');
      }

      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: t("dashboard.chat.error") }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-[#0e1218] rounded-2xl border border-[#ffffff1a] shadow-none overflow-hidden">
      <div className="p-4 border-b border-[#ffffff1a] bg-[#161c24] flex items-center gap-2">
        <div className="bg-[#0fc9a7]/10 p-2 rounded-full">
          <Sparkles className="w-5 h-5 text-[#0fc9a7]" />
        </div>
        <div>
          <h3 className="font-bold text-white">{t("dashboard.chat.title")}</h3>
          <p className="text-xs text-[#94a3b8]">{t("dashboard.chat.subtitle")}</p>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-3 max-w-[85%]",
                msg.role === 'user' ? "mr-auto flex-row-reverse" : "ml-auto"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                msg.role === 'user' ? "bg-[#161c24] text-white border border-[#ffffff1a]" : "bg-[#0fc9a7]/10 text-[#0fc9a7] border border-[#0fc9a7]/20"
              )}>
                {msg.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={cn(
                "p-3 rounded-2xl text-sm leading-relaxed",
                msg.role === 'user'
                  ? "bg-[#161c24] text-white border border-[#ffffff1a] rounded-tr-none"
                  : "bg-[#0fc9a7]/5 text-white rounded-tl-none border border-[#0fc9a7]/20"
              )}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3 ml-auto">
              <div className="w-8 h-8 rounded-full bg-[#0fc9a7]/10 text-[#0fc9a7] border border-[#0fc9a7]/20 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-[#0fc9a7]/5 p-3 rounded-2xl rounded-tl-none border border-[#0fc9a7]/20">
                <Loader2 className="w-4 h-4 animate-spin text-[#0fc9a7]" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-[#ffffff1a] bg-[#161c24]/50">
        {isBlocked ? (
          <div className="text-center p-2 bg-[#e6b95c]/10 text-[#e6b95c] rounded-xl text-sm border border-[#e6b95c]/30">
            {t("dashboard.chat.blocked.prefix")}{" "}
            <a href="/billing" className="underline font-bold">
              {t("dashboard.chat.blocked.cta")}
            </a>{" "}
            {t("dashboard.chat.blocked.suffix")}
          </div>
        ) : (
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-2"
          >
            <Input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("dashboard.chat.placeholder")}
              className="bg-[#0e1218] border-[#ffffff1a] text-white placeholder:text-[#64748b] focus-visible:ring-[#0fc9a7]/30"
              disabled={loading}
            />
            <Button
              type="submit"
              size="icon"
              aria-label={t("dashboard.chat.send")}
              disabled={loading || !input.trim()}
              className="shrink-0 bg-[#e6b95c] text-black hover:bg-[#c5993c]"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
