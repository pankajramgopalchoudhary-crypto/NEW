'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function App() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/admin/login');
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-emerald-50">
      <div className="text-emerald-900 font-semibold">Redirecting to admin portal…</div>
    </div>
  );
}
