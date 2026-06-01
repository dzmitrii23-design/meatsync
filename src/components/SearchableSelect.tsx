import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Product } from '../types';
import { Search, ChevronDown, X } from 'lucide-react';
import { getProductNormalizedCategory, getProductPackagingLabel } from '../utils';

interface Props {
  products: Product[];
  selectedProductId: string;
  onSelectProduct: (id: string) => void;
  placeholder?: string;
}

export function SearchableSelect({
  products,
  selectedProductId,
  onSelectProduct,
  placeholder = "Выберите продукцию..."
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId);
  }, [products, selectedProductId]);

  // Reset search term when dropdown closes or when product is selected
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const lower = searchTerm.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(lower) || 
      p.sku.toLowerCase().includes(lower)
    );
  }, [products, searchTerm]);

  const chilledProducts = useMemo(() => 
    filteredProducts.filter(p => getProductNormalizedCategory(p) === "Охлажденное"),
    [filteredProducts]
  );

  const frozenProducts = useMemo(() => 
    filteredProducts.filter(p => getProductNormalizedCategory(p) === "Замороженное"),
    [filteredProducts]
  );

  const handleSelect = (productId: string) => {
    onSelectProduct(productId);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full font-sans" ref={containerRef}>
      {/* Trigger Button/Input */}
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full border border-gray-300 rounded-lg p-2.5 text-sm shadow-sm bg-white cursor-pointer flex items-center justify-between text-slate-900 hover:border-gray-400 transition-colors"
      >
        <span className={selectedProduct ? "text-slate-950 font-bold truncate pr-2" : "text-slate-400 truncate pr-2"}>
          {selectedProduct 
            ? `${selectedProduct.name} ${getProductPackagingLabel(selectedProduct.packagingType) ? `[${getProductPackagingLabel(selectedProduct.packagingType)}]` : ''} (${selectedProduct.sku})`
            : placeholder
          }
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {selectedProductId && (
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectProduct('');
              }}
              className="text-slate-400 hover:text-red-500 p-0.5 transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
          <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-500' : ''}`} />
        </div>
      </div>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 p-2 flex flex-col gap-2 max-h-[300px] animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Search Input inside Dropdown */}
          <div className="relative shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <input
              type="text"
              autoFocus
              placeholder="Введите название или SKU..."
              className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs shadow-sm bg-slate-50 font-medium text-slate-850 focus:bg-white transition-colors outline-none focus:border-blue-500"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onClick={e => e.stopPropagation()} // Prevent closing
            />
          </div>

          {/* List Options */}
          <div className="flex-1 overflow-y-auto max-h-[220px] space-y-2 pr-1 scrollbar-thin">
            {chilledProducts.length === 0 && frozenProducts.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400 italic">
                Совпадений не найдено
              </div>
            ) : (
              <>
                {chilledProducts.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-[9px] font-extrabold text-blue-500 tracking-wider uppercase bg-blue-50/50 rounded select-none">
                      ❄️ Охлажденная продукция
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {chilledProducts.map(p => {
                        const packLabel = getProductPackagingLabel(p.packagingType);
                        const isSelected = p.id === selectedProductId;
                        return (
                          <div
                            key={p.id}
                            onClick={() => handleSelect(p.id)}
                            className={`px-2.5 py-2 text-xs rounded-lg cursor-pointer transition-colors flex items-center justify-between ${
                              isSelected 
                                ? 'bg-blue-600 text-white font-bold' 
                                : 'text-slate-800 hover:bg-slate-100'
                            }`}
                          >
                            <span className="truncate pr-2 font-medium">{p.name} {packLabel ? `[${packLabel}]` : ''}</span>
                            <span className={`text-[10px] font-mono shrink-0 ${isSelected ? 'text-blue-100 font-bold' : 'text-slate-400 font-medium'}`}>
                              ({p.sku})
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {frozenProducts.length > 0 && (
                  <div>
                    <div className="px-2 py-1 text-[9px] font-extrabold text-indigo-500 tracking-wider uppercase bg-indigo-50/50 rounded select-none">
                      🧊 Замороженная продукция
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {frozenProducts.map(p => {
                        const packLabel = getProductPackagingLabel(p.packagingType);
                        const isSelected = p.id === selectedProductId;
                        return (
                          <div
                            key={p.id}
                            onClick={() => handleSelect(p.id)}
                            className={`px-2.5 py-2 text-xs rounded-lg cursor-pointer transition-colors flex items-center justify-between ${
                              isSelected 
                                ? 'bg-indigo-600 text-white font-bold' 
                                : 'text-slate-800 hover:bg-slate-100'
                            }`}
                          >
                            <span className="truncate pr-2 font-medium">{p.name} {packLabel ? `[${packLabel}]` : ''}</span>
                            <span className={`text-[10px] font-mono shrink-0 ${isSelected ? 'text-indigo-100 font-bold' : 'text-slate-400 font-medium'}`}>
                              ({p.sku})
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
