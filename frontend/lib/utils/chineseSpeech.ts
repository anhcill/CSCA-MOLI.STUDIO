'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function isSafeSpeechAudioUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function pickChineseVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  return (
    voices.find((voice) => voice.lang.toLowerCase() === 'zh-cn')
    || voices.find((voice) => voice.lang.toLowerCase() === 'zh_cn')
    || voices.find((voice) => voice.lang.toLowerCase().startsWith('zh'))
    || voices.find((voice) => /chinese|mandarin|普通话|中文|tingting|xiaoxiao|yunxi/i.test(voice.name))
  );
}

function loadSpeechVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve([]);
      return;
    }
    const synth = window.speechSynthesis;
    const ready = synth.getVoices();
    if (ready.length > 0) {
      resolve(ready);
      return;
    }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      synth.removeEventListener('voiceschanged', finish);
      resolve(synth.getVoices());
    };
    synth.addEventListener('voiceschanged', finish);
    window.setTimeout(finish, 900);
  });
}

export interface SpeakChineseOptions {
  key?: string | number | null;
  text: string;
  audioUrl?: string | null;
  rate?: number;
}

export function useChineseSpeech() {
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const [speechError, setSpeechError] = useState<string>('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const requestSeqRef = useRef(0);

  const stop = useCallback(() => {
    requestSeqRef.current += 1;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    utteranceRef.current = null;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingKey(null);
  }, []);

  const speak = useCallback(async ({ key, text, audioUrl, rate = 0.85 }: SpeakChineseOptions) => {
    const cleanText = String(text || '').trim();
    const activeKey = key != null ? String(key) : cleanText || null;
    const safeUrl = isSafeSpeechAudioUrl(audioUrl);

    if (!cleanText && !safeUrl) return;

    const reqId = requestSeqRef.current + 1;
    requestSeqRef.current = reqId;
    setSpeechError('');

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (safeUrl) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      const audio = new Audio(safeUrl);
      audioRef.current = audio;
      setSpeakingKey(activeKey);
      audio.onended = () => {
        if (requestSeqRef.current === reqId) setSpeakingKey(null);
      };
      audio.onerror = () => {
        if (requestSeqRef.current === reqId) {
          setSpeakingKey(null);
          setSpeechError('Không phát được tệp âm thanh từ vựng.');
        }
      };
      try {
        await audio.play();
        return;
      } catch {
        if (requestSeqRef.current !== reqId) return;
        setSpeakingKey(null);
        if (!cleanText) {
          setSpeechError('Trình duyệt đang chặn tự phát âm thanh; hãy bấm nút Nghe.');
          return;
        }
      }
    }

    if (
      typeof window === 'undefined'
      || !('speechSynthesis' in window)
      || typeof SpeechSynthesisUtterance === 'undefined'
    ) {
      setSpeechError('Trình duyệt này chưa hỗ trợ đọc phát âm (Web Speech API).');
      return;
    }

    const synth = window.speechSynthesis;
    synth.cancel();
    synth.resume();

    const voices = await loadSpeechVoices();
    if (requestSeqRef.current !== reqId) return;
    synth.resume();

    const zhVoice = pickChineseVoice(voices);
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = zhVoice?.lang || 'zh-CN';
    utterance.rate = rate;
    utterance.pitch = 1;
    if (zhVoice) {
      utterance.voice = zhVoice;
    }

    utterance.onstart = () => {
      if (requestSeqRef.current !== reqId) return;
      setSpeakingKey(activeKey);
      setSpeechError('');
    };
    utterance.onend = () => {
      if (requestSeqRef.current !== reqId) return;
      if (utteranceRef.current === utterance) utteranceRef.current = null;
      setSpeakingKey(null);
    };
    utterance.onerror = (event) => {
      if (requestSeqRef.current !== reqId) return;
      if (utteranceRef.current === utterance) utteranceRef.current = null;
      setSpeakingKey(null);
      if (event.error === 'not-allowed') {
        setSpeechError('Trình duyệt chặn tự phát âm trước khi bạn bấm tương tác; hãy bấm nút Nghe.');
      } else if (event.error !== 'canceled' && event.error !== 'interrupted') {
        setSpeechError(
          !zhVoice && voices.length > 0
            ? 'Thiết bị chưa có giọng đọc tiếng Trung (zh-CN) trong hệ thống.'
            : 'Không thể phát âm tự động trên trình duyệt này.',
        );
      }
    };

    utteranceRef.current = utterance;
    setSpeakingKey(activeKey);
    synth.speak(utterance);

    window.setTimeout(() => {
      if (requestSeqRef.current !== reqId) return;
      if (synth.paused) synth.resume();
    }, 120);
  }, []);

  useEffect(() => stop, [stop]);

  return {
    speakingKey,
    isSpeaking: speakingKey !== null,
    speechError,
    clearSpeechError: () => setSpeechError(''),
    speak,
    stop,
  };
}
