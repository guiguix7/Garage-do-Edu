const BASE_URL = process.env.ADMIN_API_BASE || 'http://localhost:3000';
const TOKEN = process.env.ADMIN_TOKEN || '';

const endpoints = {
	health: `${BASE_URL}/health`,
	stats: `${BASE_URL}/user/stats`,
	logs: `${BASE_URL}/user/logs?limit=2`,
	maintenance: `${BASE_URL}/user/maintenance`,
	pending: `${BASE_URL}/cars/pending`
};

const withAuth = (options = {}) => {
	if (!TOKEN) {
		return options;
	}
	return {
		...options,
		headers: {
			...options.headers,
			Authorization: `Bearer ${TOKEN}`
		}
	};
};

const check = async (label, url, options) => {
	try {
		const response = await fetch(url, options);
		const ok = response.ok ? 'OK' : `FAIL (${response.status})`;
		console.log(`${label}: ${ok}`);
		return response.ok;
	} catch (error) {
		console.log(`${label}: FAIL (${error.message})`);
		return false;
	}
};

const run = async () => {
	await check('Health', endpoints.health, { method: 'GET' });

	if (!TOKEN) {
		console.log('ADMIN_TOKEN nao informado. Testes autenticados foram ignorados.');
		return;
	}

	await check('Stats', endpoints.stats, withAuth({ method: 'GET' }));
	await check('Logs', endpoints.logs, withAuth({ method: 'GET' }));
	await check('Maintenance', endpoints.maintenance, withAuth({ method: 'GET' }));
	await check('Pending Cars', endpoints.pending, withAuth({ method: 'GET' }));
};

run();
