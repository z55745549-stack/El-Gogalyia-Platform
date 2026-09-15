import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Send,
  Bot,
  User,
  HelpCircle,
  Key,
  ExternalLink,
  MessageSquarePlus,
  Coins,
  QrCode,
  CheckSquare,
  BookOpen,
  Code2,
  Trash2,
  Smile,
  Zap
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

const QUICK_PROMPTS = [
  { label: 'مين أنت وشو دورك؟', icon: Smile },
  { label: 'كيف أسجل حضوري بالـ QR؟', icon: QrCode },
  { label: 'كيف أجمع O Coins وأستبدلها؟', icon: Coins },
  { label: 'كيف أسلم المهمة والتكليف؟', icon: CheckSquare },
  { label: 'نصائح لتنظيم وقتي وتطوير مهاراتي البرمجية', icon: Code2 },
];

// Conversational pattern matching for instant rich answers
const INTENT_PATTERNS: {
  triggers: (string | RegExp)[];
  response: (userName: string, query: string) => { text: string; links?: { label: string; url: string }[] };
}[] = [
  // 1. Identity & Name
  {
    triggers: [
      'اسمك', 'مين انت', 'من انت', 'عرف نفسك', 'مين أنت', 'ما اسمك',
      'شو اسمك', 'أنت مين', 'انت مين', 'ما هو اسمك', 'who are you', 'what is your name'
    ],
    response: (name) => ({
      text: `أهلاً يا ${name}! أنا **«جوجالي الذكي» (Gogaly AI)** 🤖✨\n\nأنا المساعد الذكي ورفيقك في منصة الجوجالية ومجتمع GDG. دوري إني أكون معاك في كل خطوة:\n• أساعدك في أي استفسار يخص المنصة (المهام، الحضور بالـ QR، عملات O Coins، الدورات، واللجان).\n• أساعدك برمجياً وتقنياً في تخصصات الويب، الموبايل، الذكاء الاصطناعي، وغيرها.\n• وأجاوبك على أي تساؤل عام أو نصيحة تحب تاخدها!\n\nجاهز لمساعدتك دائماً، اتفضل اسألني في أي حاجة تخطر ببالك! 🚀`
    })
  },

  // 2. Greetings & How are you
  {
    triggers: [
      'ازيك', 'عامل ايه', 'اخبارك', 'شخبارك', 'كيفك', 'كيف حالك', 'صباح الخير', 'مساء الخير',
      'سلام عليكم', 'السلام عليكم', 'مرحبا', 'أهلا', 'اهلا', 'هلا', 'hi', 'hello'
    ],
    response: (name, q) => {
      const isMorning = q.includes('صباح');
      const isEvening = q.includes('مساء');
      const greeting = isMorning ? 'صباح النور والهمة العالية ☀️' : isEvening ? 'مساء الخير والإنجاز 🌙' : `يا هلا ومية مرحبا بيك يا ${name}! 👋✨`;
      return {
        text: `${greeting}\n\nأنا بأفضل حال وجاهز أساعدك! يومك ماشي إزاي؟ عندك أي تكليف شغال عليه أو حابب تستفسر عن أي حاجة في المنصة أو البرمجة؟`
      };
    }
  },

  // 3. Thanks & Appreciation
  {
    triggers: ['شكرا', 'شكراً', 'تسلم', 'عاش', 'حبيبي', 'يعطيك العافية', 'الله يخليك', 'thanks', 'thx'],
    response: (name) => ({
      text: `العفو يا ${name}! في الخدمة دائماً في أي وقت ❤️\nأتمنى لك يوم مليان إنجاز وتميز في لجان وفعاليات الجوجالية! 🚀✨`
    })
  },

  // 4. Jokes & Fun
  {
    triggers: ['نكتة', 'نكته', 'ضحكني', 'قول نكتة', 'مزحة'],
    response: () => ({
      text: `خد دي يا بطل 😂:\n\nواحد مبرمج راح السوبرماركت، زوجته قالت له: "هات علبة لبن، ولو لقيت بيض هات عشرة".\nرجع البيت ومعه 10 علب لبن! 🥛🥛\nسألته بصدمة: "ليه جبت 10 علب لبن؟!"\nقال لها: "عشان لقيت بيض! (if eggs then buy 10)" 🤣🤣`
    })
  },

  // 5. Attendance & QR
  {
    triggers: ['حضور', 'qr', 'كود', 'تسجيل الحضور', 'غياب', 'جلسة حضور'],
    response: () => ({
      text: `لتسجيل حضورك في أي ورشة أو اجتماع لمنصة الجوجالية:\n\n1. ادخل على قسم **«سجل حضوري»** في القائمة الجانبية.\n2. اضغط على خيار مسح رمز QR ووجه كاميرا هاتفك أو جهازك نحو الكود المعروض على الشاشة.\n3. سيتم اعتماد حضورك فورياً في المنظومة وإضافة نقاط الحضور لملفك!\n\n💡 ملاحظة: تأكد من تفعيل إذن استخدام الكاميرا في متصفحك.`,
      links: [{ label: 'الذهاب إلى سجل حضوري 📱', url: '/my-attendance' }]
    })
  },

  // 6. O Coins & Store
  {
    triggers: ['عملات', 'coins', 'ocoins', 'نقاط', 'متجر', 'مكافآت', 'شراء', 'محفظة'],
    response: () => ({
      text: `عملات **O Coins** هي العملة الرقمية التقديرية لمنصة الجوجالية! 🪙✨\n\n• **كيف تجمع عملات؟**\n  - تسليم المهام في موعدها بجودة عالية.\n  - الحضور المنتظم والالتزام بالجلسات والورش.\n  - المشاركة الفعالة في الأنشطة والفعاليات.\n\n• **كيف تستفيد منها؟**\n  - يمكنك استبدالها في **متجر المكافآت** للحصول على خصومات، كوبونات مميزة، وحوافز حصرية!`,
      links: [
        { label: 'فتح محفظة O Coins 💼', url: '/ocoins' },
        { label: 'تصفح متجر المكافآت 🛍️', url: '/ocoins?tab=store' }
      ]
    })
  },

  // 7. Tasks & Submissions
  {
    triggers: ['مهمة', 'تكليف', 'تسليم', 'tasks', 'واجب', 'ديدلاين', 'deadline'],
    response: () => ({
      text: `لإدارة وتسليم تكليفاتك:\n\n1. توجه إلى **«مهامي وتكليفاتي»** من القائمة.\n2. اختر المهمة واضغط على تفاصيلها للاطلاع على المطلوب والموعد النهائي.\n3. عند الانتهاء، ضع رابط التسليم (مثل GitHub, Figma, Google Drive) مع أي ملاحظات واضغط إرسال.\n4. المشرفين وقادة اللجان هيراجعوا عملك ويمنحوك التقييم والـ O Coins فور الاعتماد!`,
      links: [{ label: 'عرض تكليفاتي الحالية 📋', url: '/my-tasks' }]
    })
  },

  // 8. Courses & Learning
  {
    triggers: ['دورات', 'كورس', 'courses', 'تدريب', 'تعلم', 'مسار'],
    response: () => ({
      text: `منصة الجوجالية توفر مكتبة دورات تدريبية تقنية شاملة لكافة التخصصات!\n\n• دورات في تطوير الويب، تطبيقات الموبايل، الذكاء الاصطناعي، والمهارات الشخصية.\n• تتبع دقيق لمستوى إنجازك في كل كورس.\n• إمكانية مشاهدة الدروس من داخل المنصة وحفظ تقدمك تلقائياً.`,
      links: [{ label: 'تصفح الدورات التعليمية 🎓', url: '/courses' }]
    })
  },

  // 9. Bans & Compliance
  {
    triggers: ['حظر', 'عقوبة', 'تجميد', 'مخالفة', 'إنذار', 'انذار', 'امتثال'],
    response: () => ({
      text: `تهتم منصة الجوجالية بالحفاظ على بيئة عمل احترافية وملتزمة من خلال **«مرصد الانضباط والامتثال»**:\n\n• يتم تطبيق إجراءات الحظر تلقائياً أو من قِبل القيادة عند تكرار الغياب غير المبرر أو التقاعس عن التكليفات.\n• إذا كنت ترى أن هناك عذراً أو ترغب في الاستفسار أو تقديم التماس، يمكنك الضغط على **«فتح تذكرة دعم»** ليتواصل معك مشرف اللجنة مباشرة.`
    })
  },

  // 10. Tech & Programming Advice
  {
    triggers: [
      'برمجة', 'كود', 'react', 'flutter', 'python', 'javascript', 'نصيحة',
      'تعلم', 'مبتدئ', 'ويب', 'ذكاء اصطناعي', 'ai', 'front', 'backend'
    ],
    response: () => ({
      text: `التعلم في GDG مبني على التطبيق العملي (Hands-on)! 💻🔥\n\nإليك أهم 3 نصائح للتميز:\n1. **ابنِ مشاريع حقيقية:** لا تكتفِ بمشاهدة الكورسات، طبق كل مفهوم في كود حقيقي.\n2. **التزم بالتكليفات الأسبوعية:** تسليمات المهام في المنصة مصممة لتصقيل خبرتك تدريجياً.\n3. **شارك وتواصل:** اسأل زملاءك في اللجنة، راجع أكوادهم، واستفد من نصائح رؤساء اللجان.\n\nلو عندك كود أو تقنية معينة حابب تسألني فيها بالتفصيل، اكتبلي استفسارك فوراً!`
    })
  }
];

// Smart generative fallback when no keyword matches and Gemini API key is absent
function generateSmartFallback(query: string, userName: string): string {
  const q = query.trim();
  return (
    `أهلاً يا ${userName}! بخصوص استفسارك حول:\n` +
    `> **"${q}"**\n\n` +
    `بصفتي المساعد الذكي لمنصة الجوجالية، إليك ملخص الإجابة والإرشاد المناسب:\n\n` +
    `• إذا كان سؤالك يتعلق بخدمات المنصة (مثل الحضور، التكليفات، أو الرصيد)، فيمكنك دائماً استكشاف الأقسام المباشرة من القائمة الجانبية.\n` +
    `• إذا كان تساؤلاً فنياً أو اقتراحاً مخصصاً، يمكنك أيضاً فتح تذكرة دعم فني وسيتولى قادة اللجان والمشرفين متابعته معك باهتمام.\n` +
    `• ويمكنك أيضاً تفعيل **مفتاح الذكاء الاصطناعي (Gemini AI)** من الزر بأعلى المحادثة لتحصل على إجابات تفصيلية وعميقة لأي موضوع برمجية أو عامة لحظياً! ⚡\n\n` +
    `هل تود توضيح سؤالك أكثر لأفيدك بأدق تفاصيل؟ أنا معك في أي وقت! ✨`
  );
}

export function AIAssistantChat({ onOpenTicket }: { onOpenTicket: () => void }) {
  const { userProfile } = useAuth();
  const userName = userProfile?.displayName || userProfile?.username || 'زميلي العزيز';

  // API Key state for live Gemini AI (stored in localStorage)
  const [apiKey, setApiKey] = useState<string>(() => {
    return localStorage.getItem('gdg_gemini_api_key') || (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
  });
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKey, setTempKey] = useState(apiKey);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: `يا هلا بيك يا ${userName} في **المساعد الذكي «جوجالي AI»**! 🤖✨\n\nأنا رفيقك ومساعدك الشخصي في كل ما يخص منصة الجوجالية ومجتمع GDG، سواء كنت بتسأل عن التكليفات، الحضور بالـ QR، عملات O Coins، أو حابب تستشيرني في كود وتكنولوجيا أو تدردش معايا!\n\nاتفضل اسألني في أي حاجة، أنا جاهز لمساعدتك بكل سرور 🚀`,
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

  const handleSaveApiKey = () => {
    const trimmed = tempKey.trim();
    setApiKey(trimmed);
    if (trimmed) {
      localStorage.setItem('gdg_gemini_api_key', trimmed);
      toast.success('تم تفعيل محرك الذكاء الاصطناعي Gemini بنجاح! 🚀🧠');
    } else {
      localStorage.removeItem('gdg_gemini_api_key');
      toast.info('تم العودة للوضع الذكي المدمج للمنصة');
    }
    setShowKeyModal(false);
  };

  // Call live Gemini 1.5/2.0 API if key exists
  const callGeminiAPI = async (userPrompt: string): Promise<string> => {
    const systemPrompt = `أنت «جوجالي ذكي» (Gogaly AI)، المساعد الذكي المبهج والودود لمنصة الجوجالية ومجتمع GDG (Google Developer Groups). تتحدث باللغة العربية مع لمسة مصرية دافئة وذكية. تجيب على كل الأسئلة بأسلوب واضح، ذكي، ومباشر سواء كانت تقنية، برمجية، نصائح عامة، دراسة، تنظيم وقت، أو استفسارات منصة الجوجالية (المهام في غرفة العمليات، الحضور بالـ QR والحظر في مرصد الانضباط، عملات O Coins والمتجر، والدورات التدريبية). خاطب المستخدم باسم: ${userName}.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }]
          }
        ],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 1000
        }
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `Gemini API Error (${res.status})`);
    }

    const data = await res.json();
    const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error('لم يتم استلام نص من محرك الذكاء الاصطناعي');
    }
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

    // 1. If Gemini API key is available, use live LLM
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
      } catch (err: any) {
        console.warn('Gemini API call failed, falling back to local brain:', err);
        // Fall back gracefully to local intelligence
      }
    }

    // 2. Local Conversational Brain (Smart & Open-Ended)
    setTimeout(() => {
      const lower = query.toLowerCase();
      let matched = false;
      let aiResponseText = '';
      let links: { label: string; url: string }[] | undefined;

      for (const pattern of INTENT_PATTERNS) {
        const isMatch = pattern.triggers.some((trigger) => {
          if (typeof trigger === 'string') {
            return lower.includes(trigger.toLowerCase());
          }
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
    setMessages([
      {
        id: 'welcome-reset',
        sender: 'ai',
        text: `تم بدء محادثة جديدة يا ${userName}! أنا جاهز لأي استفسار أو مهمة تحب نبدأ بيها 🚀`,
        timestamp: 'الآن'
      }
    ]);
    toast.success('تم تنظيف سجل المحادثة');
  };

  return (
    <div className="card p-0 rounded-3xl overflow-hidden border border-[var(--border-subtle)] shadow-xl flex flex-col h-[650px] bg-[var(--surface)]">
      {/* Header */}
      <div className="p-4 sm:p-5 bg-gradient-to-r from-[var(--surface-elevated)] via-[var(--surface)] to-[var(--surface-elevated)] border-b border-[var(--border-subtle)] flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[var(--brand-primary)] via-indigo-600 to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-[var(--brand-primary)]/20">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-black text-[var(--text-primary)] flex items-center gap-1.5">
                <span>جوجالي ذكي (Gogaly AI)</span>
                <Sparkles className="h-4 w-4 text-amber-500 animate-pulse" />
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                {apiKey ? 'محرك Gemini مفعّل' : 'الوضع الذكي السريع'}
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)]">رفيقك التفاعلي للإجابة على كافة الأسئلة والبرمجة والمنصة</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* AI Key config button */}
          <button
            type="button"
            onClick={() => {
              setTempKey(apiKey);
              setShowKeyModal(true);
            }}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border cursor-pointer',
              apiKey
                ? 'bg-purple-500/10 text-purple-500 border-purple-500/20 hover:bg-purple-500/20'
                : 'bg-[var(--surface-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
            )}
            title="إعداد مفتاح الذكاء الاصطناعي Gemini"
          >
            <Key className="h-3.5 w-3.5 text-amber-500" />
            <span className="hidden sm:inline">{apiKey ? 'Gemini AI مفعل' : 'تفعيل Gemini AI'}</span>
          </button>

          <Button
            type="button"
            onClick={clearChat}
            size="sm"
            variant="ghost"
            className="text-xs text-[var(--text-muted)] hover:text-rose-500 p-2 rounded-xl"
            title="مسح المحادثة"
          >
            <Trash2 className="h-4 w-4" />
          </Button>

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
                'w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 text-white text-xs font-bold shadow-md',
                msg.sender === 'user'
                  ? 'bg-gradient-to-tr from-blue-600 to-indigo-600'
                  : 'bg-gradient-to-tr from-[var(--brand-primary)] via-indigo-600 to-cyan-500'
              )}
            >
              {msg.sender === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>

            <div className="space-y-1.5 flex-1 min-w-0">
              <div
                className={cn(
                  'p-4 rounded-3xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap shadow-xs',
                  msg.sender === 'user'
                    ? 'bg-[var(--brand-primary)] text-white rounded-tr-xs'
                    : 'bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] rounded-tl-xs'
                )}
              >
                {msg.text}

                {msg.links && msg.links.length > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-[var(--border-subtle)] flex flex-wrap gap-2">
                    {msg.links.map((link, idx) => (
                      <a
                        key={idx}
                        href={link.url}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] hover:bg-[var(--brand-primary)]/20 transition-colors"
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
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[var(--brand-primary)] to-cyan-500 flex items-center justify-center text-white shrink-0 shadow-md">
              <Bot className="h-4 w-4" />
            </div>
            <div className="p-3.5 rounded-2xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[var(--brand-primary)] animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions Pills */}
      <div className="px-4 py-2 bg-[var(--surface-elevated)]/50 border-t border-[var(--border-subtle)] overflow-x-auto no-scrollbar flex items-center gap-2 shrink-0">
        <span className="text-[11px] font-bold text-[var(--text-muted)] shrink-0 flex items-center gap-1">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          مقترحات سريعة:
        </span>
        {QUICK_PROMPTS.map((prompt, idx) => {
          const Icon = prompt.icon;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(prompt.label)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-[var(--surface)] hover:bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all shrink-0 cursor-pointer shadow-2xs"
            >
              <Icon className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
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
          placeholder="اسأل جوجالي AI أي سؤال... (اسمك ايه، كيف أسجل بالـ QR، شرح كود، نصيحة...)"
          className="flex-1 bg-[var(--surface)] border-[var(--border-subtle)] text-xs sm:text-sm rounded-2xl h-11"
        />
        <Button
          type="submit"
          variant="primary"
          disabled={!input.trim() || isTyping}
          className="h-11 px-5 rounded-2xl shrink-0 cursor-pointer gap-2 font-bold shadow-md shadow-[var(--brand-primary)]/20"
        >
          <span>إرسال</span>
          <Send className="h-4 w-4 rotate-180" />
        </Button>
      </form>

      {/* API Key Modal */}
      <Modal
        open={showKeyModal}
        onClose={() => setShowKeyModal(false)}
        title="تفعيل محرك الذكاء الاصطناعي الكامل (Gemini API)"
        description="يمكنك تزويد المساعد بمفتاح Google Gemini API المجاني للإجابة اللامحدودة على أي تساؤل برمجي أو عام."
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
              يُحفظ المفتاح محلياً في متصفحك بشكل آمن تماماً، ويمكنك الحصول على مفتاح مجاني من{' '}
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowKeyModal(false)}
              className="text-xs"
            >
              إلغاء
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSaveApiKey}
              className="text-xs font-bold gap-1.5"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>حفظ المفتاح</span>
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
