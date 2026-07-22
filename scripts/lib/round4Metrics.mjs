export function summarizeGlbResources(resources) {
  const names = resources.map((entry) => entry.name);
  const counts = new Map();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);

  return {
    requestCount: resources.length,
    uniqueRequestCount: counts.size,
    duplicateUrls: [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([name]) => name)
      .sort(),
    totalTransferSize: resources.reduce(
      (sum, entry) => sum + (entry.transferSize ?? 0),
      0,
    ),
    totalEncodedBodySize: resources.reduce(
      (sum, entry) => sum + (entry.encodedBodySize ?? 0),
      0,
    ),
    totalDecodedBodySize: resources.reduce(
      (sum, entry) => sum + (entry.decodedBodySize ?? 0),
      0,
    ),
  };
}
