
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { Language, Message, FactCheckResult } from './types.ts';
import { UI_STRINGS } from './constants.ts';
import { checkFact, createAudioBlob } from './services/geminiService.ts';
import VerdictCard from './components/VerdictCard.tsx';

const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>(Language.HINDI);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isKeyMissing, setIsKeyMissing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);
  const transcriptionRef = useRef<string>('');

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const checkApiKey = async () => {
      const currentKey = process.env.API_KEY;
      const hasValidKey = !!currentKey && currentKey.length > 5;
      
      if (!hasValidKey && window.aistudio) {
        try {
          const selected = await window.aistudio.hasSelectedApiKey();
          if (!selected) {
            setIsKeyMissing(true);
          }
        } catch (e) {
          setIsKeyMissing(true);
        }
      }
    };
    checkApiKey();
  }, []);

  const handleOpenKeyDialog = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setIsKeyMissing(false);
      setErrorMsg(null);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  useEffect(() => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      content: UI_STRINGS.welcomeMsg[language],
      timestamp: new Date()
    }]);
  }, [language]);

  const stopRecording = useCallback(() => {
    if (scriptNodeRef.current) { scriptNodeRef.current.disconnect(); scriptNodeRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (audioContextRef.current) { audioContextRef.current.close().catch(() => {}); audioContextRef.current = null; }
    if (liveSessionRef.current) {
      liveSessionRef.current.then((s: any) => { try { s.close(); } catch(e) {} }).catch(() => {});
      liveSessionRef.current = null;
    }
    setIsRecording(false);
    transcriptionRef.current = '';
  }, []);

  const startRecording = async () => {
    if (isRecording) return;
    setErrorMsg(null);
    transcriptionRef.current = '';
    
    if (!process.env.API_KEY && !window.aistudio) { 
      setIsKeyMissing(true);
      return; 
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setIsRecording(true);
            const source = audioContext.createMediaStreamSource(stream);
            const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
            scriptNodeRef.current = scriptProcessor;
            scriptProcessor.onaudioprocess = (e) => {
              const pcmBlob = createAudioBlob(e.inputBuffer.getChannelData(0));
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob })).catch(stopRecording);
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContext.destination);
          },
          onmessage: (m: LiveServerMessage) => {
            if (m.serverContent?.inputTranscription?.text) {
              const newText = m.serverContent.inputTranscription.text;
              setInputValue(prev => (transcriptionRef.current + " " + newText).trim());
              transcriptionRef.current += " " + newText;
            }
          },
          onerror: (e) => { 
            console.error("Live session error", e);
            stopRecording(); 
          },
          onclose: () => setIsRecording(false),
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
        },
      });
      liveSessionRef.current = sessionPromise;
    } catch (err) { 
      setErrorMsg("Microphone access is required for voice search."); 
      stopRecording(); 
    }
  };

  const handleSendMessage = async (customText?: string) => {
    if (isRecording) stopRecording();
    
    const text = (customText || inputValue).trim();
    if (!text && !selectedImage) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      image: selectedImage || undefined,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    if (!customText) setInputValue('');
    setSelectedImage(null);
    setIsTyping(true);
    setErrorMsg(null);

    try {
      const result = await checkFact(text || 'Image analysis', language, selectedImage || undefined);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        result,
        timestamp: new Date()
      }]);
    } catch (error: any) {
      console.error("Verification error details:", error);
      const errString = error?.message?.toLowerCase() || "";
      
      // If auth failure or model not found, always prompt for a key
      if (
        errString.includes("not found") || 
        errString.includes("key") || 
        errString.includes("401") || 
        errString.includes("403") ||
        errString.includes("unauthorized")
      ) {
        setIsKeyMissing(true);
        setErrorMsg("API Key connection lost. Please connect your Gemini key again.");
      } else {
        setErrorMsg(`Error: ${error?.message || "Something went wrong. Please check your internet."}`);
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleQuickCheck = () => {
    const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
    let prompt = language === Language.ENGLISH 
      ? `Today's (${today}) latest news from Uruwa Bazar Daily Newz.` 
      : language === Language.BHOJPURI 
      ? `आज (${today}) के उरुवा बाज़ार डेली न्यूज़ के ताज़ा खबर बताईं।`
      : `आज (${today}) की उरुवा बाज़ार डेली न्यूज़ की ताज़ा खबरें दिखाएं।`;
    
    handleSendMessage(prompt);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const renderedMessages = useMemo(() => messages.map((msg) => (
    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      <div className={`w-full ${msg.role === 'user' ? 'max-w-[85%] md:max-w-[70%]' : ''}`}>
        {msg.role === 'user' ? (
          <div className="bg-[#0a0a1a] text-white rounded-3xl p-6 rounded-tr-none shadow-2xl ml-auto border border-white/10">
            {msg.image && <img src={msg.image} className="rounded-2xl mb-4 max-h-72 object-contain w-full bg-black/20" alt="User upload" />}
            {msg.content && <p className="text-lg leading-relaxed font-medium">{msg.content}</p>}
          </div>
        ) : (
          <div className="w-full">
            {msg.content && (
              <div className="bg-white border border-slate-100 rounded-3xl p-6 rounded-tl-none shadow-sm mb-6 max-w-[85%] md:max-w-[70%] text-slate-700 font-medium text-lg border-l-4 border-l-blue-500">
                {msg.content}
              </div>
            )}
            {msg.result && <VerdictCard result={msg.result} language={language} />}
          </div>
        )}
        <div className={`text-[10px] mt-3 font-black text-slate-300 uppercase tracking-[0.2em] ${msg.role === 'user' ? 'text-right mr-2' : 'text-left ml-2'}`}>
          {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )), [messages, language]);

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden">
      {isKeyMissing && (
        <div className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-2xl flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[3rem] max-w-lg w-full p-12 shadow-2xl text-center space-y-8 transform transition-all animate-in zoom-in-95 duration-500">
            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-blue-600 shadow-inner">
              <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
            </div>
            <div className="space-y-3">
              <h3 className="text-3xl font-black text-slate-900 tracking-tighter">Connect Your Account</h3>
              <p className="text-slate-500 font-medium leading-relaxed">
                To start fact-checking, please connect your Gemini API key. If you are on Netlify, this is required for the app to function.
                <br /><a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-blue-600 underline text-sm mt-2 inline-block font-bold">Billing Documentation</a>
              </p>
            </div>
            <button 
              onClick={handleOpenKeyDialog}
              className="w-full py-6 bg-blue-600 text-white rounded-3xl font-black uppercase tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-500/30 transition-all hover:scale-[1.02] active:scale-95"
            >
              Set API Key Now
            </button>
          </div>
        </div>
      )}

      <aside className="hidden md:flex flex-col w-72 bg-[#0a0a1a] text-white p-8 justify-between border-r border-white/5 shadow-2xl z-20">
        <div className="space-y-10">
          <div className="flex items-center gap-4 group cursor-pointer">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl flex items-center justify-center font-black text-2xl shadow-lg group-hover:scale-110 transition-transform">S</div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter leading-none">{UI_STRINGS.appName[language]}</h1>
              <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest opacity-60">SachCheck Hub</span>
            </div>
          </div>
          <nav className="space-y-2">
            <button className="flex items-center gap-4 w-full p-4 bg-white/10 rounded-2xl text-left border border-white/5 shadow-xl font-bold transition-all hover:bg-white/15">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              </div>
              <span>सत्यापन केंद्र</span>
            </button>
            <button onClick={handleQuickCheck} className="flex items-center gap-4 w-full p-4 bg-gradient-to-r from-blue-600/20 to-transparent hover:from-blue-600/30 rounded-2xl text-left border border-blue-500/10 shadow-xl font-bold transition-all group">
              <div className="w-8 h-8 rounded-lg bg-blue-500/30 flex items-center justify-center group-hover:bg-blue-500/50 transition-colors">
                <svg className="w-5 h-5 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2z" /></svg>
              </div>
              <span className="text-sm truncate">{UI_STRINGS.uruwaBazar[language]}</span>
            </button>
          </nav>
        </div>
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-blue-600/10 to-indigo-600/10 p-6 rounded-3xl border border-blue-500/20 backdrop-blur-sm text-center">
            <div className="text-3xl font-black text-blue-400 tracking-tighter">99.9%</div>
            <div className="text-[10px] text-blue-200/40 uppercase font-black tracking-[0.2em] mt-1">{UI_STRINGS.accuracyLabel[language]}</div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden bg-white">
        <header className="px-8 py-5 flex items-center justify-between border-b border-slate-50 bg-white/80 backdrop-blur-xl z-10">
          <div className="md:hidden flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center font-black text-lg text-white shadow-lg">S</div>
            <span className="font-black text-slate-900 tracking-tighter text-xl">{UI_STRINGS.appName[language]}</span>
          </div>
          <div className="hidden md:flex flex-col">
            <h2 className="text-xl font-black text-slate-900 tracking-tighter">{UI_STRINGS.tagline[language]}</h2>
            <div className="flex items-center gap-2 uppercase font-black text-[10px] tracking-[0.3em] text-slate-400">
              <span className="text-blue-600">PRO-ENGINE</span>
              <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
              <span>GEMINI 3.0</span>
            </div>
          </div>
          <div className="flex bg-slate-100 p-1.5 rounded-2xl shadow-inner border border-slate-200/50">
            {Object.values(Language).map((lang) => (
              <button key={lang} onClick={() => setLanguage(lang)} className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${language === lang ? 'bg-white text-slate-900 shadow-xl scale-105' : 'text-slate-500 hover:text-slate-800'}`}>
                {lang}
              </button>
            ))}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-8 md:px-12 md:py-10 bg-[#fcfdfe] scroll-smooth">
          <div className="max-w-4xl mx-auto w-full space-y-12">
            {renderedMessages}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-xl flex items-center gap-4 animate-pulse">
                  <div className="flex gap-2">
                    <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce"></span>
                    <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">सत्यापन जारी है...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>

        {errorMsg && (
          <div className="mx-8 md:mx-12 mb-4 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-600 text-sm font-bold flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 shadow-sm">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="flex-1">{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)} className="p-2 hover:bg-rose-100 rounded-lg transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
        )}

        <footer className="p-6 md:p-12 pt-0 z-10">
          <div className="max-w-4xl mx-auto relative">
            <div className={`bg-white rounded-[2.5rem] shadow-2xl border ${isRecording ? 'border-blue-400 ring-8 ring-blue-50' : 'border-slate-100 focus-within:border-blue-200 focus-within:ring-8 focus-within:ring-slate-50'} p-3 flex items-center gap-2 transition-all duration-500`}>
              <button onClick={() => fileInputRef.current?.click()} className="p-5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </button>
              <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder={UI_STRINGS.placeholder[language]} className="flex-1 py-4 text-xl text-slate-900 placeholder-slate-300 bg-transparent outline-none font-bold tracking-tight px-2" />
              <div className="flex items-center gap-2 pr-2">
                <button onClick={isRecording ? stopRecording : startRecording} className={`p-5 rounded-full transition-all duration-500 ${isRecording ? 'bg-rose-500 text-white shadow-lg scale-110' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}>
                  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                </button>
                <button onClick={() => handleSendMessage()} disabled={isTyping || (!inputValue.trim() && !selectedImage)} className={`px-10 py-5 rounded-full font-black uppercase text-sm tracking-[0.2em] transition-all duration-300 flex items-center gap-3 ${isTyping || (!inputValue.trim() && !selectedImage) ? 'bg-slate-100 text-slate-300 scale-95' : 'bg-blue-600 text-white hover:bg-blue-700 shadow-xl hover:scale-105 active:scale-95'}`}>
                  {UI_STRINGS.checkButton[language]}
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </button>
              </div>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
          </div>
        </footer>
      </main>
    </div>
  );
};

export default App;
