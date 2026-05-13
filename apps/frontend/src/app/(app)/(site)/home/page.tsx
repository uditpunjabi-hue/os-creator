'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProduct } from '@gitroom/frontend/components/layout/product.context';

export default function Home() {
  const router = useRouter();
  const { product } = useProduct();
  useEffect(() => {
    const target = product === 'MANAGER' ? '/manager/inbox' : '/creator/research/profile';
    router.replace(target);
  }, [product, router]);

  return (
    <div className="flex h-full items-center justify-center text-sm text-gray-500">
      Loading workspace…
    </div>
  );
}
