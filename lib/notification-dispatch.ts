import { getRequestExecutionContext } from "vinext/shims/request-context";
import { dispatchPendingNotifications } from "./notifications";

const DEFAULT_DISPATCH_LIMIT = 12;

/**
 * Starts a bounded outbox relay after a database trigger has committed its
 * notification event. Cloudflare keeps the task alive through waitUntil;
 * local development falls back to a detached promise. Durable rows remain the
 * source of truth and /api/notifications retries anything left pending.
 */
export function scheduleNotificationDispatch(limit = DEFAULT_DISPATCH_LIMIT) {
  const boundedLimit = Math.max(1, Math.min(Math.trunc(limit), 20));
  const task = dispatchPendingNotifications(boundedLimit).catch(() => undefined);
  const context = getRequestExecutionContext();
  if (context) context.waitUntil(task);
  else void task;
}
