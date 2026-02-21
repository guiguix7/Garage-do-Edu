// Cuidado para não expor informações sensíveis neste arquivo.
// Este arquivo deve ser protegido e acessível apenas por administradores autorizados.
// Esse é um script front-end, muito cuidado ao adcionar códigos que possam dar vunerabilidades e comprometer a segurança.
// Esse script deve armazenar apenas a logica e funcionalidades simples que não precisam de dados como senhas ou informações sensíveis.
// Para funcionalidades mais complexas e que envolvam dados sensíveis, utilize scripts back-end com as devidas medidas de segurança. (Futuro)

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
	themeToggle: '[data-admin-theme-toggle]'
};

const STORAGE_KEYS = ['garageAdminName', 'garageUserName', 'garageUser', 'adminName'];
const THEME_STORAGE_KEY = 'garage-do-edu-admin-theme';
const DESKTOP_MEDIA = window.matchMedia('(min-width: 1200px)');
const adminState = {
	closeSidebar: null
};

document.addEventListener('DOMContentLoaded', () => {
	hydrateSession();
	initSidebarToggle();
	initProfileMenu();
	initNavHighlighting();
	initFilterGroups();
	initThemeToggle();
});

function hydrateSession() {
	const nameField = document.querySelector(SELECTORS.adminName);
	const greetingField = document.querySelector(SELECTORS.greeting);
	if (!nameField) {
		return;
	}

	const storedName = readStoredName();
	if (storedName) {
		nameField.textContent = storedName;
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

	toggle.addEventListener('click', () => {
		currentTheme = currentTheme === 'light' ? 'dark' : 'light';
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
	const label = theme === 'light' ? 'Tema escuro' : 'Tema claro';
	toggle.textContent = label;
	toggle.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
}