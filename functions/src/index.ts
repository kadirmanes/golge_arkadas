import * as admin from 'firebase-admin';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { Resend } from 'resend';

admin.initializeApp();

const resendApiKey = defineSecret('RESEND_API_KEY');

/**
 * Yeni watchRequest belgesi oluştuğunda arkadaşa e-posta gönderir.
 */
export const onFriendRequestCreated = onDocumentCreated(
  { document: 'watchRequests/{requestId}', secrets: [resendApiKey] },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const { fromDisplayName, fromEmail, toEmail } = data as {
      fromDisplayName: string;
      fromEmail: string;
      toEmail: string;
    };

    if (!toEmail) {
      console.warn('toEmail eksik, e-posta gönderilmedi');
      return;
    }

    const resend = new Resend(resendApiKey.value());

    try {
      await resend.emails.send({
        from: 'Gölge Arkadaş <onboarding@resend.dev>',
        to: toEmail,
        subject: `${fromDisplayName} seni arkadaş listesine eklemek istiyor`,
        html: `
          <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;background:#0f0f0f;color:#e4e4e7;padding:32px;border-radius:16px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px;">
              <div style="width:36px;height:36px;background:#10b981;border-radius:10px;display:flex;align-items:center;justify-content:center;">
                <span style="color:#000;font-size:20px;">🛡️</span>
              </div>
              <span style="font-size:20px;font-weight:700;color:#fff;">Gölge Arkadaş</span>
            </div>

            <div style="background:#18181b;border:1px solid #27272a;border-radius:12px;padding:20px;margin-bottom:20px;">
              <p style="margin:0 0 8px;font-size:16px;color:#fff;">
                <strong style="color:#10b981;">${fromDisplayName}</strong> sana arkadaşlık isteği gönderdi.
              </p>
              <p style="margin:0;font-size:13px;color:#71717a;">${fromEmail}</p>
            </div>

            <p style="color:#a1a1aa;font-size:14px;line-height:1.6;margin-bottom:20px;">
              Uygulamayı açıp <strong style="color:#fff;">Arkadaşlarım</strong> bölümüne giderek
              isteği kabul veya reddedebilirsin.
            </p>

            <p style="color:#52525b;font-size:12px;margin-top:32px;border-top:1px solid #27272a;padding-top:16px;">
              Bu e-postayı beklemediysen görmezden gelebilirsin.
            </p>
          </div>
        `,
      });
      console.log(`✓ E-posta gönderildi → ${toEmail}`);
    } catch (err) {
      console.error('Resend hatası:', err);
    }
  }
);
