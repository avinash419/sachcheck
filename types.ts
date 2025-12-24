
export enum Language {
  HINDI = 'Hindi',
  ENGLISH = 'English',
  BHOJPURI = 'Bhojpuri'
}

export type Verdict = 'True' | 'False' | 'Misleading' | 'Unverified';

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface FactCheckResult {
  verdict: Verdict;
  explanation: string;
  sources: GroundingSource[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image?: string;
  result?: FactCheckResult;
  timestamp: Date;
}

export interface TranslationMap {
  [key: string]: {
    [lang in Language]: string;
  };
}
