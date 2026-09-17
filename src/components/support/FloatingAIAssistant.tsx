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
  { label: 'مين إنت وإيه حكايتك؟', icon: Smile },
  { label: 'إزاي أسجل حضوري بالـ QR؟', icon: QrCode },
  { label: 'إزاي أجمع O Coins وأصرفها؟', icon: Coins },
  { label: 'إزاي أسلّم التكليف بتاعي؟', icon: CheckSquare },
  { label: 'إديني نصيحة حلوة للبرمجة والمذاكرة', icon: Code2 },
];

const INTENT_PATTERNS: {
  triggers: (string | RegExp)[];
  response: (userName: string, query: string) => { text: string; links?: { label: string; url: string }[] };
}[] = [
  {
    triggers: ['اسمك', 'مين انت', 'من انت', 'عرف نفسك', 'مين أنت', 'ما اسمك', 'شو اسمك', 'أنت مين', 'انت مين', 'who are you'],
    response: (name) => ({
      text: `يا هلا بيك يا ${name}! أنا **«جوجالي الذكي» (Gogaly AI)** 🤖✨\n\nأنا رفيقك ومساعدك الشخصي في منصة الجوجالية ومجتمع GDG. يعني في ضهرك في كل حاجة يا باشا:\n• أساعدك في أي تفصيلة تخص المنصة (التكليفات وتسليمها، الحضور بالـ QR، كوينز O Coins والمتجر، والكورسات).\n• أساعدك برمجياً وتقنياً وأشرحلك أي كود أو أجاوب على مشكلة بتواجهك.\n• وأجاوبك على أي سؤال عام أو ندردش سوا ونرتب أفكارك!\n\nجاهز أساعدك في أي وقت، اطلب بس اللي نفسك فيه! 🚀`
    })
  },
  {
    triggers: ['ازيك', 'عامل ايه', 'اخبارك', 'شخبارك', 'كيفك', 'كيف حالك', 'صباح الخير', 'مساء الخير', 'سلام عليكم', 'السلام عليكم', 'مرحبا', 'أهلا', 'اهلا', 'هلا', 'hi', 'hello'],
    response: (name, q) => {
      const isMorning = q.includes('صباح');
      const isEvening = q.includes('مساء');
      const greeting = isMorning ? 'صباح الفل والنشاط يا غالي ☀️' : isEvening ? 'مساء الورد والروقان والإنجاز 🌙' : `يا مرحب بيك يا ${name} يا بطل! 👋✨`;
      return {
        text: `${greeting}\n\nأنا زي الفل وجاهز أساعدك! يومك ماشي إزاي؟ عندك أي تسليم شغال عليه أو حابب تسألني في أي حاجة بخصوص المنصة أو البرمجة؟`
      };
    }
  },
  {
    triggers: ['شكرا', 'شكراً', 'تسلم', 'عاش', 'حبيبي', 'يعطيك العافية', 'الله يخليك', 'thanks', 'thx'],
    response: (name) => ({
      text: `العفو يا ${name} يا سيدي! إحنا في الخدمة دايماً وفي ضهرك يا بطل ❤️\nعاش إنجازك ومنور مجتمع الجوجالية! 🚀✨`
    })
  },
  {
    triggers: ['نكتة', 'نكته', 'ضحكني', 'قول نكتة', 'مزحة'],
    response: () => ({
      text: `خد دي يا صاحبي هتعجبك 😂:\n\nواحد مبرمج اتخانق مع خطيبته، بعت لها مسج: "Commit your mistakes before I Push you away!" 🤣🤣\nقالت له: "طب اعمل Rollback الأول عشان أنا أصلاً Drop Database بحالها!" 💀😂`
    })
  },
  {
    triggers: ['حضور', 'qr', 'كود', 'تسجيل الحضور', 'غياب', 'جلسة حضور'],
    response: () => ({
      text: `عشان تسجل حضورك في أي ورشة أو لقاء للجوجالية:\n\n1. افتح قسم **«الحضور والانضباط»** من القائمة اللي على اليمين.\n2. اضغط على مسح كود الـ QR، ووجّه كاميرا موبايلك على الكود اللي شغال في القاعة.\n3. هيتسجل حضورك فوراً وتاخد نقط الحضور في ثواني!\n\n💡 متنساش بس تدي الإذن للمتصفح إنه يفتح الكاميرا.`
    })
  },
  {
    triggers: ['عملات', 'coins', 'ocoins', 'نقاط', 'متجر', 'مكافآت', 'شراء', 'محفظة', 'خصم'],
    response: () => ({
      text: `كوينز **O Coins** دي عملة المنصة ومكافأتك على تعبك وشطارتك! 🪙✨\n\n• **بتجمعها إزاي؟**\n  - تسلم التكليفات في ميعادها وتتقيم عالي.\n  - تحضر الورش والفعاليات بانتظام.\n• **بتعمل بيها إيه؟**\n  - تدخل بيها **متجر المكافآت** وتشتري خصومات، اشتراكات، وكوبونات حصرية على كيفك!`,
      links: [
        { label: 'افتح محفظة O Coins 💼', url: '/ocoins' },
        { label: 'ادخل متجر الخصومات 🛍️', url: '/ocoins?tab=store' }
      ]
    })
  },
  {
    triggers: ['مهمة', 'تكليف', 'تسليم', 'tasks', 'واجب', 'ديدلاين', 'deadline'],
    response: () => ({
      text: `عشان تسلم أي تكليف مطلوب منك يا بطل:\n\n1. روح على قسم **«المهام والتكليفات»** من القائمة.\n2. افتح المهمة وشوف المطلوب والديدلاين بتاعها.\n3. حط لينك الشغل بتاعك (زي GitHub أو Drive) واضغط إرسال التسليم.\n4. رؤساء اللجان هيراجعوا شغلك ويعتمدوه وتنزل الكوينز في محفظتك على طول!`,
      links: [{ label: 'شوف تكليفاتك الحالية 📋', url: '/operations' }]
    })
  },
  {
    triggers: ['دورات', 'كورس', 'courses', 'تدريب', 'تعلم', 'مسار'],
    response: () => ({
      text: `منصة الجوجالية مظبطالك مكتبة كورسات تقنية كاملة في كل المجالات!\n\n• مسارات في تطوير الويب، الموبايل، الذكاء الاصطناعي، والمهارات الشخصية.\n• تتابع نسبة إنجازك وتتفرج على الفيديوهات مباشرة من جوه المنصة.\n• ادخل وابدأ اتعلم وطور من نفسك دلوقتي!`,
      links: [{ label: 'تصفح الكورسات التعليمية 🎓', url: '/courses' }]
    })
  },
  {
    triggers: ['برمجة', 'كود', 'react', 'flutter', 'python', 'javascript', 'نصيحة', 'تعلم', 'ويب', 'ذكاء اصطناعي'],
    response: () => ({
      text: `البرمجة والتطور في مجتمع GDG عايز مبدأ واحد: "اكتب كود بإيدك كتير"! 💻🔥\n\n1. **متركنش النظري:** طبق فوراً على كل معلومة تاخدها في مشروع صغير.\n2. **التزم بتكليفات اللجنة:** كل أسبوع بتعمل تكليف جديد مستواك بيعلى خطوة كبيرة.\n3. **اسأل ومتتكسفش:** إحنا تيم واحد وبنساعد بعض، وأنا هنا أهو اسألني في أي إيرور يظهرلك!\n\nلو عندك كود واقف معاك، هاته هنا وأنا أظبطهولك!`
    })
  }
];

function generateSmartFallback(query: string, userName: string): string {
  return (
    `يا مرحب يا ${userName}! بخصوص سؤالك:\n` +
    `> **"${query.trim()}"**\n\n` +
    `بص يا سيدي:\n` +
    `• لو السؤال عن المنصة، فكل الأقسام موجودة ومنظمة في القائمة اللي على اليمين.\n` +
    `• تقدر كمان تفعّل **مفتاح الذكاء الاصطناعي (Gemini AI)** من أيقونة المفتاح فوق، وهيجاوبك على أي سؤال برمجي أو عام بتفاصيل عميقة جداً وفي ثواني! ⚡\n\n` +
    `قولي إيه التفاصيل بالظبط وأنا عينيا ليك يا باشا! ✨`
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
    const systemPrompt = `أنت «جوجالي ذكي» (Gogaly AI)، المساعد الذكي لمجتمع GDG ومنصة الجوجالية. شخصيتك مصرية فرفوشة، ذكي، جدع ومحترف جداً في التكنولوجيا والأكواد. بتكلم بالمصري السلس الجميل (زي: "يا باشا"، "منور يا غالي"، "في ضهرك ومعاك"، "عاش يا بطل"). بتجاوب بدقة وبأسلوب منظم على كل الأسئلة البرمجية، الأكواد، نصائح المذاكرة والعمل الجماعي، أو استفسارات منصة الجوجالية (المهام والتكليفات، الحضور والانضباط بكود الـ QR، محفظة O Coins والمتجر، والكورسات). اسم المستخدم: ${userName}.`;

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
      <div className="fixed bottom-[4.5rem] sm:bottom-6 left-3 sm:left-6 z-50 flex items-center gap-2" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <motion.button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.94 }}
          className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-tr from-[var(--brand-primary)] via-indigo-600 to-cyan-500 text-white shadow-2xl shadow-[var(--brand-primary)]/40 flex items-center justify-center cursor-pointer border-2 border-white/20"
          title="مساعد جوجالي الذكي"
        >
          {isOpen ? (
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          ) : (
            <>
              <Bot className="h-6 w-6 sm:h-7 sm:w-7" />
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-emerald-500 border-2 border-[var(--surface)] flex items-center justify-center">
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
            className="fixed bottom-[8.5rem] sm:bottom-24 left-3 sm:left-6 z-50 w-[calc(100vw-1.5rem)] sm:w-[420px] h-[calc(100svh-10rem)] sm:h-[580px] max-h-[calc(100svh-10rem)] sm:max-h-[calc(100vh-8rem)] rounded-3xl overflow-hidden shadow-2xl border border-[var(--border-subtle)] bg-[var(--surface)] flex flex-col dir-rtl text-right font-sans"
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
            <div className="px-3 py-2 bg-[var(--surface-elevated)]/60 border-t border-[var(--border-subtle)] flex flex-wrap items-center gap-1.5 shrink-0 max-h-28 overflow-y-auto">
              {QUICK_PROMPTS.map((prompt, idx) => {
                const Icon = prompt.icon;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(prompt.label)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[var(--surface)] hover:bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--brand-primary)]/40 transition-all shrink-0 cursor-pointer shadow-2xs active:scale-95"
                  >
                    <Icon className="h-3 w-3 text-[var(--brand-primary)]" />
                    <span className="whitespace-normal">{prompt.label}</span>
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
