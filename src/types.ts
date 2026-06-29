export type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  defaultShelfLifeDays: number;
  notifyBeforeDays?: number; // Оповещение об истечении срока за указанное число дней
  rawMaterial?: string;      // Свинина, Говядина, Птица, Баранина, Субпродукты, Иное, Готовая продукция
  packagingType?: string;    // Блочка, Мелкая фасовка, Отруба, Полутуши, Вакуум, Лотки, Иное
  unit?: string;             // Единица измерения: кг, шт, м и т.д.
};

export type LocationType = 'main_fridge' | 'reefer' | 'shock_freezer' | 'chilled_fridge' | 'returns';

export type StorageLocation = {
  id: string;
  name: string;
  type: LocationType;
  capacityKg: number;
};

export type Batch = {
  id: string;
  productId: string;
  locationId: string;
  quantityKg: number; // Current remaining quantity
  initialQuantityKg: number;
  receivedAt: string; // ISO
  expiresAt: string; // ISO
  manufacturedAt?: string; // ISO
  isReturn?: boolean;
  returnedByBuyerId?: string;
  returnReason?: string;
};

export type TransactionType = 'IN' | 'OUT' | 'MOVE' | 'RETURN';

export type Buyer = {
  id: string;
  name: string;
  inn?: string;
  phone?: string;
};

export type Transaction = {
  id: string;
  type: TransactionType;
  productId: string;
  quantityKg: number;
  date: string; // ISO
  batchId?: string;
  fromLocationId?: string;
  toLocationId?: string;
  notes?: string;
  outcomeType?: 'sale' | 'waste' | 'mpc';
  buyerId?: string;
  wasteReason?: string;
};

export type AppState = {
  products: Product[];
  locations: StorageLocation[];
  batches: Batch[];
  transactions: Transaction[];
  buyers: Buyer[];
};

