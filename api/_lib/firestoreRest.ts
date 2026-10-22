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
 * Fetch a subcollection of documents via REST API
 */
export async function getRestCollection(
  collectionPath: string,
  idToken?: string
): Promise<Array<{ id: string; data: Record<string, any> }>> {
  const url = buildRestUrl(collectionPath);
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.warn(`[firestoreRest] Failed listing ${collectionPath}, status: ${res.status}`);
      return [];
    }
    const json = await res.json();
    const rawDocs = json.documents || [];
    const results: Array<{ id: string; data: Record<string, any> }> = [];
    for (const d of rawDocs) {
      const parsed = parseFirestoreDoc(d);
      if (parsed) results.push(parsed);
    }
    return results;
  } catch (err: any) {
    console.warn(`[firestoreRest] Error listing collection ${collectionPath}:`, err?.message);
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
