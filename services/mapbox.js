const MAPBOX_BASE = "https://api.mapbox.com";

const hasToken = () => Boolean(process.env.MAPBOX_ACCESS_TOKEN);

const sanitizeUrl = (url) => url.replace(/access_token=[^&]+/i, "access_token=***");

const mapboxGetJson = async (url) => {
    const res = await fetch(url);
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        const shortText = typeof text === "string" ? text.slice(0, 500) : "";
        throw new Error(`Mapbox error ${res.status} @ ${sanitizeUrl(url)}: ${shortText}`);
    }
    return res.json();
};

const geocodeAddress = async (addressText) => {
    if (!hasToken()) {
        throw new Error("MAPBOX_ACCESS_TOKEN no configurado");
    }

    const q = encodeURIComponent(addressText);
    // Nota: mantenemos parámetros simples; el debug se hace desde los logs del controller.
    const url = `${MAPBOX_BASE}/geocoding/v5/mapbox.places/${q}.json?access_token=${process.env.MAPBOX_ACCESS_TOKEN}&limit=1&country=ES&language=es&types=address`;
    const data = await mapboxGetJson(url);
    const feature = data?.features?.[0];
    const [lng, lat] = feature?.center || [];
    if (typeof lat !== "number" || typeof lng !== "number") {
        throw new Error(`No se pudo geocodificar la dirección (query="${addressText}")`);
    }
    return { lat, lng };
};

const getRoute = async ({ origin, destination, profile = "driving" }) => {
    if (!hasToken()) {
        throw new Error("MAPBOX_ACCESS_TOKEN no configurado");
    }

    const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const url = `${MAPBOX_BASE}/directions/v5/mapbox/${profile}/${coords}?geometries=geojson&overview=full&access_token=${process.env.MAPBOX_ACCESS_TOKEN}`;
    const data = await mapboxGetJson(url);
    const geometry = data?.routes?.[0]?.geometry;
    const coordinates = geometry?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
        throw new Error("No se pudo calcular la ruta");
    }

    return coordinates.map(([lng, lat]) => ({ lat, lng }));
};

const interpolateRoute = ({ origin, destination, steps = 40 }) => {
    const points = [];
    for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        points.push({
            lat: origin.lat + (destination.lat - origin.lat) * t,
            lng: origin.lng + (destination.lng - origin.lng) * t,
        });
    }
    return points;
};

module.exports = {
    geocodeAddress,
    getRoute,
    interpolateRoute,
    hasToken,
};
