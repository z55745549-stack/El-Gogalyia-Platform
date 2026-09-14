import type { Timestamp } from './index';

export type DiscountType = 'percentage' | 'fixed' | 'voucher' | 'partner' | 'special';
export type DiscountStatus = 'active' | 'inactive' | 'expired' | 'archived';

export interface Discount {
  id: string;
  title: string;
  description: string;
  discountType: DiscountType;
  discountValue: string; // e.g. "15%" or "50 EGP"
  ocoinCost: number;
  promoCode?: string; // Secret promo code set by Admin, only revealed after purchase
  expiresAt: Timestamp | string;
  redemptionUrl?: string;
  terms?: string;
  imageUrl?: string;
  status: DiscountStatus;
  totalPurchases: number;
  totalCoinsCollected: number;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export type PurchaseStatus = 'active' | 'used' | 'expired';

export interface DiscountPurchase {
  id: string;
  discountId: string;
  discountTitle: string;
  discountValue: string;
  discountType: DiscountType;
  redemptionUrl?: string;
  imageUrl?: string;
  employeeId: string;
  employeeEmail: string;
  employeeName: string;
  employeePhoto?: string;
  ocoinCost: number;
  purchasedAt: Timestamp | string;
  expiresAt: Timestamp | string;
  status: PurchaseStatus;
  redemptionCode?: string;
  usedAt?: Timestamp | string | null;
  transactionId?: string;
}
