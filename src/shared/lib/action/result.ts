import 'server-only';

export type ActionResult = {
  status: 'success' | 'error';
  message: string;
  redirect_url?: string;
};

export function actionOk(message: string, redirect_url?: string): ActionResult {
  return { status: 'success', message, redirect_url };
}

export function actionErr(message: string): ActionResult {
  return { status: 'error', message };
}
