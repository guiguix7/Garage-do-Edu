document.addEventListener('DOMContentLoaded', () => {
	const body = document.body;
	const messageBox = document.querySelector('[data-auth-status]');
	const loginForm = document.querySelector('[data-auth-form="login"]');
	const actionsBox = document.querySelector('[data-auth-actions]');
	const logoutButton = document.querySelector('[data-auth-logout]');
	const homeButton = document.querySelector('[data-auth-home]');

	const tokenKey = 'garage-auth-token';
	const sessionKey = 'garage-auth-session';
	const authEndpoint = (body?.dataset.authEndpoint || 'http://localhost:3000/auth').replace(/\/$/, '');

	const clearAuth = () => {
		try {
			window.localStorage.removeItem(tokenKey);
			window.sessionStorage.removeItem(sessionKey);
		} catch (error) {
			console.warn('Nao foi possivel limpar a sessao local.', error);
		}
	};

	const getStoredUser = () => {
		try {
			const raw = window.sessionStorage.getItem(sessionKey);
			if (!raw) {
				return null;
			}
			const parsed = JSON.parse(raw);
			return parsed?.user || null;
		} catch (error) {
			return null;
		}
	};

	const token = (() => {
		try {
			return window.localStorage.getItem(tokenKey);
		} catch (error) {
			return null;
		}
	})();

	const storedUser = getStoredUser();

	const showLoggedState = (email) => {
		if (messageBox) {
			messageBox.textContent = `Voce ja esta logado como ${email || 'usuario'}.`;
			messageBox.hidden = false;
		}
		if (actionsBox) {
			actionsBox.hidden = false;
		}
		if (loginForm) {
			loginForm.hidden = true;
		}
	};

	if (actionsBox) {
		actionsBox.hidden = true;
	}

	const checkSession = async () => {
		if (!token) {
			return;
		}
		try {
			const response = await fetch(`${authEndpoint}/me`, {
				method: 'GET',
				headers: {
					Accept: 'application/json',
					Authorization: `Bearer ${token}`
				},
				credentials: 'include'
			});

			if (!response.ok) {
				clearAuth();
				return;
			}

			const payload = await response.json();
			if (payload?.success && payload?.user?.email) {
				showLoggedState(payload.user.email);
			}
		} catch (error) {
			console.warn('Falha ao verificar sessao atual.', error);
		}
	};

	if (storedUser?.email) {
		showLoggedState(storedUser.email);
	} else {
		void checkSession();
	}

	if (logoutButton) {
		logoutButton.addEventListener('click', () => {
			clearAuth();
			window.location.reload();
		});
	}

	if (homeButton) {
		homeButton.addEventListener('click', () => {
			window.location.href = '../../index.html';
		});
	}
});
