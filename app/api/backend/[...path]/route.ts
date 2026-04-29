import { NextRequest, NextResponse } from "next/server";
import {
  getBackendApiBaseUrl,
  getBackendInternalApiSecret,
  getRequiredSession,
} from "@/lib/server-auth";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

const METHODS_WITHOUT_BODY = new Set(["GET", "HEAD"]);

async function proxyToBackend(req: NextRequest, context: RouteContext) {
  const auth = await getRequiredSession();
  if ("error" in auth) return auth.error;

  const { path } = await context.params;
  const backendPath = `/${path.map(encodeURIComponent).join("/")}/`;
  const targetUrl = new URL(`${getBackendApiBaseUrl()}${backendPath}`);
  targetUrl.search = req.nextUrl.search;

  const headers = new Headers();
  const contentType = req.headers.get("content-type");
  const accept = req.headers.get("accept");
  if (contentType) headers.set("Content-Type", contentType);
  if (accept) headers.set("Accept", accept);
  headers.set("X-User-Id", auth.userId);
  headers.set("X-User-Email", auth.userEmail);
  headers.set("X-Internal-Api-Secret", getBackendInternalApiSecret());

  const body = METHODS_WITHOUT_BODY.has(req.method)
    ? undefined
    : await req.arrayBuffer();

  let backendResponse: Response;
  try {
    backendResponse = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { detail: "Backend service unavailable." },
      { status: 503 },
    );
  }

  if (backendResponse.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const responseHeaders = new Headers();
  const backendContentType = backendResponse.headers.get("content-type");
  if (backendContentType) responseHeaders.set("Content-Type", backendContentType);

  return new NextResponse(await backendResponse.arrayBuffer(), {
    status: backendResponse.status,
    headers: responseHeaders,
  });
}

export const GET = proxyToBackend;
export const POST = proxyToBackend;
export const PATCH = proxyToBackend;
export const PUT = proxyToBackend;
export const DELETE = proxyToBackend;
