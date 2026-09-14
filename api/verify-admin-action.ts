import type { VercelRequest, VercelResponse } from '@vercel/node';

type AdminActionType =
  | 'add_employee'
  | 'add_admin'
  | 'add_opportunity'
  | 'confirm_ban'
  | 'enable_maintenance'
  | 'change_user_password';

interface EnvCredentials {
  username: string | undefined;
  password: string | undefined;
}

function getCredentialsForAction(actionType: AdminActionType): EnvCredentials {
  switch (actionType) {
    case 'add_employee':
      return {
        username: process.env.ADD_EMPLOYEE_CONFIRM_USERNAME,
        password: process.env.ADD_EMPLOYEE_CONFIRM_PASSWORD,
      };
    case 'add_admin':
      return {
        username: process.env.ADD_ADMIN_CONFIRM_USERNAME,
        password: process.env.ADD_ADMIN_CONFIRM_PASSWORD,
      };
    case 'add_opportunity':
      return {
        username: process.env.ADD_OPPORTUNITY_CONFIRM_USERNAME,
        password: process.env.ADD_OPPORTUNITY_CONFIRM_PASSWORD,
      };
    case 'confirm_ban':
      return {
        username: process.env.BAN_CONFIRM_USERNAME,
        password: process.env.BAN_CONFIRM_PASSWORD,
      };
    case 'enable_maintenance':
      return {
        username: process.env.MAINTENANCE_CONFIRM_USERNAME,
        password: process.env.MAINTENANCE_CONFIRM_PASSWORD,
      };
    case 'change_user_password':
      return {
        username: process.env.CHANGE_USER_PASSWORD_CONFIRM_USERNAME,
        password: process.env.CHANGE_USER_PASSWORD_CONFIRM_PASSWORD,
      };
    default:
      return { username: undefined, password: undefined };
  }
}

const VALID_ACTION_TYPES: AdminActionType[] = [
  'add_employee',
  'add_admin',
  'add_opportunity',
  'confirm_ban',
  'enable_maintenance',
  'change_user_password',
];

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Allow OPTIONS for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed.' });
  }

  const { actionType, username, password } = req.body ?? {};

  // Validate inputs exist
  if (!actionType || !username || !password) {
    return res.status(400).json({ success: false, error: 'يرجى إدخال جميع البيانات المطلوبة.' });
  }

  // Validate actionType is a known value
  if (!VALID_ACTION_TYPES.includes(actionType)) {
    return res.status(400).json({ success: false, error: 'نوع العملية غير معروف.' });
  }

  const credentials = getCredentialsForAction(actionType as AdminActionType);

  // If env vars are not set, fallback or deny
  if (!credentials.username || !credentials.password) {
    console.error(`[verify-admin-action] Missing env vars for action: ${actionType}`);
    return res.status(500).json({
      success: false,
      error: 'خطأ في إعداد مفاتيح التفويض على الخادم. يرجى مراجعة إعدادات البيئة (Environment Variables).',
    });
  }

  const cleanUser = String(username).trim();
  const cleanPass = String(password).trim();

  const usernameMatch = cleanUser === credentials.username.trim();
  const passwordMatch = cleanPass === credentials.password.trim();

  if (!usernameMatch || !passwordMatch) {
    return res.status(401).json({
      success: false,
      error: 'بيانات التفويض (اسم المستخدم أو كلمة المرور) غير صحيحة. لا يمكن إتمام العملية.',
    });
  }

  return res.status(200).json({ success: true });
}
