// SCRIPT EM DESENVOLVIMENTO - NÃO INCLUIR EM PRODUÇÃO //

'use strict';

(() => {
    const storageKey = 'garage-auth-session';
    const body = document.body;
    if (!body) {
        console.log('Elemento <body> não encontrado. O script de autenticação não foi inicializado.');
        return;
    }

    const apiRoot = (body.dataset.authEndpoint || 'http://localhost:3000/auth').replace(/\/$/, '');
    const forms = document.querySelectorAll('[data-auth-form]');
    if (!forms.length) {
        console.log('Nenhum formulário de autenticação encontrado. O script de autenticação foi carregado, mas não está ativo.');
        return;
    }

    const request = async (endpoint, payload) => {
        const response = await fetch(`${apiRoot}${endpoint}`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify(payload)
        });

        let data = null;
        try {
            data = await response.json();
        } catch (error) {
            // Ignora corpo inválido; a camada de erro trata com mensagem genérica.
        }

        if (!response.ok || (data && data.success === false)) {
            const message = data && data.message ? data.message : `Erro na requisição (${response.status}).`;
            const error = new Error(message);
            error.status = response.status;
            error.payload = data;
            throw error;
        }

        return data;
    };

    const getMessageBox = (form) => {
        const box = form.querySelector('[data-auth-message]');
        if (box) {
            return box;
        }
        const created = document.createElement('div');
        created.className = 'auth-message';
        created.dataset.authMessage = '';
        created.hidden = true;
        form.prepend(created);
        return created;
    };

    const clearMessage = (form) => {
        const box = getMessageBox(form);
        box.textContent = '';
        box.hidden = true;
        box.classList.remove('is-success', 'is-error');
    };

    const showMessage = (form, variant, message) => {
        const box = getMessageBox(form);
        box.textContent = message;
        box.hidden = false;
        box.classList.remove('is-success', 'is-error');
        box.classList.add(variant === 'success' ? 'is-success' : 'is-error');
    };

    const setLoadingState = (form, isLoading) => {
        const submitButton = form.querySelector('button[type="submit"]');
        if (submitButton) {
            submitButton.disabled = isLoading;
            submitButton.setAttribute('aria-busy', String(isLoading));
        }
        form.dataset.loading = isLoading ? 'true' : 'false';
    };

    const migrateLegacyStorage = () => {
        try {
            if (window.localStorage.getItem(storageKey)) {
                window.localStorage.removeItem(storageKey);
            }
        } catch (error) {
            // ignora erros de acesso ao storage legado
        }
    };

    migrateLegacyStorage();

    const persistSession = (data) => {
        if (!data || !data.user) {
            return;
        }
        try {
            const session = {
                user: data.user,
                savedAt: new Date().toISOString()
            };
            window.sessionStorage.setItem(storageKey, JSON.stringify(session));
        } catch (error) {
            console.warn('Não foi possível salvar a sessão localmente:', error);
        }
    };

    const scheduleRedirect = (form) => {
        const redirectTo = form.dataset.successRedirect;
        if (!redirectTo) {
            return;
        }
        window.setTimeout(() => {
            window.location.href = redirectTo;
        }, 1200);
    };

    const handleLogin = (form) => {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            clearMessage(form);

            const formData = new FormData(form);
            const email = String(formData.get('email') || '').trim();
            const password = String(formData.get('password') || '').trim();

            if (!email || !password) {
                showMessage(form, 'error', 'Informe email e senha.');
                return;
            }

            setLoadingState(form, true);
            try {
                const result = await request('/login', { email, password });
                persistSession(result);
                showMessage(form, 'success', 'Login realizado com sucesso. Redirecionando...');
                scheduleRedirect(form);
            } catch (error) {
                const message = error.payload && error.payload.message ? error.payload.message : error.message;
                showMessage(form, 'error', message || 'Não foi possível realizar o login.');
            } finally {
                setLoadingState(form, false);
            }
        });
    };

    const handleSignup = (form) => {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            clearMessage(form);

            const formData = new FormData(form);
            const username = String(formData.get('username') || '').trim();
            const email = String(formData.get('email') || '').trim();
            const password = String(formData.get('password') || '').trim();

            if (!username || !email || !password) {
                showMessage(form, 'error', 'Preencha todos os campos obrigatórios.');
                return;
            }

            if (password.length < 8) {
                showMessage(form, 'error', 'A senha deve ter pelo menos 8 caracteres.');
                return;
            }

            setLoadingState(form, true);
            try {
                const result = await request('/signup', { username, email, password });
                persistSession(result);
                showMessage(form, 'success', 'Cadastro concluído. Redirecionando...');
                form.reset();
                scheduleRedirect(form);
            } catch (error) {
                const message = error.payload && error.payload.message ? error.payload.message : error.message;
                showMessage(form, 'error', message || 'Não foi possível concluir o cadastro.');
            } finally {
                setLoadingState(form, false);
            }
        });
    };

    const handleShowPassword = (form) => {
        const toggle = form.querySelector('.show-password-toggle');
        if (!toggle) {
            return;
        }
        const passwordFields = [...form.querySelectorAll('input[type="password"]')];
        if (!passwordFields.length) {
            return;
        }
        toggle.addEventListener('change', () => {
            const type = toggle.checked ? 'text' : 'password';
            passwordFields.forEach((field) => {
                field.type = type;
            });
        });
    };

    forms.forEach((form) => {
        const formType = form.dataset.authForm;
        if (formType === 'login') {
            handleLogin(form);
        } else if (formType === 'signup') {
            handleSignup(form);
        }
        handleShowPassword(form);
    });
})();