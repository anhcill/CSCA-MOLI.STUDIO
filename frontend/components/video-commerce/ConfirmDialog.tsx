'use client';
import { useEffect,useRef,type ReactNode } from 'react';

export default function ConfirmDialog({children,busy,onClose}:{children:ReactNode;busy:boolean;onClose:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close();},[]);
  return <dialog ref={dialog} aria-labelledby="revoke-title" onCancel={event=>{event.preventDefault();if(!busy)onClose();}}
    className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl bg-transparent p-0 text-slate-900 backdrop:bg-black/50 dark:text-slate-100">{children}</dialog>;
}
