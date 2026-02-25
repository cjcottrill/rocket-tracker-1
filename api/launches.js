export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Your API token — stored as a Vercel environment variable
  const API_TOKEN = process.env.SPACE_API_TOKEN;

  if (!API_TOKEN) {
    console.error('SPACE_API_TOKEN environment variable is not set');
    return res.status(500).json({ error: 'Server misconfiguration: missing API token' });
  }

  // Read the endpoint from the query string
  const { endpoint: rawEndpoint, ...queryParams } = req.query;

  // Decode the endpoint in case it comes as launch%2Fupcoming
  const endpoint = decodeURIComponent(rawEndpoint || '');

  // Whitelist: only allow specific LL2 endpoints
  const ALLOWED_ENDPOINTS = [
    'launch/upcoming',
    'launch/previous'
  ];

  if (!endpoint || !ALLOWED_ENDPOINTS.includes(endpoint)) {
    return res.status(400).json({
      error: 'Invalid endpoint',
      allowed: ALLOWED_ENDPOINTS
    });
  }

  // Decode location__ids too, then validate
  if (queryParams.location__ids) {
    queryParams.location__ids = decodeURIComponent(queryParams.location__ids);
  }

  // Enforce Florida-only location IDs (12 = Cape Canaveral, 27 = Kennedy)
 // Validate location IDs - allow only Florida pads
if (queryParams.location__ids) {
    const ids = decodeURIComponent(queryParams.location__ids).split(',');
    const ALLOWED_IDS = ['12', '27'];
    const allValid = ids.every(id => ALLOWED_IDS.includes(id.trim()));
    if (!allValid) {
        return res.status(400).json({ error: 'Invalid location filter' });
    }
    // Ensure clean value is passed forward
    queryParams.location__ids = ids.join(',');
}


  try {
    // Build the real LL2 API URL
    const params = new URLSearchParams(queryParams);
    const apiUrl = `https://ll.thespacedevs.com/2.2.0/${endpoint}/?${params.toString()}`;

    console.log(`Proxying request to: ${apiUrl}`);

    const apiResponse = await fetch(apiUrl, {
      headers: {
        'Authorization': `Token ${API_TOKEN}`,
        'Accept': 'application/json'
      }
    });

    // Forward rate-limit errors to the client
    if (apiResponse.status === 429) {
      const retryAfter = apiResponse.headers.get('Retry-After') || '60';
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        error: 'Rate limited by upstream API',
        retryAfter: retryAfter
      });
    }

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      console.error(`LL2 API error: ${apiResponse.status} — ${errorText}`);
      return res.status(apiResponse.status).json({
        error: `Upstream API returned ${apiResponse.status}`
      });
    }

    const data = await apiResponse.json();

    // Cache at the edge for 5 minutes, allow stale for 60s while revalidating
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');
    res.setHeader('Content-Type', 'application/json');

    return res.status(200).json(data);

  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(502).json({
      error: 'Failed to fetch from upstream API',
      details: error.message
    });
  }
}
