import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';

export function ImageLightbox({ images, index, onClose, downloadable = false }) {
  const [i, setI] = useState(index ?? 0);
  useEffect(() => setI(index ?? 0), [index]);
  useEffect(() => {
    if (index === null || index === undefined) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((x) => (x + 1) % images.length);
      if (e.key === 'ArrowLeft') setI((x) => (x - 1 + images.length) % images.length);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, images.length, onClose]);
  if (index === null || index === undefined) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1080] flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label="Image viewer">
      <button type="button" onClick={onClose} className="absolute inset-0" aria-label="Close" tabIndex={-1} />
      <img src={images[i]} alt={`Image ${i + 1} of ${images.length}`} className="relative max-h-[85vh] max-w-full rounded-control object-contain" />
      <div className="absolute right-4 top-4 flex gap-2">
        {downloadable && (
          <a href={images[i]} download className="rounded-full bg-white/15 p-2.5 text-white hover:bg-white/25" aria-label="Download image"><Download className="h-5 w-5" /></a>
        )}
        <button type="button" onClick={onClose} className="rounded-full bg-white/15 p-2.5 text-white hover:bg-white/25" aria-label="Close"><X className="h-5 w-5" /></button>
      </div>
      {images.length > 1 && (
        <>
          <button type="button" onClick={() => setI((i - 1 + images.length) % images.length)} className="absolute left-3 rounded-full bg-white/15 p-2.5 text-white hover:bg-white/25" aria-label="Previous image"><ChevronLeft className="h-6 w-6" /></button>
          <button type="button" onClick={() => setI((i + 1) % images.length)} className="absolute right-3 rounded-full bg-white/15 p-2.5 text-white hover:bg-white/25" aria-label="Next image"><ChevronRight className="h-6 w-6" /></button>
          <p className="absolute bottom-5 text-sm font-bold text-white/80">{i + 1} / {images.length}</p>
        </>
      )}
    </div>,
    document.body,
  );
}
