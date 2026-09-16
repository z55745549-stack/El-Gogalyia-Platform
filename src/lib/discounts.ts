import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  increment,
  runTransaction,
  db,
} from './supabase';
import { logActivity, createNotification } from './database-service';
import type { Discount, DiscountPurchase, DiscountStatus, UserProfile } from '@/types';
import { hasUnlimitedCoins } from '@/utils';

// ─── 1. Create Discount (Admin) ──────────────────────────────────────────────
export async function createDiscount(params: {
  title: string;
  description: string;
  discountType: Discount['discountType'];
  discountValue: string;
  ocoinCost: number;
  promoCode?: string;
  expiresAt: string; // ISO string or date string YYYY-MM-DDTHH:mm
  redemptionUrl?: string;
  terms?: string;
  imageUrl?: string;
  status?: DiscountStatus;
  creator: UserProfile;
}): Promise<string> {
  const {
    title,
    description,
    discountType,
    discountValue,
    ocoinCost,
    promoCode = '',
    expiresAt,
    redemptionUrl = '',
    terms = '',
    imageUrl = '',
    status = 'active',
    creator,
  } = params;

  const discountId = `disc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = serverTimestamp();

  const discountData: Discount = {
    id: discountId,
    title: title.trim(),
    description: description.trim(),
    discountType,
    discountValue: discountValue.trim(),
    ocoinCost: Math.max(0, Math.round(Number(ocoinCost) || 0)),
    promoCode: promoCode.trim(),
    expiresAt,
    redemptionUrl: redemptionUrl.trim(),
    terms: terms.trim(),
    imageUrl: imageUrl.trim(),
    status,
    totalPurchases: 0,
    totalCoinsCollected: 0,
    createdBy: creator.uid,
    createdByName: creator.displayName || creator.username || 'المشرف',
    createdAt: now as any,
    updatedAt: now as any,
  };

  await setDoc(doc(db, 'discounts', discountId), discountData);

  // Activity log
  await logActivity({
    actor: creator.uid,
    actorName: creator.displayName || 'المشرف',
    actorPhoto: creator.photoURL || '',
    action: 'discount.created',
    targetType: 'discount',
    targetId: discountId,
    targetName: title,
    metadata: { ocoinCost, discountType, discountValue },
  });

  return discountId;
}

// ─── 2. Update Discount (Admin) ──────────────────────────────────────────────
export async function updateDiscount(
  discountId: string,
  updates: Partial<Omit<Discount, 'id' | 'createdBy' | 'createdAt'>>,
  actor: UserProfile
): Promise<void> {
  const discountRef = doc(db, 'discounts', discountId);
  const payload: any = {
    ...updates,
    updatedAt: serverTimestamp(),
  };

  if (updates.ocoinCost !== undefined) {
    payload.ocoinCost = Math.max(0, Math.round(Number(updates.ocoinCost) || 0));
  }

  await updateDoc(discountRef, payload);

  await logActivity({
    actor: actor.uid,
    actorName: actor.displayName || 'المشرف',
    actorPhoto: actor.photoURL || '',
    action: 'discount.updated',
    targetType: 'discount',
    targetId: discountId,
    targetName: updates.title || discountId,
    metadata: updates,
  });
}

// ─── 3. Delete Discount (Admin) ──────────────────────────────────────────────
export async function deleteDiscount(discountId: string, actor: UserProfile, title = ''): Promise<void> {
  await deleteDoc(doc(db, 'discounts', discountId));

  await logActivity({
    actor: actor.uid,
    actorName: actor.displayName || 'المشرف',
    actorPhoto: actor.photoURL || '',
    action: 'discount.deleted',
    targetType: 'discount',
    targetId: discountId,
    targetName: title || discountId,
  });
}

// ─── 4. Toggle Discount Status (Admin) ───────────────────────────────────────
export async function toggleDiscountStatus(
  discountId: string,
  newStatus: DiscountStatus,
  actor: UserProfile,
  title = ''
): Promise<void> {
  await updateDoc(doc(db, 'discounts', discountId), {
    status: newStatus,
    updatedAt: serverTimestamp(),
  });

  await logActivity({
    actor: actor.uid,
    actorName: actor.displayName || 'المشرف',
    actorPhoto: actor.photoURL || '',
    action: 'discount.status_changed',
    targetType: 'discount',
    targetId: discountId,
    targetName: title || discountId,
    metadata: { newStatus },
  });
}

// ─── 5. Atomic OCoin Purchase Transaction ───────────────────────────────────
export async function purchaseDiscount(params: {
  discountId: string;
  employee: UserProfile;
}): Promise<{ purchase: DiscountPurchase; newBalance: number }> {
  const { discountId, employee } = params;

  if (!employee || !employee.uid) {
    throw new Error('يرجى تسجيل الدخول بحسابك أولاً لإتمام الشراء.');
  }

  const discountRef = doc(db, 'discounts', discountId);
  const userRef = doc(db, 'users', employee.uid);
  const ocoinRef = doc(collection(db, 'oCoins'));
  const purchaseId = `purch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const purchaseRef = doc(db, 'discount_purchases', purchaseId);

  // Generate unique redemption code (e.g. VOUCH-58291)
  const randomCode = `VOUCH-${Math.floor(10000 + Math.random() * 90000)}`;

  let resultPurchase: DiscountPurchase | null = null;
  let finalNewBalance = 0;

  // Execute safe Supabase transaction
  await runTransaction(db, async (tx) => {
    // 1. Fetch discount
    const discountSnap = await tx.get(discountRef);
    if (!discountSnap.exists()) {
      throw new Error('هذا العرض/الخصم لم يعد متوفراً.');
    }

    const discount = discountSnap.data() as Discount;

    // 2. Validate discount status
    if (discount.status !== 'active') {
      throw new Error('هذا العرض غير متاح للشراء حالياً.');
    }

    // 3. Validate expiration
    if (discount.expiresAt) {
      const expTime = (discount.expiresAt as any)?.toDate
        ? (discount.expiresAt as any).toDate().getTime()
        : new Date(String(discount.expiresAt) || 0).getTime();
      if (!isNaN(expTime) && expTime < Date.now()) {
        throw new Error('عفواً، لقد انتهت صلاحية هذا العرض.');
      }
    }

    // 3.5 Validate per-user purchase limit
    const maxAllowed = discount.maxPurchasesPerUser ?? 1;
    const existingSnap = await getDocs(
      query(
        collection(db, 'discount_purchases'),
        where('discountId', '==', discountId),
        where('employeeId', '==', employee.uid)
      )
    );
    if (existingSnap.size >= maxAllowed) {
      throw new Error(
        `لقد قمت بالحصول على هذا العرض بالفعل (الحد الأقصى المسموح به هو ${maxAllowed} لكل عضو).`
      );
    }

    const requiredCoins = Number(discount.ocoinCost) || 0;

    // 4. Fetch user balance
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) {
      throw new Error('تعذر العثور على حساب الموظف.');
    }

    const userData = userSnap.data() as UserProfile;
    const currentBalance = Number(userData.oCoinsBalance) || 0;

    const isUnlimitedUser = hasUnlimitedCoins(userData.role);

    // 5. Validate sufficient balance (unlimited roles have unlimited coins)
    if (!isUnlimitedUser && currentBalance < requiredCoins) {
      throw new Error(
        `رصيدك الحالي (${currentBalance} OC) غير كافٍ لشراء هذا العرض الذي يتطلب (${requiredCoins} OC).`
      );
    }

    finalNewBalance = isUnlimitedUser ? currentBalance : Math.max(0, currentBalance - requiredCoins);

    // 6. Assign promo/redemption code (Secret code configured by Admin or generated unique code)
    const assignedCode = discount.promoCode && discount.promoCode.trim().length > 0
      ? discount.promoCode.trim()
      : randomCode;

    // Construct purchase record
    const purchaseData: DiscountPurchase = {
      id: purchaseId,
      discountId: discount.id,
      discountTitle: discount.title,
      discountValue: discount.discountValue,
      discountType: discount.discountType,
      redemptionUrl: discount.redemptionUrl || '',
      imageUrl: discount.imageUrl || '',
      employeeId: employee.uid,
      employeeEmail: (employee.email || employee.username || '').toLowerCase(),
      employeeName: employee.displayName || employee.username || 'عضو الفريق',
      employeePhoto: employee.photoURL || '',
      ocoinCost: requiredCoins,
      purchasedAt: new Date().toISOString(),
      expiresAt: discount.expiresAt,
      status: 'active',
      redemptionCode: assignedCode,
      usedAt: null,
      transactionId: ocoinRef.id,
    };

    // 7. Construct OCoin Transaction (Unified archive)
    const ocoinTxData = {
      userId: employee.uid,
      user_id: employee.uid,
      userEmail: (employee.email || employee.username || '').toLowerCase(),
      userDisplayName: employee.displayName || employee.username || 'عضو الفريق',
      uid: employee.uid,
      employeeId: employee.uid,
      employeeName: employee.displayName || employee.username || 'عضو الفريق',
      amount: -requiredCoins,
      type: 'discount_purchase',
      reason: `شراء عرض: ${discount.title}`,
      description: `شراء قسيمة/خصم "${discount.title}" بقيمة ${discount.discountValue} مقابل ${requiredCoins} O Coins`,
      source: 'discount_shop',
      previousBalance: currentBalance,
      newBalance: finalNewBalance,
      discountId: discount.id,
      discountTitle: discount.title,
      referenceId: discount.id,
      referenceType: 'discount',
      createdBy: employee.uid,
      createdByName: employee.displayName || employee.username || 'الموظف',
      createdAt: serverTimestamp(),
    };

    // 8. Atomic Writes
    tx.set(purchaseRef, {
      ...purchaseData,
      purchasedAtServer: serverTimestamp(),
    });

    tx.set(ocoinRef, ocoinTxData);

    tx.update(userRef, {
      oCoinsBalance: finalNewBalance,
      updatedAt: serverTimestamp(),
    });

    tx.update(discountRef, {
      totalPurchases: increment(1),
      totalCoinsCollected: increment(requiredCoins),
      updatedAt: serverTimestamp(),
    });

    resultPurchase = purchaseData;
  });

  if (!resultPurchase) {
    throw new Error('حدث خطأ غير متوقع أثناء معالجة عملية الشراء.');
  }

  // 9. Update local state for immediate reactivity across tabs
  try {
    const localUsers: any[] = JSON.parse(localStorage.getItem('elgogalyia_local_users') || '[]');
    const uIdx = localUsers.findIndex((u: any) => u.uid === employee.uid);
    if (uIdx !== -1) {
      localUsers[uIdx].oCoinsBalance = finalNewBalance;
      localStorage.setItem('elgogalyia_local_users', JSON.stringify(localUsers));
    }
    const sessRaw = localStorage.getItem('elgogalyia_user_session');
    if (sessRaw) {
      const sess: any = JSON.parse(sessRaw);
      if (sess.uid === employee.uid) {
        sess.oCoinsBalance = finalNewBalance;
        localStorage.setItem('elgogalyia_user_session', JSON.stringify(sess));
      }
    }
    window.dispatchEvent(new Event('elgogalyia_data_change'));
  } catch {}

  // 10. Send rich notification to employee
  createNotification({
    recipientEmail: (employee.email || employee.username || '').toLowerCase(),
    recipientUid: employee.uid,
    type: 'discount_purchased',
    title: `🎉 تم شراء الخصم بنجاح!`,
    message: `تم شراء "${(resultPurchase as any).discountTitle}" مقابل ${(resultPurchase as any).ocoinCost} O Coins. كود القسيمة: ${(resultPurchase as any).redemptionCode}. الرصيد المتبقي: ${finalNewBalance} OC`,
    relatedEntityType: 'discount',
    relatedEntityId: (resultPurchase as any).id,
    actionUrl: '/my-discounts',
  }).catch(() => {});

  // 11. Activity Log
  logActivity({
    actor: employee.uid,
    actorName: employee.displayName || employee.username || 'عضو الفريق',
    actorPhoto: employee.photoURL || '',
    action: 'discount.purchased',
    targetType: 'discount',
    targetId: (resultPurchase as any).discountId,
    targetName: (resultPurchase as any).discountTitle,
    metadata: {
      purchaseId: (resultPurchase as any).id,
      ocoinCost: (resultPurchase as any).ocoinCost,
      redemptionCode: (resultPurchase as any).redemptionCode,
      newBalance: finalNewBalance,
    },
  }).catch(() => {});

  return {
    purchase: resultPurchase as any,
    newBalance: finalNewBalance,
  };
}

// ─── 6. Subscriptions ────────────────────────────────────────────────────────

// Subscribe to all discounts (Active first, sorted by createdAt desc)
export function subscribeDiscounts(callback: (discounts: Discount[]) => void): () => void {
  const q = query(collection(db, 'discounts'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Discount));
      list.sort((a, b) => {
        const tA = (a.createdAt as any)?.toDate ? (a.createdAt as any).toDate().getTime() : new Date((a.createdAt as any) || 0).getTime();
        const tB = (b.createdAt as any)?.toDate ? (b.createdAt as any).toDate().getTime() : new Date((b.createdAt as any) || 0).getTime();
        return tB - tA;
      });
      callback(list);
    },
    (err) => console.warn('subscribeDiscounts notice:', err)
  );
}

// Subscribe to employee purchases
export function subscribeEmployeePurchases(
  employeeId: string,
  callback: (purchases: DiscountPurchase[]) => void
): () => void {
  const q = query(
    collection(db, 'discount_purchases'),
    where('employeeId', '==', employeeId)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DiscountPurchase));
      list.sort((a, b) => {
        const tA = new Date((a.purchasedAt as any) || 0).getTime();
        const tB = new Date((b.purchasedAt as any) || 0).getTime();
        return tB - tA;
      });
      callback(list);
    },
    (err) => console.warn('subscribeEmployeePurchases notice:', err)
  );
}

// Subscribe to all purchases (Admin)
export function subscribeAllPurchases(callback: (purchases: DiscountPurchase[]) => void): () => void {
  const q = query(collection(db, 'discount_purchases'));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as DiscountPurchase));
      list.sort((a, b) => {
        const tA = new Date((a.purchasedAt as any) || 0).getTime();
        const tB = new Date((b.purchasedAt as any) || 0).getTime();
        return tB - tA;
      });
      callback(list);
    },
    (err) => console.warn('subscribeAllPurchases notice:', err)
  );
}
