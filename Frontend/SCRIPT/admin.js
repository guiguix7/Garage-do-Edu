// Cuidado para não expor informações sensíveis neste arquivo.
// Este arquivo deve ser protegido e acessível apenas por administradores autorizados.
// Esse é um script front-end, muito cuidado ao adicionar códigos que possam dar vulnerabilidades.
// Para funcionalidades sensíveis, use scripts back-end com as devidas medidas de segurança.

const SELECTORS = {
	adminName: '#admin-name',
	greeting: '.admin-session__greeting',
	sidebar: '.admin-sidebar',
	sidebarToggle: '.admin-toggle',
	sidebarLinks: '.admin-sidebar nav a[href^="#"]',
	headerTop: '.admin-header__top',
	profile: '.admin-profile',
	profileTrigger: '.admin-profile__trigger',
	profileMenu: '.admin-profile__menu',
	filterGroups: '.admin-panel__filters',
	themeToggle: '[data-admin-theme-toggle]',
	refreshButton: '[data-admin-refresh]',
	statusApi: '[data-admin-status="api"]',
	statusAuth: '[data-admin-status="auth"]',
	statusMaintenance: '[data-admin-status="maintenance"]',
	lastUpdate: '[data-admin-last-update]',
	carsTable: '[data-admin-cars]',
	usersTable: '[data-admin-users]',
	partnersTable: '[data-admin-partners]',
	logsList: '[data-admin-logs]',
	feedbackList: '[data-admin-feedback]',
	maintenanceToggle: '[data-admin-maintenance]',
	maintenanceLabel: '[data-admin-maintenance-label]',
	maintenancePages: '[data-maintenance-page]'
};

const STORAGE_KEYS = ['garageAdminName', 'garageUserName', 'garageUser', 'adminName'];
const THEME_STORAGE_KEY = 'garage-do-edu-admin-theme';
const DESKTOP_MEDIA = window.matchMedia('(min-width: 1200px)');
const DEFAULT_ENDPOINTS = {
	auth: 'http://localhost:3000/auth',
	user: 'http://localhost:3000/user',
	cars: 'http://localhost:3000/cars',
	feedback: 'http://localhost:3000/feedback',
	health: 'http://localhost:3000/health'
};

const adminState = {
	closeSidebar: null,
	endpoints: null,
	adminUser: null
};

document.addEventListener('DOMContentLoaded', () => {
	verifyAdminAccess()
		.then((user) => {
			if (!user) {
				return;
			}
			adminState.adminUser = user;
			hydrateSession(user);
			initSidebarToggle();
			initProfileMenu();
			initNavHighlighting();
			initFilterGroups();
			initThemeToggle();
			bindLogout();
			initRefreshButton();
			initMaintenanceToggle();
			initMaintenancePages();
			initAdminActions();
			loadDashboardData();
		})
		.catch((error) => {
			console.warn('Falha ao validar acesso admin.', error);
			setStatusBadge(SELECTORS.statusAuth, 'warning', 'Erro');
			redirectToLogin('admin_access_denied');
		});
});

function getEndpoints() {
	if (adminState.endpoints) {
		return adminState.endpoints;
	}
	const body = document.body;
	const resolve = (value, fallback) => (value ? value.replace(/\/$/, '') : fallback);
	adminState.endpoints = {
		auth: resolve(body?.dataset.authEndpoint, DEFAULT_ENDPOINTS.auth),
		user: resolve(body?.dataset.userEndpoint, DEFAULT_ENDPOINTS.user),
		cars: resolve(body?.dataset.carsEndpoint, DEFAULT_ENDPOINTS.cars),
		feedback: resolve(body?.dataset.feedbackEndpoint, DEFAULT_ENDPOINTS.feedback),
		health: resolve(body?.dataset.healthEndpoint, DEFAULT_ENDPOINTS.health)
	};
	return adminState.endpoints;
}

function getLoginPage() {
	const candidate = document.body?.dataset.loginPage?.trim();
	return candidate || 'login.html';
}

async function verifyAdminAccess() {
	const tokenKey = 'garage-auth-token';
	const sessionKey = 'garage-auth-session';
	const endpoints = getEndpoints();
	const token = readToken(tokenKey);

	if (!token) {
		clearAuthState(tokenKey, sessionKey);
		redirectToLogin('admin_access_denied');
		return null;
	}

	try {
		const response = await fetch(`${endpoints.auth}/me`, {
			method: 'GET',
			headers: {
				Accept: 'application/json',
				Authorization: `Bearer ${token}`
			},
			credentials: 'include'
		});

		if (!response.ok) {
			clearAuthState(tokenKey, sessionKey);
			redirectToLogin('admin_access_denied');
			return null;
		}

		const payload = await response.json();
		if (!payload?.user || payload.user.role !== 'admin') {
			clearAuthState(tokenKey, sessionKey);
			redirectToLogin('admin_access_denied');
			return null;
		}

		setStatusBadge(SELECTORS.statusAuth, 'success', 'Autenticado');
		return payload.user;
	} catch (error) {
		clearAuthState(tokenKey, sessionKey);
		redirectToLogin('admin_access_denied');
		return null;
	}
}

function readToken(tokenKey) {
	try {
		return window.localStorage.getItem(tokenKey);
	} catch (error) {
		return null;
	}
}

function clearAuthState(tokenKey, sessionKey) {
	try {
		window.localStorage.removeItem(tokenKey);
		window.sessionStorage.removeItem(sessionKey);
	} catch (error) {
		console.warn('Nao foi possivel limpar credenciais locais.', error);
	}
}

function redirectToLogin(reason) {
	const query = reason ? `?error=${encodeURIComponent(reason)}` : '';
	window.location.replace(`${getLoginPage()}${query}`);
}

function bindLogout() {
	const button = document.querySelector('[data-admin-logout]');
	if (!button) {
		return;
	}
	button.addEventListener('click', () => {
		clearAuthState('garage-auth-token', 'garage-auth-session');
		redirectToLogin('logged_out');
	});
}

function hydrateSession(user) {
	const nameField = document.querySelector(SELECTORS.adminName);
	const greetingField = document.querySelector(SELECTORS.greeting);
	if (nameField) {
		nameField.textContent = user?.username || readStoredName() || 'Administrador';
	}
	if (greetingField) {
		greetingField.textContent = getGreeting();
	}
}

function readStoredName() {
	try {
		return STORAGE_KEYS.map((key) => window.localStorage.getItem(key)).find(Boolean) || '';
	} catch (error) {
		console.warn('Não foi possível acessar o armazenamento local.', error);
		return '';
	}
}

function getGreeting() {
	const hour = new Date().getHours();
	if (hour < 12) {
		return 'Bom dia,';
	}
	if (hour < 18) {
		return 'Boa tarde,';
	}
	return 'Boa noite,';
}

function initRefreshButton() {
	const buttons = document.querySelectorAll(SELECTORS.refreshButton);
	if (!buttons.length) {
		return;
	}
	buttons.forEach((button) => {
		button.addEventListener('click', () => loadDashboardData());
	});
}

function initMaintenanceToggle() {
	const toggle = document.querySelector(SELECTORS.maintenanceToggle);
	if (!toggle) {
		return;
	}
	toggle.addEventListener('change', () => {
		setMaintenanceState(toggle.checked, getSelectedMaintenancePages());
	});
}

function initMaintenancePages() {
	const checkboxes = document.querySelectorAll(SELECTORS.maintenancePages);
	if (!checkboxes.length) {
		return;
	}
	checkboxes.forEach((checkbox) => {
		checkbox.addEventListener('change', () => {
			const toggle = document.querySelector(SELECTORS.maintenanceToggle);
			const enabled = toggle ? toggle.checked : false;
			setMaintenanceState(enabled, getSelectedMaintenancePages());
		});
	});
}

function initAdminActions() {
	document.addEventListener('click', (event) => {
		const action = event.target.closest('[data-admin-action]');
		if (!action) {
			return;
		}
		const actionName = action.dataset.adminAction;
		const id = action.dataset.adminId;
		if (!actionName || !id) {
			return;
		}
		handleAdminAction(actionName, id, action.dataset.adminValue || null);
	});
}

async function handleAdminAction(actionName, id, value) {
	try {
		const endpoints = getEndpoints();
		if (actionName === 'approve-car') {
			await fetchWithAuth(`${endpoints.cars}/pending/${encodeURIComponent(id)}/approve`, {
				method: 'PUT'
			});
			loadDashboardData();
			return;
		}
		if (actionName === 'delete-car') {
			await fetchWithAuth(`${endpoints.cars}/${encodeURIComponent(id)}`, {
				method: 'DELETE'
			});
			loadDashboardData();
			return;
		}
		if (actionName === 'promote-user') {
			await fetchWithAuth(`${endpoints.user}/${encodeURIComponent(id)}/role`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ role: 'partner' })
			});
			loadDashboardData();
			return;
		}
		if (actionName === 'toggle-user') {
			const nextValue = value === 'true' ? false : true;
			await fetchWithAuth(`${endpoints.user}/${encodeURIComponent(id)}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ isActive: nextValue })
			});
			loadDashboardData();
		}
	} catch (error) {
		console.warn('Falha ao executar acao admin.', error);
	}
}

function initSidebarToggle() {
	const sidebar = document.querySelector(SELECTORS.sidebar);
	const toggle = document.querySelector(SELECTORS.sidebarToggle);
	if (!sidebar || !toggle) {
		return;
	}

	const overlay = ensureSidebarOverlay();
	const openSidebar = () => {
		sidebar.classList.add('is-open');
		toggle.setAttribute('aria-expanded', 'true');
		sidebar.setAttribute('aria-hidden', 'false');
		document.body.classList.add('is-sidebar-open');
		if (overlay) {
			overlay.hidden = false;
			overlay.classList.add('is-visible');
			overlay.setAttribute('aria-hidden', 'false');
		}
	};

	const closeSidebar = ({ restoreFocus = true } = {}) => {
		if (!sidebar.classList.contains('is-open')) {
			return;
		}
		sidebar.classList.remove('is-open');
		toggle.setAttribute('aria-expanded', 'false');
		sidebar.setAttribute('aria-hidden', 'true');
		document.body.classList.remove('is-sidebar-open');
		if (overlay) {
			overlay.classList.remove('is-visible');
			overlay.setAttribute('aria-hidden', 'true');
			const handleTransitionEnd = () => {
				overlay.hidden = true;
			};
			const styles = window.getComputedStyle(overlay);
			const hasTransition = parseFloat(styles.transitionDuration || '0') > 0 || parseFloat(styles.transitionDelay || '0') > 0;
			if (hasTransition) {
				overlay.addEventListener('transitionend', handleTransitionEnd, { once: true });
			} else {
				overlay.hidden = true;
			}
		}
		if (restoreFocus) {
			toggle.focus({ preventScroll: true });
		}
	};

	const toggleSidebar = () => {
		if (sidebar.classList.contains('is-open')) {
			closeSidebar({ restoreFocus: false });
			return;
		}
		openSidebar();
	};

	toggle.addEventListener('click', toggleSidebar);

	if (overlay) {
		overlay.addEventListener('click', () => closeSidebar({ restoreFocus: false }));
	}

	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			closeSidebar({ restoreFocus: false });
		}
	});

	DESKTOP_MEDIA.addEventListener('change', (event) => {
		if (event.matches) {
			closeSidebar({ restoreFocus: false });
		}
	});

	adminState.closeSidebar = closeSidebar;
}

function ensureSidebarOverlay() {
	let overlay = document.querySelector('.admin-sidebar-overlay');
	if (overlay) {
		return overlay;
	}

	overlay = document.createElement('div');
	overlay.className = 'admin-sidebar-overlay';
	overlay.setAttribute('aria-hidden', 'true');
	overlay.hidden = true;
	document.body.appendChild(overlay);
	return overlay;
}

function initProfileMenu() {
	const profile = document.querySelector(SELECTORS.profile);
	if (!profile) {
		return;
	}

	const trigger = profile.querySelector(SELECTORS.profileTrigger);
	const menu = profile.querySelector(SELECTORS.profileMenu);
	if (!trigger || !menu) {
		return;
	}

	const close = (restoreFocus = false) => {
		if (!profile.classList.contains('is-open')) {
			return;
		}
		profile.classList.remove('is-open');
		trigger.setAttribute('aria-expanded', 'false');
		if (restoreFocus) {
			trigger.focus({ preventScroll: true });
		}
	};

	const open = () => {
		profile.classList.add('is-open');
		trigger.setAttribute('aria-expanded', 'true');
	};

	const toggle = () => {
		if (profile.classList.contains('is-open')) {
			close(false);
			return;
		}
		open();
	};

	trigger.addEventListener('click', (event) => {
		event.stopPropagation();
		toggle();
	});

	document.addEventListener('pointerdown', (event) => {
		if (!profile.classList.contains('is-open')) {
			return;
		}
		if (!profile.contains(event.target)) {
			close(false);
		}
	});

	document.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') {
			close(true);
		}
	});
}

function initNavHighlighting() {
	const links = Array.from(document.querySelectorAll(SELECTORS.sidebarLinks));
	if (!links.length) {
		return;
	}

	const sectionsMap = new Map();
	links.forEach((link) => {
		const hash = link.getAttribute('href');
		if (!hash || !hash.startsWith('#')) {
			return;
		}
		const section = document.querySelector(hash);
		if (!section) {
			return;
		}
		const id = section.id;
		if (!sectionsMap.has(id)) {
			sectionsMap.set(id, { section, links: [] });
		}
		sectionsMap.get(id).links.push(link);
	});

	if (!sectionsMap.size) {
		return;
	}

	const observer = new IntersectionObserver((entries) => {
		const visible = entries
			.filter((entry) => entry.isIntersecting)
			.sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
		if (visible) {
			setActiveLink(visible.target.id);
		}
	}, {
		rootMargin: '-45% 0px -45% 0px',
		threshold: [0.2, 0.4, 0.6]
	});

	sectionsMap.forEach(({ section }) => observer.observe(section));

	links.forEach((link) => {
		link.addEventListener('click', (event) => {
			const hash = link.getAttribute('href');
			if (!hash || !hash.startsWith('#')) {
				return;
			}
			const entry = sectionsMap.get(hash.slice(1));
			if (!entry) {
				return;
			}
			event.preventDefault();
			smoothScrollToSection(entry.section);
			setActiveLink(entry.section.id);
			if (adminState.closeSidebar) {
				adminState.closeSidebar({ restoreFocus: false });
			}
		});
	});

	function setActiveLink(id) {
		sectionsMap.forEach(({ links: anchors }, sectionId) => {
			anchors.forEach((anchor) => {
				const isActive = sectionId === id;
				anchor.classList.toggle('is-active', isActive);
				anchor.setAttribute('aria-current', isActive ? 'true' : 'false');
			});
		});
	}
}

function smoothScrollToSection(target) {
	const offset = getHeaderOffset();
	const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - offset);
	window.scrollTo({ top, behavior: 'smooth' });
}

function getHeaderOffset() {
	const header = document.querySelector(SELECTORS.headerTop);
	if (!header) {
		return 24;
	}
	return header.getBoundingClientRect().height + 16;
}

function initFilterGroups() {
	const groups = document.querySelectorAll(SELECTORS.filterGroups);
	if (!groups.length) {
		return;
	}

	groups.forEach((group) => {
		const buttons = Array.from(group.querySelectorAll('.link-button'));
		group.addEventListener('click', (event) => {
			const button = event.target.closest('.link-button');
			if (!button || !group.contains(button)) {
				return;
			}
			buttons.forEach((current) => {
				const isActive = current === button;
				current.classList.toggle('is-active', isActive);
				current.setAttribute('aria-pressed', isActive ? 'true' : 'false');
			});
		});
		buttons.forEach((button) => {
			const isActive = button.classList.contains('is-active');
			button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
		});
	});
}

function initThemeToggle() {
	const toggle = document.querySelector(SELECTORS.themeToggle);
	if (!toggle) {
		return;
	}

	let currentTheme = readStoredTheme();
	applyTheme(currentTheme, toggle);

	toggle.addEventListener('change', () => {
		currentTheme = toggle.checked ? 'light' : 'dark';
		applyTheme(currentTheme, toggle);
		persistTheme(currentTheme);
	});
}

function readStoredTheme() {
	try {
		return window.localStorage.getItem(THEME_STORAGE_KEY) === 'light' ? 'light' : 'dark';
	} catch (error) {
		console.warn('Não foi possível ler o tema salvo.', error);
		return 'dark';
	}
}

function persistTheme(theme) {
	try {
		window.localStorage.setItem(THEME_STORAGE_KEY, theme);
	} catch (error) {
		console.warn('Não foi possível salvar o tema.', error);
	}
}

function applyTheme(theme, toggle) {
	document.body.classList.toggle('admin-theme-light', theme === 'light');
	toggle.checked = theme === 'light';
}

async function loadDashboardData() {
	const endpoints = getEndpoints();
	setLastUpdate(new Date());

	const tasks = await Promise.allSettled([
		fetchHealth(endpoints),
		loadStats(endpoints),
		loadFeedback(endpoints),
		loadCars(endpoints),
		loadUsers(endpoints),
		loadLogs(endpoints),
		loadMaintenance(endpoints)
	]);

	const hasHealthError = tasks[0].status === 'rejected';
	if (hasHealthError) {
		setStatusBadge(SELECTORS.statusApi, 'warning', 'Indisponivel');
	}
}

async function fetchHealth(endpoints) {
	const response = await fetch(endpoints.health, { method: 'GET' });
	if (!response.ok) {
		throw new Error('Health check failed');
	}
	setStatusBadge(SELECTORS.statusApi, 'success', 'Online');
}

async function loadStats(endpoints) {
	try {
		const response = await fetchWithAuth(`${endpoints.user}/stats`, { method: 'GET' });
		const payload = await response.json();
		const stats = payload?.body || {};
		setTextById('available_ads', formatNumber(stats.availableCars));
		setTextById('total_ads', formatNumber(stats.totalCars));
		setTextById('total_customers', formatNumber(stats.totalUsers));
		setTextById('sold_cars', formatNumber(stats.soldCars));
		setTextById('total_partners', formatNumber(stats.partners));
	} catch (error) {
		console.warn('Falha ao carregar estatisticas.', error);
	}
}

async function loadFeedback(endpoints) {
	try {
		const response = await fetch(endpoints.feedback, { method: 'GET' });
		const payload = await response.json();
		const feedback = payload?.body || {};
		const average = Number(feedback.averageRating || 0).toFixed(1);
		setTextById('average_rating', average);
		setTextById('total_reviews', `${formatNumber(feedback.total)} avaliações`);
		setTextById('rating_stars', buildStars(average));
		renderFeedbackList(feedback.result || []);
	} catch (error) {
		console.warn('Falha ao carregar feedback.', error);
	}
}

async function loadCars(endpoints) {
	try {
		const [activeResult, pendingResult] = await Promise.allSettled([
			fetch(`${endpoints.cars}`),
			fetchWithAuth(`${endpoints.cars}/pending`, { method: 'GET' })
		]);

		const activeCars = await resolveCarsResponse(activeResult);
		const pendingCars = await resolveCarsResponse(pendingResult, true);
		const merged = mergeCars(activeCars, pendingCars).slice(0, 6);
		renderCarsTable(merged);
	} catch (error) {
		console.warn('Falha ao carregar anuncios.', error);
		renderCarsTable([]);
	}
}

async function resolveCarsResponse(result, requiresAuth = false) {
	if (!result || result.status === 'rejected') {
		return [];
	}
	const response = result.value;
	if (!response.ok) {
		if (requiresAuth) {
			return [];
		}
		throw new Error('Cars request failed');
	}
	const payload = await response.json();
	const body = payload?.body || {};
	return Array.isArray(body.cars) ? body.cars : [];
}

function mergeCars(activeCars, pendingCars) {
	const annotatedActive = activeCars.map((car) => ({ ...car, status: car.status || 'active' }));
	const annotatedPending = pendingCars.map((car) => ({ ...car, status: car.status || 'pending' }));
	return [...annotatedPending, ...annotatedActive].sort((a, b) => {
		const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
		const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
		return bTime - aTime;
	});
}

async function loadUsers(endpoints) {
	try {
		const response = await fetchWithAuth(`${endpoints.user}`, { method: 'GET' });
		const payload = await response.json();
		const users = Array.isArray(payload?.body?.result) ? payload.body.result : [];
		renderUsersTable(users.filter((user) => user.role === 'client').slice(0, 6));
		renderPartnersTable(users.filter((user) => user.role === 'partner').slice(0, 6));
	} catch (error) {
		console.warn('Falha ao carregar usuarios.', error);
		renderUsersTable([]);
		renderPartnersTable([]);
	}
}

async function loadLogs(endpoints) {
	try {
		const response = await fetchWithAuth(`${endpoints.user}/logs?limit=6`, { method: 'GET' });
		const payload = await response.json();
		const logs = Array.isArray(payload?.body?.result) ? payload.body.result : [];
		renderLogs(logs);
	} catch (error) {
		console.warn('Falha ao carregar logs.', error);
		renderLogs([]);
	}
}

async function loadMaintenance(endpoints) {
	try {
		const response = await fetchWithAuth(`${endpoints.user}/maintenance`, { method: 'GET' });
		const payload = await response.json();
		const enabled = Boolean(payload?.body?.enabled);
		const pages = Array.isArray(payload?.body?.pages) ? payload.body.pages : [];
		applyMaintenanceState(enabled, pages, payload?.body?.updatedAt || null);
	} catch (error) {
		console.warn('Falha ao carregar modo manutencao.', error);
		setStatusBadge(SELECTORS.statusMaintenance, 'warning', 'Indefinido');
	}
}

async function setMaintenanceState(enabled, pages) {
	try {
		const endpoints = getEndpoints();
		const response = await fetchWithAuth(`${endpoints.user}/maintenance`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ enabled: Boolean(enabled), pages: Array.isArray(pages) ? pages : [] })
		});
		if (!response.ok) {
			throw new Error('Maintenance toggle failed');
		}
		const payload = await response.json();
		const nextPages = Array.isArray(payload?.body?.pages) ? payload.body.pages : [];
		applyMaintenanceState(Boolean(payload?.body?.enabled), nextPages, payload?.body?.updatedAt || null);
	} catch (error) {
		console.warn('Falha ao atualizar manutencao.', error);
	}
}

function applyMaintenanceState(enabled, pages, updatedAt) {
	const toggle = document.querySelector(SELECTORS.maintenanceToggle);
	const label = document.querySelector(SELECTORS.maintenanceLabel);
	if (toggle) {
		toggle.checked = enabled;
	}
	setSelectedMaintenancePages(pages);
	if (label) {
		label.textContent = enabled ? 'Ativo' : 'Desativado';
		label.classList.toggle('admin-badge--success', enabled);
		label.classList.toggle('admin-badge--neutral', !enabled);
	}
	setStatusBadge(SELECTORS.statusMaintenance, enabled ? 'success' : 'neutral', enabled ? 'Ativo' : 'Desativado');
	if (updatedAt) {
		setLastUpdate(new Date(updatedAt));
	}
}

function getSelectedMaintenancePages() {
	return Array.from(document.querySelectorAll(SELECTORS.maintenancePages))
		.filter((checkbox) => checkbox.checked)
		.map((checkbox) => checkbox.dataset.maintenancePage)
		.filter(Boolean);
}

function setSelectedMaintenancePages(pages) {
	const selected = new Set(Array.isArray(pages) ? pages : []);
	const checkboxes = document.querySelectorAll(SELECTORS.maintenancePages);
	checkboxes.forEach((checkbox) => {
		checkbox.checked = selected.has(checkbox.dataset.maintenancePage);
	});
}

function renderCarsTable(cars) {
	const body = document.querySelector(SELECTORS.carsTable);
	if (!body) {
		return;
	}
	body.innerHTML = '';
	if (!cars.length) {
		body.appendChild(createEmptyRow(5, 'Nenhum anúncio encontrado.'));
		return;
	}
	cars.forEach((car) => {
		const row = document.createElement('tr');
		row.appendChild(createCell('Veiculo', car.name || 'Sem titulo'));
		row.appendChild(createCell('Categoria', car.brand || 'Nao informado'));
		row.appendChild(createStatusCell('Status', car.status));
		row.appendChild(createCell('Horario', formatDate(car.updatedAt || car.createdAt)));
		row.appendChild(createActionsCell(buildCarActions(car)));
		body.appendChild(row);
	});
}

function renderUsersTable(users) {
	const body = document.querySelector(SELECTORS.usersTable);
	if (!body) {
		return;
	}
	body.innerHTML = '';
	if (!users.length) {
		body.appendChild(createEmptyRow(4, 'Nenhum cliente encontrado.'));
		return;
	}
	users.forEach((user) => {
		const row = document.createElement('tr');
		row.appendChild(createCell('Cliente', user.username || 'Sem nome'));
		row.appendChild(createCell('E-mail', user.email || 'Nao informado'));
		row.appendChild(createStatusCell('Status', user.isActive === false ? 'inactive' : 'active'));
		row.appendChild(createActionsCell(buildUserActions(user)));
		body.appendChild(row);
	});
}

function renderPartnersTable(users) {
	const body = document.querySelector(SELECTORS.partnersTable);
	if (!body) {
		return;
	}
	body.innerHTML = '';
	if (!users.length) {
		body.appendChild(createEmptyRow(4, 'Nenhum parceiro encontrado.'));
		return;
	}
	users.forEach((user) => {
		const row = document.createElement('tr');
		row.appendChild(createCell('Parceiro', user.username || 'Sem nome'));
		row.appendChild(createCell('E-mail', user.email || 'Nao informado'));
		row.appendChild(createStatusCell('Status', user.isActive === false ? 'inactive' : 'active'));
		row.appendChild(createActionsCell(buildUserActions(user)));
		body.appendChild(row);
	});
}

function renderLogs(logs) {
	const list = document.querySelector(SELECTORS.logsList);
	if (!list) {
		return;
	}
	list.innerHTML = '';
	if (!logs.length) {
		const empty = document.createElement('li');
		empty.className = 'admin-empty';
		empty.textContent = 'Nenhuma atividade registrada.';
		list.appendChild(empty);
		return;
	}
	logs.slice(0, 6).forEach((log) => {
		const item = document.createElement('li');
		const time = document.createElement('span');
		time.className = 'admin-timeline__time';
		time.textContent = formatTime(log.createdAt || log.timestamp);
		const content = document.createElement('div');
		content.className = 'admin-timeline__content';
		const title = document.createElement('strong');
		title.textContent = log.action || 'Atividade';
		const description = document.createElement('p');
		description.textContent = formatLogMeta(log);
		content.appendChild(title);
		content.appendChild(description);
		item.appendChild(time);
		item.appendChild(content);
		list.appendChild(item);
	});
}

function renderFeedbackList(items) {
	const list = document.querySelector(SELECTORS.feedbackList);
	if (!list) {
		return;
	}
	list.innerHTML = '';
	if (!items.length) {
		const empty = document.createElement('li');
		empty.className = 'admin-empty';
		empty.textContent = 'Nenhum feedback recebido.';
		list.appendChild(empty);
		return;
	}
	items.slice(0, 4).forEach((item) => {
		const listItem = document.createElement('li');
		const title = document.createElement('strong');
		title.textContent = `Nota ${item.rating || 0}`;
		const message = document.createElement('span');
		message.textContent = item.message || 'Sem mensagem';
		listItem.appendChild(title);
		listItem.appendChild(message);
		list.appendChild(listItem);
	});
}

function buildCarActions(car) {
	const actions = [];
	if (car.status === 'pending') {
		actions.push(createActionButton('Aprovar', 'approve-car', car.id));
	}
	actions.push(createActionButton('Remover', 'delete-car', car.id));
	return actions;
}

function buildUserActions(user) {
	const actions = [];
	if (user.role === 'client') {
		actions.push(createActionButton('Promover', 'promote-user', user._id || user.id));
	}
	if (user.role !== 'admin') {
		const active = user.isActive !== false;
		actions.push(createActionButton(active ? 'Desativar' : 'Ativar', 'toggle-user', user._id || user.id, String(active)));
	}
	return actions;
}

function createActionButton(label, action, id, value) {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'link-button';
	button.textContent = label;
	button.dataset.adminAction = action;
	button.dataset.adminId = id || '';
	if (value !== undefined && value !== null) {
		button.dataset.adminValue = value;
	}
	return button;
}

function createCell(label, value) {
	const cell = document.createElement('td');
	cell.dataset.label = label;
	cell.textContent = value || '--';
	return cell;
}

function createStatusCell(label, status) {
	const cell = document.createElement('td');
	cell.dataset.label = label;
	const pill = document.createElement('span');
	pill.className = `status-pill ${resolveStatusClass(status)}`;
	pill.textContent = formatStatusLabel(status);
	cell.appendChild(pill);
	return cell;
}

function createActionsCell(actions) {
	const cell = document.createElement('td');
	cell.dataset.label = 'Acoes';
	const wrapper = document.createElement('div');
	wrapper.className = 'admin-table__actions';
	actions.forEach((action) => wrapper.appendChild(action));
	cell.appendChild(wrapper);
	return cell;
}

function createEmptyRow(columns, text) {
	const row = document.createElement('tr');
	row.className = 'admin-empty';
	const cell = document.createElement('td');
	cell.colSpan = columns;
	cell.textContent = text;
	row.appendChild(cell);
	return row;
}

function resolveStatusClass(status) {
	if (status === 'active' || status === 'approved') {
		return 'status-pill--success';
	}
	if (status === 'pending') {
		return 'status-pill--warning';
	}
	if (status === 'inactive') {
		return 'status-pill--neutral';
	}
	return 'status-pill--neutral';
}

function formatStatusLabel(status) {
	if (status === 'active') {
		return 'Publicado';
	}
	if (status === 'pending') {
		return 'Revisao';
	}
	if (status === 'inactive') {
		return 'Inativo';
	}
	return 'Indefinido';
}

function setTextById(id, value) {
	const element = document.getElementById(id);
	if (element) {
		element.textContent = value || '0';
	}
}

function formatNumber(value) {
	const safe = Number(value || 0);
	return new Intl.NumberFormat('pt-BR').format(safe);
}

function formatDate(dateValue) {
	if (!dateValue) {
		return '--';
	}
	const date = new Date(dateValue);
	if (Number.isNaN(date.getTime())) {
		return '--';
	}
	return new Intl.DateTimeFormat('pt-BR', {
		dateStyle: 'short',
		timeStyle: 'short'
	}).format(date);
}

function formatTime(dateValue) {
	if (!dateValue) {
		return '--';
	}
	const date = new Date(dateValue);
	if (Number.isNaN(date.getTime())) {
		return '--';
	}
	return new Intl.DateTimeFormat('pt-BR', {
		hour: '2-digit',
		minute: '2-digit'
	}).format(date);
}

function formatLogMeta(log) {
	const action = log.action || 'atividade';
	const actor = log.actorRole ? `(${log.actorRole})` : '';
	const target = log.targetId ? `id ${log.targetId}` : 'sem alvo';
	return `${action} ${actor} - ${target}`.trim();
}

function buildStars(value) {
	const numeric = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
	return `${'★'.repeat(numeric)}${'☆'.repeat(5 - numeric)}`;
}

function setStatusBadge(selector, type, label) {
	const badge = document.querySelector(selector);
	if (!badge) {
		return;
	}
	badge.classList.remove('admin-badge--success', 'admin-badge--warning', 'admin-badge--neutral');
	if (type === 'success') {
		badge.classList.add('admin-badge--success');
	} else if (type === 'warning') {
		badge.classList.add('admin-badge--warning');
	} else {
		badge.classList.add('admin-badge--neutral');
	}
	badge.textContent = label;
}

function setLastUpdate(date) {
	const fields = document.querySelectorAll(SELECTORS.lastUpdate);
	if (!fields.length) {
		return;
	}
	const text = date instanceof Date ? formatDate(date) : '--';
	fields.forEach((field) => {
		field.textContent = text;
	});
}

async function fetchWithAuth(url, options = {}) {
	const token = readToken('garage-auth-token');
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
		clearAuthState('garage-auth-token', 'garage-auth-session');
		redirectToLogin('unauthorized');
		throw new Error('Unauthorized request.');
	}

	return response;
}
