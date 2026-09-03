import { createContext, useContext, useLayoutEffect, useMemo, type ReactNode } from 'react';
import {
  getProductSurfaceRules,
  setProductSurface,
  type ProductSurface,
  type ProductSurfaceRules,
} from '@/config/productSurface';

type ProductSurfaceContextValue = {
  surface: ProductSurface;
  rules: ProductSurfaceRules;
};

const ProductSurfaceContext = createContext<ProductSurfaceContextValue>({
  surface: 'studio',
  rules: getProductSurfaceRules('studio'),
});

type ProductSurfaceProviderProps = {
  surface: ProductSurface;
  children: ReactNode;
};

export const ProductSurfaceProvider = ({ surface, children }: ProductSurfaceProviderProps) => {
  useLayoutEffect(() => {
    setProductSurface(surface);
    return () => {
      setProductSurface('studio');
    };
  }, [surface]);

  const value = useMemo(
    () => ({
      surface,
      rules: getProductSurfaceRules(surface),
    }),
    [surface]
  );

  return <ProductSurfaceContext.Provider value={value}>{children}</ProductSurfaceContext.Provider>;
};

export const useProductSurface = (): ProductSurfaceContextValue => useContext(ProductSurfaceContext);
