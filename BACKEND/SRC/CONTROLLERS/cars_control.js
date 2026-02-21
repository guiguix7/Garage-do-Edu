// Controller //

// Import necessary modules //
import CarDataAccess from "../DATA/cars.js";
import { OK, NotFound, ServerError } from '../HELPERS/httpResponse.js';

const toArray = (value) => (Array.isArray(value) ? value : []);

const normalizeGalleryItem = (entry, fallbackName, index) => {
    if (!entry) {
        return null;
    }

    const defaultAlt = fallbackName ? `${fallbackName} - imagem ${index + 1}` : `Imagem ${index + 1}`;

    if (typeof entry === 'string') {
        return {
            src: entry,
            alt: defaultAlt
        };
    }

    if (typeof entry === 'object') {
        const src = entry.src ?? entry.url ?? entry.href ?? entry.image ?? null;
        if (!src) {
            return null;
        }

        const item = {
            src,
            alt: entry.alt ?? entry.description ?? entry.caption ?? defaultAlt
        };

        if (entry.title) {
            item.title = entry.title;
        }

        if (entry.caption) {
            item.caption = entry.caption;
        }

        if (entry.width) {
            item.width = entry.width;
        }

        if (entry.height) {
            item.height = entry.height;
        }

        return item;
    }

    return null;
};

const collectGalleryEntries = (doc) => {
    if (!doc || typeof doc !== 'object') {
        return [];
    }

    const buckets = [
        doc.gallery,
        doc.carousel,
        doc.images,
        doc.assetGallery,
        doc.heroImages,
        doc.media?.gallery,
        doc.media?.carousel,
        doc.media?.images
    ];

    const entries = [];
    buckets.forEach((bucket) => {
        toArray(bucket).forEach((item) => entries.push(item));
    });

    return entries;
};

const normalizeHeroEntries = (entries, fallbackName) =>
    toArray(entries)
        .map((entry, index) => normalizeGalleryItem(entry, fallbackName, index))
        .filter(Boolean);

const dedupeGallery = (items) => {
    const seen = new Set();
    const deduped = [];

    items.forEach((item) => {
        if (!item?.src) {
            return;
        }

        if (seen.has(item.src)) {
            return;
        }

        seen.add(item.src);
        deduped.push(item);
    });

    return deduped;
};

const normalizeCarDocument = (doc) => {
    if (!doc) {
        return null;
    }

    const {
        _id,
        gallery,
        carousel,
        images,
        heroImages,
        media = {},
        characteristics,
        specs,
        assetGallery,
        coverImage,
        ...rest
    } = doc;

    const id = typeof _id === 'object' && typeof _id.toString === 'function' ? _id.toString() : String(_id ?? '');
    const fallbackName = rest.name ?? 'Veículo';

    const galleryEntries = collectGalleryEntries({
        gallery,
        carousel,
        images,
        media,
        heroImages,
        assetGallery
    });

    const normalizedGallery = dedupeGallery(
        galleryEntries.map((entry, index) => normalizeGalleryItem(entry, fallbackName, index)).filter(Boolean)
    );

    const heroMedia = dedupeGallery(normalizeHeroEntries(heroImages ?? media.hero, fallbackName));

    const resolvedSpecs =
        specs && typeof specs === 'object'
            ? specs
            : characteristics && typeof characteristics === 'object'
            ? characteristics
            : {};

    const cover = coverImage ?? media.cover ?? heroMedia[0]?.src ?? normalizedGallery[0]?.src ?? null;

    const normalizedMedia = {
        ...(typeof media === 'object' && media ? media : {}),
        cover,
        gallery: normalizedGallery,
        hero: heroMedia
    };

    const normalizedCar = {
        id,
        ...rest,
        available: Boolean(rest.available),
        specs: resolvedSpecs,
        characteristics: resolvedSpecs,
        media: normalizedMedia,
        gallery: normalizedGallery,
        coverImage: cover
    };

    return normalizedCar;
};

const normalizeCarsCollection = (payload) => {
    if (!payload) {
        return { info: null, total: 0, cars: [] };
    }

    const records = Array.isArray(payload.result) ? payload.result : Array.isArray(payload) ? payload : [];
    const cars = records.map(normalizeCarDocument).filter(Boolean);

    return {
        info: payload.info ?? null,
        total: cars.length,
        cars
    };
};

// Define CarsController class //
export default class CarsController {

    constructor() {
        this.carDataAccess = new CarDataAccess();
    }

    // Get all cars //
    async getCars() {
        try {
            const cars = await this.carDataAccess.getCars();

            return OK(normalizeCarsCollection(cars));

        } catch (error) {
            return ServerError(error);
        }
    }

    // Get available cars //
    async getAvailableCars() {
        try {
            const cars = await this.carDataAccess.getAvailableCars();

            const normalized = normalizeCarsCollection(cars);
            return OK({ ...normalized, info: normalized.info ?? "Available cars only" });

        } catch (error) {
            return ServerError(error);
        }
    }

    async getCarById(carId) {
        try {
            const car = await this.carDataAccess.getCarById(carId);

            if (!car) {
                return NotFound();
            }

            return OK({ car: normalizeCarDocument(car) });
        } catch (error) {
            return ServerError(error);
        }
    }

    async addCar(carData) {
        try {
            const newCount = await this.carDataAccess.addCar(carData);

            if (!newCount) {
                return NotFound();
            }

            return OK({ added: true, id: newCount });

        } catch (error) {
            return ServerError(error);
        }

    }

    // Delete a car by ID //
    async deleteCar(carId) {
        try {
            const deletedCount = await this.carDataAccess.deleteCar(carId);

            if (!deletedCount) {
                return NotFound();
            }

            return OK({ deleted: true, id_deleted: carId });

        } catch (error) {
            return ServerError(error);
        }

    }

    // Update a car by ID //
    async updateCar(carId, carData) {
        try {
            const modifiedCount = await this.carDataAccess.updateCar(carId, carData);

            if (!modifiedCount) {
                return NotFound();
            }

            return OK({ updated: true, id_updated: carId, data: carData });

        } catch (error) {
            return ServerError(error);
        }

    }
}