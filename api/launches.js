export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const API_TOKEN = process.env.SPACE_API_TOKEN;

  if (!API_TOKEN) {
    return res.status(500).json({ error: 'Server misconfiguration: missing API token' });
  }

  const { endpoint: rawEndpoint, ...queryParams } = req.query;
  const endpoint = decodeURIComponent(rawEndpoint || '');

  const ALLOWED_ENDPOINTS = ['launch/upcoming'];

  if (!endpoint || !ALLOWED_ENDPOINTS.includes(endpoint)) {
    return res.status(400).json({ error: 'Invalid endpoint', allowed: ALLOWED_ENDPOINTS });
  }

  // Force Florida Space Coast location IDs
  queryParams.location__ids = '12,27,80';

  try {
    const params = new URLSearchParams(queryParams);
    const apiUrl = `https://ll.thespacedevs.com/2.2.0/${endpoint}/?${params.toString()}`;

    const apiResponse = await fetch(apiUrl, {
      headers: {
        'Authorization': `Token ${API_TOKEN}`,
        'Accept': 'application/json'
      }
    });

    if (apiResponse.status === 429) {
      const retryAfter = apiResponse.headers.get('Retry-After') || '60';
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({ error: 'Rate limited', retryAfter });
    }

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      return res.status(apiResponse.status).json({ error: `Upstream API returned ${apiResponse.status}` });
    }

    const data = await apiResponse.json();

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    return res.status(200).json(data);

  } catch (error) {
    return res.status(502).json({ error: 'Failed to fetch from upstream API', details: error.message });
  }
}
