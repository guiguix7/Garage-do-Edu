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
	periodSelect: '[data-admin-period]',
	alertsList: '[data-admin-alerts]',
	tasksList: '[data-admin-tasks]',
	carsTable: '[data-admin-cars]',
	stockTable: '[data-admin-stock]',
	usersTable: '[data-admin-users]',
	partnersTable: '[data-admin-partners]',
	adminsTable: '[data-admin-admins]',
	leadsTable: '[data-admin-leads]',
	leadsVisits: '[data-admin-leads-visits]',
	leadsCount: '[data-admin-leads-count]',
	leadsSales: '[data-admin-leads-sales]',
	leadsSource: '[data-admin-leads-source]',
	leadsStatus: '[data-admin-leads-status]',
	leadsChannel: '[data-admin-leads-channel]',
	leadsExport: '[data-admin-leads-export]',
	financeRevenue: '[data-admin-finance-revenue]',
	financeRevenueTrend: '[data-admin-finance-revenue-trend]',
	financeCommissions: '[data-admin-finance-commissions]',
	financeCommissionsCount: '[data-admin-finance-commissions-count]',
	financeTable: '[data-admin-commissions]',
	financeExport: '[data-admin-finance-export]',
	pagesTable: '[data-admin-pages]',
	pageForm: '[data-admin-page-form]',
	pageTitle: '[data-admin-page-title]',
	pageSlug: '[data-admin-page-slug]',
	pageStatus: '[data-admin-page-status]',
	pageContent: '[data-admin-page-content]',
	mediaTable: '[data-admin-media]',
	mediaForm: '[data-admin-media-form]',
	mediaName: '[data-admin-media-name]',
	mediaUrl: '[data-admin-media-url]',
	mediaType: '[data-admin-media-type]',
	mediaUsage: '[data-admin-media-usage]',
	stockImport: '[data-admin-stock-import]',
	reviewsTable: '[data-admin-reviews]',
	chart: '[data-admin-chart]',
	chartMetric: '[data-admin-chart-metric]',
	reportsList: '[data-admin-reports]',
	reportsRun: '[data-admin-reports-run]',
	exportButtons: '[data-admin-export]',
	notificationsList: '[data-admin-notifications]',
	notificationsBadge: '[data-admin-notify-count]',
	notificationsRead: '[data-admin-notifications-read]',
	dbUsage: '[data-admin-db-usage]',
	dbIndexes: '[data-admin-db-indexes]',
	dbBackupDate: '[data-admin-db-backup-date]',
	dbCollections: '[data-admin-db-collections]',
	dbBackup: '[data-admin-db-backup]',
	automations: '[data-admin-automation]',
	security2fa: '[data-admin-security-2fa]',
	securityRoles: '[data-admin-security-roles]',
	securitySave: '[data-admin-security-save]',
	supportOpen: '[data-admin-support-open]',
	supportClosed: '[data-admin-support-closed]',
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
	adminUser: null,
	period: '30d',
	currentChartMetric: 'visits',
	leads: [],
	commissions: [],
	pages: [],
	media: [],
	reports: [],
	notifications: []
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
			initPeriodFilter();
			initLeadsFilters();
			initPageForm();
			initMediaForm();
			initStockImport();
			initChartFilters();
			initExports();
			initReportsControls();
			initAutomationControls();
			initSecurityControls();
			initNotificationsControls();
			initDbControls();
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
		if (actionName === 'lead-status') {
			await fetchWithAuth(`${endpoints.user}/leads/${encodeURIComponent(id)}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ status: value })
			});
			loadLeads(endpoints);
			return;
		}
		if (actionName === 'lead-delete') {
			await fetchWithAuth(`${endpoints.user}/leads/${encodeURIComponent(id)}`, {
				method: 'DELETE'
			});
			loadLeads(endpoints);
			return;
		}
		if (actionName === 'commission-pay') {
			await fetchWithAuth(`${endpoints.user}/finance/commissions/${encodeURIComponent(id)}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ status: 'paid' })
			});
			loadFinance(endpoints);
			return;
		}
		if (actionName === 'review-reply') {
			const responseText = window.prompt('Resposta ao cliente:');
			if (!responseText) {
				return;
			}
			await fetchWithAuth(`${endpoints.feedback}/${encodeURIComponent(id)}/respond`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ response: responseText })
			});
			loadFeedback(endpoints);
			return;
		}
		if (actionName === 'page-edit') {
			const page = adminState.pages.find((item) => item.id === id || item._id === id);
			const form = document.querySelector(SELECTORS.pageForm);
			if (page && form) {
				form.dataset.pageId = page.id || page._id || '';
				setInputValue(SELECTORS.pageTitle, page.title);
				setInputValue(SELECTORS.pageSlug, page.slug);
				setInputValue(SELECTORS.pageStatus, page.status || 'draft');
				setInputValue(SELECTORS.pageContent, page.content || '');
				form.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}
			return;
		}
		if (actionName === 'page-delete') {
			await fetchWithAuth(`${endpoints.user}/pages/${encodeURIComponent(id)}`, {
				method: 'DELETE'
			});
			loadPages(endpoints);
			return;
		}
		if (actionName === 'media-edit') {
			const media = adminState.media.find((item) => item.id === id || item._id === id);
			const form = document.querySelector(SELECTORS.mediaForm);
			if (media && form) {
				form.dataset.mediaId = media.id || media._id || '';
				setInputValue(SELECTORS.mediaName, media.name);
				setInputValue(SELECTORS.mediaUrl, media.url);
				setInputValue(SELECTORS.mediaType, media.type || 'image');
				setInputValue(SELECTORS.mediaUsage, media.usage || '');
				form.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}
			return;
		}
		if (actionName === 'media-delete') {
			await fetchWithAuth(`${endpoints.user}/media/${encodeURIComponent(id)}`, {
				method: 'DELETE'
			});
			loadMedia(endpoints);
			return;
		}
		if (actionName === 'report-run') {
			await fetchWithAuth(`${endpoints.user}/reports/${encodeURIComponent(id)}/run`, {
				method: 'POST'
			});
			loadReports(endpoints);
			return;
		}
		if (actionName === 'task-open') {
			if (value && value.startsWith('#')) {
				const target = document.querySelector(value);
				if (target) {
					smoothScrollToSection(target);
				}
			}
			return;
		}
		if (actionName === 'toggle-2fa') {
			const nextValue = value === 'true' ? false : true;
			await fetchWithAuth(`${endpoints.user}/${encodeURIComponent(id)}/2fa`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ enabled: nextValue })
			});
			loadUsers(endpoints);
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

function initPeriodFilter() {
	const select = document.querySelector(SELECTORS.periodSelect);
	if (!select) {
		return;
	}
	adminState.period = select.value || '30d';
	select.addEventListener('change', () => {
		adminState.period = select.value || '30d';
		loadDashboardData();
	});
}

function initLeadsFilters() {
	const statusSelect = document.querySelector(SELECTORS.leadsStatus);
	const channelSelect = document.querySelector(SELECTORS.leadsChannel);
	if (!statusSelect && !channelSelect) {
		return;
	}
	const handleChange = () => loadLeads(getEndpoints());
	statusSelect?.addEventListener('change', handleChange);
	channelSelect?.addEventListener('change', handleChange);
}

function initPageForm() {
	const form = document.querySelector(SELECTORS.pageForm);
	if (!form) {
		return;
	}
	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		await createPage();
		form.reset();
	});
}

function initMediaForm() {
	const form = document.querySelector(SELECTORS.mediaForm);
	if (!form) {
		return;
	}
	form.addEventListener('submit', async (event) => {
		event.preventDefault();
		await createMedia();
		form.reset();
	});
}

function initStockImport() {
	const button = document.querySelector(SELECTORS.stockImport);
	if (!button) {
		return;
	}
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = '.csv';
	input.hidden = true;
	input.addEventListener('change', async () => {
		const file = input.files?.[0];
		if (!file) {
			return;
		}
		const text = await file.text();
		const rows = parseCsv(text);
		if (rows.length) {
			await importStock(rows);
		}
		input.value = '';
	});
	button.addEventListener('click', () => input.click());
}

function initChartFilters() {
	const buttons = document.querySelectorAll(SELECTORS.chartMetric);
	if (!buttons.length) {
		return;
	}
	buttons.forEach((button) => {
		button.addEventListener('click', () => {
			adminState.currentChartMetric = button.dataset.adminChartMetric || 'visits';
			buttons.forEach((item) => item.classList.toggle('is-active', item === button));
			renderChart(adminState.chartData || [], adminState.currentChartMetric);
		});
	});
}

function initExports() {
	const leadsExport = document.querySelector(SELECTORS.leadsExport);
	const financeExport = document.querySelector(SELECTORS.financeExport);
	const reportExports = document.querySelectorAll(SELECTORS.exportButtons);

	if (leadsExport) {
		leadsExport.addEventListener('click', () => downloadCsv('leads.csv', adminState.leads));
	}
	if (financeExport) {
		financeExport.addEventListener('click', () => downloadCsv('comissoes.csv', adminState.commissions));
	}
	if (reportExports.length) {
		reportExports.forEach((button) => {
			button.addEventListener('click', () => downloadCsv('relatorios.csv', adminState.reports));
		});
	}
}

function initReportsControls() {
	const button = document.querySelector(SELECTORS.reportsRun);
	if (!button) {
		return;
	}
	button.addEventListener('click', async () => {
		const endpoints = getEndpoints();
		await fetchWithAuth(`${endpoints.user}/reports/run-all`, { method: 'POST' });
		loadReports(endpoints);
	});
}

function initAutomationControls() {
	const checkboxes = document.querySelectorAll(SELECTORS.automations);
	if (!checkboxes.length) {
		return;
	}
	checkboxes.forEach((checkbox) => {
		checkbox.addEventListener('change', () => saveAutomations());
	});
}

function initSecurityControls() {
	const button = document.querySelector(SELECTORS.securitySave);
	if (!button) {
		return;
	}
	button.addEventListener('click', () => saveSecurityPolicy());
}

function initNotificationsControls() {
	const button = document.querySelector(SELECTORS.notificationsRead);
	if (!button) {
		return;
	}
	button.addEventListener('click', () => markNotificationsRead());
}

function initDbControls() {
	const button = document.querySelector(SELECTORS.dbBackup);
	if (!button) {
		return;
	}
	button.addEventListener('click', () => requestDatabaseBackup());
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
		loadAlerts(endpoints),
		loadTasks(endpoints),
		loadFeedback(endpoints),
		loadCars(endpoints),
		loadStock(endpoints),
		loadUsers(endpoints),
		loadLeads(endpoints),
		loadFinance(endpoints),
		loadPages(endpoints),
		loadMedia(endpoints),
		loadReports(endpoints),
		loadNotifications(endpoints),
		loadSupport(endpoints),
		loadDbStatus(endpoints),
		loadAutomations(endpoints),
		loadSecurityPolicy(endpoints),
		loadChartData(endpoints),
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

async function loadAlerts(endpoints) {
	try {
		const response = await fetchWithAuth(`${endpoints.user}/alerts?period=${encodeURIComponent(adminState.period)}`, {
			method: 'GET'
		});
		const payload = await response.json();
		renderAlerts(payload?.body?.items || []);
	} catch (error) {
		console.warn('Falha ao carregar alertas.', error);
		renderAlerts([]);
	}
}

async function loadTasks(endpoints) {
	try {
		const response = await fetchWithAuth(`${endpoints.user}/tasks`, { method: 'GET' });
		const payload = await response.json();
		renderTasks(payload?.body?.items || []);
	} catch (error) {
		console.warn('Falha ao carregar tarefas.', error);
		renderTasks([]);
	}
}

async function loadLeads(endpoints) {
	try {
		const status = document.querySelector(SELECTORS.leadsStatus)?.value || '';
		const channel = document.querySelector(SELECTORS.leadsChannel)?.value || '';
		const query = new URLSearchParams({
			period: adminState.period,
			status,
			channel,
			limit: '10'
		});
		const response = await fetchWithAuth(`${endpoints.user}/leads?${query.toString()}`, { method: 'GET' });
		const payload = await response.json();
		const body = payload?.body || {};
		adminState.leads = Array.isArray(body.result) ? body.result : [];
		setTextContent(SELECTORS.leadsVisits, formatNumber(body.visits));
		setTextContent(SELECTORS.leadsCount, formatNumber(body.total));
		setTextContent(SELECTORS.leadsSales, formatNumber(body.sales));
		setTextContent(
			SELECTORS.leadsSource,
			body.primarySource ? `Origem principal: ${body.primarySource}` : 'Origem principal: --'
		);
		setTextById('monthly_leads', formatNumber(body.total));
		renderLeadsTable(adminState.leads);
	} catch (error) {
		console.warn('Falha ao carregar leads.', error);
		renderLeadsTable([]);
	}
}

async function loadFinance(endpoints) {
	try {
		const response = await fetchWithAuth(`${endpoints.user}/finance?period=${encodeURIComponent(adminState.period)}`, {
			method: 'GET'
		});
		const payload = await response.json();
		const body = payload?.body || {};
		adminState.commissions = Array.isArray(body.commissions) ? body.commissions : [];
		setTextContent(SELECTORS.financeRevenue, formatCurrency(body.revenue || 0));
		setTextContent(SELECTORS.financeRevenueTrend, body.revenueTrend || '--');
		setTextContent(SELECTORS.financeCommissions, formatCurrency(body.commissionDue || 0));
		setTextContent(SELECTORS.financeCommissionsCount, `${formatNumber(body.commissionsCount || 0)} pendentes`);
		setTextById('estimated_revenue', formatCurrency(body.revenue || 0));
		renderCommissionsTable(adminState.commissions);
	} catch (error) {
		console.warn('Falha ao carregar financeiro.', error);
		renderCommissionsTable([]);
	}
}

async function loadPages(endpoints) {
	try {
		const response = await fetchWithAuth(`${endpoints.user}/pages?limit=12`, { method: 'GET' });
		const payload = await response.json();
		adminState.pages = Array.isArray(payload?.body?.result) ? payload.body.result : [];
		renderPagesTable(adminState.pages);
	} catch (error) {
		console.warn('Falha ao carregar paginas.', error);
		renderPagesTable([]);
	}
}

async function loadMedia(endpoints) {
	try {
		const response = await fetchWithAuth(`${endpoints.user}/media?limit=12`, { method: 'GET' });
		const payload = await response.json();
		adminState.media = Array.isArray(payload?.body?.result) ? payload.body.result : [];
		renderMediaTable(adminState.media);
	} catch (error) {
		console.warn('Falha ao carregar midias.', error);
		renderMediaTable([]);
	}
}

async function loadReports(endpoints) {
	try {
		const response = await fetchWithAuth(`${endpoints.user}/reports`, { method: 'GET' });
		const payload = await response.json();
		adminState.reports = Array.isArray(payload?.body?.result) ? payload.body.result : [];
		renderReports(adminState.reports);
	} catch (error) {
		console.warn('Falha ao carregar relatorios.', error);
		renderReports([]);
	}
}

async function loadNotifications(endpoints) {
	try {
		const response = await fetchWithAuth(`${endpoints.user}/notifications?limit=8`, { method: 'GET' });
		const payload = await response.json();
		adminState.notifications = Array.isArray(payload?.body?.result) ? payload.body.result : [];
		renderNotifications(adminState.notifications);
	} catch (error) {
		console.warn('Falha ao carregar notificacoes.', error);
		renderNotifications([]);
	}
}

async function loadSupport(endpoints) {
	try {
		const response = await fetchWithAuth(`${endpoints.user}/support`, { method: 'GET' });
		const payload = await response.json();
		renderSupport(payload?.body || {});
	} catch (error) {
		console.warn('Falha ao carregar suporte.', error);
		renderSupport({});
	}
}

async function loadDbStatus(endpoints) {
	try {
		const response = await fetchWithAuth(`${endpoints.user}/db/status`, { method: 'GET' });
		const payload = await response.json();
		renderDbStatus(payload?.body || {});
	} catch (error) {
		console.warn('Falha ao carregar banco de dados.', error);
		renderDbStatus({});
	}
}

async function loadAutomations(endpoints) {
	try {
		const response = await fetchWithAuth(`${endpoints.user}/automations`, { method: 'GET' });
		const payload = await response.json();
		applyAutomationState(payload?.body || {});
	} catch (error) {
		console.warn('Falha ao carregar automacoes.', error);
	}
}

async function loadSecurityPolicy(endpoints) {
	try {
		const response = await fetchWithAuth(`${endpoints.user}/security-policy`, { method: 'GET' });
		const payload = await response.json();
		applySecurityPolicy(payload?.body || {});
	} catch (error) {
		console.warn('Falha ao carregar politica de seguranca.', error);
	}
}

async function loadChartData(endpoints) {
	try {
		const response = await fetchWithAuth(`${endpoints.user}/metrics?period=${encodeURIComponent(adminState.period)}`, {
			method: 'GET'
		});
		const payload = await response.json();
		adminState.chartData = Array.isArray(payload?.body?.series) ? payload.body.series : [];
		renderChart(adminState.chartData, adminState.currentChartMetric);
	} catch (error) {
		console.warn('Falha ao carregar grafico.', error);
		renderChart([], adminState.currentChartMetric);
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
		renderReviewsTable(feedback.result || []);
	} catch (error) {
		console.warn('Falha ao carregar feedback.', error);
		renderFeedbackList([]);
		renderReviewsTable([]);
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

async function loadStock(endpoints) {
	try {
		const response = await fetchWithAuth(`${endpoints.user}/stock?limit=8`, { method: 'GET' });
		const payload = await response.json();
		const items = Array.isArray(payload?.body?.result) ? payload.body.result : [];
		renderStockTable(items);
	} catch (error) {
		console.warn('Falha ao carregar estoque.', error);
		renderStockTable([]);
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
		renderAdminsTable(users.filter((user) => user.role === 'admin').slice(0, 6));
	} catch (error) {
		console.warn('Falha ao carregar usuarios.', error);
		renderUsersTable([]);
		renderPartnersTable([]);
		renderAdminsTable([]);
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

async function createPage() {
	const form = document.querySelector(SELECTORS.pageForm);
	if (!form) {
		return;
	}
	const payload = {
		title: document.querySelector(SELECTORS.pageTitle)?.value?.trim() || '',
		slug: document.querySelector(SELECTORS.pageSlug)?.value?.trim() || '',
		status: document.querySelector(SELECTORS.pageStatus)?.value || 'draft',
		content: document.querySelector(SELECTORS.pageContent)?.value?.trim() || ''
	};
	if (!payload.title || !payload.slug) {
		return;
	}
	const endpoints = getEndpoints();
	const pageId = form.dataset.pageId || '';
	const url = pageId ? `${endpoints.user}/pages/${encodeURIComponent(pageId)}` : `${endpoints.user}/pages`;
	const method = pageId ? 'PUT' : 'POST';
	await fetchWithAuth(url, {
		method,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	delete form.dataset.pageId;
	await loadPages(endpoints);
}

async function createMedia() {
	const form = document.querySelector(SELECTORS.mediaForm);
	if (!form) {
		return;
	}
	const payload = {
		name: document.querySelector(SELECTORS.mediaName)?.value?.trim() || '',
		url: document.querySelector(SELECTORS.mediaUrl)?.value?.trim() || '',
		type: document.querySelector(SELECTORS.mediaType)?.value || 'image',
		usage: document.querySelector(SELECTORS.mediaUsage)?.value?.trim() || ''
	};
	if (!payload.name || !payload.url) {
		return;
	}
	const endpoints = getEndpoints();
	const mediaId = form.dataset.mediaId || '';
	const url = mediaId ? `${endpoints.user}/media/${encodeURIComponent(mediaId)}` : `${endpoints.user}/media`;
	const method = mediaId ? 'PUT' : 'POST';
	await fetchWithAuth(url, {
		method,
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	delete form.dataset.mediaId;
	await loadMedia(endpoints);
}

async function saveAutomations() {
	const checkboxes = Array.from(document.querySelectorAll(SELECTORS.automations));
	if (!checkboxes.length) {
		return;
	}
	const settings = {};
	checkboxes.forEach((checkbox) => {
		settings[checkbox.dataset.adminAutomation] = checkbox.checked;
	});
	const endpoints = getEndpoints();
	await fetchWithAuth(`${endpoints.user}/automations`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ settings })
	});
}

async function saveSecurityPolicy() {
	const enabled = document.querySelector(SELECTORS.security2fa)?.value || 'enabled';
	const rolesSelect = document.querySelector(SELECTORS.securityRoles);
	const roles = rolesSelect ? Array.from(rolesSelect.selectedOptions).map((option) => option.value) : [];
	const endpoints = getEndpoints();
	await fetchWithAuth(`${endpoints.user}/security-policy`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ twoFactorRequired: enabled === 'enabled', roles })
	});
}

async function markNotificationsRead() {
	const endpoints = getEndpoints();
	await fetchWithAuth(`${endpoints.user}/notifications/mark-read`, { method: 'PATCH' });
	await loadNotifications(endpoints);
}

async function requestDatabaseBackup() {
	const endpoints = getEndpoints();
	await fetchWithAuth(`${endpoints.user}/db/backup`, { method: 'POST' });
	await loadDbStatus(endpoints);
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

function applyAutomationState(payload) {
	const checkboxes = document.querySelectorAll(SELECTORS.automations);
	if (!checkboxes.length) {
		return;
	}
	checkboxes.forEach((checkbox) => {
		const key = checkbox.dataset.adminAutomation;
		checkbox.checked = Boolean(payload?.settings?.[key]);
	});
}

function applySecurityPolicy(payload) {
	const select = document.querySelector(SELECTORS.security2fa);
	const roles = document.querySelector(SELECTORS.securityRoles);
	if (select) {
		select.value = payload?.twoFactorRequired ? 'enabled' : 'disabled';
	}
	if (roles) {
		const selected = new Set(Array.isArray(payload?.roles) ? payload.roles : []);
		Array.from(roles.options).forEach((option) => {
			option.selected = selected.has(option.value);
		});
	}
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
		body.appendChild(createEmptyRow(5, 'Nenhum cliente encontrado.'));
		return;
	}
	users.forEach((user) => {
		const row = document.createElement('tr');
		row.appendChild(createCell('Cliente', user.username || 'Sem nome'));
		row.appendChild(createCell('E-mail', user.email || 'Nao informado'));
		row.appendChild(createStatusCell('Status', user.isActive === false ? 'inactive' : 'active'));
		row.appendChild(createCell('Tipo', 'Cliente'));
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

function renderAdminsTable(users) {
	const body = document.querySelector(SELECTORS.adminsTable);
	if (!body) {
		return;
	}
	body.innerHTML = '';
	if (!users.length) {
		body.appendChild(createEmptyRow(5, 'Nenhum administrador encontrado.'));
		return;
	}
	users.forEach((user) => {
		const row = document.createElement('tr');
		row.appendChild(createCell('Admin', user.username || 'Sem nome'));
		row.appendChild(createCell('E-mail', user.email || 'Nao informado'));
		row.appendChild(createStatusCell('2FA', user.twoFactorEnabled ? 'active' : 'inactive'));
		row.appendChild(createStatusCell('Status', user.isActive === false ? 'inactive' : 'active'));
		row.appendChild(createActionsCell(buildAdminActions(user)));
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

function renderReviewsTable(items) {
	const body = document.querySelector(SELECTORS.reviewsTable);
	if (!body) {
		return;
	}
	body.innerHTML = '';
	if (!items.length) {
		body.appendChild(createEmptyRow(5, 'Nenhuma avaliação encontrada.'));
		return;
	}
	items.slice(0, 6).forEach((item) => {
		const row = document.createElement('tr');
		row.appendChild(createCell('Cliente', item.userName || 'Cliente'));
		row.appendChild(createCell('Nota', String(item.rating || 0)));
		row.appendChild(createCell('Mensagem', item.message || 'Sem mensagem'));
		row.appendChild(createStatusCell('Status', item.responded ? 'respondido' : 'pendente'));
		row.appendChild(createActionsCell([createActionButton('Responder', 'review-reply', item.id || '')]));
		body.appendChild(row);
	});
}

function renderAlerts(items) {
	const wrapper = document.querySelector(SELECTORS.alertsList);
	if (!wrapper) {
		return;
	}
	wrapper.innerHTML = '';
	if (!items.length) {
		const card = document.createElement('article');
		card.className = 'admin-card admin-card--surface';
		card.innerHTML = '<div class="admin-card__header"><span class="admin-card__label">Sem alertas críticos</span><span class="admin-card__badge admin-card__badge--neutral">0</span></div><p class="admin-card__meta">Tudo em ordem no momento.</p>';
		wrapper.appendChild(card);
		return;
	}
	items.forEach((item) => {
		const card = document.createElement('article');
		card.className = 'admin-card admin-card--surface';
		const header = document.createElement('div');
		header.className = 'admin-card__header';
		const label = document.createElement('span');
		label.className = 'admin-card__label';
		label.textContent = item.title || 'Alerta';
		const badge = document.createElement('span');
		badge.className = 'admin-card__badge admin-card__badge--neutral';
		badge.textContent = formatNumber(item.count || 0);
		header.appendChild(label);
		header.appendChild(badge);
		const meta = document.createElement('p');
		meta.className = 'admin-card__meta';
		meta.textContent = item.description || '';
		card.appendChild(header);
		card.appendChild(meta);
		wrapper.appendChild(card);
	});
}

function renderTasks(items) {
	const list = document.querySelector(SELECTORS.tasksList);
	if (!list) {
		return;
	}
	list.innerHTML = '';
	if (!items.length) {
		const empty = document.createElement('li');
		empty.className = 'admin-empty';
		empty.textContent = 'Nenhuma tarefa pendente.';
		list.appendChild(empty);
		return;
	}
	items.forEach((task) => {
		const item = document.createElement('li');
		const primary = document.createElement('div');
		primary.className = 'admin-list__primary';
		const title = document.createElement('strong');
		title.textContent = task.title || 'Tarefa';
		const meta = document.createElement('span');
		meta.textContent = task.description || '';
		primary.appendChild(title);
		primary.appendChild(meta);
		const secondary = document.createElement('div');
		secondary.className = 'admin-list__secondary';
		const button = createActionButton('Abrir', 'task-open', task.id || '', task.link || '');
		button.classList.add('link-button');
		secondary.appendChild(button);
		item.appendChild(primary);
		item.appendChild(secondary);
		list.appendChild(item);
	});
}

function renderLeadsTable(items) {
	const body = document.querySelector(SELECTORS.leadsTable);
	if (!body) {
		return;
	}
	body.innerHTML = '';
	if (!items.length) {
		body.appendChild(createEmptyRow(5, 'Nenhum lead encontrado.'));
		return;
	}
	items.forEach((lead) => {
		const row = document.createElement('tr');
		row.appendChild(createCell('Lead', lead.name || lead.contact || 'Sem nome'));
		row.appendChild(createCell('Canal', lead.channel || 'Nao informado'));
		row.appendChild(createCell('Interesse', lead.interest || 'Nao informado'));
		row.appendChild(createStatusCell('Status', lead.status || 'novo'));
		const actions = [
			createActionButton('Contato', 'lead-status', lead.id || lead._id, 'contato'),
			createActionButton('Qualificar', 'lead-status', lead.id || lead._id, 'qualificado'),
			createActionButton('Perder', 'lead-status', lead.id || lead._id, 'perdido'),
			createActionButton('Excluir', 'lead-delete', lead.id || lead._id)
		];
		row.appendChild(createActionsCell(actions));
		body.appendChild(row);
	});
}

function renderStockTable(items) {
	const body = document.querySelector(SELECTORS.stockTable);
	if (!body) {
		return;
	}
	body.innerHTML = '';
	if (!items.length) {
		body.appendChild(createEmptyRow(5, 'Nenhum veiculo em estoque.'));
		return;
	}
	items.forEach((item) => {
		const row = document.createElement('tr');
		row.appendChild(createCell('Veiculo', item.name || 'Sem nome'));
		row.appendChild(createStatusCell('Status', item.status || 'disponivel'));
		row.appendChild(createCell('KM', item.km ? `${formatNumber(item.km)} km` : '--'));
		row.appendChild(createCell('Local', item.location || '--'));
		row.appendChild(createCell('Preco sugerido', formatCurrency(item.suggestedPrice || 0)));
		body.appendChild(row);
	});
}

function renderCommissionsTable(items) {
	const body = document.querySelector(SELECTORS.financeTable);
	if (!body) {
		return;
	}
	body.innerHTML = '';
	if (!items.length) {
		body.appendChild(createEmptyRow(5, 'Nenhuma comissao encontrada.'));
		return;
	}
	items.forEach((item) => {
		const row = document.createElement('tr');
		row.appendChild(createCell('Parceiro', item.partner || 'Sem parceiro'));
		row.appendChild(createCell('Valor', formatCurrency(item.amount || 0)));
		row.appendChild(createStatusCell('Status', item.status || 'pending'));
		row.appendChild(createCell('Vencimento', formatDate(item.dueDate)));
		const actions = [createActionButton('Pagar', 'commission-pay', item.id || item._id)];
		row.appendChild(createActionsCell(actions));
		body.appendChild(row);
	});
}

function renderPagesTable(items) {
	const body = document.querySelector(SELECTORS.pagesTable);
	if (!body) {
		return;
	}
	body.innerHTML = '';
	if (!items.length) {
		body.appendChild(createEmptyRow(5, 'Nenhuma pagina encontrada.'));
		return;
	}
	items.forEach((page) => {
		const row = document.createElement('tr');
		row.appendChild(createCell('Pagina', page.title || 'Sem titulo'));
		row.appendChild(createCell('Slug', page.slug || '--'));
		row.appendChild(createStatusCell('Status', page.status || 'draft'));
		row.appendChild(createCell('Atualizado', formatDate(page.updatedAt || page.createdAt)));
		const actions = [
			createActionButton('Editar', 'page-edit', page.id || page._id),
			createActionButton('Excluir', 'page-delete', page.id || page._id)
		];
		row.appendChild(createActionsCell(actions));
		body.appendChild(row);
	});
}

function renderMediaTable(items) {
	const body = document.querySelector(SELECTORS.mediaTable);
	if (!body) {
		return;
	}
	body.innerHTML = '';
	if (!items.length) {
		body.appendChild(createEmptyRow(5, 'Nenhuma midia encontrada.'));
		return;
	}
	items.forEach((item) => {
		const row = document.createElement('tr');
		row.appendChild(createCell('Arquivo', item.name || 'Sem nome'));
		row.appendChild(createCell('Tipo', item.type || 'indefinido'));
		row.appendChild(createCell('Uso', item.usage || '--'));
		row.appendChild(createStatusCell('Status', item.status || 'active'));
		const actions = [
			createActionButton('Editar', 'media-edit', item.id || item._id),
			createActionButton('Excluir', 'media-delete', item.id || item._id)
		];
		row.appendChild(createActionsCell(actions));
		body.appendChild(row);
	});
}

function renderReports(items) {
	const list = document.querySelector(SELECTORS.reportsList);
	if (!list) {
		return;
	}
	list.innerHTML = '';
	if (!items.length) {
		const empty = document.createElement('li');
		empty.className = 'admin-empty';
		empty.textContent = 'Nenhum relatorio disponivel.';
		list.appendChild(empty);
		return;
	}
	items.forEach((report) => {
		const item = document.createElement('li');
		const primary = document.createElement('div');
		primary.className = 'admin-list__primary';
		const title = document.createElement('strong');
		title.textContent = report.name || 'Relatorio';
		const meta = document.createElement('span');
		meta.textContent = report.description || 'Sem descricao';
		primary.appendChild(title);
		primary.appendChild(meta);
		const secondary = document.createElement('div');
		secondary.className = 'admin-list__secondary';
		const button = createActionButton('Executar', 'report-run', report.id || report._id);
		button.classList.add('link-button');
		secondary.appendChild(button);
		item.appendChild(primary);
		item.appendChild(secondary);
		list.appendChild(item);
	});
}

function renderNotifications(items) {
	const list = document.querySelector(SELECTORS.notificationsList);
	const badge = document.querySelector(SELECTORS.notificationsBadge);
	if (badge) {
		const unread = items.filter((item) => !item.read).length;
		badge.textContent = formatNumber(unread);
	}
	if (!list) {
		return;
	}
	list.innerHTML = '';
	if (!items.length) {
		const empty = document.createElement('li');
		empty.className = 'admin-empty';
		empty.textContent = 'Nenhuma notificacao pendente.';
		list.appendChild(empty);
		return;
	}
	items.forEach((notice) => {
		const item = document.createElement('li');
		const primary = document.createElement('div');
		primary.className = 'admin-list__primary';
		const title = document.createElement('strong');
		title.textContent = notice.title || 'Notificacao';
		const meta = document.createElement('span');
		meta.textContent = notice.message || '';
		primary.appendChild(title);
		primary.appendChild(meta);
		const secondary = document.createElement('div');
		secondary.className = 'admin-list__secondary';
		const status = document.createElement('span');
		status.className = `status-pill ${notice.read ? 'status-pill--neutral' : 'status-pill--warning'}`;
		status.textContent = notice.read ? 'Lido' : 'Novo';
		secondary.appendChild(status);
		item.appendChild(primary);
		item.appendChild(secondary);
		list.appendChild(item);
	});
}

function renderDbStatus(payload) {
	setTextContent(SELECTORS.dbUsage, payload.storageUsage || '--');
	setTextContent(SELECTORS.dbIndexes, payload.indexHealth || '--');
	setTextContent(SELECTORS.dbBackupDate, payload.lastBackup || '--');
	const body = document.querySelector(SELECTORS.dbCollections);
	if (!body) {
		return;
	}
	body.innerHTML = '';
	const collections = Array.isArray(payload.collections) ? payload.collections : [];
	if (!collections.length) {
		body.appendChild(createEmptyRow(4, 'Nenhuma colecao encontrada.'));
		return;
	}
	collections.forEach((collection) => {
		const row = document.createElement('tr');
		row.appendChild(createCell('Colecao', collection.name || '--'));
		row.appendChild(createCell('Documentos', formatNumber(collection.count || 0)));
		row.appendChild(createCell('Tamanho', collection.size || '--'));
		row.appendChild(createCell('Atualizacao', formatDate(collection.updatedAt)));
		body.appendChild(row);
	});
}

function renderSupport(payload) {
	const openList = document.querySelector(SELECTORS.supportOpen);
	const closedList = document.querySelector(SELECTORS.supportClosed);
	if (openList) {
		openList.innerHTML = '';
		const items = Array.isArray(payload.open) ? payload.open : [];
		if (!items.length) {
			const empty = document.createElement('li');
			empty.className = 'admin-empty';
			empty.textContent = 'Nenhuma pendencia interna.';
			openList.appendChild(empty);
		} else {
			items.forEach((item) => {
				const li = document.createElement('li');
				const title = document.createElement('strong');
				title.textContent = item.title || 'Tarefa';
				const meta = document.createElement('span');
				meta.textContent = item.description || '';
				li.appendChild(title);
				li.appendChild(meta);
				openList.appendChild(li);
			});
		}
	}
	if (closedList) {
		closedList.innerHTML = '';
		const items = Array.isArray(payload.closed) ? payload.closed : [];
		if (!items.length) {
			const empty = document.createElement('li');
			empty.className = 'admin-empty';
			empty.textContent = 'Nenhum item resolvido.';
			closedList.appendChild(empty);
		} else {
			items.forEach((item) => {
				const li = document.createElement('li');
				const title = document.createElement('strong');
				title.textContent = item.title || 'Resolvido';
				const meta = document.createElement('span');
				meta.textContent = item.description || '';
				li.appendChild(title);
				li.appendChild(meta);
				closedList.appendChild(li);
			});
		}
	}
}

function renderChart(series, metric) {
	const container = document.querySelector(SELECTORS.chart);
	if (!container) {
		return;
	}
	container.innerHTML = '';
	if (!series.length) {
		const empty = document.createElement('div');
		empty.className = 'admin-chart__empty';
		empty.textContent = 'Sem dados para o periodo selecionado.';
		container.appendChild(empty);
		return;
	}
	const maxValue = Math.max(1, ...series.map((item) => Number(item[metric] || 0)));
	series.forEach((item) => {
		const bar = document.createElement('div');
		bar.className = 'admin-chart__bar';
		const value = Number(item[metric] || 0);
		bar.style.height = `${Math.round((value / maxValue) * 100)}%`;
		const label = document.createElement('span');
		label.textContent = item.label || '--';
		bar.appendChild(label);
		container.appendChild(bar);
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

function buildAdminActions(user) {
	const actions = [];
	const active = user.isActive !== false;
	actions.push(createActionButton(active ? 'Desativar' : 'Ativar', 'toggle-user', user._id || user.id, String(active)));
	actions.push(createActionButton(user.twoFactorEnabled ? 'Desativar 2FA' : 'Ativar 2FA', 'toggle-2fa', user._id || user.id, String(user.twoFactorEnabled)));
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
	if (status === 'qualificado' || status === 'paid' || status === 'published') {
		return 'status-pill--success';
	}
	if (status === 'novo' || status === 'contato' || status === 'draft' || status === 'pendente') {
		return 'status-pill--warning';
	}
	if (status === 'inactive') {
		return 'status-pill--neutral';
	}
	if (status === 'disponivel') {
		return 'status-pill--success';
	}
	if (status === 'reservado' || status === 'avaliacao') {
		return 'status-pill--warning';
	}
	if (status === 'vendido') {
		return 'status-pill--neutral';
	}
	if (status === 'respondido') {
		return 'status-pill--success';
	}
	if (status === 'perdido') {
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
	if (status === 'qualificado') {
		return 'Qualificado';
	}
	if (status === 'contato') {
		return 'Em contato';
	}
	if (status === 'novo') {
		return 'Novo';
	}
	if (status === 'perdido') {
		return 'Perdido';
	}
	if (status === 'respondido') {
		return 'Respondido';
	}
	if (status === 'pendente') {
		return 'Pendente';
	}
	if (status === 'paid') {
		return 'Pago';
	}
	if (status === 'draft') {
		return 'Rascunho';
	}
	if (status === 'published') {
		return 'Publicado';
	}
	if (status === 'disponivel') {
		return 'Disponivel';
	}
	if (status === 'reservado') {
		return 'Reservado';
	}
	if (status === 'vendido') {
		return 'Vendido';
	}
	if (status === 'avaliacao') {
		return 'Em avaliacao';
	}
	return 'Indefinido';
}

function setTextById(id, value) {
	const element = document.getElementById(id);
	if (element) {
		element.textContent = value || '0';
	}
}

function setTextContent(selector, value) {
	const element = document.querySelector(selector);
	if (element) {
		element.textContent = value || '--';
	}
}

function setInputValue(selector, value) {
	const element = document.querySelector(selector);
	if (element) {
		element.value = value ?? '';
	}
}

function formatNumber(value) {
	const safe = Number(value || 0);
	return new Intl.NumberFormat('pt-BR').format(safe);
}

function formatCurrency(value) {
	const safe = Number(value || 0);
	return new Intl.NumberFormat('pt-BR', {
		style: 'currency',
		currency: 'BRL'
	}).format(safe);
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

function downloadCsv(filename, items) {
	if (!Array.isArray(items) || !items.length) {
		return;
	}
	const headers = Object.keys(items[0] || {});
	const rows = items.map((item) => headers.map((key) => String(item[key] ?? '')).join(','));
	const csv = [headers.join(','), ...rows].join('\n');
	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}

function parseCsv(text) {
	const lines = text.split(/\r?\n/).filter(Boolean);
	if (lines.length < 2) {
		return [];
	}
	const headers = lines[0].split(',').map((value) => value.trim().toLowerCase());
	return lines.slice(1).map((line) => {
		const values = line.split(',').map((value) => value.trim());
		return headers.reduce((acc, key, index) => {
			acc[key] = values[index] || '';
			return acc;
		}, {});
	});
}

async function importStock(rows) {
	const endpoints = getEndpoints();
	await fetchWithAuth(`${endpoints.user}/stock/import`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ rows })
	});
	await loadStock(endpoints);
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
