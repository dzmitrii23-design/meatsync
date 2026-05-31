import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, X, Sparkles } from 'lucide-react';
import { AppState } from '../types';
import { processAiQuery, AiMessage } from '../aiAssistant';

interface AiAssistantPanelProps {
  state: AppState;
}

export function AiAssistantPanel({ state }: AiAssistantPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<AiMessage[]>([
    {
      sender: 'assistant',
      text: 'Приветствую! Я ваш локальный ИИ-Ассистент. 🤖\n\nЯ могу быстро подсказать остатки по сырью, свободное место на складах, найти партии с истекающим сроком годности или показать последние проводки.\n\nНапишите ваш вопрос (например: *«Сколько у нас свинины?»* или *«помощь»*)!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Автопрокрутка чата вниз при новых сообщениях
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const handleSend = () => {
    if (!query.trim()) return;

    const userMsg: AiMessage = {
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setQuery('');
    setIsTyping(true);

    // Симуляция "раздумий" ИИ для более премиального ощущения
    setTimeout(() => {
      const responseText = processAiQuery(userMsg.text, state);
      const assistantMsg: AiMessage = {
        sender: 'assistant',
        text: responseText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, assistantMsg]);
      setIsTyping(false);
    }, 450);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  // Простой рендерер локального Markdown
  const renderMessageText = (text: string) => {
    return text.split('\n').map((line, idx) => {
      let formatted = line;
      let isBullet = false;

      if (formatted.startsWith('• ')) {
        formatted = formatted.substring(2);
        isBullet = true;
      } else if (formatted.startsWith('- ')) {
        formatted = formatted.substring(2);
        isBullet = true;
      }

      // **bold** -> <strong>
      formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
      // *italic* -> <em>
      formatted = formatted.replace(/\*(.*?)\*/g, '<em class="text-slate-200 italic">$1</em>');

      if (isBullet) {
        return (
          <li 
            key={idx} 
            className="ml-4 list-disc text-slate-300 my-1 font-sans text-xs md:text-sm"
            dangerouslySetInnerHTML={{ __html: formatted }} 
          />
        );
      }
      return (
        <p 
          key={idx} 
          className="my-1 leading-relaxed text-slate-300 font-sans text-xs md:text-sm"
          dangerouslySetInnerHTML={{ __html: formatted }} 
        />
      );
    });
  };

  return (
    <>
      {/* Floating Chat Bubble Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-full shadow-[0_4px_20px_rgba(37,99,235,0.4)] hover:shadow-[0_4px_25px_rgba(37,99,235,0.6)] flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 z-40 border border-blue-400/20 cursor-pointer"
        aria-label="ИИ Помощник"
      >
        {isOpen ? <X size={24} /> : <Bot size={26} className="animate-pulse" />}
        {!isOpen && (
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border border-white"></span>
          </span>
        )}
      </button>

      {/* Glassmorphic Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[calc(100vw-32px)] sm:w-[400px] h-[500px] bg-slate-950/95 backdrop-blur-xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] border border-slate-800/80 flex flex-col overflow-hidden z-40 animate-in fade-in slide-in-from-bottom-5 duration-200">
          
          {/* Header */}
          <div className="bg-slate-900 px-4 py-3.5 border-b border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400">
                <Sparkles size={16} />
              </div>
              <div>
                <h3 className="text-xs md:text-sm font-extrabold text-white leading-none">
                  ИИ-Ассистент MeatSync
                </h3>
                <div className="flex items-center gap-1 mt-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                    Локальный режим
                  </span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0 bg-slate-950/40">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`flex gap-2.5 max-w-[85%] ${
                  msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''
                }`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                    <Bot size={14} />
                  </div>
                )}
                <div>
                  <div className={`p-3 rounded-2xl text-xs md:text-sm shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-none'
                      : 'bg-slate-900 border border-slate-800 text-slate-300 rounded-tl-none'
                  }`}>
                    {msg.sender === 'user' ? (
                      <p className="font-sans leading-relaxed text-xs md:text-sm">{msg.text}</p>
                    ) : (
                      renderMessageText(msg.text)
                    )}
                  </div>
                  <span className={`text-[9px] font-semibold text-slate-500 mt-1 block px-1 ${
                    msg.sender === 'user' ? 'text-right' : ''
                  }`}>
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex gap-2.5 max-w-[80%]">
                <div className="w-7 h-7 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                  <Bot size={14} />
                </div>
                <div className="bg-slate-900 border border-slate-800 text-slate-300 p-3 rounded-2xl rounded-tl-none flex items-center gap-1 shadow-sm shrink-0">
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Footer Input */}
          <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2 shrink-0">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Спросите меня о запасах..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs md:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/80 transition-colors font-sans"
            />
            <button
              onClick={handleSend}
              disabled={!query.trim()}
              className="p-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 disabled:active:scale-100 cursor-pointer shrink-0"
              aria-label="Отправить"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
