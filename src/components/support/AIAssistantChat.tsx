import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Send,
  Bot,
  User,
  HelpCircle,
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  ExternalLink,
  MessageSquarePlus,
  Coins,
  QrCode,
  CheckSquare,
  BookOpen
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/utils';

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
  links?: { label: string; url: string }[];
}

const QUICK_PROMPTS = [
  { label: 'كيف أسجل حضوري بالـ QR؟', icon: QrCode },
  { label: 'كيف أحصل على عملات O Coins؟', icon: Coins },
  { label: 'كيف أسلم المهمة المكلف بها؟', icon: CheckSquare },
  { label: 'أين أجد الدورات التدريبية المعتمدة؟', icon: BookOpen },
];

const KNOWLEDGE_BASE: { keywords: string[]; answer: string; links?: { label: string; url: string }[] }[] = [
  {
    keywords: ['حضور', 'qr', 'كود', 'تسجيل الحضور', 'غياب'],
    answer: 'لتسجيل حضورك في أي ورشة أو اجتماع للجوجالية:\n1. افتح صفحة "سجل حضوري" أو وجه الكاميرا نحو رمز الـ QR المعروض في القاعة.\n2. ستقوم المنصة تلقائياً بالتحقق من جلستك وتأكيد حضورك فوراً.\n3. تأكد من تفعيل الكاميرا والسماح بالصلاحيات للمتصفح.',
    links: [{ label: 'الذهاب لسجل الحضور', url: '/my-attendance' }]
  },
  {
    keywords: ['عملات', 'coins', 'ocoins', 'نقاط', 'متجر', 'مكافآت', 'شراء'],
    answer: 'عملات O Coins هي نظام المكافآت التقديرية الخاص بـ GDG!\n• يمكنك كسبها عند إنجاز المهام والتكليفات في وقتها، والحضور الفعال للاجتماعات والأنشطة.\n• يمكنك استبدالها في "متجر المكافآت" للحصول على كوبونات خصم، اشتراكات، ومزايا حصرية.',
    links: [
      { label: 'محفظة O Coins', url: '/ocoins' },
      { label: 'متجر المكافآت', url: '/ocoins?tab=store' }
    ]
  },
  {
    keywords: ['مهمة', 'تكليف', 'تسليم', 'tasks', 'واجب'],
    answer: 'لتسليم التكليف المطلوب منك:\n1. توجه إلى قسم "مهامي وتكليفاتي" في القائمة الجانبية.\n2. اختر المهمة المطلوبة واضغط على "عرض التفاصيل".\n3. اكتب ملاحظاتك أو أرفق رابط العمل (مثل GitHub أو Google Drive) واضغط "إرسال التسليم".\n4. سيقوم مشرف لجنتك بمراجعتها وصرف الـ O Coins المستحقة لك فور الاعتماد.',
    links: [{ label: 'مهامي وتكليفاتي', url: '/my-tasks' }]
  },
  {
    keywords: ['دورات', 'كورس', 'courses', 'تدريب', 'تعلم'],
    answer: 'توفر منصة الجوجالية مكتبة متكاملة من الدورات التدريبية التقنية والشروحات:\n• يمكنك تصفح الدورات حسب تخصصك ومستواك (مبتدئ، متوسط، متقدم).\n• متابعة نسبة تقدمك ومشاهدة الدروس مباشرة من داخل المنصة.',
    links: [{ label: 'الدورات التعليمية', url: '/courses' }]
  },
  {
    keywords: ['حظر', 'عقوبة', 'تجميد', 'مخالفة'],
    answer: 'يتم تطبيق إجراءات الحظر تلقائياً أو من قِبل إدارة اللجان في حال تكرار الغياب غير المبرر أو مخالفة ميثاق العمل.\n• إذا كنت ترى أن هناك خطأ أو ترغب في تقديم التماس، يرجى فتح تذكرة دعم فني هنا وسيقوم فريق القيادة بمراجعة حالتك.',
  },
  {
    keywords: ['صورة', 'افاتار', 'avatar', 'ملف شخصي', 'بروفايل'],
    answer: 'يمكنك تغيير صورتك الشخصية وقصها بدقة واحترافية من خلال:\n1. الانتقال إلى "الإعدادات والأمان".\n2. الضغط على أيقونة الكاميرا على صورتك الشخصية.\n3. استخدام أداة القص التفاعلية لضبط الأبعاد والتقريب ثم الحفظ.',
    links: [{ label: 'الإعدادات والأمان', url: '/settings' }]
  }
];

export function AIAssistantChat({ onOpenTicket }: { onOpenTicket: () => void }) {
  const { userProfile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `أهلاً بك يا ${userProfile?.displayName || 'زميلي العزيز'} في المساعد الذكي لمنصة الجوجالية! 🚀✨\nأنا هنا لمساعدتك في أي استفسار يتعلق بالمهام، الحضور، محفظة O Coins، الدورات، أو إعدادات الحساب. كيف أستطيع مساعدتك اليوم؟`,
      timestamp: 'الآن'
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const findAnswer = (queryText: string) => {
    const lower = queryText.toLowerCase().trim();
    for (const item of KNOWLEDGE_BASE) {
      if (item.keywords.some((k) => lower.includes(k))) {
        return item;
      }
    }
    return null;
  };

  const handleSendMessage = (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const match = findAnswer(query);
      let aiResponseText = '';
      let links: { label: string; url: string }[] | undefined;

      if (match) {
        aiResponseText = match.answer;
        links = match.links;
      } else {
        aiResponseText = `شكراً لسؤالك! بخصوص "${query}"، لم أتمكن من العثور على إجابة محددة ومباشرة في سجلات المساعد الفوري.\n\nيمكنك فتح تذكرة دعم فني مباشرة وسيقوم فريق القيادة والإشراف بمتابعة استفسارك وتقديم الحل لك سريعاً.`;
      }

      const aiMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'ai',
        text: aiResponseText,
        timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
        links
      };

      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);
    }, 600);
  };

  return (
    <div className="card p-0 rounded-3xl overflow-hidden border border-[var(--border-subtle)] shadow-xl flex flex-col h-[600px] bg-[var(--surface)]">
      {/* Header */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-[var(--surface-elevated)] via-[var(--surface)] to-[var(--surface-elevated)] border-b border-[var(--border-subtle)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[var(--brand-primary)] to-cyan-500 text-white flex items-center justify-center shadow-md">
            <Sparkles className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-[var(--text-primary)]">المساعد الذكي للمنصة</h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                متصل
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">إجابات ذكية وفورية لكافة إجراءات وخدمات المنصة</p>
          </div>
        </div>

        <Button
          type="button"
          onClick={onOpenTicket}
          size="sm"
          variant="outline"
          className="text-xs gap-1.5 rounded-xl border-[var(--border-subtle)]"
        >
          <MessageSquarePlus className="h-4 w-4 text-[var(--brand-primary)]" />
          <span>فتح تذكرة دعم</span>
        </Button>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              'flex gap-3 max-w-[85%]',
              msg.sender === 'user' ? 'mr-auto flex-row-reverse' : 'ml-auto'
            )}
          >
            <div
              className={cn(
                'w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white text-xs font-bold',
                msg.sender === 'user'
                  ? 'bg-gradient-to-tr from-blue-600 to-indigo-600'
                  : 'bg-gradient-to-tr from-[var(--brand-primary)] to-cyan-500'
              )}
            >
              {msg.sender === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>

            <div className="space-y-1.5">
              <div
                className={cn(
                  'p-3.5 sm:p-4 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap',
                  msg.sender === 'user'
                    ? 'bg-[var(--brand-primary)] text-white rounded-tr-none'
                    : 'bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-tl-none'
                )}
              >
                {msg.text}

                {msg.links && msg.links.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-[var(--border-subtle)] flex flex-wrap gap-2">
                    {msg.links.map((link, idx) => (
                      <a
                        key={idx}
                        href={link.url}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/20 transition-colors"
                      >
                        <span>{link.label}</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-[10px] text-[var(--text-muted)] px-1">
                {msg.timestamp}
              </p>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-3 max-w-[85%] ml-auto items-center">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[var(--brand-primary)] to-cyan-500 flex items-center justify-center text-white shrink-0">
              <Bot className="h-4 w-4" />
            </div>
            <div className="p-3 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--brand-primary)] animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-[var(--brand-primary)] animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-[var(--brand-primary)] animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions Pills */}
      <div className="px-4 py-2 bg-[var(--surface-elevated)]/50 border-t border-[var(--border-subtle)] overflow-x-auto no-scrollbar flex items-center gap-2">
        <span className="text-[11px] font-bold text-[var(--text-muted)] shrink-0 flex items-center gap-1">
          <HelpCircle className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
          مقترحات:
        </span>
        {QUICK_PROMPTS.map((prompt, idx) => {
          const Icon = prompt.icon;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(prompt.label)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs bg-[var(--surface)] hover:bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all shrink-0 cursor-pointer"
            >
              <Icon className="h-3 w-3 text-[var(--brand-primary)]" />
              <span>{prompt.label}</span>
            </button>
          );
        })}
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3 sm:p-4 bg-[var(--surface-elevated)] border-t border-[var(--border-subtle)] flex items-center gap-2"
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="اسأل المساعد الذكي عن أي شيء بالمنصة..."
          className="flex-1 bg-[var(--surface)] border-[var(--border-subtle)] text-xs sm:text-sm rounded-2xl h-11"
        />
        <Button
          type="submit"
          variant="primary"
          disabled={!input.trim() || isTyping}
          className="h-11 px-5 rounded-2xl shrink-0 cursor-pointer gap-2"
        >
          <span>إرسال</span>
          <Send className="h-4 w-4 rotate-180" />
        </Button>
      </form>
    </div>
  );
}
