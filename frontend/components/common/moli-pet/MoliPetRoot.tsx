'use client';

import { type FormEvent, useMemo } from 'react';
import { FiImage, FiMessageCircle, FiPaperclip, FiSend, FiX } from 'react-icons/fi';
import RichMathText from '@/components/common/RichMathText';
import MolyPet3D from './MolyPet3D';
import { useMoliPetController } from './useMoliPetController';
import type { MoliPetProps } from './types';

const SUGGESTIONS = [
  { label: 'Giải bài', prompt: 'Giúp mình giải bài đang học nhé.' },
  { label: 'Lập kế hoạch', prompt: 'Lập kế hoạch học tập phù hợp cho mình.' },
  { label: 'Ôn từ vựng', prompt: 'Cùng mình ôn từ vựng CSCA nhé.' },
];

export default function MoliPetRoot({ defaultPosition = 'right' }: MoliPetProps) {
  const controller = useMoliPetController({ defaultPosition });
  const motion = useMemo(() => {
    if (controller.loading) return 'think' as const;
    if (controller.walking || controller.dragging) return 'walk' as const;
    if (controller.open) return 'happy' as const;
    return 'wave' as const;
  }, [controller.dragging, controller.loading, controller.open, controller.walking]);

  if (!controller.mounted) return null;

  if (controller.hidden) {
    return (
      <button
        type="button"
        onClick={controller.restorePet}
        className="fixed bottom-5 right-5 z-[65] grid h-12 w-12 place-items-center rounded-full border border-violet-200/80 bg-white/90 text-violet-600 shadow-[0_12px_35px_rgba(82,61,140,0.2)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(82,61,140,0.26)]"
        aria-label="Hiện Moly"
      >
        <FiMessageCircle className="h-5 w-5" />
      </button>
    );
  }

  if (!controller.petPoint) return null;

  const sendSuggestion = (prompt: string) => {
    controller.setInput(prompt);
  };

  const submit = (event: FormEvent) => {
    void controller.sendMessage(event);
  };

  return (
    <>
      {controller.open && !controller.minimized && (
        <section
          className="fixed z-[90] flex min-h-[360px] flex-col overflow-visible rounded-[30px] border border-white/90 bg-[rgba(255,252,255,0.94)] text-slate-800 shadow-[0_28px_90px_rgba(74,54,122,0.24),0_8px_28px_rgba(119,91,180,0.12)] backdrop-blur-2xl"
          style={controller.panelStyle}
          aria-label="Trò chuyện với Moly"
        >
          <div className="pointer-events-none absolute -left-[74px] -top-[112px] hidden h-[190px] w-[190px] sm:block">
            <MolyPet3D motion={motion} className="h-full w-full" />
          </div>

          <header className="flex min-h-[76px] items-center gap-3 border-b border-violet-100/80 px-5">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-lg font-black tracking-[-0.02em] text-slate-900">Moly</h2>
              <p className="text-[11px] font-medium text-slate-400">
                {controller.loading ? 'Đang suy nghĩ cùng bạn…' : 'Trợ lý học tập của bạn'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => controller.setOpen(false)}
              className="grid h-10 w-10 place-items-center rounded-full text-slate-400 transition hover:bg-violet-50 hover:text-violet-600"
              aria-label="Đóng trò chuyện"
            >
              <FiX className="h-5 w-5" />
            </button>
          </header>

          <div
            ref={controller.messagesScrollRef}
            className="moli-pet-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
          >
            {controller.messages.length <= 1 && (
              <div className="pb-1 text-center">
                <h3 className="text-xl font-black tracking-[-0.035em] text-slate-900">
                  Hôm nay bạn muốn học gì?
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Hỏi bài, lập kế hoạch hoặc cùng Moly ôn tập.
                </p>
              </div>
            )}

            {controller.messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[88%] rounded-[20px] px-4 py-3 ${
                  message.role === 'user'
                    ? 'ml-auto rounded-br-md bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_8px_22px_rgba(139,92,246,0.2)]'
                    : 'mr-auto rounded-bl-md border border-violet-100 bg-white/90 text-slate-700 shadow-sm'
                }`}
              >
                {message.imageDataUrl && (
                  <div className="mb-2 overflow-hidden rounded-xl border border-white/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={message.imageDataUrl} alt="Ảnh đã gửi" className="max-h-44 w-full object-cover" />
                  </div>
                )}
                <RichMathText value={message.content} className={message.role === 'user' ? 'text-white' : ''} />
              </div>
            ))}

            {controller.loading && (
              <div className="mr-auto flex items-center gap-2 rounded-[18px] rounded-bl-md border border-violet-100 bg-white px-4 py-3 shadow-sm">
                <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.24s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400 [animation-delay:-0.12s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400" />
              </div>
            )}
          </div>

          <div className="border-t border-violet-100/80 p-3">
            {controller.messages.length <= 1 && (
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion.label}
                    type="button"
                    onClick={() => sendSuggestion(suggestion.prompt)}
                    className="shrink-0 rounded-full border border-violet-100 bg-white px-3 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-200 hover:text-violet-600"
                  >
                    {suggestion.label}
                  </button>
                ))}
              </div>
            )}

            {controller.pastedImage && (
              <div className="mb-2 flex items-center gap-2 rounded-xl bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700">
                <FiImage className="h-4 w-4" />
                <span className="min-w-0 flex-1 truncate">{controller.pastedImage.name || 'Ảnh đã dán'}</span>
                <button type="button" onClick={controller.clearPastedImage} aria-label="Bỏ ảnh">
                  <FiX />
                </button>
              </div>
            )}

            <form
              onSubmit={submit}
              className="flex items-center gap-2 rounded-[19px] border border-violet-100 bg-white/95 p-1.5 shadow-[0_6px_24px_rgba(78,57,130,0.08)] focus-within:border-violet-300 focus-within:ring-4 focus-within:ring-violet-100/70"
            >
              <label className="grid h-10 w-10 shrink-0 cursor-pointer place-items-center rounded-full text-slate-400 transition hover:bg-violet-50 hover:text-violet-600">
                <FiPaperclip className="h-[18px] w-[18px]" />
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled
                  aria-label="Đính kèm ảnh bằng cách dán ảnh vào ô nhập"
                />
              </label>
              <input
                value={controller.input}
                onChange={(event) => controller.setInput(event.target.value)}
                onPaste={controller.handlePasteImage}
                onFocus={controller.keepMobileViewportStable}
                placeholder={controller.cooldownSeconds > 0 ? `Thử lại sau ${controller.cooldownSeconds}s` : 'Hỏi Moly…'}
                disabled={controller.loading || controller.cooldownSeconds > 0}
                className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={
                  controller.loading ||
                  controller.processingImage ||
                  controller.cooldownSeconds > 0 ||
                  (!controller.input.trim() && !controller.pastedImage)
                }
                className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_7px_18px_rgba(139,92,246,0.3)] transition hover:scale-[1.04] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label="Gửi tin nhắn"
              >
                <FiSend className="h-[17px] w-[17px]" />
              </button>
            </form>
          </div>
        </section>
      )}

      {!controller.open && (
        <div
          className="fixed z-[65] h-32 w-32 select-none"
          style={controller.containerStyle}
        >
          {controller.showHintBubble && (
            <div className={`pointer-events-none absolute top-3 ${controller.bubbleSideClass} w-max max-w-52 rounded-2xl border border-violet-100 bg-white/95 px-3 py-2 text-xs font-bold text-slate-600 shadow-xl backdrop-blur`}>
              {controller.routeHint}
            </div>
          )}
          <button
            type="button"
            onPointerDown={controller.handlePetPointerDown}
            onPointerMove={controller.handlePetPointerMove}
            onPointerUp={controller.handlePetPointerUp}
            onPointerCancel={controller.handlePetPointerUp}
            onClick={controller.toggleFromPetClick}
            className="group relative h-full w-full cursor-grab touch-none rounded-full outline-none active:cursor-grabbing focus-visible:ring-4 focus-visible:ring-violet-300/70"
            aria-label="Mở trò chuyện với Moly"
          >
            <span className="absolute inset-5 rounded-full bg-violet-300/20 blur-2xl transition group-hover:bg-fuchsia-300/30" />
            <MolyPet3D motion={motion} className="relative h-full w-full transition-transform duration-300 group-hover:scale-105" />
          </button>
        </div>
      )}
    </>
  );
}
