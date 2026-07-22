type ModelFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const modelByteRequests = new Map<string, Promise<ArrayBuffer>>();

async function fetchModelBytes(
  url: string,
  fetcher: ModelFetcher,
): Promise<ArrayBuffer> {
  const response = await fetcher(url);
  if (!response.ok) {
    throw new Error(`Model request failed with ${response.status}: ${url}`);
  }
  return response.arrayBuffer();
}

export function loadModelBytes(
  url: string,
  fetcher: ModelFetcher = fetch,
): Promise<ArrayBuffer> {
  const cached = modelByteRequests.get(url);
  if (cached) return cached;

  const request = fetchModelBytes(url, fetcher);
  modelByteRequests.set(url, request);
  void request.catch(() => {
    if (modelByteRequests.get(url) === request) modelByteRequests.delete(url);
  });
  return request;
}
