/**
 * Envío de correo a través de Resend (https://resend.com), un servicio de
 * correo con una API REST sencilla: una llamada con la clave y el mensaje.
 *
 * Se elige Resend por lo mínimo que hay que montar —una clave y un remitente
 * verificado— y porque el envío entero cabe en una llamada `fetch`, sin
 * dependencias, que es lo único que corre bien dentro de un Worker.
 *
 * La configuración (clave y remitente) la pasa quien llama, no se lee aquí: así
 * esta librería no depende del runtime y se puede probar. Si falta la clave, no
 * se rompe nada: se devuelve `sent: 0` con el motivo, y el resumen se habrá
 * compuesto igual —quien lo pidió puede leerlo aunque el correo no salga—.
 */

export type EmailConfig = {
  apiKey: string;
  /** Remitente verificado, p. ej. "Centro de Control ARAYA <avisos@grupobricket.com>". */
  from: string;
};

export type EmailMessage = {
  recipients: string[];
  subject: string;
  html: string;
  text: string;
};

export type EmailResult = {
  sent: number;
  skipped?: string;
  error?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validRecipients(recipients: string[]): string[] {
  const vistos = new Set<string>();
  const limpios: string[] = [];
  for (const raw of recipients) {
    const email = raw.trim().toLowerCase();
    if (!EMAIL_RE.test(email) || vistos.has(email)) continue;
    vistos.add(email);
    limpios.push(email);
  }
  return limpios;
}

export async function sendSummaryEmail(
  config: EmailConfig,
  message: EmailMessage,
  fetchImpl: typeof fetch = fetch,
): Promise<EmailResult> {
  const destinatarios = validRecipients(message.recipients);
  if (!destinatarios.length) {
    return { sent: 0, skipped: "No hay destinatarios válidos dados de alta." };
  }
  if (!config.apiKey || !config.from) {
    return {
      sent: 0,
      skipped:
        "Falta configurar el correo (clave de Resend y remitente). El resumen se ha compuesto pero no se ha enviado.",
    };
  }

  // Los destinatarios van en copia oculta (bcc) para que no se vean entre
  // ellos; el "to" es el propio remitente, que es lo normal en un envío a
  // lista. Así una sola llamada cubre a toda la oficina.
  try {
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [config.from],
        bcc: destinatarios,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });
    if (!response.ok) {
      const detalle = await response.text().catch(() => "");
      return { sent: 0, error: `Resend respondió ${response.status}. ${detalle}`.trim() };
    }
    return { sent: destinatarios.length };
  } catch (error) {
    return { sent: 0, error: error instanceof Error ? error.message : "Fallo de red al enviar el correo." };
  }
}
