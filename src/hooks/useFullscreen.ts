import { useCallback, useEffect, useState } from 'react';

interface FullscreenDocument extends Document {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenEnabled?: boolean;
}

interface FullscreenElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
}

export function useFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const getFullscreenElement = () => {
    const doc = document as FullscreenDocument;
    return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
  };

  useEffect(() => {
    const syncState = () => {
      setIsFullscreen(Boolean(getFullscreenElement()));
    };
    syncState();
    document.addEventListener('fullscreenchange', syncState);
    document.addEventListener('webkitfullscreenchange', syncState);
    return () => {
      document.removeEventListener('fullscreenchange', syncState);
      document.removeEventListener('webkitfullscreenchange', syncState);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const doc = document as FullscreenDocument;
    const root = document.documentElement as FullscreenElement;

    try {
      if (getFullscreenElement()) {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
      } else {
        if (root.requestFullscreen) {
          await root.requestFullscreen();
        } else if (root.webkitRequestFullscreen) {
          await root.webkitRequestFullscreen();
        }
      }
    } catch {
      // Gracefully ignore if browser or embedded iframe restricts Fullscreen API
    }
  }, []);

  return { isFullscreen, toggleFullscreen };
}
