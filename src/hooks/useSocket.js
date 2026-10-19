import { useEffect, useRef, useState } from 'react';

/**
 * useSocket - lightweight WebSocket hook.
 * In production this connects to a real socket server (e.g. Socket.io).
 * @param {string} url - socket endpoint
 * @param {Object} options - { enabled, onMessage }
 */
export const useSocket = (url, options = {}) => {
  const { enabled = false, onMessage } = options;
  const [connected, setConnected] = useState(false);
  const [events, setEvents] = useState([]);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!enabled || !url) return undefined;

    // Placeholder for a real WebSocket connection.
    // Example: const socket = io(url, { auth: { token } });
    const socket = { connected: true, close: () => {} };
    socketRef.current = socket;
    setConnected(true);

    return () => {
      socketRef.current?.close();
      setConnected(false);
    };
  }, [enabled, url]);

  const emit = (event, payload) => {
    if (socketRef.current) {
      // socketRef.current.emit(event, payload);
      console.log('socket emit', event, payload);
    }
  };

  return { connected, events, emit };
};
