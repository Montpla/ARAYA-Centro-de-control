"use client";

export type DeviceNotificationItem = {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  tone: "critical" | "warning" | "info" | "success";
  view?: string;
};

export type LocalBiometricRecord = {
  userId: number;
  credentialId: string;
  enrolledAt: string;
};

export type DeviceNotificationPermission = NotificationPermission | "unsupported";

function biometricStorageKey(userId: number) {
  return `bricket-biometric-v1:${userId}`;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function challenge() {
  return crypto.getRandomValues(new Uint8Array(32));
}

export function readBiometricRecord(userId: number): LocalBiometricRecord | null {
  try {
    const stored = window.localStorage.getItem(biometricStorageKey(userId));
    if (!stored) return null;
    const parsed = JSON.parse(stored) as LocalBiometricRecord;
    if (
      parsed.userId !== userId ||
      !parsed.credentialId ||
      !parsed.enrolledAt
    ) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function removeBiometricRecord(userId: number) {
  window.localStorage.removeItem(biometricStorageKey(userId));
}

export async function platformBiometricAvailable() {
  if (
    typeof window === "undefined" ||
    !window.isSecureContext ||
    !("PublicKeyCredential" in window) ||
    !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
  ) return false;
  return PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
}

export async function enrollPlatformBiometric(userId: number, displayName: string) {
  const userHandle = new TextEncoder().encode(`bricket-control-${userId}`);
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: challenge(),
      rp: { name: "Bricket Control" },
      user: {
        id: userHandle,
        name: `bricket-user-${userId}`,
        displayName,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "preferred",
        userVerification: "required",
      },
      attestation: "none",
      timeout: 60_000,
    },
  });
  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error("El dispositivo no ha creado una credencial biométrica.");
  }
  const record: LocalBiometricRecord = {
    userId,
    credentialId: bytesToBase64Url(new Uint8Array(credential.rawId)),
    enrolledAt: new Date().toISOString(),
  };
  window.localStorage.setItem(biometricStorageKey(userId), JSON.stringify(record));
  return record;
}

export async function verifyPlatformBiometric(record: LocalBiometricRecord) {
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: challenge(),
      allowCredentials: [{
        id: base64UrlToBytes(record.credentialId),
        type: "public-key",
      }],
      userVerification: "required",
      timeout: 60_000,
    },
  });
  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error("No se ha podido verificar la identidad biométrica.");
  }
  return true;
}

export function DeviceBootScreen() {
  return (
    <main className="device-gate device-boot" aria-label="Preparando Bricket Control">
      <div className="device-gate-logo" aria-hidden="true" />
      <strong>BRICKET CONTROL</strong>
      <span>Preparando el acceso seguro…</span>
    </main>
  );
}

export function BiometricGate({
  displayName,
  busy,
  error,
  online,
  onUnlock,
  onRecover,
}: {
  displayName: string;
  busy: boolean;
  error: string;
  online: boolean;
  onUnlock: () => void;
  onRecover: () => void;
}) {
  return (
    <main className="device-gate biometric-gate">
      <div className="device-gate-card">
        <div className="device-gate-logo" aria-hidden="true" />
        <span>ACCESO PRIVADO · GRUPO BRICKET</span>
        <h1>Desbloquear Bricket Control</h1>
        <p>Confirma tu identidad con Face ID, Touch ID, huella o el método seguro configurado en este dispositivo.</p>
        <button className="biometric-unlock-button" type="button" onClick={onUnlock} disabled={busy}>
          <i aria-hidden="true">◎</i>
          <span><strong>{busy ? "Verificando…" : "Desbloquear"}</strong><small>{displayName}</small></span>
        </button>
        {error && <div className="device-gate-error" role="alert">{error}</div>}
        {online ? (
          <button className="device-gate-recovery" type="button" onClick={onRecover}>
            Volver a iniciar sesión
          </button>
        ) : (
          <small className="device-gate-offline">Modo sin conexión · la comprobación se realiza en el dispositivo.</small>
        )}
        <a href="/signout-with-chatgpt?return_to=/">Cerrar sesión</a>
      </div>
    </main>
  );
}

export function OfflineAccessGate({ onRetry }: { onRetry: () => void }) {
  return (
    <main className="device-gate offline-access-gate">
      <div className="device-gate-card">
        <div className="device-gate-logo" aria-hidden="true" />
        <span>MODO SIN CONEXIÓN</span>
        <h1>Protección del dispositivo pendiente</h1>
        <p>Para consultar información sin internet debes conectarte una vez y activar el desbloqueo biométrico desde Avisos y seguridad.</p>
        <button className="button primary" type="button" onClick={onRetry}>Comprobar conexión</button>
        <a href="/signout-with-chatgpt?return_to=/">Cerrar sesión</a>
      </div>
    </main>
  );
}

export function DeviceCenter({
  notifications,
  readIds,
  notificationPermission,
  biometricSupported,
  biometricConfigured,
  biometricBusy,
  biometricError,
  online,
  offlineReady,
  onClose,
  onRead,
  onReadAll,
  onOpenNotification,
  onEnableNotifications,
  onTestNotification,
  onEnableBiometric,
  onDisableBiometric,
  onLockNow,
}: {
  notifications: DeviceNotificationItem[];
  readIds: string[];
  notificationPermission: DeviceNotificationPermission;
  biometricSupported: boolean;
  biometricConfigured: boolean;
  biometricBusy: boolean;
  biometricError: string;
  online: boolean;
  offlineReady: boolean;
  onClose: () => void;
  onRead: (id: string) => void;
  onReadAll: () => void;
  onOpenNotification: (item: DeviceNotificationItem) => void;
  onEnableNotifications: () => void;
  onTestNotification: () => void;
  onEnableBiometric: () => void;
  onDisableBiometric: () => void;
  onLockNow: () => void;
}) {
  const unread = notifications.filter((item) => !readIds.includes(item.id)).length;
  const permissionLabel =
    notificationPermission === "granted" ? "Activadas" :
    notificationPermission === "denied" ? "Bloqueadas por el dispositivo" :
    notificationPermission === "unsupported" ? "No disponibles" :
    "Pendientes de activar";

  return (
    <div className="device-center-backdrop" role="presentation" onMouseDown={onClose}>
      <aside
        className="device-center-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Avisos y seguridad del dispositivo"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="device-center-header">
          <div>
            <span className="section-kicker">BRICKET CONTROL · DISPOSITIVO</span>
            <h2>Avisos y seguridad</h2>
            <p>Notificaciones, biometría y disponibilidad sin conexión.</p>
          </div>
          <button className="close-button" type="button" onClick={onClose} aria-label="Cerrar avisos y seguridad">×</button>
        </header>

        <section className="device-capability-card">
          <div className="device-capability-heading">
            <span className="device-capability-icon">●</span>
            <div><strong>Notificaciones del dispositivo</strong><small>{permissionLabel}</small></div>
            <i className={notificationPermission === "granted" ? "ready" : ""}>{notificationPermission === "granted" ? "ACTIVO" : "CONFIGURAR"}</i>
          </div>
          <p>Recibe avisos cuando llega una revisión viva, una acción o una incidencia crítica mientras Bricket Control está activo.</p>
          <div className="device-capability-actions">
            {notificationPermission !== "granted" && notificationPermission !== "unsupported" && (
              <button className="button primary" type="button" onClick={onEnableNotifications}>Activar notificaciones</button>
            )}
            {notificationPermission === "granted" && (
              <button className="button secondary" type="button" onClick={onTestNotification}>Enviar aviso de prueba</button>
            )}
          </div>
        </section>

        <section className="device-capability-card">
          <div className="device-capability-heading">
            <span className="device-capability-icon biometric">◎</span>
            <div><strong>Desbloqueo biométrico</strong><small>{biometricConfigured ? "Configurado en este dispositivo" : biometricSupported ? "Disponible" : "No compatible"}</small></div>
            <i className={biometricConfigured ? "ready" : ""}>{biometricConfigured ? "ACTIVO" : "LOCAL"}</i>
          </div>
          <p>Usa Face ID, Touch ID, huella o el método seguro del dispositivo. Es una protección local adicional; los permisos financieros siguen controlados por el servidor.</p>
          <div className="device-capability-actions">
            {!biometricConfigured && biometricSupported && (
              <button className="button primary" type="button" onClick={onEnableBiometric} disabled={biometricBusy}>
                {biometricBusy ? "Configurando…" : "Activar biometría"}
              </button>
            )}
            {biometricConfigured && (
              <>
                <button className="button primary" type="button" onClick={onLockNow}>Bloquear ahora</button>
                <button className="button secondary" type="button" onClick={onDisableBiometric}>Desactivar</button>
              </>
            )}
          </div>
          {biometricError && <div className="device-capability-error" role="alert">{biometricError}</div>}
        </section>

        <section className="device-capability-card">
          <div className="device-capability-heading">
            <span className="device-capability-icon offline">↯</span>
            <div><strong>Funcionamiento sin conexión</strong><small>{online ? offlineReady ? "Copia local preparada" : "Preparando copia local" : "Consulta local activa"}</small></div>
            <i className={offlineReady ? "ready" : ""}>{online ? "ONLINE" : "OFFLINE"}</i>
          </div>
          <p>Conserva el último Centro de Control visitado para consultar planos, indicadores y fichas. Sin internet funciona en modo de solo lectura: las cargas, aprobaciones y cambios esperan a recuperar conexión.</p>
          {!biometricConfigured && <div className="device-capability-note">Activa la biometría para poder abrir la copia local de forma protegida.</div>}
        </section>

        <section className="notification-section">
          <div className="notification-heading">
            <div><span className="section-kicker">CENTRO DE NOTIFICACIONES</span><h3>Avisos recientes</h3></div>
            <button type="button" onClick={onReadAll} disabled={unread === 0}>Marcar todo leído</button>
          </div>
          <div className="notification-list">
            {notifications.length > 0 ? notifications.map((item) => {
              const isRead = readIds.includes(item.id);
              return (
                <button
                  type="button"
                  className={`notification-item ${item.tone} ${isRead ? "read" : "unread"}`}
                  key={item.id}
                  onClick={() => {
                    onRead(item.id);
                    onOpenNotification(item);
                  }}
                >
                  <i aria-hidden="true" />
                  <span><strong>{item.title}</strong><small>{item.detail}</small><time>{item.timestamp || "Ahora"}</time></span>
                  {!isRead && <b>Nuevo</b>}
                </button>
              );
            }) : (
              <div className="notification-empty"><strong>Sin avisos pendientes</strong><p>Las nuevas revisiones, acciones e incidencias aparecerán aquí.</p></div>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}
