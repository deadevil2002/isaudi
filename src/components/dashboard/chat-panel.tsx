import { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User as UserIcon, Loader2, Sparkles, MessageSquareText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/providers/language-provider";
import { createTranslator } from "@/lib/i18n/translations";

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatPanelProps {
  reportId: string;
  freeReportsUsed: number;
  isPremium: boolean;
  sendMessage?: (message: string, reportId: string) => Promise<string>;
  initialMessages?: Message[];
  blockedActionHref?: string;
  fallbackForm?: {
    action: string;
    fields: Record<string, string>;
    inputName: string;
  };
}

export function ChatPanel({ reportId, freeReportsUsed, isPremium, sendMessage, initialMessages, blockedActionHref, fallbackForm }: ChatPanelProps) {
  const { lang } = useLanguage();
  const t = createTranslator(lang);
  const [messages, setMessages] = useState<Message[]>(
    initialMessages || [{ role: 'assistant', content: t("dashboard.chat.welcome") }]
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const isBlocked = !isPremium && freeReportsUsed >= 2;
  const suggestions = lang === 'ar'
    ? ['ما أهم فرصة نمو؟', 'اشرح هامش الربح', 'ما المنتج الذي يحتاج إجراء؟']
    : ['What is the top growth opportunity?', 'Explain my profit margin', 'Which product needs action?'];

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
      if (sendMessage) {
        const reply = await sendMessage(userMsg, reportId);
        setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      } else {
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
      }
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
    <div className="isaudi-card flex h-[600px] flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.025] p-4">
        <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#0fc9a7]/20 bg-[#0fc9a7]/10">
          <Sparkles className="h-5 w-5 text-[#20d4b2]" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-white">{t("dashboard.chat.title")}</h3>
          <p className="truncate text-xs text-[#94a3b8]">{t("dashboard.chat.subtitle")}</p>
        </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-[#0fc9a7]/20 bg-[#0fc9a7]/[0.07] px-2.5 py-1 text-[11px] font-semibold text-[#72ead4]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#20d4b2]" />
          {lang === 'ar' ? 'مرتبط بالتقرير' : 'Report-aware'}
        </span>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4" role="log" aria-live="polite" aria-relevant="additions text">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex max-w-[92%] gap-3 sm:max-w-[88%]",
                msg.role === 'user' ? "ms-auto flex-row-reverse" : "me-auto"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                msg.role === 'user' ? "bg-[#161c24] text-white border border-[#ffffff1a]" : "bg-[#0fc9a7]/10 text-[#0fc9a7] border border-[#0fc9a7]/20"
              )}>
                {msg.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>
              <div className={cn(
                "rounded-2xl p-3.5 text-sm leading-7",
                msg.role === 'user'
                  ? "rounded-se-sm border border-[#e6b95c]/15 bg-[#e6b95c]/[0.07] text-white"
                  : "rounded-ss-sm border border-[#0fc9a7]/20 bg-[#0fc9a7]/[0.055] text-[#e8edf3]"
              )}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="me-auto flex gap-3" role="status" aria-label={lang === 'ar' ? 'المساعد يجهز الإجابة' : 'Assistant is preparing a response'}>
              <div className="w-8 h-8 rounded-full bg-[#0fc9a7]/10 text-[#0fc9a7] border border-[#0fc9a7]/20 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-[#0fc9a7]/5 p-3 rounded-2xl rounded-tl-none border border-[#0fc9a7]/20">
                <Loader2 className="h-4 w-4 animate-spin text-[#0fc9a7] motion-reduce:animate-none" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-white/10 bg-white/[0.025] p-4">
        {isBlocked ? (
          <div className="text-center p-2 bg-[#e6b95c]/10 text-[#e6b95c] rounded-xl text-sm border border-[#e6b95c]/30">
            {t("dashboard.chat.blocked.prefix")}{" "}
            <a
              href={blockedActionHref ?? "/billing"}
              className="underline font-bold"
              onClick={e => {
                if (blockedActionHref === "#") e.preventDefault();
              }}
            >
              {t("dashboard.chat.blocked.cta")}
            </a>{" "}
            {t("dashboard.chat.blocked.suffix")}
          </div>
        ) : (
          <div className="space-y-3">
          {messages.length === 1 && !loading && (
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar" aria-label={lang === 'ar' ? 'أسئلة مقترحة' : 'Suggested questions'}>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setInput(suggestion)}
                  className="isaudi-focus inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 text-xs font-medium text-[#a4b0c0] transition-colors hover:border-[#0fc9a7]/25 hover:bg-[#0fc9a7]/[0.07] hover:text-white"
                >
                  <MessageSquareText className="h-3.5 w-3.5 text-[#0fc9a7]" aria-hidden="true" />
                  {suggestion}
                </button>
              ))}
            </div>
          )}
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            action={fallbackForm?.action}
            method={fallbackForm ? "get" : undefined}
            className="flex gap-2"
          >
            {fallbackForm && Object.entries(fallbackForm.fields).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <Input 
              name={fallbackForm?.inputName}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t("dashboard.chat.placeholder")}
              className="min-h-12"
              disabled={loading}
            />
            <Button
              type="submit"
              size="icon"
              aria-label={t("dashboard.chat.send")}
              disabled={loading || (!fallbackForm && !input.trim())}
              className="h-12 w-12 shrink-0 rounded-xl bg-[#e6b95c] text-[#171004] hover:bg-[#f0c96e]"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
          </div>
        )}
      </div>
    </div>
  );
}
