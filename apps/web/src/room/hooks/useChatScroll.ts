import { useEffect, useRef, useState, type RefObject } from "react";

/** Keeps the chat pinned to the bottom unless the reader scrolled up. */
export function useChatScroll(ref: RefObject<HTMLElement>, messageCount: number) {
  const [newCount, setNewCount] = useState(0);
  const pinned = useRef(true);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (pinned.current) {
      element.scrollTop = element.scrollHeight;
    } else {
      setNewCount((count) => count + 1);
    }
  }, [messageCount, ref]);

  function onScroll() {
    const element = ref.current;
    if (!element) return;
    const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 40;
    pinned.current = atBottom;
    if (atBottom) setNewCount(0);
  }

  function jumpToLatest(): void {
    const element = ref.current;
    if (element) element.scrollTop = element.scrollHeight;
    pinned.current = true;
    setNewCount(0);
  }

  return { newCount, onScroll, jumpToLatest };
}
