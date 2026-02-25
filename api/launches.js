// Calculate date range: now to 14 days from now
const futureDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

const netAfter = now.toISOString().slice(0, 16) + 'Z';
const netBefore = futureDate.toISOString().slice(0, 16) + 'Z';

// Florida Space Coast location IDs: 12 (KSC), 27 (Cape Canaveral), 80 (SLC)
const locationIds = '12,27,80';

const apiUrl = `https://ll.thespacedevs.com/2.2.0/launch/upcoming/?location__ids=${locationIds}&net__gte=${netAfter}&net__lte=${netBefore}&limit=20&ordering=net`;

console.log('Fetching from LL2 API:', apiUrl);

const response = await fetch(apiUrl, {
  headers: {
    'Accept': 'application/json',
  }
});

if (!response.ok) {
  console.error('LL2 API error:', response.status, response.statusText);
  
  if (response.status === 429) {
    return res.status(429).json({
      error: 'Rate limited by launch API. Please try again in a moment.',
      results: []
    });
  }
  
  return res.status(response.status).json({
    error: `Launch API returned ${response.status}`,
    results: []
  });
}

const data = await response.json();

// Transform the data to include what we need
const launches = (data.results || []).map(launch => ({
  id: launch.id,
  name: launch.name,
  net: launch.net,
  status: launch.status ? {
    id: launch.status.id,
    name: launch.status.name,
    abbrev: launch.status.abbrev,
    description: launch.status.description
  } : null,
  launch_service_provider: launch.launch_service_provider ? {
    name: launch.launch_service_provider.name,
    type: launch.launch_service_provider.type
  } : null,
  rocket: launch.rocket ? {
    configuration: launch.rocket.configuration ? {
      name: launch.rocket.configuration.name,
      full_name: launch.rocket.configuration.full_name,
      variant: launch.rocket.configuration.variant
    } : null
  } : null,
  mission: launch.mission ? {
    name: launch.mission.name,
    description: launch.mission.description,
    type: launch.mission.type,
    orbit: launch.mission.orbit ? {
      name: launch.mission.orbit.name,
      abbrev: launch.mission.orbit.abbrev
    } : null
  } : null,
  pad: launch.pad ? {
    name: launch.pad.name,
    location: launch.pad.location ? {
      name: launch.pad.location.name
    } : null
  } : null,
  image: launch.image,
  vidURLs: launch.vidURLs || [],
  webcast_live: launch.webcast_live
}));

return res.status(200).json({
  count: data.count,
  results: launches
});
