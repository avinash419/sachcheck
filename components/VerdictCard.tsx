
import React, { useState } from 'react';
import { FactCheckResult, Language } from '../types';
import { UI_STRINGS } from '../constants';
import { generateSpeech, decodeAudio, decodeAudioToBuffer } from '../services/geminiService';

interface VerdictCardProps {
  result: FactCheckResult;
  language: Language;
}

const VerdictCard: React.FC<VerdictCardProps> = ({ result, language }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const getVerdictLabel = () => {
    switch (result.verdict) {
      case 'True': return UI_STRINGS.verdictTrue[language];
      case 'False': return UI_STRINGS.verdictFalse[language];
      case 'Misleading': return UI_STRINGS.verdictMisleading[language];
      default: return 'UNVERIFIED';
    }
  };

  const renderFormattedLine = (text: string, key: number) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    const content = parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <span key={`${key}-${i}`} className="text-blue-600 font-bold">
            {part.slice(2, -2)}
          </span>
        );
      }
      return part;
    });

    const trimmed = text.trim();
    const isBullet = trimmed.startsWith('•') || trimmed.startsWith('-') || /^(News|Point|दावा|खबर)\s+\d+[:.]/i.test(trimmed);
    
    return (
      <div 
        key={key} 
        className={`${isBullet ? 'pl-6 relative mb-4 border-l-2 border-blue-100 py-1' : 'mb-5'} leading-relaxed`}
      >
        {isBullet && (
          <span className="absolute -left-[5px] top-3 w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]"></span>
        )}
        <p className={`${isBullet ? 'text-slate-800' : 'text-slate-600 font-medium'}`}>
          {content}
        </p>
      </div>
    );
  };

  const renderExplanation = () => {
    // Advanced parsing: split by newline OR by News/Point patterns if they are preceded by space/punctuation
    // This ensures that "News 1: ... News 2: ..." becomes separate items
    const rawLines = result.explanation
      .split(/\n|(?=(?:News|Point|दावा|खबर)\s+\d+[:.])/i)
      .filter(l => l.trim().length > 0);
      
    return (
      <div className="space-y-1">
        {rawLines.map((line, idx) => renderFormattedLine(line, idx))}
      </div>
    );
  };

  const handlePlayVoice = async () => {
    if (isPlaying) return;
    setIsPlaying(true);
    try {
      const audioData = await generateSpeech(result.explanation);
      if (audioData) {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        const decodedData = decodeAudio(audioData);
        const buffer = await decodeAudioToBuffer(decodedData, audioCtx);
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.onended = () => {
          setIsPlaying(false);
          audioCtx.close().catch(() => {});
        };
        source.start();
      } else {
        setIsPlaying(false);
      }
    } catch (error) {
      console.error("Speech playback error:", error);
      setIsPlaying(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result.explanation);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.08)] p-8 space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700 w-full overflow-hidden">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner ${
            result.verdict === 'True' ? 'bg-emerald-50 text-emerald-600' : 
            result.verdict === 'False' ? 'bg-rose-50 text-rose-600' : 
            'bg-amber-50 text-amber-600'
          }`}>
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="12" y1="9" x2="12" y2="13" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="12" y1="17" x2="12.01" y2="17" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Final Verdict</span>
            <span className={`font-black text-2xl tracking-tighter ${
              result.verdict === 'True' ? 'text-emerald-600' : 
              result.verdict === 'False' ? 'text-rose-600' : 
              'text-amber-600'
            }`}>{getVerdictLabel()}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={handleCopy}
            className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white transition-all text-slate-500 hover:shadow-xl hover:-translate-y-0.5 active:scale-95"
            title="Copy"
          >
            {isCopied ? (
               <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2" />
              </svg>
            )}
          </button>
          <button 
            onClick={handlePlayVoice}
            disabled={isPlaying}
            className={`p-3.5 bg-slate-50 border border-slate-100 rounded-2xl hover:bg-white transition-all text-slate-500 hover:shadow-xl hover:-translate-y-0.5 active:scale-95 ${isPlaying ? 'ring-2 ring-blue-500 bg-blue-50 animate-pulse text-blue-600' : ''}`}
            title="Listen"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          </button>
        </div>
      </div>
      
      <div className="text-slate-700 text-lg px-1">
        {renderExplanation()}
      </div>
      
      {result.sources.length > 0 && (
        <div className="pt-6 border-t border-slate-50">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-4 h-[2px] bg-blue-500"></span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em]">Evidence Sources</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {result.sources.map((source, idx) => (
              <a 
                key={idx} 
                href={source.uri} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 text-xs bg-white border border-slate-100 px-4 py-2.5 rounded-2xl text-slate-600 hover:border-blue-200 hover:text-blue-600 hover:shadow-lg transition-all font-bold group"
              >
                <svg className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {source.title}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VerdictCard;
