type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export function getFullscreenElement(doc: Document = document): Element | null {
  const fullscreenDocument = doc as FullscreenDocument;
  return fullscreenDocument.fullscreenElement ?? fullscreenDocument.webkitFullscreenElement ?? null;
}

export function isElementFullscreen(element: HTMLElement | null, doc: Document = document): boolean {
  if (!element) return false;
  return getFullscreenElement(doc) === element;
}

export function addFullscreenChangeListener(doc: Document, listener: () => void): () => void {
  doc.addEventListener("fullscreenchange", listener);
  doc.addEventListener("webkitfullscreenchange", listener);
  return () => {
    doc.removeEventListener("fullscreenchange", listener);
    doc.removeEventListener("webkitfullscreenchange", listener);
  };
}

export async function requestLessonFullscreen(element: HTMLElement, doc: Document = document): Promise<void> {
  const target = element as FullscreenElement;
  if (target.requestFullscreen) {
    await target.requestFullscreen();
    return;
  }

  if (target.webkitRequestFullscreen) {
    await target.webkitRequestFullscreen();
    return;
  }

  const root = doc.documentElement as FullscreenElement;
  if (root.requestFullscreen) {
    await root.requestFullscreen();
    return;
  }

  if (root.webkitRequestFullscreen) {
    await root.webkitRequestFullscreen();
  }
}

export async function exitLessonFullscreen(doc: Document = document): Promise<void> {
  const fullscreenDocument = doc as FullscreenDocument;
  if (fullscreenDocument.exitFullscreen) {
    await fullscreenDocument.exitFullscreen();
    return;
  }
  if (fullscreenDocument.webkitExitFullscreen) {
    await fullscreenDocument.webkitExitFullscreen();
  }
}
