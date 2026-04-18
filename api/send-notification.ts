import type { VercelRequest, VercelResponse } from '@vercel/node';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 6;
const MAX_TOKENS_PER_REQUEST = 20;
const requestBuckets = new Map<string, number[]>();

type NotificationPayload = {
  tokens: string[];
  title: string;
  body: string;
  journeyId: string;
  data?: Record<string, string>;
};

class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  const idToken = authHeader.slice('Bearer '.length).trim();
  if (!idToken) {
    return res.status(401).json({ error: 'Invalid bearer token' });
  }

  const payloadResult = parsePayload(req.body);
  if ('error' in payloadResult) {
    return res.status(400).json({ error: payloadResult.error });
  }
  const { tokens, title, body, data, journeyId } = payloadResult.payload;

  const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT;
  const firebaseWebApiKey = process.env.FIREBASE_WEB_API_KEY;
  if (!serviceAccountStr || !firebaseWebApiKey) {
    return res.status(500).json({ error: 'Server auth configuration missing' });
  }

  let serviceAccount: Record<string, string>;
  try {
    serviceAccount = JSON.parse(serviceAccountStr) as Record<string, string>;
  } catch {
    return res.status(500).json({ error: 'Invalid Firebase service account JSON' });
  }

  try {
    const projectId = serviceAccount.project_id;
    if (!projectId) {
      return res.status(500).json({ error: 'Service account project_id missing' });
    }

    const uid = await verifyFirebaseIdToken(idToken, firebaseWebApiKey);
    if (!uid) {
      return res.status(401).json({ error: 'Unauthorized token' });
    }

    const rateKey = `${uid}:${getClientIp(req)}`;
    if (!allowRequest(rateKey)) {
      return res.status(429).json({ error: 'Too many requests' });
    }

    const accessToken = await getAccessToken(serviceAccount);
    await assertJourneyAuthorization({
      accessToken,
      journeyId,
      projectId,
      requesterUid: uid,
      tokens,
    });

    let sent = 0;
    let failed = 0;

    await Promise.allSettled(
      tokens.map(async (token) => {
        try {
          const response = await fetch(
            `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                message: {
                  token,
                  notification: { title, body },
                  data: data ?? {},
                  android: {
                    priority: 'HIGH',
                    notification: {
                      channelId: 'emergency',
                      notificationPriority: 'PRIORITY_MAX',
                      defaultSound: true,
                      defaultVibrateTimings: false,
                      vibrateTimings: ['0.5s', '0.2s', '0.5s', '0.2s', '0.5s', '0.2s', '1s'],
                      visibility: 'PUBLIC',
                    },
                  },
                  apns: {
                    headers: { 'apns-priority': '10' },
                    payload: { aps: { sound: 'default', badge: 1, 'interruption-level': 'critical' } },
                  },
                },
              }),
            }
          );

          if (response.ok) {
            sent++;
          } else {
            failed++;
            console.error('[send-notification] FCM rejected token', {
              journeyId,
              requesterUid: uid,
              status: response.status,
            });
          }
        } catch {
          failed++;
        }
      })
    );

    return res.status(200).json({ sent, failed });
  } catch (error) {
    if (error instanceof HttpError) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    console.error('FCM error:', error);
    return res.status(500).json({ error: 'Failed to send notifications' });
  }
}

function parsePayload(body: unknown): { ok: true; payload: NotificationPayload } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Invalid request body' };
  }

  const candidate = body as Partial<NotificationPayload>;
  const tokens = Array.isArray(candidate.tokens) ? candidate.tokens.filter((token): token is string => typeof token === 'string') : [];

  if (tokens.length === 0) {
    return { ok: false, error: 'No tokens provided' };
  }

  if (tokens.length > MAX_TOKENS_PER_REQUEST) {
    return { ok: false, error: `Token limit exceeded (${MAX_TOKENS_PER_REQUEST})` };
  }

  if (tokens.some((token) => token.trim().length < 30)) {
    return { ok: false, error: 'Invalid token format' };
  }

  if (typeof candidate.title !== 'string' || candidate.title.trim().length === 0 || candidate.title.length > 120) {
    return { ok: false, error: 'Invalid title' };
  }

  if (typeof candidate.body !== 'string' || candidate.body.trim().length === 0 || candidate.body.length > 600) {
    return { ok: false, error: 'Invalid body' };
  }

  if (typeof candidate.journeyId !== 'string' || candidate.journeyId.trim().length < 10 || candidate.journeyId.length > 120) {
    return { ok: false, error: 'Invalid journeyId' };
  }

  const safeData = sanitizeData(candidate.data);

  return {
    ok: true,
    payload: {
      tokens: tokens.map((token) => token.trim()),
      title: candidate.title.trim(),
      body: candidate.body.trim(),
      journeyId: candidate.journeyId.trim(),
      data: safeData,
    },
  };
}

function sanitizeData(data: NotificationPayload['data']): Record<string, string> {
  if (!data || typeof data !== 'object') return {};
  const entries = Object.entries(data)
    .filter(([key, value]) => typeof key === 'string' && typeof value === 'string')
    .slice(0, 20)
    .map(([key, value]) => [key.slice(0, 100), value.slice(0, 500)]);
  return Object.fromEntries(entries);
}

function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
}

function allowRequest(rateKey: string): boolean {
  const now = Date.now();
  const bucket = requestBuckets.get(rateKey) ?? [];
  const active = bucket.filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);

  if (active.length >= RATE_LIMIT_MAX_REQUESTS) {
    requestBuckets.set(rateKey, active);
    return false;
  }

  active.push(now);
  requestBuckets.set(rateKey, active);
  return true;
}

async function verifyFirebaseIdToken(idToken: string, apiKey: string): Promise<string | null> {
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  if (!response.ok) return null;

  const payload = await response.json() as {
    users?: Array<{ localId?: string }>;
  };
  const localId = payload.users?.[0]?.localId;
  return typeof localId === 'string' && localId.length > 0 ? localId : null;
}

async function assertJourneyAuthorization(input: {
  accessToken: string;
  journeyId: string;
  projectId: string;
  requesterUid: string;
  tokens: string[];
}): Promise<void> {
  const journey = await fetchJourney(input.projectId, input.accessToken, input.journeyId);
  if (!journey) {
    throw new HttpError(404, 'Journey not found');
  }

  if (journey.userId !== input.requesterUid) {
    throw new HttpError(403, 'Journey does not belong to requester');
  }

  const allowedTokens = await fetchAllowedWatcherTokens(
    input.projectId,
    input.accessToken,
    journey.contactUids
  );

  const unauthorizedToken = input.tokens.find((token) => !allowedTokens.has(token));
  if (unauthorizedToken) {
    throw new HttpError(403, 'One or more notification targets are unauthorized');
  }
}

async function fetchJourney(
  projectId: string,
  accessToken: string,
  journeyId: string
): Promise<{ userId: string; contactUids: string[] } | null> {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/journeys/${journeyId}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new HttpError(500, 'Failed to read journey data');
  }

  const payload = await response.json() as { fields?: Record<string, unknown> };
  const fields = payload.fields ?? {};
  const userId = readStringField(fields.userId);
  const contactUids = readStringArrayField(fields.contactUids);

  if (!userId) {
    throw new HttpError(500, 'Journey record is missing userId');
  }

  return { userId, contactUids };
}

async function fetchAllowedWatcherTokens(
  projectId: string,
  accessToken: string,
  contactUids: string[]
): Promise<Set<string>> {
  if (contactUids.length === 0) return new Set<string>();

  const chunks = chunkArray(contactUids, 10);
  const tokens = new Set<string>();

  for (const chunk of chunks) {
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: 'users' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'uid' },
                op: 'IN',
                value: {
                  arrayValue: {
                    values: chunk.map((uid) => ({ stringValue: uid })),
                  },
                },
              },
            },
          },
        }),
      }
    );

    if (!response.ok) {
      throw new HttpError(500, 'Failed to read watcher data');
    }

    const rows = await response.json() as Array<{ document?: { fields?: Record<string, unknown> } }>;
    for (const row of rows) {
      const fieldToken = readStringField(row.document?.fields?.fcmToken);
      if (fieldToken) tokens.add(fieldToken);
    }
  }

  return tokens;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function readStringField(fieldValue: unknown): string | null {
  if (!fieldValue || typeof fieldValue !== 'object') return null;
  const maybe = fieldValue as { stringValue?: unknown };
  return typeof maybe.stringValue === 'string' ? maybe.stringValue : null;
}

function readStringArrayField(fieldValue: unknown): string[] {
  if (!fieldValue || typeof fieldValue !== 'object') return [];
  const maybe = fieldValue as { arrayValue?: { values?: unknown[] } };
  const values = maybe.arrayValue?.values ?? [];
  return values
    .map((value) => readStringField(value))
    .filter((value): value is string => Boolean(value));
}

async function getAccessToken(serviceAccount: Record<string, string>): Promise<string> {
  const header = toBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = toBase64Url(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));

  const { createSign } = await import('crypto');
  const sign = createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const signature = sign
    .sign(serviceAccount.private_key, 'base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  const jwt = `${header}.${payload}.${signature}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    throw new HttpError(500, 'Failed to obtain Google access token');
  }

  const tokenData = await tokenRes.json() as { access_token?: string };
  if (!tokenData.access_token) {
    throw new HttpError(500, 'Google access token missing in response');
  }

  return tokenData.access_token;
}

function toBase64Url(value: string): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}
