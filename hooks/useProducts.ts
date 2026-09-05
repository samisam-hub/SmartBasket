import { useMemo, useState } from 'react';
import { searchProducts } from '@/services/products';

export function useProducts() {
  const [query, setQuery] = useState('');
  const products = useMemo(() => searchProducts(query), [query]);
  return { query, setQuery, products };
}
