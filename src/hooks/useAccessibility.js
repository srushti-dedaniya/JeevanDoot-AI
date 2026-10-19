import { useEffect, useRef, useCallback, useState } from 'react';

export const useFocusTrap = (enabled = true) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTab = (e) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTab);
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleTab);
    };
  }, [enabled]);

  return containerRef;
};

export const useFocusOnMount = (deps = []) => {
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.focus();
  }, deps);

  return ref;
};

export const useAnnouncer = () => {
  const [message, setMessage] = useState('');
  const timeoutRef = useRef(null);

  const announce = useCallback((msg, priority = 'polite') => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setMessage('');
    timeoutRef.current = setTimeout(() => {
      setMessage(msg);
    }, 100);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { announce, message };
};

export const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    const handler = (e) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
};

export const useKeyboardNavigation = (onEnter, onEscape, onArrowUp, onArrowDown) => {
  return useCallback((e) => {
    switch (e.key) {
      case 'Enter':
        onEnter?.(e);
        break;
      case 'Escape':
        onEscape?.(e);
        break;
      case 'ArrowUp':
        onArrowUp?.(e);
        break;
      case 'ArrowDown':
        onArrowDown?.(e);
        break;
      default:
        break;
    }
  }, [onEnter, onEscape, onArrowUp, onArrowDown]);
};

export default {
  useFocusTrap,
  useFocusOnMount,
  useAnnouncer,
  useReducedMotion,
  useKeyboardNavigation,
};