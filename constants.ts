
import { Language, TranslationMap } from './types';

export const UI_STRINGS: TranslationMap = {
  appName: {
    [Language.HINDI]: 'सत्यप्रमाण',
    [Language.ENGLISH]: 'SachCheck',
    [Language.BHOJPURI]: 'सच चेक',
  },
  tagline: {
    [Language.HINDI]: 'सत्यापन केंद्र',
    [Language.ENGLISH]: 'Verification Hub',
    [Language.BHOJPURI]: 'जाँच केंद्र',
  },
  placeholder: {
    [Language.HINDI]: 'लिंक टाइप करें या दावे का वर्णन करें...',
    [Language.ENGLISH]: 'Type a link or describe the claim...',
    [Language.BHOJPURI]: 'लिंक लिखीं चाहे दावा बताईं...',
  },
  checkButton: {
    [Language.HINDI]: 'जाँचें',
    [Language.ENGLISH]: 'Check',
    [Language.BHOJPURI]: 'जाँचीं',
  },
  welcomeMsg: {
    [Language.HINDI]: 'सत्यापन हब में आपका स्वागत है। 👋 मैं राजनीतिक दावों और संदेशों की वास्तविक समय में पुष्टि कर सकता हूँ। शुरू करने के लिए कोई लिंक साझा करें, फोटो अपलोड करें या बोलकर पूछें।',
    [Language.ENGLISH]: 'Welcome to the Verification Hub. 👋 I can verify political claims and messages in real-time. Share a link, upload a photo, or ask to get started.',
    [Language.BHOJPURI]: 'सत्यापन हब में राउर स्वागत बा। 👋 हम राजनीतिक दावा अउरी संदेशन के तुरंत जांच कर सकिला। शुरू करे खातिर कौनों लिंक भेजीं, फोटो अपलोड करीं भा बोल के पूछीं।',
  },
  verdictTrue: {
    [Language.HINDI]: 'SAHI',
    [Language.ENGLISH]: 'TRUE',
    [Language.BHOJPURI]: 'SAHI',
  },
  verdictFalse: {
    [Language.HINDI]: 'GALAT',
    [Language.ENGLISH]: 'FALSE',
    [Language.BHOJPURI]: 'GALAT',
  },
  verdictMisleading: {
    [Language.HINDI]: 'BHRAMAK',
    [Language.ENGLISH]: 'MISLEADING',
    [Language.BHOJPURI]: 'BHRAMAK',
  },
  sourcesTitle: {
    [Language.HINDI]: 'स्रोत लिंक:',
    [Language.ENGLISH]: 'Source Links:',
    [Language.BHOJPURI]: 'स्रोत लिंक:',
  },
  accuracyLabel: {
    [Language.HINDI]: 'सिस्टम सटीकता',
    [Language.ENGLISH]: 'System Accuracy',
    [Language.BHOJPURI]: 'सिस्टम के सटीकता',
  },
  activeLabel: {
    [Language.HINDI]: 'सक्रिय',
    [Language.ENGLISH]: 'Active',
    [Language.BHOJPURI]: 'चालू',
  }
};
