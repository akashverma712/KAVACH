import { useEffect, useId, useMemo } from 'react';
import { FileText, ImagePlus, X } from 'lucide-react';

/** Multi-file picker with thumbnails. `files` is controlled (array of File). */
export function FilePicker({ label, hint, files, onChange, max = 4, accept = 'image/*', error }) {
  const id = useId();
  const previews = useMemo(() => files.map((f) => ({ f, url: f.type.startsWith('image/') ? URL.createObjectURL(f) : null })), [files]);
  useEffect(() => () => previews.forEach((p) => p.url && URL.revokeObjectURL(p.url)), [previews]);

  const add = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    onChange([...files, ...picked].slice(0, max));
  };

  return (
    <div>
      {label && <p className="label">{label}</p>}
      <div className="flex flex-wrap gap-2.5">
        {previews.map(({ f, url }, i) => (
          <div key={`${f.name}-${i}`} className="relative h-24 w-24 overflow-hidden rounded-control border border-line bg-raised">
            {url ? <img src={url} alt={f.name} className="h-full w-full object-cover" /> : (
              <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center text-[11px] text-muted"><FileText className="h-6 w-6" /><span className="line-clamp-2 break-all">{f.name}</span></div>
            )}
            <button type="button" onClick={() => onChange(files.filter((_, j) => j !== i))}
              className="absolute right-1 top-1 rounded-full bg-night/70 p-1 text-white hover:bg-night" aria-label={`Remove ${f.name}`}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {files.length < max && (
          <label htmlFor={id} className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-control border-2 border-dashed border-line text-[12px] font-bold text-muted hover:border-ink/40 hover:text-ink">
            <ImagePlus className="h-6 w-6" /> Add
            <input id={id} type="file" accept={accept} multiple className="sr-only" onChange={add} />
          </label>
        )}
      </div>
      {error ? <p className="mt-1.5 text-[13px] font-bold text-signal">{error}</p> : <p className="hint">{hint || `Up to ${max} files`}</p>}
    </div>
  );
}
