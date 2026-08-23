/**
 * Minimal email provider abstraction.
 *
 * In development/test the "console" provider is used — it logs the email to
 * stdout and never hits an external SMTP server.  Swap for a real transport
 * (nodemailer, Resend, SendGrid SDK …) by setting EMAIL_PROVIDER=smtp and
 * adding provider-specific env vars without touching the queue or worker code.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

// ── Console provider (development / test default) ────────────────────────────

class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<void> {
    if (process.env.EMAIL_PROVIDER === "console-fail") {
      throw new Error("Simulated email delivery failure");
    }

    console.log(
      JSON.stringify({
        level: "info",
        service: "taskflow-worker",
        event: "email_sent",
        to: message.to,
        subject: message.subject,
        body: message.text,
        timestamp: new Date().toISOString()
      })
    );
  }
}
// ── Factory ──────────────────────────────────────────────────────────────────

export function createEmailProvider(): EmailProvider {
  const provider = process.env.EMAIL_PROVIDER ?? "console";

  switch (provider) {
    case "console":
    case "console-fail":
      return new ConsoleEmailProvider();


    default:
      throw new Error(
        `Unknown EMAIL_PROVIDER "${provider}". Supported values: console`
      );
  }
}
