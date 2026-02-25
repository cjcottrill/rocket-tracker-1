// api/launches.js
// This runs on Vercel's servers — your API token is NEVER sent to the browser

export default async function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get parameters from the frontend request
    const { endpoint, limit, offset, mode, location__ids, search } = req.query;

    // Validate the endpoint parameter to prevent abuse
    const allowedEndpoints = [
        'launch/upcoming',
        'launch/previous'
    ];

    if (!endpoint || !allowedEndpoints.includes(endpoint)) {
        return res.status(400).json({
            error: 'Invalid endpoint',
            allowed: allowedEndpoints
        });
    }

    // Build the query string from allowed parameters only
    const params = new URLSearchParams();
    if (limit) params.set('limit', limit);
    if (offset) params.set('offset', offset);
    if (mode) params.set('mode', mode);
    if (location__ids) params.set('location__ids', location__ids);
    if (search) params.set('search', search);

    const apiUrl = `https://ll.thespacedevs.com/2.2.0/${endpoint}/?${params.toString()}`;

    try {
        console.log(`[Proxy] Fetching: ${apiUrl}`);

        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `Token ${process.env.SPACE_API_TOKEN}`
            }
        });

        // Forward rate limit headers so the frontend can react
        const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining');
        const rateLimitReset = response.headers.get('X-RateLimit-Reset');
        const retryAfter = response.headers.get('Retry-After');

        // Set CORS headers (allows your frontend to call this)
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');

        // Forward rate limit info to the frontend
        if (rateLimitRemaining) res.setHeader('X-RateLimit-Remaining', rateLimitRemaining);
        if (rateLimitReset) res.setHeader('X-RateLimit-Reset', rateLimitReset);
        if (retryAfter) res.setHeader('Retry-After', retryAfter);

        // Handle rate limiting from the Space Devs API
        if (response.status === 429) {
            return res.status(429).json({
                error: 'Rate limit exceeded',
                retryAfter: retryAfter || 60,
                message: 'The API rate limit has been reached. Please wait before trying again.'
            });
        }

        if (!response.ok) {
            return res.status(response.status).json({
                error: `API returned ${response.status}`,
                message: response.statusText
            });
        }

        const data = await response.json();

        // Cache successful responses at the edge for 5 minutes
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=60');

        return res.status(200).json(data);

    } catch (error) {
        console.error('[Proxy] Error:', error.message);
        return res.status(500).json({
            error: 'Failed to fetch from Space Devs API',
            message: error.message
        });
    }
}
