document.addEventListener('DOMContentLoaded', async () => {
	const dom = collectDomReferences();
	const state = createInitialState(dom);

	await initializeInventoryData(dom, state);

	prepareLazyInventoryCards(dom);
	initializeInventory(dom, state);
	initializeRevealAnimations(dom);
	initializeNavigation(dom);
	initializeHeader(dom, state);
	initializeAccountMenu(dom);
	initializeAuthGuards(dom);
	initializeTheme(dom);
	initializeHeroCarousel(dom, state);
	initializeInventoryModal(dom);
	initializeUtilityInteractions(dom);
	initializeCookieConsent(dom);
	initializeFeedbackForm(dom);
	initializeAdCreateForm(dom);
});

const WHATSAPP_NUMBER = '5511963152153';
const WHATSAPP_BASE_URL = `https://wa.me/${WHATSAPP_NUMBER}`;
const DEFAULT_WHATSAPP_MESSAGE = 'Ol%C3%A1%2C%20estou%20no%20site%20da%20Garage%20do%20Edu%20e%20quero%20falar%20com%20voc%C3%AAs.';
const AUTH_SESSION_STORAGE_KEY = 'garage-auth-session';
const AUTH_TOKEN_STORAGE_KEY = 'garage-auth-token';
const COOKIE_CONSENT_STORAGE_KEY = 'garage-cookie-consent';
const COOKIE_CONSENT_VERSION = '1';
const AUTH_DEFAULT_ENDPOINT = 'http://localhost:3000/auth';
const INVENTORY_DEFAULT_ENDPOINT = 'http://localhost:3000/cars';
const INVENTORY_VISIBLE_BATCH = 4;
const INVENTORY_FALLBACK_IMAGE = 'https://placehold.co/960x640?text=Ve%C3%ADculo';
const INVENTORY_FALLBACK_CARD = 'https://placehold.co/600x400?text=Ve%C3%ADculo';

const CURRENCY_FORMATTER = new Intl.NumberFormat('pt-BR', {
	style: 'currency',
	currency: 'BRL'
});

// Utilitários de autenticação e sessão
function getAuthConfig(dom) {
	const candidate = dom.body?.dataset.authEndpoint?.trim() ?? AUTH_DEFAULT_ENDPOINT;
	const normalized = candidate.replace(/\/$/, '');
	const base = normalized || AUTH_DEFAULT_ENDPOINT;

	return {
		base,
		me: `${base}/me`,
		session: `${base}/session`,
		logout: `${base}/logout`
	};
}

function getLoginFallback() {
	const candidate = document.body?.dataset.loginPage?.trim();
	return candidate || 'HTML/login.html';
}

function parseJwt(token) {
	if (!token || typeof token !== 'string') {
		return null;
	}
	const parts = token.split('.');
	if (parts.length !== 3) {
		return null;
	}
	try {
		const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/');
		const padded = normalized.padEnd(normalized.length + (4 - (normalized.length % 4)) % 4, '=');
		const decoded = atob(padded);
		return JSON.parse(decoded);
	} catch (error) {
		console.warn('Failed to decode token payload:', error);
		return null;
	}
}

function getStoredToken() {
	try {
		return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
	} catch (error) {
		console.warn('Unable to read auth token from storage:', error);
		return null;
	}
}

function setStoredToken(token) {
	try {
		if (token) {
			window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
		} else {
			window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
		}
	} catch (error) {
		console.warn('Unable to persist auth token:', error);
	}
}

function getUserFromToken(token) {
	const payload = parseJwt(token);
	if (!payload) {
		return null;
	}

	const now = Math.floor(Date.now() / 1000);
	if (typeof payload.exp === 'number' && payload.exp <= now) {
		return null;
	}

	return normalizeUserPayload({
		id: payload.sub || payload.userId || payload.id,
		email: payload.email,
		role: payload.role,
		username: payload.username
	});
}

function getUser() {
	return getUserFromToken(getStoredToken());
}

function clearAuthState() {
	setStoredToken(null);
	clearStoredAuthSession();
}

async function fetchWithAuth(url, options = {}) {
	const token = getStoredToken();
	const headers = new Headers(options.headers || {});
	if (token) {
		headers.set('Authorization', `Bearer ${token}`);
	}

	const response = await fetch(url, {
		...options,
		credentials: 'include',
		headers
	});

	if (response.status === 401 || response.status === 403) {
		// Revoga sessao no front ao detectar acesso negado.
		clearAuthState();
		window.dispatchEvent(new CustomEvent('garage:auth-logout', { detail: { reason: 'unauthorized' } }));
		const fallback = getLoginFallback();
		if (fallback) {
			window.location.assign(fallback);
		}
		throw new Error('Unauthorized request.');
	}

	return response;
}

function getInventoryConfig(dom) {
	const candidate = dom.body?.dataset.inventoryEndpoint?.trim() ?? INVENTORY_DEFAULT_ENDPOINT;
	const normalized = candidate.replace(/\/$/, '') || INVENTORY_DEFAULT_ENDPOINT;
	const detailPage = dom.body?.dataset.inventoryDetail?.trim() || 'HTML/anuncio.html';

	return {
		base: normalized,
		list: `${normalized}/availables`,
		detail: (carId) => `${normalized}/${encodeURIComponent(carId)}`,
		detailPage
	};
}

function normalizeUserPayload(rawUser) {
	if (!rawUser) {
		return null;
	}

	const rawId = rawUser.id ?? rawUser._id ?? null;
	let id = null;

	if (typeof rawId === 'string') {
		id = rawId;
	} else if (rawId && typeof rawId === 'object' && typeof rawId.toString === 'function') {
		id = rawId.toString();
	}

	return {
		id,
		username: typeof rawUser.username === 'string' ? rawUser.username : '',
		email: typeof rawUser.email === 'string' ? rawUser.email : '',
		role: typeof rawUser.role === 'string' ? rawUser.role : 'client'
	};
}

function persistAuthSession(user) {
	if (!user) {
		return;
	}

	try {
		const payload = {
			user,
			savedAt: new Date().toISOString()
		};
		window.sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(payload));
	} catch (error) {
		console.warn('Unable to persist auth session locally:', error);
	}
}

function readStoredAuthSession() {
	try {
		const raw = window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY);
		if (!raw) {
			return null;
		}
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === 'object' && parsed.user) {
			return parsed;
		}
	} catch (error) {
		console.warn('Stored auth session is invalid and will be discarded:', error);
	}
	return null;
}

function clearStoredAuthSession() {
	try {
		window.sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
	} catch (error) {
		console.warn('Failed to clear stored auth session:', error);
	}
}

async function fetchAccountSession(authConfig) {
	try {
		const token = getStoredToken();
		const endpoint = token ? authConfig.me : authConfig.session;
		const response = token
			? await fetchWithAuth(endpoint, {
				method: 'GET',
				headers: {
					Accept: 'application/json'
				}
			})
			: await fetch(endpoint, {
				method: 'GET',
				credentials: 'include',
				headers: {
					Accept: 'application/json'
				}
			});

		if (response.status === 401 || response.status === 403) {
			clearStoredAuthSession();
			return { status: 'anonymous', user: null, verified: true };
		}

		if (!response.ok) {
			throw new Error(`Session check failed (${response.status}).`);
		}

		const payload = await response.json();
		if (!payload?.success || !payload?.user) {
			throw new Error('Invalid session payload.');
		}

		const user = normalizeUserPayload(payload.user);
		if (!user) {
			throw new Error('Session payload missing user data.');
		}

		persistAuthSession(user);

		return { status: 'authenticated', user, verified: true };
	} catch (error) {
		console.warn('Unable to verify current session:', error);
		return { status: 'anonymous', user: null, verified: false };
	}
}

async function performLogout(authConfig) {
	try {
		const response = await fetch(authConfig.logout, {
			method: 'POST',
			credentials: 'include',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json'
			}
		});
		if (!response.ok && response.status !== 401 && response.status !== 403) {
			throw new Error(`Logout failed (${response.status}).`);
		}
	} catch (error) {
		console.warn('Logout request returned an error:', error);
		throw error;
	} finally {
		clearAuthState();
	}
}

async function logout(authConfig) {
	try {
		await performLogout(authConfig);
	} catch (error) {
		console.warn('Logout failed:', error);
	} finally {
		clearAuthState();
		window.dispatchEvent(new CustomEvent('garage:auth-logout', { detail: { reason: 'manual' } }));
	}
}

function updateAccountMenuItems(items, state) {
	items.forEach((item) => {
		const visibility = item.dataset.accountVisible ?? 'always';
		const requiredRoles = (item.dataset.accountRole ?? '').split(/\s+/).filter(Boolean);

		let isVisible = true;

		if (visibility === 'guest') {
			isVisible = state.status === 'anonymous';
		} else if (visibility === 'authenticated') {
			isVisible = state.status === 'authenticated';
		}

		if (isVisible && requiredRoles.length) {
			const role = state.user?.role ?? '';
			isVisible = state.status === 'authenticated' && requiredRoles.includes(role);
		}

		if (isVisible) {
			item.hidden = false;
			item.removeAttribute('aria-hidden');
			item.classList.remove('is-hidden');
		} else {
			item.hidden = true;
			item.setAttribute('aria-hidden', 'true');
			item.classList.add('is-hidden');
		}
	});
}

function updateAccountTriggerLabel(trigger, labelEl, defaultLabel, state) {
	const baseLabel = trigger.dataset.accountBaseLabel ?? defaultLabel ?? trigger.textContent.trim();
	const target = labelEl ?? trigger;
	let nextLabel = baseLabel;

	if (state.status === 'authenticated' && state.user?.username) {
		const roleLabel = state.user?.role ? ` (${state.user.role})` : '';
		nextLabel = `${baseLabel} - ${state.user.username}${roleLabel}`;
	}

	target.textContent = nextLabel;
	trigger.setAttribute('data-account-state', state.status);
	trigger.setAttribute(
		'aria-label',
		state.status === 'authenticated' && state.user?.username
			? `Abrir menu da conta de ${state.user.username}`
			: 'Abrir menu Minha Conta'
	);
}

function updateUI(dom, state) {
	const { menu, trigger, submenu, items, label } = dom.account || {};
	if (!menu || !trigger || !submenu) {
		return;
	}
	const defaultLabel = trigger.dataset.accountBaseLabel ?? label?.textContent?.trim() ?? trigger.textContent.trim();
	updateAccountMenuItems(Array.isArray(items) ? items : [], state);
	updateAccountTriggerLabel(trigger, label, defaultLabel, state);
}

function collectDomReferences() {
	const brandContainer = document.querySelector('[data-brand-select]');
	const brandPanel = brandContainer?.querySelector('[data-brand-panel]');
	const brandCheckboxes = brandPanel ? Array.from(brandPanel.querySelectorAll('[data-brand-checkbox]')) : [];
	const sortContainer = document.querySelector('[data-sort-select]');
	const sortPanel = sortContainer?.querySelector('[data-sort-panel]');
	const sortRadios = sortPanel ? Array.from(sortPanel.querySelectorAll('[data-sort-radio]')) : [];
	const modalRoot = document.querySelector('[data-car-modal]');
	const accountMenu = document.querySelector('.myacount');
	const accountTrigger = accountMenu?.querySelector('.account-trigger') ?? null;
	const accountSubmenu = accountMenu?.querySelector('.submenu') ?? null;
	const inventoryGrid = document.querySelector('[data-inventory-grid]') ?? document.querySelector('.inventory .car-grid');
	const inventoryStatus = document.querySelector('[data-inventory-status]');
	const inventoryTemplate = document.querySelector('[data-car-card-template]');
	const cookieConsent = document.querySelector('[data-cookie-consent]');

	return {
		body: document.body,
		carCards: Array.from(document.querySelectorAll('.car-card')),
		carGrid: inventoryGrid,
		filters: {
			categoryButtons: Array.from(document.querySelectorAll('.filter[data-filter]')),
			brand: {
				container: brandContainer ?? null,
				toggle: brandContainer?.querySelector('[data-brand-toggle]') ?? null,
				panel: brandPanel ?? null,
				summary: brandContainer?.querySelector('[data-brand-summary]') ?? null,
				checkboxes: brandCheckboxes,
				allCheckbox: brandCheckboxes.find((input) => input.value === 'all') ?? null
			},
			sort: {
				container: sortContainer ?? null,
				toggle: sortContainer?.querySelector('[data-sort-toggle]') ?? null,
				panel: sortPanel ?? null,
				summary: sortContainer?.querySelector('[data-sort-summary]') ?? null,
				radios: sortRadios
			}
		},
		search: {
			input: document.getElementById('search-input'),
			button: document.getElementById('send-search')
		},
		loadMoreButton: document.querySelector('[data-inventory-expand]'),
		loadMoreContainer: document.querySelector('.inventory-view'),
		inventoryEmpty: document.querySelector('[data-inventory-empty]'),
		revealElements: Array.from(document.querySelectorAll('[data-reveal]')),
		inventoryStatus,
		inventoryTemplate,
		planButtons: Array.from(document.querySelectorAll('[data-plan-whatsapp]')),
		navAnchors: Array.from(document.querySelectorAll('.header-nav a[href^="#"], .links-header a[href^="#"]')),
		headerTop: document.querySelector('.header-top'),
		mainHeader: document.querySelector('header > .header'),
		account: {
			menu: accountMenu ?? null,
			trigger: accountTrigger,
			submenu: accountSubmenu,
			label: accountTrigger?.querySelector('[data-account-label]') ?? null,
			items: accountSubmenu ? Array.from(accountSubmenu.querySelectorAll('[data-account-item]')) : [],
			logout: accountSubmenu?.querySelector('[data-account-logout]') ?? null
		},
		themeToggle: document.getElementById('theme-toggle'),
		heroSlides: Array.from(document.querySelectorAll('.hero-slide')),
		modal: {
			root: modalRoot ?? null,
			dialog: modalRoot?.querySelector('[data-car-modal-dialog]') ?? null,
			image: modalRoot?.querySelector('[data-car-modal-image]') ?? null,
			title: modalRoot?.querySelector('[data-car-modal-title]') ?? null,
			price: modalRoot?.querySelector('[data-car-modal-price]') ?? null,
			description: modalRoot?.querySelector('[data-car-modal-description]') ?? null,
			features: modalRoot?.querySelector('[data-car-modal-features]') ?? null,
			whatsapp: modalRoot?.querySelector('[data-car-modal-whatsapp]') ?? null,
			closeControls: Array.from(modalRoot?.querySelectorAll('[data-car-close]') ?? [])
		},
		searchTrigger: document.querySelector('.search-trigger'),
		whatsappButtons: Array.from(document.querySelectorAll('.whatsapp-btn')),
		cookie: {
			container: cookieConsent ?? null,
			accept: cookieConsent?.querySelector('[data-cookie-accept]') ?? document.querySelector('[data-cookie-accept]') ?? null
		},
		auth: {
			restrictedElements: Array.from(document.querySelectorAll('[data-auth-required]'))
		}
	};
}

function createInitialState(dom) {
	const defaultFilter =
		dom.filters.categoryButtons.find((button) => button.classList.contains('active'))?.dataset.filter ?? 'all';
	const initialSearch = dom.search.input?.value.trim() ?? '';
	const defaultSort = dom.filters.sort?.radios.find((radio) => radio.checked)?.value ?? 'newest';

	return {
		activeCategoryFilter: defaultFilter,
		searchTerm: initialSearch,
		selectedBrands: new Set(['all']),
		isBrandPanelOpen: false,
		activeSort: defaultSort,
		isSortPanelOpen: false,
		lastScrollY: window.scrollY,
		headerHideThreshold: 0,
		heroCarouselTimer: null,
		inventory: {
			cars: [],
			map: new Map(),
			normalized: new Map(),
			isLoading: false,
			error: null,
			fetched: false
		},
		visibleCardCount: 0
	};
}

async function initializeInventoryData(dom, state) {
	if (!dom.carGrid || !(dom.inventoryTemplate instanceof HTMLTemplateElement)) {
		return;
	}

	const { list } = getInventoryConfig(dom);
	const statusEl = dom.inventoryStatus;

	const setStatus = (message, variant = 'info') => {
		if (!statusEl) {
			return;
		}
		if (!message) {
			statusEl.textContent = '';
			statusEl.hidden = true;
			delete statusEl.dataset.statusVariant;
			return;
		}
		statusEl.textContent = message;
		statusEl.hidden = false;
		statusEl.dataset.statusVariant = variant;
	};

	try {
		state.inventory.isLoading = true;
		state.inventory.error = null;
		if (statusEl) {
			setStatus('Carregando estoque...', 'loading');
		}

		const response = await fetch(list, {
			method: 'GET',
			credentials: 'include',
			headers: {
				Accept: 'application/json'
			}
		});

		if (!response.ok) {
			throw new Error(`Falha ao carregar estoque (${response.status}).`);
		}

		const payload = await response.json();
		const body = payload?.body ?? payload ?? {};
		const rawCars = Array.isArray(body?.cars)
			? body.cars
			: Array.isArray(body?.result)
				? body.result
				: [];

		state.inventory.cars = rawCars;
		state.inventory.map = new Map(rawCars.map((car, index) => [resolveCarId(car, index), car]));
		state.inventory.fetched = true;

		renderInventoryCards(dom, state, rawCars);

		if (!rawCars.length) {
			if (dom.inventoryEmpty) {
				dom.inventoryEmpty.hidden = false;
				dom.inventoryEmpty.textContent = 'Nenhum veículo disponível no momento.';
			}
			if (statusEl) {
				setStatus('Nenhum veículo disponível no momento.', 'info');
			}
			return;
		}

		if (dom.inventoryEmpty) {
			dom.inventoryEmpty.hidden = true;
		}
		if (statusEl) {
			setStatus('', 'info');
		}
	} catch (error) {
		console.error('Failed to load inventory data:', error);
		state.inventory.error = error;
		state.inventory.fetched = false;
		if (dom.inventoryEmpty) {
			dom.inventoryEmpty.hidden = false;
			dom.inventoryEmpty.textContent = 'Não foi possível carregar o estoque. Tente novamente mais tarde.';
		}
		if (statusEl) {
			setStatus('Não foi possível carregar o estoque. Tente novamente mais tarde.', 'error');
		}
	} finally {
		state.inventory.isLoading = false;
	}
}

function renderInventoryCards(dom, state, cars) {
	if (!dom.carGrid || !(dom.inventoryTemplate instanceof HTMLTemplateElement)) {
		dom.carCards = [];
		return;
	}

	const existingCards = dom.carGrid.querySelectorAll('.car-card');
	existingCards.forEach((card) => card.remove());

	const loadMoreContainer =
		dom.loadMoreContainer && dom.carGrid.contains(dom.loadMoreContainer) ? dom.loadMoreContainer : null;
	const loadMoreButton = loadMoreContainer?.querySelector('[data-inventory-expand]');
	const fragment = document.createDocumentFragment();
	const normalizedCars = cars.map((car, index) => normalizeCarForCard(car, index)).filter(Boolean);
	const inventoryConfig = getInventoryConfig(dom);

	state.inventory.normalized = new Map(normalizedCars.map((car) => [car.id, car]));

	normalizedCars.forEach((car, index) => {
		const templateContent = dom.inventoryTemplate.content.firstElementChild;
		if (!templateContent) {
			return;
		}
		const card = templateContent.cloneNode(true);
		const nameEl = card.querySelector('[data-card-name]');
		const priceEl = card.querySelector('[data-card-price]');
		const imageEl = card.querySelector('[data-card-image]');
		const detailLink = card.querySelector('[data-card-detail]');

		if (nameEl) {
			nameEl.textContent = car.name;
		}

		if (priceEl) {
			priceEl.textContent = car.priceLabel;
		}

		if (imageEl instanceof HTMLImageElement) {
			imageEl.src = car.thumbnail ?? INVENTORY_FALLBACK_CARD;
			imageEl.alt = car.name;
			if (car.heroImage) {
				imageEl.dataset.hero = car.heroImage;
			}
		}

		if (detailLink instanceof HTMLAnchorElement) {
			const detailUrl = `${inventoryConfig.detailPage}?id=${encodeURIComponent(car.id)}`;
			detailLink.href = detailUrl;
			detailLink.dataset.detailUrl = detailUrl;
			detailLink.setAttribute('aria-label', `Ver detalhes do ${car.name}`);
		}

		card.dataset.id = car.id;
		card.dataset.title = car.name;
		card.dataset.price = car.priceLabel;
		card.dataset.priceValue = String(car.priceValue ?? '');
		card.dataset.description = car.description;
		card.dataset.features = car.features.join('|');
		card.dataset.brand = car.brandSlug;
		card.dataset.category = car.categorySlug;
		card.dataset.image = car.heroImage ?? car.thumbnail ?? INVENTORY_FALLBACK_IMAGE;
		card.dataset.thumbnail = car.thumbnail ?? '';
		card.dataset.whatsapp = car.whatsappMessage;
		card.dataset.detailUrl = `${getInventoryConfig(dom).detailPage}?id=${encodeURIComponent(car.id)}`;
		if (car.year) {
			card.dataset.year = String(car.year);
		}

		card.dataset.initialOrder = String(index);

		if (index >= INVENTORY_VISIBLE_BATCH) {
			card.dataset.lazy = 'true';
			card.dataset.lazyState = 'pending';
			card.hidden = true;
		} else {
			card.dataset.lazyState = 'visible';
		}

		fragment.appendChild(card);
	});

	if (loadMoreContainer) {
		dom.carGrid.insertBefore(fragment, loadMoreContainer);
	} else {
		dom.carGrid.append(fragment);
	}

	dom.carCards = Array.from(dom.carGrid.querySelectorAll('.car-card'));
	state.visibleCardCount = dom.carCards.filter((card) => !card.hidden).length;

	const hasHiddenCards = dom.carCards.some((card) => card.dataset.lazyState === 'pending');
	if (loadMoreContainer) {
		loadMoreContainer.hidden = !hasHiddenCards;
		loadMoreContainer.setAttribute('aria-hidden', hasHiddenCards ? 'false' : 'true');
	}
	if (loadMoreButton instanceof HTMLButtonElement) {
		loadMoreButton.disabled = !hasHiddenCards;
	}

	dom.revealElements = Array.from(document.querySelectorAll('[data-reveal]'));
	refreshBrandFilterOptions(dom, state);
}

function refreshBrandFilterOptions(dom, state) {
	const brandDom = dom.filters?.brand;
	if (!brandDom?.panel) {
		return;
	}

	const desiredBrands = new Map();
	state.inventory.normalized.forEach((car) => {
		if (!car?.brandSlug || car.brandSlug === 'all') {
			return;
		}
		if (!desiredBrands.has(car.brandSlug)) {
			desiredBrands.set(car.brandSlug, car.brand || car.brandSlug);
		}
	});

	if (!desiredBrands.size) {
		return;
	}

	const existingValues = new Set((brandDom.checkboxes ?? []).map((checkbox) => checkbox.value.toLowerCase()));
	let addedOption = false;
	const fragment = document.createDocumentFragment();

	Array.from(desiredBrands.entries())
		.sort(([, labelA], [, labelB]) => labelA.localeCompare(labelB, 'pt-BR'))
		.forEach(([slug, label]) => {
			if (existingValues.has(slug.toLowerCase())) {
				return;
			}
			const option = document.createElement('label');
			option.className = 'select-option';
			option.setAttribute('data-brand-option', '');

			const input = document.createElement('input');
			input.type = 'checkbox';
			input.value = slug;
			input.setAttribute('data-brand-checkbox', '');
			input.dataset.brandLabel = label;

			const span = document.createElement('span');
			span.textContent = label;

			option.append(input, span);
			fragment.append(option);
			addedOption = true;
		});

	if (!addedOption) {
		return;
	}

	brandDom.panel.append(fragment);
	brandDom.checkboxes = Array.from(brandDom.panel.querySelectorAll('[data-brand-checkbox]'));
	brandDom.allCheckbox = brandDom.checkboxes.find((input) => input.value === 'all') ?? null;

	brandDom.checkboxes.forEach((checkbox) => {
		if (!checkbox.dataset.brandBound) {
			checkbox.addEventListener('change', () => handleBrandCheckboxChange(checkbox, brandDom, dom, state));
			checkbox.dataset.brandBound = 'true';
		}
	});

	const sanitizedSelections = new Set();
	state.selectedBrands.forEach((value) => {
		if (value === 'all') {
			sanitizedSelections.add('all');
			return;
		}
		const hasOption = brandDom.checkboxes.some((checkbox) => checkbox.value === value);
		if (hasOption) {
			sanitizedSelections.add(value);
		}
	});

	if (!sanitizedSelections.size) {
		sanitizedSelections.add('all');
	}

	if (sanitizedSelections.has('all')) {
		state.selectedBrands = new Set(['all']);
		setBrandsToAll(brandDom, state);
	} else {
		state.selectedBrands = sanitizedSelections;
		brandDom.checkboxes.forEach((checkbox) => {
			if (checkbox.value === 'all') {
				checkbox.checked = false;
				return;
			}
			checkbox.checked = state.selectedBrands.has(checkbox.value);
		});
		if (brandDom.allCheckbox) {
			brandDom.allCheckbox.checked = false;
		}
	}

	updateBrandSummary(brandDom, state);
}

function normalizeCarForCard(rawCar, index = 0) {
	if (!rawCar || typeof rawCar !== 'object') {
		return null;
	}

	const id = resolveCarId(rawCar, index);
	const name = sanitizeText(rawCar.name ?? rawCar.title ?? 'Veículo disponível');
	const brand = sanitizeText(rawCar.brand ?? rawCar.maker ?? '');
	const brandSlug = slugify(brand || 'outros');
	const categoryRaw = sanitizeText(rawCar.category ?? rawCar.type ?? rawCar.segment ?? 'all');
	const categorySlug = categoryRaw ? slugify(categoryRaw) : 'all';
	const description = sanitizeText(
		rawCar.description ?? rawCar.summary ?? rawCar.observations ?? 'Entre em contato para mais informações.'
	);
	const year = rawCar.year ?? rawCar.modelYear ?? null;
	const priceValue =
		typeof rawCar.price === 'number'
			? rawCar.price
			: Number.parseInt(String(rawCar.price ?? '').replace(/[^\d]/g, ''), 10) || null;
	const priceLabel = formatCurrency(priceValue ?? rawCar.price ?? null);
	const whatsappMessage = encodeURIComponent(`Olá, tenho interesse no ${name}. Pode me enviar mais detalhes?`);
	const heroImage = selectPrimaryImage(rawCar, { preferHero: true }) ?? selectPrimaryImage(rawCar);
	const thumbnail = heroImage ?? INVENTORY_FALLBACK_CARD;
	const features = extractCardFeatures(rawCar);

	return {
		id,
		name,
		brand,
		brandSlug,
		category: categoryRaw,
		categorySlug,
		description,
		year,
		priceLabel,
		priceValue,
		whatsappMessage,
		heroImage,
		thumbnail,
		features
	};
}

function resolveCarId(rawCar, fallbackIndex = 0) {
	const rawId = rawCar?.id ?? rawCar?._id ?? rawCar?.uuid ?? rawCar?.slug ?? null;
	if (typeof rawId === 'string' && rawId.trim()) {
		return rawId.trim();
	}
	if (rawId && typeof rawId === 'object' && typeof rawId.toString === 'function') {
		const converted = rawId.toString();
		if (converted && converted !== '[object Object]') {
			return converted;
		}
	}
	return `car-${fallbackIndex}`;
}

function formatCurrency(value) {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return CURRENCY_FORMATTER.format(value);
	}
	if (typeof value === 'string' && value.trim()) {
		return value.trim();
	}
	return 'Consulte';
}

function slugify(value) {
	return sanitizeText(value)
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.trim() || 'all';
}

function sanitizeText(value) {
	if (value === null || value === undefined) {
		return '';
	}
	return String(value).replace(/\s+/g, ' ').trim();
}

function selectPrimaryImage(rawCar, options = {}) {
	const preferHero = Boolean(options.preferHero);
	const media = rawCar?.media ?? {};

	const heroCandidates = [];
	if (preferHero) {
		heroCandidates.push(media.hero);
	}

	const candidates = [
		media.cover,
		rawCar.coverImage,
		...heroCandidates,
		media.gallery,
		rawCar.gallery,
		rawCar.images,
		media.images,
		rawCar.image,
		rawCar.thumbnail
	];

	for (const candidate of candidates) {
		const resolved = resolveImageSource(candidate);
		if (resolved) {
			return resolved;
		}
	}

	return null;
}

function resolveImageSource(entry) {
	if (!entry) {
		return null;
	}
	if (typeof entry === 'string') {
		return entry;
	}
	if (Array.isArray(entry)) {
		for (const item of entry) {
			const resolved = resolveImageSource(item);
			if (resolved) {
				return resolved;
			}
		}
		return null;
	}
	if (typeof entry === 'object') {
		return entry.src ?? entry.url ?? entry.href ?? entry.image ?? null;
	}
	return null;
}

function extractCardFeatures(rawCar) {
	const features = [];
	const specs = (rawCar && typeof rawCar.specs === 'object' && rawCar.specs) ||
		(rawCar && typeof rawCar.characteristics === 'object' && rawCar.characteristics) ||
		null;

	if (specs) {
		for (const [key, value] of Object.entries(specs)) {
			if (!value) {
				continue;
			}
			features.push(`${formatSpecLabel(key)}: ${toReadableValue(value)}`);
			if (features.length >= 6) {
				break;
			}
		}
	}

	if (Array.isArray(rawCar?.features)) {
		rawCar.features.forEach((item) => {
			if (typeof item === 'string' && item.trim()) {
				features.push(item.trim());
			}
		});
	}

	return features.slice(0, 6);
}

function formatSpecLabel(key) {
	const normalized = String(key ?? '')
		.replace(/([A-Z])/g, ' $1')
		.replace(/[_\-]+/g, ' ')
		.trim()
		.toLowerCase();

	const dictionary = {
		engine: 'Motor',
		motor: 'Motor',
		transmission: 'Transmissão',
		gearbox: 'Câmbio',
		fuel: 'Combustível',
		fueltype: 'Combustível',
		fuel_type: 'Combustível',
		mileage: 'Quilometragem',
		km: 'Quilometragem',
		color: 'Cor',
		doors: 'Portas',
		seats: 'Lugares',
		power: 'Potência',
		torque: 'Torque',
		drive: 'Tração'
	};

	if (normalized in dictionary) {
		return dictionary[normalized];
	}

	return normalized
		.split(' ')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
}

function toReadableValue(value) {
	if (typeof value === 'number') {
		return value.toLocaleString('pt-BR');
	}
	return sanitizeText(value);
}

function prepareLazyInventoryCards(dom) {
	dom.carCards.forEach((card, index) => {
		if (!card.dataset.initialOrder) {
			card.dataset.initialOrder = String(index);
		}
		if (card.hasAttribute('data-lazy')) {
			card.dataset.lazyState = card.hidden ? 'pending' : 'visible';
		}
	});
}

// Inventory setup -------------------------------------------------------------
function initializeInventory(dom, state) {
	setupLoadMoreButton(dom, state);
	setupCategoryFilters(dom, state);
	setupBrandFilter(dom, state);
	setupSortFilter(dom, state);
	setupSearchControls(dom, state);

	if (state.searchTerm) {
		revealHiddenCards(dom, { shouldHideButton: false });
	}

	applyInventoryFilters(dom, state);
}

function setupLoadMoreButton(dom, state) {
	if (!dom.loadMoreButton) {
		return;
	}

	dom.loadMoreButton.addEventListener('click', () => {
		revealHiddenCards(dom);
		applyInventoryFilters(dom, state);
	});
}

function setupCategoryFilters(dom, state) {
	const buttons = dom.filters.categoryButtons;
	if (!buttons.length) {
		return;
	}

	const syncButtonStates = () => {
		buttons.forEach((button) => {
			const isActive = (button.dataset.filter ?? 'all') === state.activeCategoryFilter;
			button.classList.toggle('active', isActive);
			button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
		});
	};

	syncButtonStates();

	buttons.forEach((button) => {
		button.addEventListener('click', () => {
			const nextFilter = button.dataset.filter ?? 'all';
			if (nextFilter === state.activeCategoryFilter) {
				return;
			}

			state.activeCategoryFilter = nextFilter;
			syncButtonStates();
			revealHiddenCards(dom);
			applyInventoryFilters(dom, state);
		});
	});
}

function setupBrandFilter(dom, state) {
	const brandDom = dom.filters.brand;
	if (!brandDom.container || !brandDom.checkboxes.length) {
		updateBrandSummary(brandDom, state);
		return;
	}

	setBrandsToAll(brandDom, state);
	updateBrandSummary(brandDom, state);
	closeBrandPanel(brandDom, state);

	brandDom.checkboxes.forEach((checkbox) => {
		if (checkbox.dataset.brandBound) {
			return;
		}
		checkbox.addEventListener('change', () => {
			handleBrandCheckboxChange(checkbox, brandDom, dom, state);
		});
		checkbox.dataset.brandBound = 'true';
	});

	if (brandDom.toggle) {
		brandDom.toggle.addEventListener('click', () => {
			if (state.isBrandPanelOpen) {
				closeBrandPanel(brandDom, state);
			} else {
				closeSortPanel(dom.filters.sort, state);
				openBrandPanel(brandDom, state);
			}
		});

		brandDom.toggle.addEventListener('keydown', (event) => {
			if (event.key === 'ArrowDown' && !state.isBrandPanelOpen) {
				event.preventDefault();
				closeSortPanel(dom.filters.sort, state);
				openBrandPanel(brandDom, state);
			}
			if (event.key === 'Escape' && state.isBrandPanelOpen) {
				event.preventDefault();
				closeBrandPanel(brandDom, state);
			}
		});
	}

	if (brandDom.panel) {
		brandDom.panel.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				closeBrandPanel(brandDom, state);
			}
		});
	}

	document.addEventListener('click', (event) => {
		if (!state.isBrandPanelOpen) {
			return;
		}
		if (brandDom.container && !brandDom.container.contains(event.target)) {
			closeBrandPanel(brandDom, state);
		}
	});

	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && state.isBrandPanelOpen) {
			closeBrandPanel(brandDom, state);
		}
	});
}

function setupSortFilter(dom, state) {
	const sortDom = dom.filters.sort;
	if (!sortDom?.container || !sortDom.radios.length) {
		return;
	}

	syncSortOptionHighlights(sortDom, state);
	updateSortSummary(sortDom, state);
	closeSortPanel(sortDom, state);

	sortDom.radios.forEach((radio) => {
		radio.addEventListener('change', () => {
			if (!radio.checked) {
				return;
			}
			handleSortRadioChange(radio, sortDom, dom, state);
		});
	});

	if (sortDom.toggle) {
		sortDom.toggle.addEventListener('click', () => {
			if (state.isSortPanelOpen) {
				closeSortPanel(sortDom, state);
			} else {
				closeBrandPanel(dom.filters.brand, state);
				openSortPanel(sortDom, state);
			}
		});

		sortDom.toggle.addEventListener('keydown', (event) => {
			if (event.key === 'ArrowDown' && !state.isSortPanelOpen) {
				event.preventDefault();
				closeBrandPanel(dom.filters.brand, state);
				openSortPanel(sortDom, state);
			}
			if (event.key === 'Escape' && state.isSortPanelOpen) {
				event.preventDefault();
				closeSortPanel(sortDom, state);
			}
		});
	}

	if (sortDom.panel) {
		sortDom.panel.addEventListener('keydown', (event) => {
			if (event.key === 'Escape') {
				event.preventDefault();
				closeSortPanel(sortDom, state);
			}
		});
	}

	document.addEventListener('click', (event) => {
		if (!state.isSortPanelOpen) {
			return;
		}
		if (sortDom.container && !sortDom.container.contains(event.target)) {
			closeSortPanel(sortDom, state);
		}
	});

	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && state.isSortPanelOpen) {
			closeSortPanel(sortDom, state);
		}
	});
}

function handleSortRadioChange(radio, sortDom, dom, state) {
	state.activeSort = radio.value;
	syncSortOptionHighlights(sortDom, state);
	updateSortSummary(sortDom, state);
	closeSortPanel(sortDom, state);
	applyInventoryFilters(dom, state);
}

function updateSortSummary(sortDom, state) {
	const target = sortDom.summary ?? sortDom.toggle;
	if (!target) {
		return;
	}

	const activeRadio =
		sortDom.radios.find((input) => input.value === state.activeSort && input.checked) ??
		sortDom.radios.find((input) => input.value === state.activeSort) ??
		sortDom.radios.find((input) => input.checked);

	const label =
		activeRadio?.dataset.sortLabel ??
		activeRadio?.closest('[data-sort-option]')?.querySelector('span')?.textContent ??
		'Mais Recentes';

	target.textContent = label;
}

function syncSortOptionHighlights(sortDom, state) {
	sortDom.radios.forEach((radio) => {
		const shouldBeChecked = radio.value === state.activeSort;
		if (radio.checked !== shouldBeChecked) {
			radio.checked = shouldBeChecked;
		}
		const option = radio.closest('[data-sort-option]');
		if (option) {
			option.classList.toggle('is-active', shouldBeChecked && radio.checked);
			option.setAttribute('aria-selected', shouldBeChecked && radio.checked ? 'true' : 'false');
		}
	});
}

function openSortPanel(sortDom, state) {
	setSortPanelState(sortDom, state, true);
}

function closeSortPanel(sortDom, state) {
	if (!sortDom?.container) {
		state.isSortPanelOpen = false;
		return;
	}
	setSortPanelState(sortDom, state, false);
}

function setSortPanelState(sortDom, state, isOpen) {
	const { toggle, panel, container } = sortDom ?? {};
	state.isSortPanelOpen = Boolean(isOpen);
	if (!toggle || !panel || !container) {
		return;
	}

	toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
	panel.hidden = !isOpen;
	panel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
	container.classList.toggle('is-open', isOpen);

	if (isOpen) {
		window.requestAnimationFrame(() => {
			const firstOption = panel.querySelector('input[type="radio"]');
			if (firstOption instanceof HTMLElement) {
				firstOption.focus();
			}
		});
	} else if (panel.contains(document.activeElement)) {
		window.requestAnimationFrame(() => {
			if (toggle instanceof HTMLElement) {
				toggle.focus();
			}
		});
	}
}

function setupSearchControls(dom, state) {
	const { input, button } = dom.search;

	const submitSearch = () => {
		state.searchTerm = input?.value.trim() ?? '';
		if (state.searchTerm) {
			revealHiddenCards(dom);
		}
		applyInventoryFilters(dom, state);
	};

	if (button) {
		button.addEventListener('click', submitSearch);
	}

	if (input) {
		input.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') {
				event.preventDefault();
				submitSearch();
			}
		});

		input.addEventListener('input', () => {
			if (!input.value.trim()) {
				state.searchTerm = '';
				applyInventoryFilters(dom, state);
			}
		});
	}
}

// Brand filter helpers -------------------------------------------------------
function setBrandsToAll(brandDom, state) {
	state.selectedBrands = new Set(['all']);
	brandDom.checkboxes.forEach((checkbox) => {
		checkbox.checked = checkbox === brandDom.allCheckbox;
	});
}

function openBrandPanel(brandDom, state) {
	setBrandPanelState(brandDom, state, true);
}

function closeBrandPanel(brandDom, state) {
	setBrandPanelState(brandDom, state, false);
}

function setBrandPanelState(brandDom, state, isOpen) {
	const { toggle, panel, container } = brandDom;
	state.isBrandPanelOpen = isOpen;

	if (!toggle || !panel || !container) {
		return;
	}

	toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
	panel.hidden = !isOpen;
	panel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
	container.classList.toggle('is-open', isOpen);

	if (isOpen) {
		window.requestAnimationFrame(() => {
			const firstCheckbox = panel.querySelector('input[type="checkbox"]');
			if (firstCheckbox instanceof HTMLElement) {
				firstCheckbox.focus();
			}
		});
	} else if (panel.contains(document.activeElement)) {
		window.requestAnimationFrame(() => {
			if (toggle instanceof HTMLElement) {
				toggle.focus();
			}
		});
	}
}

function handleBrandCheckboxChange(checkbox, brandDom, dom, state) {
	const value = checkbox.value.toLowerCase();

	if (value === 'all') {
		if (checkbox.checked) {
			setBrandsToAll(brandDom, state);
		} else {
			checkbox.checked = true;
			return;
		}
	} else if (checkbox.checked) {
		state.selectedBrands.delete('all');
		state.selectedBrands.add(value);
		if (brandDom.allCheckbox) {
			brandDom.allCheckbox.checked = false;
		}
	} else {
		state.selectedBrands.delete(value);
	}

	if (state.selectedBrands.size === 0) {
		setBrandsToAll(brandDom, state);
	}

	updateBrandSummary(brandDom, state);
	revealHiddenCards(dom);
	applyInventoryFilters(dom, state);
}

function updateBrandSummary(brandDom, state) {
	const target = brandDom.summary ?? brandDom.toggle;
	if (!target) {
		return;
	}

	if (state.selectedBrands.has('all') || state.selectedBrands.size === 0) {
		target.textContent = 'Todas as marcas';
		return;
	}

	if (state.selectedBrands.size === 1) {
		const [single] = state.selectedBrands;
		target.textContent = getBrandLabel(single, brandDom);
		return;
	}

	target.textContent = `${state.selectedBrands.size} marcas selecionadas`;
}

function getBrandLabel(value, brandDom) {
	const checkbox = brandDom.checkboxes.find((input) => input.value.toLowerCase() === value);
	return checkbox?.dataset.brandLabel ?? value;
}

// Inventory utilities --------------------------------------------------------

function hideLoadMoreContainer(dom) {
	if (!dom.loadMoreButton) {
		return;
	}

	const container = dom.loadMoreButton.closest('.inventory-view');
	if (container) {
		container.setAttribute('hidden', '');
	} else {
		dom.loadMoreButton.setAttribute('hidden', '');
	}
}

function revealHiddenCards(dom, { shouldHideButton = true } = {}) {
	let changed = false;

	dom.carCards.forEach((card) => {
		if (card.dataset.lazyState === 'pending') {
			card.hidden = false;
			card.dataset.lazyState = 'revealed';
			changed = true;
		}
	});

	if (changed && shouldHideButton) {
		hideLoadMoreContainer(dom);
	}

	return changed;
}

function applyInventoryFilters(dom, state) {
	const normalizedTerm = normalizeText(state.searchTerm);
	let visibleCount = 0;

	dom.carCards.forEach((card) => {
		const category = card.dataset.category ?? 'all';
		const brand = (card.dataset.brand ?? 'all').toLowerCase();
		const matchesCategory = state.activeCategoryFilter === 'all' || category === state.activeCategoryFilter;
		const matchesBrand =
			state.selectedBrands.has('all') || state.selectedBrands.size === 0 || state.selectedBrands.has(brand);
		const matchesSearch = !normalizedTerm || cardMatches(card, normalizedTerm);

		let shouldShow = matchesCategory && matchesBrand && matchesSearch;
		if (card.dataset.lazyState === 'pending') {
			shouldShow = false;
		}

		card.hidden = !shouldShow;
		if (shouldShow) {
			visibleCount += 1;
		}
	});

	reorderCarGrid(dom, state);

	if (dom.inventoryEmpty) {
		dom.inventoryEmpty.hidden = visibleCount > 0;
	}
}

function reorderCarGrid(dom, state) {
	const grid = dom.carGrid;
	if (!grid) {
		return;
	}

	const loadMoreContainer = dom.loadMoreContainer && grid.contains(dom.loadMoreContainer) ? dom.loadMoreContainer : null;
	const sortedCards = dom.carCards.slice().sort((a, b) => compareCardsBySort(a, b, state));

	if (loadMoreContainer) {
		grid.removeChild(loadMoreContainer);
	}

	sortedCards.forEach((card) => {
		grid.append(card);
	});

	if (loadMoreContainer) {
		grid.append(loadMoreContainer);
	}
}

function compareCardsBySort(a, b, state) {
	const pendingA = a.dataset.lazyState === 'pending';
	const pendingB = b.dataset.lazyState === 'pending';
	if (pendingA !== pendingB) {
		return pendingA ? 1 : -1;
	}

	const yearA = getCardYearValue(a);
	const yearB = getCardYearValue(b);
	const priceA = getCardPriceValue(a);
	const priceB = getCardPriceValue(b);
	const orderA = Number.parseInt(a.dataset.initialOrder ?? '0', 10) || 0;
	const orderB = Number.parseInt(b.dataset.initialOrder ?? '0', 10) || 0;

	switch (state.activeSort) {
		case 'oldest':
			if (yearA !== yearB) {
				return yearA - yearB;
			}
			break;
		case 'price-low-to-high':
			if (priceA !== priceB) {
				return priceA - priceB;
			}
			break;
		case 'price-high-to-low':
			if (priceA !== priceB) {
				return priceB - priceA;
			}
			break;
		case 'newest':
		default:
			if (yearA !== yearB) {
				return yearB - yearA;
			}
			break;
	}

	return orderA - orderB;
}

function getCardYearValue(card) {
	const datasetYear = card.dataset.year ? Number.parseInt(card.dataset.year, 10) : NaN;
	if (Number.isFinite(datasetYear)) {
		return datasetYear;
	}

	const extractedYear = extractYearFromText(card.dataset.title ?? '') ?? extractYearFromText(card.dataset.description ?? '');
	return extractedYear ?? 0;
}

function extractYearFromText(value) {
	if (!value) {
		return null;
	}
	const match = value.match(/(19|20)\d{2}(?!.*\d)/);
	return match ? Number.parseInt(match[0], 10) : null;
}

function getCardPriceValue(card) {
	const storedValue = card.dataset.priceValue ? Number.parseInt(card.dataset.priceValue, 10) : NaN;
	if (Number.isFinite(storedValue)) {
		return storedValue;
	}

	const rawPrice = card.dataset.price ?? '';
	const digits = rawPrice.replace(/[^\d]/g, '');
	const parsed = digits ? Number.parseInt(digits, 10) : 0;
	card.dataset.priceValue = String(parsed);
	return parsed;
}

function cardMatches(card, term) {
	const searchableFragments = [
		card.dataset.title,
		card.dataset.description,
		card.dataset.features?.split('|').join(' '),
		card.dataset.price
	]
		.filter(Boolean)
		.map((fragment) => normalizeText(fragment));

	return searchableFragments.join(' ').includes(term);
}

function normalizeText(value) {
	return value ? value.toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
}

// Reveal animations ----------------------------------------------------------
function initializeRevealAnimations(dom) {
	if (!dom.revealElements.length) {
		return;
	}

	const revealObserver = new IntersectionObserver(
		(entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					entry.target.classList.add('is-visible');
					revealObserver.unobserve(entry.target);
				}
			});
		},
		{ threshold: 0.15 }
	);

	dom.revealElements.forEach((element, index) => {
		if (!element.style.getPropertyValue('--reveal-delay')) {
			const delay = Math.min(index * 60, 240);
			element.style.setProperty('--reveal-delay', `${delay}ms`);
		}
		revealObserver.observe(element);
	});
}

// Navigation -----------------------------------------------------------------

function initializeNavigation(dom) {
	if (!dom.navAnchors.length) {
		return;
	}

	dom.navAnchors.forEach((link) => {
		link.addEventListener('click', (event) => {
			const hash = link.getAttribute('href');
			if (!hash || hash === '#') {
				return;
			}

			const targetSection = document.querySelector(hash);
			if (!targetSection) {
				return;
			}

			event.preventDefault();
			smoothScrollTo(targetSection, dom);
		});
	});
}

function smoothScrollTo(section, dom) {
	const offset = getHeaderStackHeight(dom);
	const sectionTop = section.getBoundingClientRect().top + window.scrollY;

	window.scrollTo({
		top: Math.max(sectionTop - offset, 0),
		behavior: 'smooth'
	});
}

function getHeaderStackHeight(dom) {
	const topHeight = dom.headerTop ? dom.headerTop.offsetHeight : 0;
	const mainHeight = dom.mainHeader ? dom.mainHeader.offsetHeight : 0;
	return topHeight + mainHeight;
}

// Header behaviour -----------------------------------------------------------

function initializeHeader(dom, state) {
	const { headerTop } = dom;
	if (!headerTop) {
		return;
	}

	const updateHeaderMetrics = () => {
		const headerHeight = headerTop.offsetHeight;
		state.headerHideThreshold = Math.max(headerHeight, 48);
		document.documentElement.style.setProperty('--header-top-offset', `${headerHeight}px`);
	};

	updateHeaderMetrics();
	window.addEventListener('resize', updateHeaderMetrics);
	window.addEventListener('load', updateHeaderMetrics, { once: true });

	const handleScroll = () => {
		const currentScrollY = window.scrollY;
		const scrollingDown = currentScrollY > state.lastScrollY;

		if (currentScrollY > state.headerHideThreshold && scrollingDown) {
			headerTop.classList.add('header-top--hidden');
		} else {
			headerTop.classList.remove('header-top--hidden');
		}

		state.lastScrollY = currentScrollY;
	};

	window.addEventListener('scroll', handleScroll, { passive: true });
}

// Account menu ---------------------------------------------------------------

function initializeAccountMenu(dom) {
	const { menu, trigger, submenu, items, label, logout } = dom.account;
	const hasMenu = Boolean(menu && trigger && submenu);

	const authConfig = getAuthConfig(dom);
	const defaultLabel = hasMenu
		? trigger.dataset.accountBaseLabel ?? label?.textContent?.trim() ?? trigger.textContent.trim()
		: 'Minha Conta';
	const safeItems = hasMenu && Array.isArray(items) ? items : [];
	const pageBody = dom.body instanceof HTMLElement ? dom.body : document.body;

	const notifyAccountStateChange = (state) => {
		if (pageBody) {
			pageBody.dataset.accountStatus = state?.status ?? 'unknown';
			if (state?.user?.role) {
				pageBody.dataset.accountRole = state.user.role;
			} else {
				delete pageBody.dataset.accountRole;
			}
			if (typeof state?.verified === 'boolean') {
				pageBody.dataset.accountVerified = String(state.verified);
			} else {
				delete pageBody.dataset.accountVerified;
			}
		}

		try {
			window.dispatchEvent(new CustomEvent('garage:auth-state', { detail: state }));
		} catch (error) {
			console.warn('Failed to dispatch auth state event:', error);
		}
	};

	const applyAccountState = (state) => {
		if (!hasMenu) {
			return;
		}
		updateAccountMenuItems(safeItems, state);
		updateAccountTriggerLabel(trigger, label, defaultLabel, state);
	};

	let currentAccountState = { status: 'anonymous', user: null, verified: false };
	const setAccountState = (nextState) => {
		currentAccountState = nextState;
		applyAccountState(nextState);
		notifyAccountStateChange(nextState);
	};

	if (hasMenu) {
		trigger.setAttribute('aria-expanded', 'false');
	}
	setAccountState(currentAccountState);

	const storedSession = readStoredAuthSession();
	const storedUser = storedSession?.user ? normalizeUserPayload(storedSession.user) : null;
	if (storedUser?.username) {
		setAccountState({ status: 'authenticated', user: storedUser, verified: false, source: 'storage' });
	} else {
		const tokenUser = getUserFromToken(getStoredToken());
		if (tokenUser) {
			setAccountState({ status: 'authenticated', user: tokenUser, verified: false, source: 'token' });
		}
	}

	let closeMenu = () => { };
	let openMenu = () => { };

	if (hasMenu) {
		closeMenu = () => {
			menu.classList.remove('is-open');
			trigger.setAttribute('aria-expanded', 'false');
		};

		openMenu = () => {
			menu.classList.add('is-open');
			trigger.setAttribute('aria-expanded', 'true');
			const focusableSelector = [
				'[data-account-item]:not([hidden]) a[href]',
				'[data-account-item]:not([hidden]) button:not([disabled])',
				'[data-account-item]:not([hidden]) input:not([disabled])',
				'[data-account-item]:not([hidden]) [tabindex]:not([tabindex="-1"])'
			].join(', ');
			const firstMenuItem = submenu?.querySelector(focusableSelector);
			if (firstMenuItem instanceof HTMLElement) {
				window.requestAnimationFrame(() => firstMenuItem.focus());
			}
		};

		trigger.addEventListener('click', () => {
			if (menu.classList.contains('is-open')) {
				closeMenu();
			} else {
				openMenu();
			}
		});

		trigger.addEventListener('keydown', (event) => {
			if (event.key === 'ArrowDown') {
				event.preventDefault();
				openMenu();
			}
			if (event.key === 'Escape') {
				closeMenu();
			}
		});

		document.addEventListener('click', (event) => {
			if (!menu.contains(event.target)) {
				closeMenu();
			}
		});

		document.addEventListener('keydown', (event) => {
			if (event.key === 'Escape' && menu.classList.contains('is-open')) {
				closeMenu();
				trigger.focus();
			}
		});
	}

	if (logout instanceof HTMLButtonElement) {
		logout.addEventListener('click', async () => {
			if (logout.disabled) {
				return;
			}
			logout.disabled = true;
			closeMenu();
			await logout(authConfig);
			setAccountState({ status: 'anonymous', user: null, verified: true });
			logout.disabled = false;
			if (hasMenu) {
				trigger.focus();
			}
		});
	}

	void fetchAccountSession(authConfig).then((resolvedState) => {
		if (resolvedState.status === 'authenticated') {
			setAccountState(resolvedState);
			return;
		}

		if (resolvedState.status === 'anonymous' && resolvedState.verified) {
			setAccountState(resolvedState);
			return;
		}

		if (resolvedState.status === 'anonymous' && !resolvedState.verified && currentAccountState.status !== 'authenticated') {
			setAccountState(resolvedState);
		}
	});
}

// Auth guards ----------------------------------------------------------------

function initializeAuthGuards(dom) {
	const restrictedElements = Array.isArray(dom.auth?.restrictedElements)
		? dom.auth.restrictedElements.filter((element) => element instanceof HTMLElement)
		: [];
	if (!restrictedElements.length) {
		return;
	}

	const loginFallback = dom.body?.dataset.loginPage?.trim() || 'HTML/login.html';
	const requireAuthPattern = /^(auth|authenticated|true|yes)$/i;

	const parseRoles = (value) =>
		(value || '')
			.split(',')
			.map((role) => role.trim().toLowerCase())
			.filter(Boolean);

	const isAuthenticated = (state) => state?.status === 'authenticated';

	const isAccessGranted = (element, state) => {
		const requirement = (element.dataset.authRequired || '').trim().toLowerCase();
		const allowedRoles = parseRoles(element.dataset.authRoles);

		if (requireAuthPattern.test(requirement)) {
			if (!isAuthenticated(state)) {
				return false;
			}
		}

		if (requirement === 'guest') {
			return !isAuthenticated(state);
		}

		if (allowedRoles.length) {
			if (!isAuthenticated(state)) {
				return false;
			}
			const userRole = (state?.user?.role || '').trim().toLowerCase();
			if (!allowedRoles.includes(userRole)) {
				return false;
			}
		}

		return true;
	};

	const resolveFallback = (element) => element.dataset.authFallback?.trim() || loginFallback;

	const ensureDestination = (element) => {
		if (!(element instanceof HTMLAnchorElement)) {
			return;
		}
		if (!element.dataset.authDestination) {
			const currentHref = element.getAttribute('href');
			if (currentHref) {
				element.dataset.authDestination = currentHref;
			}
		}
	};

	const updateElementState = (element, state) => {
		ensureDestination(element);
		const allowed = isAccessGranted(element, state);
		element.dataset.authState = allowed ? 'allowed' : 'blocked';

		if (element instanceof HTMLAnchorElement) {
			const desiredDestination = element.dataset.authDestination?.trim();
			const fallback = resolveFallback(element);
			if (allowed && desiredDestination) {
				element.setAttribute('href', desiredDestination);
			} else if (!allowed && fallback) {
				element.setAttribute('href', fallback);
			}
		}

		if ((element instanceof HTMLButtonElement || element instanceof HTMLInputElement) && element.type === 'button') {
			const disableWhenBlocked = element.dataset.authDisable !== 'false';
			if (disableWhenBlocked) {
				element.disabled = !allowed;
			}
		}

		if (allowed) {
			delete element.dataset.authDeniedAt;
		} else {
			element.dataset.authDeniedAt = new Date().toISOString();
		}
	};

	let currentState = {
		status: dom.body?.dataset.accountStatus || 'anonymous',
		user: null,
		verified: dom.body?.dataset.accountVerified === 'true'
	};

	const redirectToFallback = (element) => {
		const fallback = resolveFallback(element) || loginFallback;
		if (fallback) {
			window.location.assign(fallback);
		}
	};

	const handleRestrictedInteraction = (event) => {
		const element = event.currentTarget;
		if (!(element instanceof HTMLElement)) {
			return;
		}

		if (isAccessGranted(element, currentState)) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		const message = element.dataset.authMessage || 'É necessário estar logado para acessar esta funcionalidade.';
		if (message) {
			window.alert(message);
		}
		redirectToFallback(element);
	};

	restrictedElements.forEach((element) => {
		updateElementState(element, currentState);
		const eventName = element instanceof HTMLFormElement ? 'submit' : 'click';
		element.addEventListener(eventName, handleRestrictedInteraction);
	});

	const handleAuthStateChange = (state) => {
		if (!state) {
			return;
		}
		currentState = state;
		restrictedElements.forEach((element) => updateElementState(element, currentState));
	};

	window.addEventListener('garage:auth-state', (event) => {
		handleAuthStateChange(event.detail);
	});

	window.addEventListener('garage:auth-logout', () => {
		const fallback = loginFallback || 'HTML/login.html';
		window.location.assign(fallback);
	});
}

// Cookie consent ------------------------------------------------------------

function initializeCookieConsent(dom) {
	const container = dom.cookie?.container instanceof HTMLElement ? dom.cookie.container : null;
	if (!container) {
		return;
	}

	const acceptControls = Array.from(container.querySelectorAll('[data-cookie-accept]'));
	const configureControl = container.querySelector('[data-cookie-configure]');
	const rejectControl = container.querySelector('[data-cookie-reject]');
	const panel = container.querySelector('[data-cookie-panel]');
	const pageBody = dom.body instanceof HTMLElement ? dom.body : document.body;

	const readStoredConsent = () => {
		try {
			const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
			if (!raw) {
				return null;
			}
			const parsed = JSON.parse(raw);
			if (parsed && typeof parsed === 'object' && parsed.status && parsed.version === COOKIE_CONSENT_VERSION) {
				return parsed;
			}
		} catch (error) {
			console.warn('Stored cookie consent payload is invalid and will be ignored:', error);
		}
		return null;
	};

	const dispatchConsentEvent = (detail) => {
		try {
			window.dispatchEvent(new CustomEvent('garage:cookie-consent', { detail }));
		} catch (error) {
			console.warn('Failed to notify cookie consent change:', error);
		}
	};

	const setBodyState = (state) => {
		if (!pageBody) {
			return;
		}
		pageBody.dataset.cookieConsent = state;
	};

	const hideBanner = (source, status) => {
		container.hidden = true;
		container.classList.remove('is-visible');
		container.setAttribute('aria-hidden', 'true');
		setBodyState(status);
		dispatchConsentEvent({ status, source });
		if (status === 'accepted') {
			try {
				window.dispatchEvent(new CustomEvent('garage:analytics-allowed', { detail: { source } }));
			} catch (error) {
				console.warn('Failed to notify analytics consent:', error);
			}
		}
	};

	const storeConsent = (payload) => {
		try {
			window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify({
				...payload,
				version: COOKIE_CONSENT_VERSION
			}));
		} catch (error) {
			console.warn('Failed to persist cookie consent decision:', error);
		}
	};

	const acceptConsent = (source) => {
		storeConsent({
			status: 'accepted',
			decidedAt: new Date().toISOString(),
			preferences: { analytics: true, marketing: true }
		});
		hideBanner(source, 'accepted');
	};

	const rejectConsent = (source) => {
		storeConsent({
			status: 'rejected',
			decidedAt: new Date().toISOString(),
			preferences: { analytics: false, marketing: false }
		});
		hideBanner(source, 'rejected');
	};

	const saveCustomConsent = (source) => {
		storeConsent({
			status: 'custom',
			decidedAt: new Date().toISOString(),
			preferences: { analytics: false, marketing: false }
		});
		hideBanner(source, 'custom');
	};

	const showBanner = () => {
		container.hidden = false;
		container.classList.add('is-visible');
		container.setAttribute('aria-hidden', 'false');
		setBodyState('pending');
		dispatchConsentEvent({ status: 'pending', source: 'banner' });
	};

	const storedConsent = readStoredConsent();
	if (storedConsent) {
		hideBanner('storage', storedConsent.status || 'accepted');
		return;
	}

	showBanner();
	if (panel instanceof HTMLElement) {
		panel.hidden = true;
		panel.setAttribute('aria-hidden', 'true');
	}

	acceptControls.forEach((control) => {
		control.addEventListener('click', () => {
			if (panel instanceof HTMLElement && panel.contains(control)) {
				saveCustomConsent('interaction');
				return;
			}
			acceptConsent('interaction');
		});
	});

	if (rejectControl instanceof HTMLElement) {
		rejectControl.addEventListener('click', () => rejectConsent('interaction'));
	}
	if (configureControl instanceof HTMLElement) {
		configureControl.addEventListener('click', () => {
			if (!(panel instanceof HTMLElement)) {
				return;
			}
			const nextState = panel.hidden;
			panel.hidden = !nextState;
			panel.setAttribute('aria-hidden', nextState ? 'false' : 'true');
			container.classList.toggle('is-configuring', nextState);
		});
	}
}

// Feedback form -------------------------------------------------------------

function getFeedbackConfig(dom) {
	const candidate = dom.body?.dataset.feedbackEndpoint?.trim();
	return {
		base: candidate || 'http://localhost:3000/feedback'
	};
}

function initializeFeedbackForm(dom) {
	const form = document.querySelector('[data-feedback-form]');
	if (!(form instanceof HTMLFormElement)) {
		return;
	}

	const messageBox = form.querySelector('[data-feedback-message]');
	const { base } = getFeedbackConfig(dom);

	const showMessage = (text, variant = 'info') => {
		if (!messageBox) {
			return;
		}
		messageBox.textContent = text;
		messageBox.hidden = false;
		messageBox.dataset.variant = variant;
	};

	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		if (messageBox) {
			messageBox.hidden = true;
		}

		const ratingValue = Number(form.querySelector('[name="rating"]')?.value || 0);
		const messageValue = String(form.querySelector('[name="message"]')?.value || '').trim();
		if (!ratingValue || ratingValue < 1 || ratingValue > 5) {
			showMessage('Selecione uma nota valida.', 'error');
			return;
		}
		if (messageValue.length < 10 || messageValue.length > 1000) {
			showMessage('O comentario deve ter entre 10 e 1000 caracteres.', 'error');
			return;
		}

		try {
			const response = await fetchWithAuth(base, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json'
				},
				body: JSON.stringify({ rating: ratingValue, message: messageValue })
			});

			if (!response.ok) {
				const payload = await response.json().catch(() => null);
				const errorMessage = payload?.message || 'Nao foi possivel enviar o feedback.';
				showMessage(errorMessage, 'error');
				return;
			}

			form.reset();
			showMessage('Feedback enviado com sucesso.', 'success');
		} catch (error) {
			showMessage('Falha ao enviar feedback. Tente novamente.', 'error');
		}
	});
}

// Ad create form ------------------------------------------------------------

function initializeAdCreateForm(dom) {
	const form = document.querySelector('[data-ad-form]');
	if (!(form instanceof HTMLFormElement)) {
		return;
	}

	const messageBox = form.querySelector('[data-ad-message]');
	const inventoryConfig = getInventoryConfig(dom);

	const showMessage = (text, variant = 'info') => {
		if (!messageBox) {
			return;
		}
		messageBox.textContent = text;
		messageBox.hidden = false;
		messageBox.dataset.variant = variant;
	};

	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		if (messageBox) {
			messageBox.hidden = true;
		}

		const user = getUser();
		if (!user) {
			showMessage('E necessario estar logado para enviar anuncios.', 'error');
			return;
		}

		const payload = {
			name: String(form.querySelector('[name="name"]')?.value || '').trim(),
			brand: String(form.querySelector('[name="brand"]')?.value || '').trim(),
			year: Number(form.querySelector('[name="year"]')?.value || 0),
			price: Number(form.querySelector('[name="price"]')?.value || 0),
			color: String(form.querySelector('[name="color"]')?.value || '').trim(),
			description: String(form.querySelector('[name="description"]')?.value || '').trim()
		};

		if (!payload.name || !payload.brand || !payload.color || !payload.description) {
			showMessage('Preencha todos os campos obrigatorios.', 'error');
			return;
		}
		if (!payload.year || payload.year < 1886) {
			showMessage('Informe um ano valido.', 'error');
			return;
		}
		if (payload.price < 0) {
			showMessage('Informe um preco valido.', 'error');
			return;
		}

		const isPartner = user.role === 'partner' || user.role === 'admin';
		const endpoint = isPartner ? inventoryConfig.base : `${inventoryConfig.base}/pending`;
		const successMessage = isPartner ? 'Publicado com sucesso.' : 'Anuncio enviado para revisao.';

		try {
			const response = await fetchWithAuth(endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'application/json'
				},
				body: JSON.stringify(payload)
			});

			if (!response.ok) {
				const data = await response.json().catch(() => null);
				const errorMessage = data?.message || 'Nao foi possivel enviar o anuncio.';
				showMessage(errorMessage, 'error');
				return;
			}

			form.reset();
			showMessage(successMessage, 'success');
		} catch (error) {
			showMessage('Falha ao enviar anuncio. Tente novamente.', 'error');
		}
	});
}

// Theme toggle ---------------------------------------------------------------

function initializeTheme(dom) {
	const { themeToggle } = dom;

	const applyTheme = (theme) => {
		const normalizedTheme = theme === 'light' ? 'light' : 'dark';
		document.documentElement.setAttribute('data-theme', normalizedTheme);
		if (themeToggle instanceof HTMLInputElement) {
			themeToggle.checked = normalizedTheme === 'light';
		}
	};

	const detectPreferredTheme = () =>
		window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';

	const storedTheme = window.localStorage.getItem('gde-theme');
	applyTheme(storedTheme ?? detectPreferredTheme());

	if (themeToggle instanceof HTMLInputElement) {
		themeToggle.addEventListener('change', () => {
			const nextTheme = themeToggle.checked ? 'light' : 'dark';
			applyTheme(nextTheme);
			window.localStorage.setItem('gde-theme', nextTheme);
		});
	}

	window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (event) => {
		const stored = window.localStorage.getItem('gde-theme');
		if (stored) {
			return;
		}
		applyTheme(event.matches ? 'light' : 'dark');
	});
}

// Hero carousel --------------------------------------------------------------

function initializeHeroCarousel(dom, state) {
	const { heroSlides } = dom;
	if (heroSlides.length <= 1) {
		return;
	}

	let activeIndex = heroSlides.findIndex((slide) => slide.classList.contains('active'));
	if (activeIndex < 0) {
		activeIndex = 0;
		heroSlides[0].classList.add('active');
	}

	const setActiveSlide = (nextIndex) => {
		heroSlides[activeIndex].classList.remove('active');
		heroSlides[nextIndex].classList.add('active');
		activeIndex = nextIndex;
	};

	const stopCarousel = () => {
		if (state.heroCarouselTimer) {
			window.clearInterval(state.heroCarouselTimer);
			state.heroCarouselTimer = null;
		}
	};

	const startCarousel = () => {
		stopCarousel();
		state.heroCarouselTimer = window.setInterval(() => {
			const nextIndex = (activeIndex + 1) % heroSlides.length;
			setActiveSlide(nextIndex);
		}, 7000);
	};

	document.addEventListener('visibilitychange', () => {
		if (document.hidden) {
			stopCarousel();
		} else {
			startCarousel();
		}
	});

	startCarousel();
}

// Inventory modal ------------------------------------------------------------
function initializeInventoryModal(dom) {
	const { modal } = dom;
	if (!modal.root || !modal.dialog || !dom.carCards.length) {
		return;
	}

	let lastFocusedElement = null;

	const getFocusableElements = () => {
		if (!modal.dialog) {
			return [];
		}

		const selectors = [
			'a[href]',
			'button:not([disabled])',
			'textarea:not([disabled])',
			'input:not([type="hidden"]):not([disabled])',
			'select:not([disabled])'
		];

		return Array.from(modal.dialog.querySelectorAll(selectors.join(','))).filter(
			(el) => el.offsetParent !== null
		);
	};

	const trapFocus = (event) => {
		if (event.key !== 'Tab' || !modal.root.classList.contains('is-open')) {
			return;
		}

		const focusable = getFocusableElements();
		if (!focusable.length) {
			event.preventDefault();
			return;
		}

		const first = focusable[0];
		const last = focusable[focusable.length - 1];

		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	};

	const populateModal = (card) => {
		if (!modal.image || !modal.title || !modal.price || !modal.description || !modal.features || !modal.whatsapp) {
			return;
		}

		const { title, price, description, features = '', image = '', whatsapp } = card.dataset;

		modal.image.src = image || 'https://placehold.co/1280x720?text=Imagem+indisponivel';
		modal.image.alt = title ? `Imagem do ${title}` : 'Imagem do ve�culo selecionado';
		modal.title.textContent = title ?? 'Ve�culo dispon�vel';
		modal.price.textContent = price ?? '';
		modal.description.textContent = description ?? 'Entre em contato para mais informa��es.';

		modal.features.innerHTML = '';
		features
			.split('|')
			.map((feature) => feature.trim())
			.filter(Boolean)
			.forEach((feature) => {
				const li = document.createElement('li');
				li.textContent = feature;
				modal.features.appendChild(li);
			});

		const whatsappMessage = whatsapp ? `?text=${whatsapp}` : '';
		modal.whatsapp.href = `${WHATSAPP_BASE_URL}${whatsappMessage}`;
		modal.whatsapp.textContent = title ? 'Quero Esse' : 'Falar no WhatsApp';
	};

	const closeModal = () => {
		modal.root.classList.remove('is-open');
		modal.root.setAttribute('aria-hidden', 'true');
		dom.body.classList.remove('modal-open');

		document.removeEventListener('keydown', trapFocus);

		if (lastFocusedElement instanceof HTMLElement) {
			lastFocusedElement.focus();
		}
	};

	const openModal = (card) => {
		populateModal(card);

		lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

		modal.root.classList.add('is-open');
		modal.root.setAttribute('aria-hidden', 'false');
		dom.body.classList.add('modal-open');

		const focusable = getFocusableElements();
		const firstFocusable = focusable[0] ?? modal.dialog;
		window.requestAnimationFrame(() => {
			if (firstFocusable instanceof HTMLElement) {
				firstFocusable.focus();
			}
		});

		document.addEventListener('keydown', trapFocus);
	};

	dom.carCards.forEach((card) => {
		const triggers = Array.from(card.querySelectorAll('[data-car-trigger]'));
		if (!triggers.length) {
			return;
		}

		triggers.forEach((trigger) => {
			trigger.addEventListener('click', (event) => {
				event.preventDefault();
				openModal(card);
			});
		});
	});

	modal.closeControls.forEach((control) => {
		control.addEventListener('click', closeModal);
	});

	modal.root.addEventListener('click', (event) => {
		if (event.target === modal.root) {
			closeModal();
		}
	});

	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape' && modal.root.classList.contains('is-open')) {
			closeModal();
		}
	});
}

// Miscellaneous interactions -------------------------------------------------

function initializeUtilityInteractions(dom) {
	setupPlanButtons(dom);
	setupSearchTrigger(dom);
	setupWhatsappButtons(dom);
}

function setupPlanButtons(dom) {
	if (!dom.planButtons.length) {
		return;
	}

	dom.planButtons.forEach((button) => {
		button.addEventListener('click', () => {
			const message = button.dataset.planWhatsapp ?? '';
			const url = `${WHATSAPP_BASE_URL}${message ? `?text=${message}` : ''}`;
			window.open(url, '_blank', 'noopener');
		});
	});
}

function setupSearchTrigger(dom) {
	if (!dom.searchTrigger) {
		return;
	}

	dom.searchTrigger.addEventListener('click', () => {
		document.querySelector('.inventory')?.scrollIntoView({ behavior: 'smooth' });
	});
}

function setupWhatsappButtons(dom) {
	if (!dom.whatsappButtons.length) {
		return;
	}

	dom.whatsappButtons.forEach((button) => {
		button.addEventListener('click', () => {
			const url = `${WHATSAPP_BASE_URL}?text=${DEFAULT_WHATSAPP_MESSAGE}`;
			window.open(url, '_blank', 'noopener');
		});
	});
}