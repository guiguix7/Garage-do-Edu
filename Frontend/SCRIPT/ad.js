document.addEventListener('DOMContentLoaded', () => {
    setupScheduleButtons();
    void hydrateCarDetails();
});

function setupScheduleButtons() {
    const scheduleButtons = document.querySelectorAll('[data-open-schedule]');
    const contactSection = document.querySelector('.ad-contact');

    if (!scheduleButtons.length || !contactSection) {
        return;
    }

    scheduleButtons.forEach((button) => {
        button.addEventListener('click', () => {
            contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    });
}

async function hydrateCarDetails() {
    const dom = collectCarDom();
    const setStatus = (message, variant = 'info') => {
        if (!dom.status) {
            return;
        }
        if (!message) {
            dom.status.hidden = true;
            dom.status.textContent = '';
            delete dom.status.dataset.statusVariant;
            return;
        }
        dom.status.hidden = false;
        dom.status.textContent = message;
        dom.status.dataset.statusVariant = variant;
    };

    const params = new URLSearchParams(window.location.search);
    const carId = params.get('id');

    if (!carId) {
        setStatus('Anúncio não encontrado. Volte ao estoque para escolher outro veículo.', 'error');
        return;
    }

    setStatus('Carregando anúncio...', 'loading');

    const config = typeof getInventoryConfig === 'function'
        ? getInventoryConfig({ body: document.body })
        : createInventoryFallbackConfig();

    try {
        const response = await fetch(config.detail(carId), {
            method: 'GET',
            credentials: 'include',
            headers: {
                Accept: 'application/json'
            }
        });

        if (response.status === 404) {
            setStatus('Veículo não encontrado ou indisponível.', 'error');
            return;
        }

        if (!response.ok) {
            throw new Error(`Falha ao buscar anúncio (${response.status}).`);
        }

        const payload = await response.json();
        const car = payload?.body?.car ?? payload?.body ?? null;

        if (!car) {
            throw new Error('Resposta inválida do servidor.');
        }

        applyCarDetails(car, dom);
        setStatus('', '');
    } catch (error) {
        console.error('Failed to hydrate car detail:', error);
        setStatus('Não foi possível carregar os detalhes do veículo. Tente novamente mais tarde.', 'error');
    }
}

function collectCarDom() {
    const root = document.querySelector('[data-car-page]');
    return {
        root,
        status: root?.querySelector('[data-car-status]') ?? document.querySelector('[data-car-status]'),
        title: document.getElementById('page-title'),
        hero: {
            cover: root?.querySelector('[data-car-cover]') ?? null,
            badge: root?.querySelector('[data-car-badge]') ?? null,
            tag: root?.querySelector('[data-car-tag]') ?? null,
            title: root?.querySelector('[data-car-title]') ?? null,
            subtitle: root?.querySelector('[data-car-subtitle]') ?? null,
            description: root?.querySelector('[data-car-description]') ?? null,
            priceBlock: root?.querySelector('[data-car-price-block]') ?? null,
            priceLabel: root?.querySelector('[data-car-price-label]') ?? null,
            priceValue: root?.querySelector('[data-car-price]') ?? null,
            installments: root?.querySelector('[data-car-installments]') ?? null,
            facts: {
                year: root?.querySelector('[data-car-year]') ?? null,
                mileage: root?.querySelector('[data-car-km]') ?? null,
                fuel: root?.querySelector('[data-car-fuel]') ?? null,
                color: root?.querySelector('[data-car-color]') ?? null
            },
            whatsapp: root?.querySelector('[data-car-whatsapp]') ?? null
        },
        sections: {
            specs: root?.querySelector('[data-car-specs]') ?? null,
            history: root?.querySelector('[data-car-history]') ?? null,
            services: root?.querySelector('[data-car-services]') ?? null
        },
        gallery: {
            container: root?.querySelector('[data-gallery]') ?? null,
            template: root?.querySelector('template[data-gallery-template]') ?? null
        },
        contacts: {
            whatsapp: root?.querySelector('[data-car-contact-whatsapp]') ?? null,
            email: root?.querySelector('[data-car-contact-email]') ?? null
        }
    };
}

function createInventoryFallbackConfig() {
    const base = (document.body.dataset.inventoryEndpoint || 'http://localhost:3000/cars').replace(/\/$/, '');
    return {
        base,
        list: `${base}/availables`,
        detail: (carId) => `${base}/${encodeURIComponent(carId)}`
    };
}

function applyCarDetails(car, dom) {
    const name = safeText(car.name ?? car.title ?? 'Veículo disponível');
    updateDocumentTitle(dom, name);
    updateHeroSection(car, dom, name);
    updateFacts(car, dom);
    updateSpecs(car, dom);
    updateNarratives(car, dom);
    updateGallery(car, dom, name);
    updateContactLinks(car, dom, name);
}

function updateDocumentTitle(dom, name) {
    if (dom.title) {
        dom.title.textContent = `${name} - Garage do Edu`;
    }
    document.title = `${name} - Garage do Edu`;
}

function updateHeroSection(car, dom, name) {
    const hero = dom.hero;
    if (!hero) {
        return;
    }

    const coverSrc = resolveCoverImage(car) ?? '../SRC/ASSETS/IMG/carro1-carrossel-teste.jpg';
    if (hero.cover instanceof HTMLImageElement) {
        hero.cover.src = coverSrc;
        hero.cover.alt = `${name} em destaque`;
    }

    setText(hero.badge, car.available === false ? 'Negociação encerrada' : 'Disponível no showroom');
    setText(hero.tag, buildHeroTag(car));
    setText(hero.title, name);
    setText(hero.subtitle, buildSubtitle(car));
    setText(hero.description, safeText(car.description ?? car.summary ?? 'Entre em contato para solicitar o dossiê completo.'));

    const priceValue = extractField(car, ['price', 'valor', 'value']);
    const formattedPrice = formatDetailPrice(priceValue);
    const hasExplicitPrice = Boolean(formattedPrice && formattedPrice !== 'Consulte');

    if (hero.priceBlock) {
        hero.priceBlock.hidden = false;
    }

    setText(hero.priceLabel, hasExplicitPrice ? 'Preço especial' : 'Sob consulta');
    setText(hero.priceValue, formattedPrice ?? 'Consulte');
    setText(hero.installments, extractPaymentPlan(car));

    const whatsappLink = buildWhatsappLink(name);
    if (hero.whatsapp instanceof HTMLAnchorElement) {
        hero.whatsapp.href = whatsappLink;
    }
}

function updateFacts(car, dom) {
    const facts = dom.hero?.facts;
    if (!facts) {
        return;
    }

    setText(facts.year, extractYear(car));
    setText(facts.mileage, formatMileage(extractField(car, ['mileage', 'km', 'kilometragem', 'odometer'])));
    setText(facts.fuel, safeText(extractField(car, ['fuel', 'fuelType', 'combustivel'])) || 'Sob consulta');
    setText(facts.color, safeText(extractField(car, ['color', 'cor'])) || 'Sob consulta');
}

function updateSpecs(car, dom) {
    const specsHost = dom.sections.specs;
    if (!specsHost) {
        return;
    }

    setText(specsHost.querySelector('[data-spec-engine]'), safeText(extractField(car, ['engine', 'motor'])) || 'Sob consulta');
    setText(specsHost.querySelector('[data-spec-power]'), safeText(extractField(car, ['power', 'potencia'])) || 'Sob consulta');
    setText(specsHost.querySelector('[data-spec-torque]'), safeText(extractField(car, ['torque'])) || 'Sob consulta');
    setText(specsHost.querySelector('[data-spec-transmission]'), safeText(extractField(car, ['transmission', 'cambio'])) || 'Sob consulta');
    setText(specsHost.querySelector('[data-spec-drive]'), safeText(extractField(car, ['drive', 'tracao'])) || 'Sob consulta');
    setText(specsHost.querySelector('[data-spec-doc]'), safeText(extractField(car, ['documentation', 'documentacao', 'documents'])) || 'Sob consulta');
}

function updateNarratives(car, dom) {
    const historyHost = dom.sections.history?.querySelector('.feature-list');
    const servicesHost = dom.sections.services?.querySelector('.feature-list');

    if (historyHost) {
        renderBulletList(historyHost, collectNarratives(car, ['history', 'conservationNotes', 'highlights', 'notes']));
    }

    if (servicesHost) {
        renderBulletList(servicesHost, collectNarratives(car, ['services', 'perks', 'benefits']));
    }
}

function updateGallery(car, dom, name) {
    const { container, template } = dom.gallery;
    if (!container) {
        return;
    }

    container.innerHTML = '';

    const entries = collectGalleryItems(car, name);
    if (!entries.length) {
        return;
    }

    entries.forEach((entry, index) => {
        const figure = template?.content?.firstElementChild
            ? template.content.firstElementChild.cloneNode(true)
            : createFallbackGalleryNode();
        const image = figure.querySelector('[data-gallery-image]') ?? figure.querySelector('img');
        const caption = figure.querySelector('[data-gallery-caption]') ?? figure.querySelector('figcaption');

        if (image instanceof HTMLImageElement) {
            image.src = entry.src;
            image.alt = entry.alt ?? `${name} - imagem ${index + 1}`;
            image.loading = 'lazy';
            image.decoding = 'async';
            image.setAttribute('tabindex', '0');
            const openPreview = () => window.open(entry.src, '_blank', 'noopener');
            image.addEventListener('click', openPreview);
            image.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openPreview();
                }
            });
        }

        if (caption) {
            caption.textContent = safeText(entry.caption ?? entry.alt ?? `Detalhe ${index + 1}`);
        }

        container.appendChild(figure);
    });
}

function updateContactLinks(car, dom, name) {
    const whatsappLink = buildWhatsappLink(name);
    if (dom.contacts.whatsapp instanceof HTMLAnchorElement) {
        dom.contacts.whatsapp.href = whatsappLink;
    }

    if (dom.contacts.email instanceof HTMLAnchorElement) {
        const base = 'contato@garagedoedu.com';
        const subject = encodeURIComponent(`Interesse no ${name}`);
        dom.contacts.email.href = `mailto:${base}?subject=${subject}`;
    }
}

function buildHeroTag(car) {
    const parts = [safeText(car.brand ?? car.maker ?? '')];
    const category = safeText(car.category ?? car.segment ?? '');
    if (category) {
        parts.push(category);
    }
    return parts.filter(Boolean).join(' • ') || 'Colecionável certificado';
}

function buildSubtitle(car) {
    const specs = [];
    const engine = safeText(extractField(car, ['engine', 'motor']));
    const transmission = safeText(extractField(car, ['transmission', 'cambio']));
    const power = safeText(extractField(car, ['power', 'potencia']));

    if (engine) {
        specs.push(engine);
    }
    if (transmission) {
        specs.push(transmission);
    }
    if (power) {
        specs.push(power);
    }

    if (specs.length === 0) {
        const fallback = [safeText(car.version), safeText(car.trim), safeText(car.bodyStyle)].filter(Boolean);
        return fallback.join(' • ') || 'Clássico selecionado Garage do Edu';
    }

    return specs.join(' • ');
}

function extractPaymentPlan(car) {
    const plan = safeText(extractField(car, ['paymentPlan', 'installments', 'parcelas']));
    if (plan) {
        return plan;
    }
    return 'Entrada flexível + saldo em até 48x com aprovação imediata';
}

function resolveCoverImage(car) {
    if (typeof selectPrimaryImage === 'function') {
        const primary = selectPrimaryImage(car, { preferHero: true }) ?? selectPrimaryImage(car);
        if (primary) {
            return primary;
        }
    }
    return (
        car.media?.cover ??
        car.coverImage ??
        car.media?.hero?.[0]?.src ??
        car.media?.gallery?.[0]?.src ??
        car.gallery?.[0]?.src ??
        null
    );
}

function extractYear(car) {
    if (car.year) {
        return `${car.year}`;
    }
    const fromSpec = extractField(car, ['year', 'ano', 'modelYear']);
    return fromSpec ? `${fromSpec}` : 'Sob consulta';
}

function formatMileage(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return `${value.toLocaleString('pt-BR')} km`;
    }
    if (typeof value === 'string' && value.trim()) {
        const digits = value.replace(/[^\d]/g, '');
        if (digits) {
            return `${Number.parseInt(digits, 10).toLocaleString('pt-BR')} km`;
        }
        return value.trim();
    }
    return 'Sob consulta';
}

function formatDetailPrice(value) {
    if (typeof formatCurrency === 'function') {
        return formatCurrency(value);
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    if (typeof value === 'string' && value.trim()) {
        return value.trim();
    }
    return 'Consulte';
}

function buildWhatsappLink(name) {
    const base = typeof WHATSAPP_BASE_URL === 'string' ? WHATSAPP_BASE_URL : 'https://wa.me/5511963152153';
    const message = encodeURIComponent(`Olá, tenho interesse no ${name}. Pode me enviar mais detalhes?`);
    return `${base}?text=${message}`;
}

function renderBulletList(host, entries) {
    if (!host) {
        return;
    }

    host.innerHTML = '';

    if (!entries.length) {
        return;
    }

    entries.forEach((entry) => {
        const li = document.createElement('li');
        li.textContent = entry;
        host.appendChild(li);
    });
}

function collectNarratives(car, fieldCandidates) {
    const entries = [];

    fieldCandidates.forEach((field) => {
        const value = extractField(car, [field]);
        if (Array.isArray(value)) {
            value.forEach((item) => {
                const text = safeText(item);
                if (text) {
                    entries.push(text);
                }
            });
        } else {
            const text = safeText(value);
            if (text) {
                entries.push(text);
            }
        }
    });

    return entries.slice(0, 8);
}

function collectGalleryItems(car, name) {
    const gallerySources = [car.media?.hero, car.media?.gallery, car.gallery, car.images];
    const items = [];
    const seen = new Set();

    gallerySources.forEach((source) => {
        if (!source) {
            return;
        }
        const array = Array.isArray(source) ? source : [source];
        array.forEach((entry, index) => {
            const normalized = normalizeGalleryEntry(entry, name, items.length + index);
            if (normalized && !seen.has(normalized.src)) {
                seen.add(normalized.src);
                items.push(normalized);
            }
        });
    });

    if (!items.length) {
        const cover = resolveCoverImage(car);
        if (cover) {
            items.push({ src: cover, alt: `${name} - imagem principal` });
        }
    }

    return items;
}

function normalizeGalleryEntry(entry, name, index) {
    if (!entry) {
        return null;
    }

    const fallbackAlt = `${name} - imagem ${index + 1}`;

    if (typeof entry === 'string') {
        return { src: entry, alt: fallbackAlt };
    }

    if (typeof entry === 'object') {
        const src = entry.src ?? entry.url ?? entry.href ?? entry.image ?? null;
        if (!src) {
            return null;
        }
        return {
            src,
            alt: entry.alt ?? entry.description ?? entry.caption ?? fallbackAlt,
            caption: entry.caption ?? entry.alt ?? null
        };
    }

    return null;
}

function createFallbackGalleryNode() {
    const figure = document.createElement('figure');
    figure.className = 'gallery-item';
    const image = document.createElement('img');
    image.setAttribute('data-gallery-image', '');
    const caption = document.createElement('figcaption');
    caption.setAttribute('data-gallery-caption', '');
    figure.append(image, caption);
    return figure;
}

function extractField(car, keys) {
    const sources = [car, car.specs, car.characteristics, car.details, car.info];
    const normalizedKeys = keys.map((key) => String(key ?? '').toLowerCase());

    for (const source of sources) {
        if (!source || typeof source !== 'object') {
            continue;
        }
        for (const [prop, value] of Object.entries(source)) {
            if (normalizedKeys.includes(prop.toLowerCase()) && value !== undefined && value !== null && value !== '') {
                return value;
            }
        }
    }

    return null;
}

function safeText(value, fallback = '') {
    if (typeof sanitizeText === 'function') {
        const sanitized = sanitizeText(value);
        return sanitized || fallback;
    }
    if (value === null || value === undefined) {
        return fallback;
    }
    const normalized = String(value).replace(/\s+/g, ' ').trim();
    return normalized || fallback;
}

function setText(element, text) {
    if (!element) {
        return;
    }
    const value = text ?? '';
    if (!value) {
        element.textContent = '';
        return;
    }
    element.textContent = value;
}
