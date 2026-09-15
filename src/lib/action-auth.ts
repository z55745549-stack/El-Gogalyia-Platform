export type AdminActionType =
  | 'add_employee'
  | 'add_admin'
  | 'add_opportunity'
  | 'confirm_ban'
  | 'change_user_password';

export interface AdminActionConfig {
  type: AdminActionType;
  title: string;
  badgeLabel: string;
  description: string;
}

export const ADMIN_ACTION_CONFIGS: Record<AdminActionType, AdminActionConfig> = {
  add_employee: {
    type: 'add_employee',
    title: 'تأكيد إضافة موظف جديد 👤',
    badgeLabel: 'تصريح إضافة موظف',
    description: 'يتطلب هذا الإجراء إدخال اسم المستخدم وكلمة مرور التفويض الخاصة بإضافة موظف جديد.',
  },
  add_admin: {
    type: 'add_admin',
    title: 'تأكيد إضافة وتفويض أدمن جديد 🛡️',
    badgeLabel: 'تصريح تفويض أدمن',
    description: 'يتطلب هذا الإجراء إدخال اسم المستخدم وكلمة مرور التفويض الخاصة بإضافة مسؤول أو مشرف للنظام.',
  },
  add_opportunity: {
    type: 'add_opportunity',
    title: 'تأكيد إضافة فرصة وتدريب جديد 🎓',
    badgeLabel: 'تصريح نشر تدريب / فرصة',
    description: 'يتطلب هذا الإجراء إدخال بيانات التفويض الخاصة بنشر وتوزيع فرصة وتدريب جديد على الفريق.',
  },
  confirm_ban: {
    type: 'confirm_ban',
    title: 'تأكيد حظر وتعليق حساب موظف ⛔',
    badgeLabel: 'تصريح تنفيذ الحظر',
    description: 'إجراء عالي الحساسية: يتطلب إدخال بيانات التفويض الخاصة بتأكيد قرار الحظر وتصفير الـ O Coins.',
  },

  change_user_password: {
    type: 'change_user_password',
    title: 'تأكيد تغيير كلمة مرور الموظف 🔑',
    badgeLabel: 'تصريح تغيير كلمة المرور',
    description: 'يتطلب هذا الإجراء إدخال بيانات التفويض الإدارية الخاصة بتعيين وتغيير كلمة مرور الموظف.',
  },
};

/**
 * Verifies admin action credentials securely via the serverless API endpoint.
 * Credentials are NEVER stored or compared in client-side code.
 */
export async function verifyAdminActionRemote(
  type: AdminActionType,
  username: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const cfg = ADMIN_ACTION_CONFIGS[type];
  if (!cfg) {
    return { success: false, error: 'نوع العملية غير معرف.' };
  }

  const cleanUser = username.trim();
  const cleanPass = password.trim();

  if (!cleanUser || !cleanPass) {
    return { success: false, error: 'يرجى إدخال اسم المستخدم وكلمة المرور الخاصة بتفويض العملية.' };
  }

  try {
    const response = await fetch('/api/verify-admin-action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        actionType: type,
        username: cleanUser,
        password: cleanPass,
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok || !data?.success) {
      return {
        success: false,
        error: data?.error || 'بيانات التفويض غير صحيحة أو تعذر التحقق.',
      };
    }

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: 'تعذر الاتصال بخادم التحقق من التفويض. يرجى التحقق من اتصال الإنترنت.',
    };
  }
}
