import React from 'react';
import { StorageLocation, Batch, Product } from '../types';
import { MapPin, ThermometerSnowflake, Grid, Refrigerator, RotateCcw } from 'lucide-react';

interface Props {
  locations: StorageLocation[];
  batches: Batch[];
  products: Product[];
}

export function Locations({ locations, batches, products }: Props) {
  
  const getLocationIcon = (type: string) => {
    switch(type) {
      case 'chilled_fridge': return <Refrigerator className="text-teal-500 font-bold" />;
      case 'main_fridge': return <Grid className="text-blue-500" />;
      case 'reefer': return <Refrigerator className="text-cyan-500" />;
      case 'shock_freezer': return <ThermometerSnowflake className="text-indigo-500" />;
      case 'returns': return <RotateCcw className="text-amber-500 font-bold" />;
      default: return <MapPin />;
    }
  };

  const getTypeName = (type: string) => {
    switch(type) {
      case 'chilled_fridge': return 'Холодильник охлажденки';
      case 'main_fridge': return 'Основной холодильник';
      case 'reefer': return 'Реф (Контейнер)';
      case 'shock_freezer': return 'Шоковая заморозка';
      case 'returns': return 'Склад возвратов (Обособленный)';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-4 border-b">
        <h2 className="text-2xl font-medium tracking-tight text-gray-900">Места хранения</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {locations.map(loc => {
           const locBatches = batches.filter(b => b.locationId === loc.id);
           const totalKg = locBatches.reduce((sum, b) => sum + b.quantityKg, 0);
           const percentUtilized = Math.round((totalKg / loc.capacityKg) * 100);
           
           return (
             <div key={loc.id} className="bg-white rounded-lg border shadow-sm p-5 flex flex-col">
               <div className="flex justify-between items-start mb-4">
                 <div className="flex items-center gap-3">
                   <div className="p-2 bg-gray-50 rounded-md border">
                     {getLocationIcon(loc.type)}
                   </div>
                   <div>
                     <h3 className="font-semibold text-gray-900">{loc.name}</h3>
                     <p className="text-xs text-gray-500">{getTypeName(loc.type)}</p>
                   </div>
                 </div>
               </div>
               
               <div className="mb-4 flex-1">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Загрузка</span>
                    <span className="font-medium text-gray-900">{percentUtilized}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${percentUtilized > 90 ? 'bg-red-500' : 'bg-blue-500'}`} 
                      style={{ width: `${Math.min(percentUtilized, 100)}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-right">
                    {totalKg.toLocaleString()} кг / {loc.capacityKg.toLocaleString()} кг
                  </p>
               </div>

               <div className="pt-4 border-t border-gray-100">
                 <p className="text-sm font-medium text-gray-700 mb-2">Содержимое ({locBatches.length} парт.)</p>
                 <div className="space-y-1 max-h-32 overflow-y-auto">
                   {locBatches.length > 0 ? locBatches.map(b => {
                     const p = products.find(prod => prod.id === b.productId);
                     return (
                       <div key={b.id} className="text-xs flex justify-between text-gray-600 bg-gray-50 p-1 rounded">
                         <span className="truncate pr-2">{p?.name}</span>
                         <span className="font-medium shrink-0">{b.quantityKg} кг</span>
                       </div>
                     );
                   }) : (
                     <p className="text-sm text-gray-400 italic">Склад пуст</p>
                   )}
                 </div>
               </div>
             </div>
           );
        })}
      </div>
    </div>
  );
}
