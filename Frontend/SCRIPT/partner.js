document.addEventListener('DOMContentLoaded', () => {
    if (typeof getInventoryConfig !== 'function') {
        return;
    }

    const dom = collectPartnerDom();
    if (!dom.root) {
        return;
    }

    const state = {
        cars: [],
        user: typeof getUser === 'function' ? getUser() : null,
        isAdmin: false
    };

    state.isAdmin = state.user?.role === 'admin';
    const isPartner = state.user && (state.user.role === 'partner' || state.isAdmin);

    const config = getInventoryConfig({ body: document.body });
    const detailPage = config.detailPage || 'HTML/anuncio.html';

    if (!isPartner) {
        setStatus(dom, 'Acesso exclusivo para parceiros. Faca login para continuar.');
        renderEmpty(dom, 'Entre com sua conta de parceiro para ver seus anuncios.');
        return;
    }

    dom.search?.addEventListener('input', () => renderCards(dom, state, detailPage));
    dom.filter?.addEventListener('change', () => renderCards(dom, state, detailPage));
    dom.refresh?.addEventListener('click', () => void loadCars(dom, state, config, detailPage));
    dom.newButton?.addEventListener('click', () => scrollToForm(dom));
    dom.reset?.addEventListener('click', () => resetForm(dom));

    dom.list?.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
            return;
        }
        const editButton = target.closest('[data-card-edit]');
        if (!(editButton instanceof HTMLElement)) {
            return;
        }
        const carId = editButton.dataset.carId;
        if (!carId) {
            return;
        }
        const car = state.cars.find((entry) => entry?.id === carId);
        if (car) {
            fillForm(dom, car);
            scrollToForm(dom);
        }
    });

    dom.form?.addEventListener('submit', (event) => {
        event.preventDefault();
        void submitForm(dom, state, config, detailPage);
    });

    void loadCars(dom, state, config, detailPage);
});

function collectPartnerDom() {
    const root = document.querySelector('[data-partner-dashboard]');
    return {
        root,
        status: root?.querySelector('[data-partner-status]') ?? null,
        total: root?.querySelector('[data-partner-total]') ?? null,
        available: root?.querySelector('[data-partner-available]') ?? null,
        unavailable: root?.querySelector('[data-partner-unavailable]') ?? null,
        list: root?.querySelector('[data-partner-list]') ?? null,
        empty: root?.querySelector('[data-partner-empty]') ?? null,
        template: root?.querySelector('template[data-partner-card-template]') ?? null,
        search: root?.querySelector('[data-partner-search]') ?? null,
        filter: root?.querySelector('[data-partner-filter]') ?? null,
        refresh: root?.querySelector('[data-partner-refresh]') ?? null,
        newButton: root?.querySelector('[data-partner-new]') ?? null,
        form: root?.querySelector('[data-partner-form]') ?? null,
        formTitle: root?.querySelector('#partner-form-title') ?? null,
        message: root?.querySelector('[data-partner-message]') ?? null,
        id: root?.querySelector('[data-partner-id]') ?? null,
        reset: root?.querySelector('[data-partner-reset]') ?? null
    };
}

function setStatus(dom, message) {
    if (!dom.status) {
        return;
    }
    if (!message) {
        dom.status.hidden = true;
        dom.status.textContent = '';
        return;
    }
    dom.status.hidden = false;
    dom.status.textContent = message;
}

function renderEmpty(dom, message) {
    if (!dom.empty) {
        return;
    }
    dom.empty.textContent = message || 'Nenhum anuncio encontrado.';
}

async function loadCars(dom, state, config, detailPage) {
    setStatus(dom, 'Carregando anuncios...');

    try {
        const response = typeof fetchWithAuth === 'function'
            ? await fetchWithAuth(config.base, { method: 'GET', headers: { Accept: 'application/json' } })
            : await fetch(config.base, { method: 'GET', headers: { Accept: 'application/json' } });

        if (!response.ok) {
            throw new Error(`Falha ao buscar anuncios (${response.status}).`);
        }

        const payload = await response.json().catch(() => null);
        const entries = Array.isArray(payload?.body?.cars)
            ? payload.body.cars
            : Array.isArray(payload?.body)
            ? payload.body
            : Array.isArray(payload?.cars)
            ? payload.cars
            : [];

        const filtered = state.isAdmin
            ? entries
            : entries.filter((car) => normalizeOwnerId(car) === String(state.user?.id || ''));

        state.cars = filtered.map((car) => ({
            ...car,
            id: String(car?.id ?? car?._id ?? '')
        })).filter((car) => car.id);

        updateStats(dom, state);
        renderCards(dom, state, detailPage);
        setStatus(dom, '');
    } catch (error) {
        console.error('Failed to load partner cars:', error);
        setStatus(dom, 'Nao foi possivel carregar seus anuncios.');
        renderEmpty(dom, 'Tente atualizar em alguns instantes.');
    }
}

function updateStats(dom, state) {
    const total = state.cars.length;
    const available = state.cars.filter((car) => Boolean(car.available)).length;
    const unavailable = total - available;

    if (dom.total) {
        dom.total.textContent = String(total);
    }
    if (dom.available) {
        dom.available.textContent = String(available);
    }
    if (dom.unavailable) {
        dom.unavailable.textContent = String(unavailable);
    }
}

function renderCards(dom, state, detailPage) {
    if (!dom.list) {
        return;
    }

    dom.list.innerHTML = '';

    const query = String(dom.search?.value || '').trim().toLowerCase();
    const filter = String(dom.filter?.value || '').trim().toLowerCase();

    const matches = state.cars.filter((car) => {
        const name = String(car?.name || '').toLowerCase();
        const brand = String(car?.brand || '').toLowerCase();
        const matchesQuery = !query || name.includes(query) || brand.includes(query);
        const matchesFilter =
            !filter ||
            (filter === 'available' && Boolean(car.available)) ||
            (filter === 'unavailable' && !car.available);
        return matchesQuery && matchesFilter;
    });

    if (!matches.length) {
        renderEmpty(dom, 'Nenhum anuncio encontrado para os filtros atuais.');
        if (dom.empty) {
            dom.list.appendChild(dom.empty);
        }
        return;
    }

    matches.forEach((car) => {
        const card = createCard(dom.template, car, detailPage);
        if (card) {
            dom.list.appendChild(card);
        }
    });
}

function createCard(template, car, detailPage) {
    const content = template?.content?.firstElementChild?.cloneNode(true);
    if (!(content instanceof HTMLElement)) {
        return null;
    }

    const brand = content.querySelector('[data-card-brand]');
    const title = content.querySelector('[data-card-title]');
    const status = content.querySelector('[data-card-status]');
    const year = content.querySelector('[data-card-year]');
    const price = content.querySelector('[data-card-price]');
    const updated = content.querySelector('[data-card-updated]');
    const edit = content.querySelector('[data-card-edit]');
    const view = content.querySelector('[data-card-view]');

    if (brand) {
        brand.textContent = String(car?.brand || 'Marca nao informada');
    }
    if (title) {
        title.textContent = String(car?.name || 'Veiculo sem nome');
    }
    if (status) {
        const isAvailable = Boolean(car?.available);
        status.textContent = isAvailable ? 'Disponivel' : 'Indisponivel';
        status.classList.toggle('is-offline', !isAvailable);
    }
    if (year) {
        year.textContent = `Ano: ${car?.year || '---'}`;
    }
    if (price) {
        price.textContent = `Preco: ${formatCurrency(car?.price)}`;
    }
    if (updated) {
        updated.textContent = `Atualizado: ${formatDate(car?.updatedAt || car?.createdAt)}`;
    }
    if (edit instanceof HTMLElement) {
        edit.dataset.carId = car.id;
    }
    if (view instanceof HTMLAnchorElement) {
        view.href = `${detailPage}?id=${encodeURIComponent(car.id)}`;
    }

    return content;
}

async function submitForm(dom, state, config, detailPage) {
    if (!(dom.form instanceof HTMLFormElement)) {
        return;
    }

    const formData = new FormData(dom.form);
    const payload = {
        name: String(formData.get('name') || '').trim(),
        brand: String(formData.get('brand') || '').trim(),
        year: Number(formData.get('year') || 0),
        color: String(formData.get('color') || '').trim(),
        price: Number(formData.get('price') || 0),
        description: String(formData.get('description') || '').trim(),
        available: String(formData.get('available') || 'true') === 'true'
    };

    const carId = String(formData.get('id') || '').trim();
    if (!payload.name || !payload.brand || !payload.color || !payload.description) {
        showMessage(dom, 'Preencha todos os campos obrigatorios.', 'error');
        return;
    }
    if (!payload.year || payload.year < 1886) {
        showMessage(dom, 'Informe um ano valido.', 'error');
        return;
    }
    if (payload.price < 0) {
        showMessage(dom, 'Informe um preco valido.', 'error');
        return;
    }

    const endpoint = carId ? `${config.base}/${encodeURIComponent(carId)}` : config.base;
    const method = carId ? 'PUT' : 'POST';

    try {
        const response = await fetchWithAuth(endpoint, {
            method,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const data = await response.json().catch(() => null);
            const errorMessage = data?.message || 'Nao foi possivel salvar o anuncio.';
            showMessage(dom, errorMessage, 'error');
            return;
        }

        showMessage(dom, carId ? 'Anuncio atualizado com sucesso.' : 'Anuncio criado com sucesso.', 'success');
        resetForm(dom);
        await loadCars(dom, state, config, detailPage);
    } catch (error) {
        showMessage(dom, 'Falha ao salvar anuncio. Tente novamente.', 'error');
    }
}

function fillForm(dom, car) {
    if (!(dom.form instanceof HTMLFormElement)) {
        return;
    }

    const nameField = dom.form.querySelector('[name="name"]');
    const brandField = dom.form.querySelector('[name="brand"]');
    const yearField = dom.form.querySelector('[name="year"]');
    const colorField = dom.form.querySelector('[name="color"]');
    const priceField = dom.form.querySelector('[name="price"]');

    if (nameField instanceof HTMLInputElement) {
        nameField.value = String(car?.name || '');
    }
    if (brandField instanceof HTMLInputElement) {
        brandField.value = String(car?.brand || '');
    }
    if (yearField instanceof HTMLInputElement) {
        yearField.value = String(car?.year || '');
    }
    if (colorField instanceof HTMLInputElement) {
        colorField.value = String(car?.color || '');
    }
    if (priceField instanceof HTMLInputElement) {
        priceField.value = String(car?.price || '');
    }
    const description = dom.form.querySelector('[name="description"]');
    if (description instanceof HTMLTextAreaElement) {
        description.value = String(car?.description || '');
    }
    const available = dom.form.querySelector('[name="available"]');
    if (available instanceof HTMLSelectElement) {
        available.value = car?.available === false ? 'false' : 'true';
    }
    if (dom.id instanceof HTMLInputElement) {
        dom.id.value = car.id;
    }
    if (dom.formTitle) {
        dom.formTitle.textContent = 'Editar anuncio';
    }
    showMessage(dom, 'Voce esta editando um anuncio existente.', 'info');
}

function resetForm(dom) {
    if (!(dom.form instanceof HTMLFormElement)) {
        return;
    }
    dom.form.reset();
    if (dom.id instanceof HTMLInputElement) {
        dom.id.value = '';
    }
    if (dom.formTitle) {
        dom.formTitle.textContent = 'Criar novo anuncio';
    }
    if (dom.message) {
        dom.message.hidden = true;
    }
}

function scrollToForm(dom) {
    dom.form?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function showMessage(dom, text, variant) {
    if (!dom.message) {
        return;
    }
    dom.message.textContent = text;
    dom.message.hidden = false;
    dom.message.dataset.variant = variant || 'info';
}

function normalizeOwnerId(car) {
    const raw = car?.ownerId ?? car?.owner_id ?? car?.owner ?? null;
    if (raw && typeof raw === 'object' && typeof raw.toString === 'function') {
        return raw.toString();
    }
    return raw ? String(raw) : '';
}

function formatCurrency(value) {
    if (typeof value !== 'number') {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) {
            return 'Sob consulta';
        }
        value = parsed;
    }

    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function formatDate(value) {
    if (!value) {
        return 'Sem data';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return 'Sem data';
    }
    return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    }).format(date);
}
