import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Send,
  Bot,
  User,
  X,
  Minimize2,
  Maximize2,
  Trash2,
  Key,
  HelpCircle,
  ExternalLink,
  MessageCircle,
  Zap,
  Smile,
  Code2,
  Coins,
  QrCode,
  CheckSquare
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { cn } from '@/utils';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
  links?: { label: string; url: string }[];
}

const STORAGE_KEY = 'gdg_ai_chat_history_v2';
const API_KEY_STORAGE = 'gdg_gemini_api_key';

const QUICK_PROMPTS = [
  { label: 'مين أنت وشو دورك؟', icon: Smile },
  { label: 'كيف أسجل حضوري بالـ QR؟', icon: QrCode },
  { label: 'كيف أجمع O Coins وأستبدلها؟', icon: Coins },
  { label: 'كيف أسلم المهمة والتكليف؟', icon: CheckSquare },
  { label: 'نصائح لتنظيم وقتي في البرمجة', icon: Code2 },
];

const INTENT_PATTERNS: {
  triggers: (string | RegExp)[];
  response: (userName: string, query: string) => { text: string; links?: { label: string; url: string }[] };
}[] = [
  {
    triggers: ['اسمك', 'مين انت', 'من انت', 'عرف نفسك', 'مين أنت', 'ما اسمك', 'شو اسمك', 'أنت مين', 'انت مين', 'who are you'],
    response: (name) => ({
      text: `أهلاً يا ${name}! أنا **«جوجالي الذكي» (Gogaly AI)** 🤖✨\n\nأنا رفيقك ومساعدك الذكي في منصة الجوجالية ومجتمع GDG. دوري إني أكون معاك في كل خطوة:\n• أجاوبك عن أي شيء يخص المنصة (التكليفات، الحضور بالـ QR، عملات O Coins، والدورات).\n• أساعدك في البرمجة وتطوير المهارات وحل المشكلات التقنية.\n• وأجاوبك على أي سؤال عام أو استشارة دراسية!\n\nجاهز لمساعدتك دائماً، اتفضل اسألني في أي شيء! 🚀`
    })
  },
  {
    triggers: ['ازيك', 'عامل ايه', 'اخبارك', 'شخبارك', 'كيفك', 'كيف حالك', 'صباح الخير', 'مساء الخير', 'سلام عليكم', 'السلام عليكم', 'مرحبا', 'أهلا', 'اهلا', 'هلا', 'hi', 'hello'],
    response: (name, q) => {
      const isMorning = q.includes('صباح');
      const isEvening = q.includes('مساء');
      const greeting = isMorning ? 'صباح النور والنشاط ☀️' : isEvening ? 'مساء الخير والتميز 🌙' : `يا هلا بيك يا ${name}! 👋✨`;
      return {
        text: `${greeting}\n\nأنا بأفضل حال وجاهز أساعدك! يومك ماشي إزاي؟ عندك أي تكليف شغال عليه أو حابب تستفسر عن أي حاجة في المنصة أو البرمجة؟`
      };
    }
  },
  {
    triggers: ['شكرا', 'شكراً', 'تسلم', 'عاش', 'حبيبي', 'يعطيك العافية', 'الله يخليك', 'thanks', 'thx'],
    response: (name) => ({
      text: `العفو يا ${name}! في خدمتك دائماً في أي وقت ❤️\nأتمنى لك كل التوفيق والتميز في منصة الجوجالية ومجتمع GDG! 🚀✨`
    })
  },
  {
    triggers: ['نكتة', 'نكته', 'ضحكني', 'قول نكتة', 'مزحة'],
    response: () => ({
      text: `خد دي يا بطل 😂:\n\nواحد مبرمج راح السوبرماركت، زوجته قالت له: "هات علبة لبن، ولو لقيت بيض هات عشرة".\nرجع البيت ومعه 10 علب لبن! 🥛🥛\nسألته: "ليه جبت 10 علب لبن؟!"\nقال لها: "عشان لقيت بيض! (if eggs then buy 10)" 🤣🤣`
    })
  },
  {
    triggers: ['حضور', 'qr', 'كود', 'تسجيل الحضور', 'غياب', 'جلسة حضور'],
    response: () => ({
      text: `لتسجيل حضورك في أي ورشة أو اجتماع للجوجالية:\n\n1. توجه لقسم **«الحضور والانضباط»** من القائمة الجانبية.\n2. اضغط على مسح رمز QR ووجه الكاميرا نحو الكود المعروض بالقاعة.\n3. يتم تأكيد حضورك فوراً وتحديث رصيد حضورك!\n\n💡 تأكد من منح المتصفح إذن الوصول للكاميرا.`,
      links: [{ label: 'سجل الحضور والانضباط 📱', url: '/compliance' }]
    })
  },
  {
    triggers: ['عملات', 'coins', 'ocoins', 'نقاط', 'متجر', 'مكافآت', 'شراء', 'محفظة', 'خصم'],
    response: () => ({
      text: `عملات **O Coins** هي نظام المكافآت الرقمي لمنصة الجوجالية! 🪙✨\n\n• **طرق الجمع:** تسليم التكليفات في وقتها، الحضور والمشاركة الفعالة في الأنشطة.\n• **الاستخدام:** استبدالها في متجر المنصة للحصول على كوبونات خصم، اشتراكات، ومزايا حصرية!`,
      links: [
        { label: 'محفظة O Coins 💼', url: '/ocoins' },
        { label: 'متجر الخصومات 🛍️', url: '/ocoins?tab=store' }
      ]
    })
  },
  {
    triggers: ['مهمة', 'تكليف', 'تسليم', 'tasks', 'واجب', 'ديدلاين', 'deadline'],
    response: () => ({
      text: `لإدارة وتسليم تكليفاتك:\n\n1. توجه إلى **«المهام والتكليفات»** من القائمة.\n2. اختر المهمة المطلوبة واطلع على تفاصيلها وموعدها النهائي.\n3. أرفق رابط العمل (مثل GitHub أو Drive) واضغط إرسال التسليم.\n4. المشرفين هيراجعوا تسليمك ويصرفوا الـ O Coins المستحقة لك فور الاعتماد!`,
      links: [{ label: 'المهام والتكليفات 📋', url: '/operations' }]
    })
  },
  {
    triggers: ['دورات', 'كورس', 'courses', 'تدريب', 'تعلم', 'مسار'],
    response: () => ({
      text: `منصة الجوجالية توفر مكتبة دورات تدريبية متكاملة لكافة التخصصات!\n\n• مسارات في تطوير الويب، تطبيقات الموبايل، الذكاء الاصطناعي، والمهارات الشخصية.\n• تتبع تقدمك بدقة ومشاهدة الدروس مباشرة من داخل المنصة.`,
      links: [{ label: 'تصفح الدورات التعليمية 🎓', url: '/courses' }]
    })
  },
  {
    triggers: ['برمجة', 'كود', 'react', 'flutter', 'python', 'javascript', 'نصيحة', 'تعلم', 'ويب', 'ذكاء اصطناعي'],
    response: () => ({
      text: `التعلم والتطور في مجتمع GDG يعتمد على التطبيق العملي! 💻🔥\n\n1. **طبق أولاً بأول:** لا تكتفِ بالجانب النظري، ابنِ مشاريع حقيقية.\n2. **التزم بالتكليفات:** تسليم المهام الأسبوعية في المنصة يرتقي بمستواك بسرعة.\n3. **شارك مع فريقك:** استشر زملاءك وقادة اللجان دائماً.\n\nلو عندك كود محدد أو مفهوم حابب أشرحهولك، اكتبلي هنا فوراً!`
    })
  }
];

function generateSmartFallback(query: string, userName: string): string {
  return (
    `أهلاً يا ${userName}! بخصوص استفسارك حول:\n` +
    `> **"${query.trim()}"**\n\n` +
    `بصفتي مساعدك الذكي، يمكنك دائماً:\n` +
    `• تصفح الأقسام ذات الصلة مباشرة من القائمة الجانبية.\n` +
    `• أو تفعيل **مفتاح Gemini AI** من زر الإعدادات بالأعلى للحصول على ردود تفصيلية غير محدودة في أي موضوع برمجي أو عام! ⚡\n\n` +
    `هل تحب توضح سؤالك أكتر لمساعدتك بأفضل شكل؟ أنا معاك دائماً!`
  );
}

export function FloatingAIAssistant() {
  const { userProfile } = useAuth();
  const userName = userProfile?.displayName || userProfile?.username || 'زميلي العزيز';

  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem(API_KEY_STORAGE) || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
  });
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);

  // Load chat history from localStorage
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse saved chat history:', e);
    }
    return [
      {
        id: 'welcome',
        sender: 'ai',
        text: `يا هلا بيك يا ${userName} في **«جوجالي ذكي» (Gogaly AI)**! 🤖✨\n\nأنا رفيقك ومساعدك الذكي في المنصة والبرمجة. اتفضل اسألني في أي حاجة تخطر ببالك 🚀`,
        timestamp: 'الآن'
      }
    ];
  });

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Persist messages to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.warn('Failed to save chat to localStorage:', e);
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSaveApiKey = () => {
    const trimmed = tempKey.trim();
    setApiKey(trimmed);
    if (trimmed) {
      localStorage.setItem(API_KEY_STORAGE, trimmed);
      toast.success('تم تفعيل محرك الذكاء الاصطناعي Gemini بنجاح! 🚀');
    } else {
      localStorage.removeItem(API_KEY_STORAGE);
      toast.info('تم الرجوع للوضع الذكي السريع للمنصة');
    }
    setShowKeyModal(false);
  };

  const callGeminiAPI = async (userPrompt: string): Promise<string> => {
    const systemPrompt = `أنت «جوجالي ذكي» (Gogaly AI)، المساعد الذكي الودود والمحترف لمنصة الجوجالية ومجتمع GDG (Google Developer Groups). تتحدث باللغة العربية مع لمسة مصرية ذكية ومهذبة. تجيب على كل الأسئلة بوضوح ودقة سواء كانت تقنية، برمجية، نصائح دراسية، أو استفسارات تخص منصة الجوجالية (المهام والتكليفات، الحضور والانضباط، عملات O Coins والمتجر، والدورات التدريبية). اسم المستخدم: ${userName}.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 1000 }
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `API error (${res.status})`);
    }

    const data = await res.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) throw new Error('لا يوجد نص في الرد');
    return candidateText;
  };

  const handleSendMessage = async (textToSend?: string) => {
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

    // If Gemini key configured
    if (apiKey) {
      try {
        const aiResponseText = await callGeminiAPI(query);
        const aiMsg: ChatMessage = {
          id: String(Date.now() + 1),
          sender: 'ai',
          text: aiResponseText,
          timestamp: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, aiMsg]);
        setIsTyping(false);
        return;
      } catch (err) {
        console.warn('Gemini call failed, fallback to local brain:', err);
      }
    }

    // Local Conversational Engine
    setTimeout(() => {
      const lower = query.toLowerCase();
      let matched = false;
      let aiResponseText = '';
      let links: { label: string; url: string }[] | undefined;

      for (const pattern of INTENT_PATTERNS) {
        const isMatch = pattern.triggers.some((trigger) => {
          if (typeof trigger === 'string') return lower.includes(trigger.toLowerCase());
          return trigger.test(query);
        });

        if (isMatch) {
          const res = pattern.response(userName, query);
          aiResponseText = res.text;
          links = res.links;
          matched = true;
          break;
        }
      }

      if (!matched) {
        aiResponseText = generateSmartFallback(query, userName);
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
    }, 450);
  };

  const clearChat = () => {
    const resetMsg: ChatMessage = {
      id: 'welcome-reset',
      sender: 'ai',
      text: `تم بدء جلسة محادثة جديدة يا ${userName}! كيف أساعدك اليوم؟ 🚀`,
      timestamp: 'الآن'
    };
    setMessages([resetMsg]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([resetMsg]));
    toast.success('تم مسح سجل المحادثة');
  };

  return (
    <>
      {/* ─── Floating Launcher Button ──────────────────────────────────── */}
      <div className="fixed bottom-6 left-6 z-50 flex items-center gap-2">
        <motion.button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          className="relative w-14 h-14 rounded-full bg-gradient-to-tr from-[var(--brand-primary)] via-indigo-600 to-cyan-500 text-white shadow-2xl shadow-[var(--brand-primary)]/40 flex items-center justify-center cursor-pointer border-2 border-white/20"
          title="مساعد جوجالي الذكي"
        >
          {isOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <>
              <Bot className="h-7 w-7" />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-[var(--surface)] flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              </span>
            </>
          )}
        </motion.button>
      </div>

      {/* ─── Floating Chat Widget ─────────────────────────────────────── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 left-4 sm:left-6 z-50 w-[calc(100vw-2rem)] sm:w-[420px] h-[580px] max-h-[calc(100vh-8rem)] rounded-3xl overflow-hidden shadow-2xl border border-[var(--border-subtle)] bg-[var(--surface)] flex flex-col dir-rtl text-right font-sans"
            style={{ backdropFilter: 'blur(20px)' }}
          >
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-[var(--surface-elevated)] via-[var(--surface)] to-[var(--surface-elevated)] border-b border-[var(--border-subtle)] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[var(--brand-primary)] to-cyan-500 text-white flex items-center justify-center shadow-md">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-black text-[var(--text-primary)]">جوجالي ذكي (Gogaly AI)</h3>
                    <Sparkles className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                  </div>
                  <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {apiKey ? 'محرك Gemini مفعّل' : 'متصل وجاهز'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setTempKey(apiKey);
                    setShowKeyModal(true);
                  }}
                  className="p-2 rounded-xl text-[var(--text-muted)] hover:text-amber-500 hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
                  title="إعداد مفتاح Gemini AI"
                >
                  <Key className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={clearChat}
                  className="p-2 rounded-xl text-[var(--text-muted)] hover:text-rose-500 hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
                  title="مسح المحادثة"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)] transition-colors cursor-pointer"
                  title="إغلاق"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex gap-2.5 max-w-[88%]',
                    msg.sender === 'user' ? 'mr-auto flex-row-reverse' : 'ml-auto'
                  )}
                >
                  <div
                    className={cn(
                      'w-7 h-7 rounded-xl flex items-center justify-center shrink-0 text-white text-xs font-bold shadow-xs',
                      msg.sender === 'user'
                        ? 'bg-gradient-to-tr from-blue-600 to-indigo-600'
                        : 'bg-gradient-to-tr from-[var(--brand-primary)] to-cyan-500'
                    )}
                  >
                    {msg.sender === 'user' ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                  </div>

                  <div className="space-y-1 flex-1 min-w-0">
                    <div
                      className={cn(
                        'p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap shadow-2xs',
                        msg.sender === 'user'
                          ? 'bg-[var(--brand-primary)] text-white rounded-tr-xs'
                          : 'bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-tl-xs'
                      )}
                    >
                      {msg.text}

                      {msg.links && msg.links.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] flex flex-wrap gap-1.5">
                          {msg.links.map((link, idx) => (
                            <a
                              key={idx}
                              href={link.url}
                              onClick={() => setIsOpen(false)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/20"
                            >
                              <span>{link.label}</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    <p className="text-[9px] text-[var(--text-muted)] px-1">{msg.timestamp}</p>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex gap-2.5 max-w-[85%] ml-auto items-center">
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-[var(--brand-primary)] to-cyan-500 flex items-center justify-center text-white shrink-0">
                    <Bot className="h-3.5 w-3.5" />
                  </div>
                  <div className="p-2.5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-primary)] animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompts */}
            <div className="px-3 py-1.5 bg-[var(--surface-elevated)]/50 border-t border-[var(--border-subtle)] overflow-x-auto no-scrollbar flex items-center gap-1.5 shrink-0">
              {QUICK_PROMPTS.map((prompt, idx) => {
                const Icon = prompt.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(prompt.label)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-[var(--surface)] hover:bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] shrink-0 cursor-pointer"
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
              className="p-3 bg-[var(--surface-elevated)] border-t border-[var(--border-subtle)] flex items-center gap-2 shrink-0"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="اسأل جوجالي الذكي أي سؤال..."
                className="flex-1 bg-[var(--surface)] border-[var(--border-subtle)] text-xs rounded-xl h-10"
              />
              <Button
                type="submit"
                variant="primary"
                disabled={!input.trim() || isTyping}
                className="h-10 px-4 rounded-xl shrink-0 cursor-pointer gap-1.5 font-bold"
              >
                <span>إرسال</span>
                <Send className="h-3.5 w-3.5 rotate-180" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* API Key Modal */}
      <Modal
        open={showKeyModal}
        onClose={() => setShowKeyModal(false)}
        title="تفعيل محرك الذكاء الاصطناعي (Gemini API)"
        description="يمكنك تزويد المساعد بمفتاح Google Gemini API المجاني للإجابة اللامحدودة على أي سؤال."
        size="md"
      >
        <div className="space-y-4 text-right dir-rtl font-sans">
          <div>
            <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
              Google Gemini API Key
            </label>
            <Input
              type="password"
              value={tempKey}
              onChange={(e) => setTempKey(e.target.value)}
              placeholder="AIzaSy..."
              className="text-xs"
            />
            <p className="text-[11px] text-[var(--text-muted)] mt-1.5 leading-relaxed">
              المفتاح يحفظ محلياً على جهازك، ويمكنك جلبه مجاناً من{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[var(--brand-primary)] underline font-bold"
              >
                Google AI Studio
              </a>.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowKeyModal(false)} className="text-xs">
              إلغاء
            </Button>
            <Button type="button" variant="primary" onClick={handleSaveApiKey} className="text-xs font-bold gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              <span>حفظ وتفعيل</span>
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
