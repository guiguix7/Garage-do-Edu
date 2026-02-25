(function () {
    const body = document.body;
    if (!body) {
        return;
    }

    const guardType = body.dataset.guard;
    if (!guardType) {
        return;
    }

    const AUTH_SESSION_STORAGE_KEY = 'garage-auth-session';
    const isLoginGuard = guardType === 'login';
    const isSignupGuard = guardType === 'signup';
    const isAdminGuard = guardType === 'admin';
    let guardResolved = false;
    let restoreVisibilityTimer = null;
    let previousVisibility = '';

    const parseStoredSession = () => {
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
            console.warn('Stored session payload is invalid and will be ignored.', error);
        }
        return null;
    };

    const redirectTo = (target) => {
        if (!target || guardResolved) {
            return;
        }
        guardResolved = true;
        window.location.replace(target);
    };

    const unlockAdminView = () => {
        if (!isAdminGuard) {
            return;
        }
        guardResolved = true;
        body.dataset.guardState = 'allowed';
        if (restoreVisibilityTimer) {
            window.clearTimeout(restoreVisibilityTimer);
            restoreVisibilityTimer = null;
        }
        body.style.visibility = previousVisibility;
    };

    const denyAdminAccess = () => {
        if (!isAdminGuard) {
            return;
        }
        body.dataset.guardState = 'denied';
    };

    if (isAdminGuard) {
        previousVisibility = body.style.visibility;
        body.dataset.guardState = 'checking';
        body.style.visibility = 'hidden';
        restoreVisibilityTimer = window.setTimeout(() => {
            if (guardResolved) {
                return;
            }
            denyAdminAccess();
            body.style.visibility = previousVisibility;
            body.dataset.guardState = 'timeout';
            redirectTo('login.html');
        }, 5000);
    }

    const handleGuardState = (state) => {
        if (!state) {
            return;
        }

        if ((isLoginGuard || isSignupGuard) && state.status === 'authenticated' && state.verified === true) {
            return;
        }

        if (isAdminGuard) {
            if (state.status === 'authenticated' && state.verified === true && state.user?.role === 'admin') {
                unlockAdminView();
                return;
            }

            if (state.verified === true) {
                denyAdminAccess();
                redirectTo('login.html');
            }
        }
    };

    window.addEventListener('garage:auth-state', (event) => {
        handleGuardState(event.detail);
    });

    const storedSession = parseStoredSession();
    if (!storedSession) {
        return;
    }

    if ((isLoginGuard || isSignupGuard) && storedSession.user) {
        // Aguarda verificação do backend antes de redirecionar; nenhum action necessário aqui.
        return;
    }

    if (isAdminGuard && storedSession.user?.role !== 'admin') {
        denyAdminAccess();
        redirectTo('login.html');
    }
})();
