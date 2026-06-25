'use client';

import { FiChevronDown, FiHeart, FiPaperclip, FiRefreshCw, FiSend, FiSettings, FiSmile, FiX } from 'react-icons/fi';
import { MOODS, PET_SKINS, SUGGESTED_ACTIONS } from './constants';
import { MoliPetSettings } from './MoliPetSettings';
import { PetFace } from './PetFace';
import type { MoliPetController } from './types';

export function MoliPetPanel({ controller }: { controller: MoliPetController }) {
  const {
    settings,
    settingsOpen,
    panelStyle,
    messages,
    messagesScrollRef,
    loading,
    cooldownSeconds,
    pastedImage,
    processingImage,
    input,
    isAuthenticated,
    petMood,
    updateSettings,
    setSettingsOpen,
    setMinimized,
    setOpen,
    setInput,
    clearPastedImage,
    keepMobileViewportStable,
    handlePasteImage,
    sendMessage,
  } = controller;
  const skin = PET_SKINS[settings.skin];

  return (
    <section
      className={`fixed flex flex-col overflow-hidden ${skin.panelClass} ${skin.retro ? 'font-mono' : ''}`}
      style={panelStyle}
      aria-label="MolyPet"
    >
      <div className={`sticky top-0 z-10 flex shrink-0 items-center justify-between px-4 py-3 max-sm:px-3 max-sm:py-2.5 ${skin.headerClass}`}>
        <div className="flex min-w-0 items-center gap-3">
          <div className={settings.skin === 'floating-pet' ? '-ml-2 -mt-7' : ''}>
            <PetFace color={settings.color} variant={settings.variant} mood={petMood} />
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              {skin.chromeLabel && (
                <span className="shrink-0 rounded-[4px] border border-current px-1.5 py-0.5 text-[10px] font-black">
                  {skin.chromeLabel}
                </span>
              )}
              <p className="truncate text-sm font-black">{settings.name}</p>
            </div>
            <p className="truncate text-xs font-medium opacity-75">{MOODS[settings.mood].hint}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" title="Tùy chỉnh" onClick={() => setSettingsOpen((value) => !value)} className="rounded-lg p-2 max-sm:p-2.5 hover:bg-white/55 dark:hover:bg-slate-700">
            <FiSettings />
          </button>
          <button type="button" title="Thu gọn" onClick={() => setMinimized(true)} className="rounded-lg p-2 max-sm:p-2.5 hover:bg-white/55 dark:hover:bg-slate-700">
            <FiChevronDown />
          </button>
          <button type="button" title="Đóng" onClick={() => setOpen(false)} className="rounded-lg p-2 max-sm:p-2.5 hover:bg-white/55 dark:hover:bg-slate-700">
            <FiX />
          </button>
        </div>
      </div>

      {settingsOpen && <MoliPetSettings controller={controller} />}

      <div ref={messagesScrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-3 max-sm:px-3">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[82%] rounded-2xl px-3 py-2 text-sm leading-relaxed max-sm:max-w-[88%] ${
                message.role === 'user' ? skin.userBubbleClass : skin.assistantBubbleClass
              }`}
            >
              {message.imageDataUrl && (
                <img
                  src={message.imageDataUrl}
                  alt="Ảnh đã gửi"
                  className="mb-2 max-h-40 w-full rounded-xl object-contain"
                />
              )}
              {message.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className={`rounded-2xl px-3 py-2 text-sm font-medium ${skin.assistantBubbleClass}`}>
              {settings.name} đang nghĩ...
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 px-3 pb-2">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {SUGGESTED_ACTIONS.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => setInput(action)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${skin.actionClass}`}
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      {cooldownSeconds > 0 && (
        <div className={`shrink-0 border-t px-4 py-2 text-xs font-bold ${skin.settingsClass}`}>
          Đợi {cooldownSeconds}s rồi nhắn tiếp.
        </div>
      )}

      {(pastedImage || processingImage) && (
        <div className={`mx-3 mt-1 flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-bold ${skin.settingsClass}`}>
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white ring-1 ring-white/70 dark:bg-slate-900 dark:ring-slate-700">
            {pastedImage ? (
              <img src={pastedImage.dataUrl} alt="Ảnh sắp gửi" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <FiRefreshCw className="animate-spin" />
              </div>
            )}
          </div>
          <span className="min-w-0 flex-1 truncate">{processingImage ? 'Đang đọc ảnh...' : 'Ảnh sẵn sàng gửi'}</span>
          {pastedImage && (
            <button
              type="button"
              onClick={clearPastedImage}
              className="rounded-lg bg-white/80 p-2 text-slate-600 hover:text-rose-500 dark:bg-slate-900 dark:text-slate-200"
              title="Xóa ảnh"
            >
              <FiX />
            </button>
          )}
        </div>
      )}

      <form onSubmit={sendMessage} className="flex shrink-0 items-center gap-2 border-t border-white/55 p-3 pb-[max(12px,env(safe-area-inset-bottom))] dark:border-slate-700">
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" title="Gợi ý vui" onClick={() => setInput('Moly cổ vũ mình học tiếp nhé')} className={`flex h-9 w-9 items-center justify-center rounded-xl border ${skin.actionClass}`}>
            <FiSmile size={15} />
          </button>
          <button type="button" title="Dán ảnh vào ô chat" onClick={keepMobileViewportStable} className={`flex h-9 w-9 items-center justify-center rounded-xl border ${skin.actionClass}`}>
            <FiPaperclip size={15} />
          </button>
        </div>
        <input
          value={input}
          maxLength={600}
          onChange={(event) => setInput(event.target.value)}
          onPaste={handlePasteImage}
          onFocus={keepMobileViewportStable}
          placeholder={cooldownSeconds > 0 ? `Đợi ${cooldownSeconds}s...` : isAuthenticated ? `Nhắn với ${settings.name}...` : 'Đăng nhập để chat AI'}
          disabled={processingImage}
          className={`h-11 min-w-0 flex-1 rounded-xl border px-3 py-0 text-base leading-5 outline-none placeholder:leading-5 sm:h-10 sm:text-sm ${skin.inputClass}`}
        />
        <button
          type="button"
          onClick={() => updateSettings({ showBubble: !settings.showBubble })}
          className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border sm:flex ${skin.actionClass}`}
          title="Bong bóng"
        >
          <FiHeart size={15} />
        </button>
        <button
          type="submit"
          disabled={(!input.trim() && !pastedImage) || loading || processingImage || cooldownSeconds > 0}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition disabled:cursor-not-allowed disabled:opacity-50 ${skin.sendButtonClass}`}
          title="Gửi"
        >
          {loading || processingImage ? <FiRefreshCw className="animate-spin" /> : <FiSend />}
        </button>
      </form>
    </section>
  );
}
