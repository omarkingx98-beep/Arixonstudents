import { firebaseAppConfig } from './config.js';

// Parse Firestore REST field value into JavaScript native value
export function parseFirestoreValue(field: any): any {
  if (!field) return null;
  if ('stringValue' in field) return field.stringValue;
  if ('integerValue' in field) return parseInt(field.integerValue, 10);
  if ('doubleValue' in field) return parseFloat(field.doubleValue);
  if ('booleanValue' in field) return Boolean(field.booleanValue);
  if ('timestampValue' in field) return field.timestampValue;
  if ('nullValue' in field) return null;
  if ('arrayValue' in field) {
    const values = field.arrayValue.values || [];
    return values.map(parseFirestoreValue);
  }
  if ('mapValue' in field) {
    const fields = field.mapValue.fields || {};
    const res: Record<string, any> = {};
    for (const k of Object.keys(fields)) {
      res[k] = parseFirestoreValue(fields[k]);
    }
    return res;
  }
  return null;
}

// Parse entire Firestore REST document
export function parseFirestoreDoc(doc: any): { id: string; data: Record<string, any> } | null {
  if (!doc || !doc.fields) return null;
  const nameParts = (doc.name || '').split('/');
  const id = nameParts[nameParts.length - 1];
  const data: Record<string, any> = {};
  for (const k of Object.keys(doc.fields)) {
    data[k] = parseFirestoreValue(doc.fields[k]);
  }
  data.id = id;
  return { id, data };
}

// Convert JavaScript native value to Firestore REST field
export function encodeFirestoreValue(val: any): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(encodeFirestoreValue) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const k of Object.keys(val)) {
      fields[k] = encodeFirestoreValue(val[k]);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

const BASE_URL = `https://firestore.googleapis.com/v1/projects/${firebaseAppConfig.projectId}/databases/(default)/documents`;

function buildRestUrl(path: string, extraQuery?: string): string {
  const apiKey = firebaseAppConfig.apiKey;
  const params = [];
  if (apiKey) params.push(`key=${encodeURIComponent(apiKey)}`);
  if (extraQuery) params.push(extraQuery);
  const qs = params.length > 0 ? `?${params.join('&')}` : '';
  return `${BASE_URL}/${path}${qs}`;
}

/**
 * Fetch a single Firestore document via REST API
 */
export async function getRestDoc(docPath: string, idToken?: string): Promise<Record<string, any> | null> {
  const url = buildRestUrl(docPath);
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const json = await res.json();
    const parsed = parseFirestoreDoc(json);
    return parsed ? parsed.data : null;
  } catch (err: any) {
    console.warn(`[firestoreRest] Error fetching doc ${docPath}:`, err?.message);
    return null;
  }
}

/**
 * Fetch a subcollection or collection of documents via REST API (paginated, up to 1500 docs)
 */
export async function getRestCollection(
  collectionPath: string,
  idToken?: string
): Promise<Array<{ id: string; data: Record<string, any> }>> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  const results: Array<{ id: string; data: Record<string, any> }> = [];
  let pageToken: string | undefined = undefined;
  let pages = 0;

  try {
    do {
      const extraParts = ['pageSize=300'];
      if (pageToken) {
        extraParts.push(`pageToken=${encodeURIComponent(pageToken)}`);
      }
      const url = buildRestUrl(collectionPath, extraParts.join('&'));
      const res = await fetch(url, { headers });
      if (!res.ok) {
        console.warn(`[firestoreRest] Failed listing ${collectionPath}, status: ${res.status}`);
        break;
      }
      const json: any = await res.json();
      const rawDocs = json.documents || [];
      for (const d of rawDocs) {
        const parsed = parseFirestoreDoc(d);
        if (parsed) results.push(parsed);
      }
      pageToken = json.nextPageToken;
      pages++;
    } while (pageToken && pages < 5);

    return results;
  } catch (err: any) {
    console.warn(`[firestoreRest] Error listing collection ${collectionPath}:`, err?.message);
    return results;
  }
}

/**
 * Query a root collection by single field equality via Firestore REST :runQuery
 */
export async function queryRestByField(
  collectionId: string,
  fieldPath: string,
  value: string,
  idToken?: string,
  limit = 100
): Promise<Array<{ id: string; data: Record<string, any> }>> {
  const apiKey = firebaseAppConfig.apiKey;
  const qs = apiKey ? `?key=${encodeURIComponent(apiKey)}` : '';
  const url = `${BASE_URL}:runQuery${qs}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId }],
          where: {
            fieldFilter: {
              field: { fieldPath },
              op: 'EQUAL',
              value: { stringValue: value },
            },
          },
          limit,
        },
      }),
    });

    if (!res.ok) {
      console.warn(`[firestoreRest] runQuery failed for ${collectionId}.${fieldPath}, status: ${res.status}`);
      return [];
    }

    const json: any = await res.json();
    const rows = Array.isArray(json) ? json : [];
    const results: Array<{ id: string; data: Record<string, any> }> = [];
    for (const row of rows) {
      if (row && row.document) {
        const parsed = parseFirestoreDoc(row.document);
        if (parsed) results.push(parsed);
      }
    }
    return results;
  } catch (err: any) {
    console.warn(`[firestoreRest] Error runQuery ${collectionId}:`, err?.message);
    return [];
  }
}

/**
 * Patch / update a document via REST API
 */
export async function patchRestDoc(
  docPath: string,
  data: Record<string, any>,
  idToken?: string
): Promise<boolean> {
  const keys = Object.keys(data);
  if (keys.length === 0) return true;
  const updateMask = keys.map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const url = buildRestUrl(docPath, updateMask);

  const fields: Record<string, any> = {};
  for (const k of keys) {
    fields[k] = encodeFirestoreValue(data[k]);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ fields }),
    });
    return res.ok;
  } catch (err: any) {
    console.warn(`[firestoreRest] Error patching doc ${docPath}:`, err?.message);
    return false;
  }
}

export interface RestBatchWriteItem {
  docPath: string; // relative to documents/
  data: Record<string, any>;
  fieldPaths?: string[]; // if provided, acts as partial updateMask; if omitted, full overwrite
}

/**
 * Commit multiple writes atomically in a single Firestore REST :commit batch
 */
export async function commitRestBatch(
  writes: RestBatchWriteItem[],
  idToken?: string
): Promise<{ ok: boolean; error?: string }> {
  if (writes.length === 0) return { ok: true };
  const apiKey = firebaseAppConfig.apiKey;
  const qs = apiKey ? `?key=${encodeURIComponent(apiKey)}` : '';
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseAppConfig.projectId}/databases/(default)/documents:commit${qs}`;

  const docPrefix = `projects/${firebaseAppConfig.projectId}/databases/(default)/documents`;
  const formattedWrites = writes.map((w) => {
    const fields: Record<string, any> = {};
    for (const k of Object.keys(w.data)) {
      fields[k] = encodeFirestoreValue(w.data[k]);
    }
    const writeObj: any = {
      update: {
        name: `${docPrefix}/${w.docPath}`,
        fields,
      },
    };
    if (w.fieldPaths && w.fieldPaths.length > 0) {
      writeObj.updateMask = { fieldPaths: w.fieldPaths };
    }
    return writeObj;
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ writes: formattedWrites }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}: ${txt.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Batch commit error' };
  }
}

