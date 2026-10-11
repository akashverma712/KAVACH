import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Compass className="h-12 w-12 text-muted" strokeWidth={1.5} />
      <h1 className="mt-4 text-3xl font-extrabold">This page doesn’t exist</h1>
      <p className="mt-2 text-muted">The link may be old or mistyped.</p>
      <Link to="/" className="mt-6 inline-flex h-11 items-center rounded-control bg-ink px-5 font-bold text-bg">Go to Kavach</Link>
    </div>
  );
}
