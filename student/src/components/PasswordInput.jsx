import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { Input } from './ui';

export function PasswordInput(props) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} icon={Lock} className="pr-11" {...props} />
      <button type="button" onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-[34px] rounded-full p-1.5 text-muted hover:text-ink"
        aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
      </button>
    </div>
  );
}

export function passwordStrength(pw) {
  let s = 0;
  if (pw.length >= 8) s += 1;
  if (pw.length >= 12) s += 1;
  if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) s += 1;
  if (/[^A-Za-z0-9]/.test(pw)) s += 1;
  return [
    { label: 'Too short', tone: 'bg-signal' },
    { label: 'Weak', tone: 'bg-signal' },
    { label: 'Okay', tone: 'bg-brass' },
    { label: 'Strong', tone: 'bg-neem' },
    { label: 'Very strong', tone: 'bg-neem' },
  ][s];
}
