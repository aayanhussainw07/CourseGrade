const MAX_BACKEND_BODY_BYTES = 1024 * 1024;

const ROUTE_RULES: Array<{ pattern: RegExp; methods: ReadonlySet<string> }> = [
  { pattern: /^semesters$/, methods: new Set(["GET", "POST"]) },
  { pattern: /^semesters\/order$/, methods: new Set(["PUT"]) },
  { pattern: /^semesters\/\d+$/, methods: new Set(["GET", "PATCH", "DELETE"]) },
  { pattern: /^semesters\/\d+\/duplicate$/, methods: new Set(["POST"]) },
  { pattern: /^semesters\/\d+\/courses\/order$/, methods: new Set(["PUT"]) },
  { pattern: /^courses$/, methods: new Set(["GET", "POST"]) },
  { pattern: /^courses\/\d+$/, methods: new Set(["GET", "PATCH", "DELETE"]) },
  { pattern: /^assignments$/, methods: new Set(["GET", "POST"]) },
  { pattern: /^assignments\/\d+$/, methods: new Set(["GET", "PATCH", "DELETE"]) },
  { pattern: /^settings$/, methods: new Set(["GET", "PUT"]) },
  { pattern: /^user-state$/, methods: new Set(["GET", "PATCH"]) },
  { pattern: /^migration\/local-v1$/, methods: new Set(["POST"]) },
  { pattern: /^grade-scales$/, methods: new Set(["GET", "POST"]) },
  { pattern: /^grade-scales\/\d+$/, methods: new Set(["GET", "PATCH", "DELETE"]) },
  { pattern: /^grade-scales\/reset_default$/, methods: new Set(["POST"]) },
];

export class BackendBodyTooLargeError extends Error {
  constructor() {
    super("Backend request body is too large.");
    this.name = "BackendBodyTooLargeError";
  }
}

export function isAllowedBackendProxyRequest(
  pathSegments: string[],
  method: string,
): boolean {
  const path = pathSegments.join("/");
  const normalizedMethod = method.toUpperCase();
  return ROUTE_RULES.some(
    (rule) => rule.pattern.test(path) && rule.methods.has(normalizedMethod),
  );
}

export async function readBackendRequestBody(
  request: Pick<Request, "body" | "headers">,
  maxBytes = MAX_BACKEND_BODY_BYTES,
): Promise<ArrayBuffer | undefined> {
  const declaredLength = Number.parseInt(
    request.headers.get("content-length") ?? "",
    10,
  );
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new BackendBodyTooLargeError();
  }
  if (!request.body) return undefined;

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new BackendBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}
