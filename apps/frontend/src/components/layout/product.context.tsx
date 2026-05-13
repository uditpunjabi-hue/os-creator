'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import useCookie from 'react-use-cookie';

export type Product = 'CONTENT' | 'MANAGER';

const COOKIE = 'illuminati-product';

interface ProductContextValue {
  product: Product;
  setProduct: (p: Product) => void;
}

const ProductContext = createContext<ProductContextValue>({
  product: 'CONTENT',
  setProduct: () => {},
});

const productLanding: Record<Product, string> = {
  CONTENT: '/creator/research/profile',
  MANAGER: '/manager/inbox',
};

const inferProductFromPath = (path: string): Product | null => {
  if (path.startsWith('/manager')) return 'MANAGER';
  if (path.startsWith('/creator')) return 'CONTENT';
  return null;
};

export const ProductProvider = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname() ?? '';
  const [stored, setStored] = useCookie(COOKIE, 'CONTENT');
  const router = useRouter();

  const fromPath = inferProductFromPath(pathname);
  const product: Product = (fromPath ?? (stored as Product)) || 'CONTENT';

  useEffect(() => {
    if (fromPath && fromPath !== stored) setStored(fromPath);
  }, [fromPath, stored, setStored]);

  const setProduct = useCallback(
    (next: Product) => {
      setStored(next);
      if (inferProductFromPath(pathname) !== next) {
        router.push(productLanding[next]);
      }
    },
    [pathname, router, setStored]
  );

  const value = useMemo(() => ({ product, setProduct }), [product, setProduct]);
  return <ProductContext.Provider value={value}>{children}</ProductContext.Provider>;
};

export const useProduct = () => useContext(ProductContext);
