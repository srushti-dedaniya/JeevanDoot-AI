import { useState, useEffect, useCallback } from 'react';

export const useNetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [connectionType, setConnectionType] = useState(() => {
    if ('connection' in navigator) {
      return navigator.connection?.effectiveType || 'unknown';
    }
    return 'unknown';
  });

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    const handleChange = () => {
      if ('connection' in navigator) {
        setConnectionType(navigator.connection?.effectiveType || 'unknown');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if ('connection' in navigator) {
      navigator.connection.addEventListener('change', handleChange);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if ('connection' in navigator) {
        navigator.connection.removeEventListener('change', handleChange);
      }
    };
  }, []);

  return { isOnline, connectionType, isSlowConnection: ['slow-2g', '2g'].includes(connectionType) };
};

export const useDebouncedCallback = (callback, delay) => {
  const timeoutRef = useState(null)[0];
  return useCallback((...args) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => callback(...args), delay);
  }, [callback, delay]);
};

export const useRetry = (asyncFn, options = {}) => {
  const { retries = 3, backoff = 1000, onError } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  const execute = useCallback(async (...args) => {
    setIsLoading(true);
    setError(null);
    let lastError;

    for (let i = 0; i <= retries; i++) {
      setAttempt(i + 1);
      try {
        const result = await asyncFn(...args);
        setIsLoading(false);
        return result;
      } catch (err) {
        lastError = err;
        if (i < retries) {
          await new Promise(resolve => setTimeout(resolve, backoff * Math.pow(2, i)));
        }
      }
    }

    setError(lastError);
    setIsLoading(false);
    onError?.(lastError);
    throw lastError;
  }, [asyncFn, retries, backoff, onError]);

  return { execute, isLoading, error, attempt };
};

export const useOptimisticUpdate = (getter, setter) => {
  const [optimisticData, setOptimisticData] = useState(null);
  const [isPending, setIsPending] = useState(false);

  const update = useCallback(async (optimisticValue, asyncFn) => {
    setOptimisticData(optimisticValue);
    setIsPending(true);
    try {
      const result = await asyncFn();
      setOptimisticData(null);
      setIsPending(false);
      return result;
    } catch (err) {
      setOptimisticData(null);
      setIsPending(false);
      throw err;
    }
  }, []);

  return { data: optimisticData ?? getter(), isPending, update };
};

export default {
  useNetworkStatus,
  useDebouncedCallback,
  useRetry,
  useOptimisticUpdate,
};