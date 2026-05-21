import { createContext } from 'react';

export const CanvasContext = createContext({
  activeArtifact: null,
  canvasOpen: false,
  canvasMode: 'split',
  openInCanvas: () => {},
  closeCanvas: () => {},
  setCanvasMode: () => {}
});
