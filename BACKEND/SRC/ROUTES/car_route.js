// Routes //
import express from 'express';
import { z } from 'zod';
import CarsController from '../CONTROLLERS/cars_control.js';
import { authenticateToken, checkRole } from '../MIDDLEWARE/auth.js';
import { validateBody } from '../MIDDLEWARE/validate.js';
import { writeAuditLog } from '../HELPERS/audit.js';

const carRouter = express.Router();
const carsController = new CarsController();

const carBaseSchema = z.object({
    name: z.string().trim().min(2).max(120),
    brand: z.string().trim().min(2).max(80),
    year: z.coerce.number().int().min(1886).max(new Date().getFullYear() + 1),
    color: z.string().trim().min(2).max(60),
    available: z.boolean().optional().default(true),
    price: z.coerce.number().min(0),
    description: z.string().trim().min(10).max(2000).optional(),
    characteristics: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
    specs: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
    media: z.record(z.any()).optional(),
    gallery: z.array(z.any()).optional()
});

const carCreateSchema = carBaseSchema;
const carUpdateSchema = carBaseSchema.partial();

const getCarOwnerId = (car) => {
    if (!car) {
        return null;
    }
    const raw = car.ownerId ?? car.owner_id ?? car.owner ?? null;
    return typeof raw?.toString === 'function' ? raw.toString() : raw ? String(raw) : null;
};

carRouter.get('/', async (req, res, next) => {
    try {
        const { success, statusCode, body } = await carsController.getCars();
        res.status(statusCode).send({ success, statusCode, body });
    } catch (error) {
        next(error);
    }
});

carRouter.get('/availables', async (req, res, next) => {
    try {
        const { success, statusCode, body } = await carsController.getAvailableCars();
        res.status(statusCode).send({ success, statusCode, body });
    } catch (error) {
        next(error);
    }
});

carRouter.post('/pending', authenticateToken, checkRole('client'), validateBody(carCreateSchema), async (req, res, next) => {
    try {
        // Clientes enviam para revisao; evita publicacao direta sem aprovacao.
        const payload = {
            ...req.body,
            ownerId: req.user?.userId || null,
            status: 'pending',
            available: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const { success, statusCode, body } = await carsController.addCar(payload);
        res.status(statusCode).send({ success, statusCode, body });

        if (success) {
            void writeAuditLog({
                action: 'car_submit_pending',
                actorId: req.user?.userId || null,
                actorRole: req.user?.role || null,
                targetId: body?.id || null,
                req
            });
        }
    } catch (error) {
        next(error);
    }
});

carRouter.put('/pending/:id/approve', authenticateToken, checkRole('admin'), async (req, res, next) => {
    try {
        // Somente admin aprova anuncio pendente.
        const carId = req.params.id;
        const existing = await carsController.carDataAccess.getCarById(carId);
        if (existing) {
            return res.status(409).send({
                success: false,
                statusCode: 409,
                message: 'Car is already active.'
            });
        }

        const pending = await carsController.carDataAccess.getPendingCarById?.(carId);
        if (!pending) {
            return res.status(404).send({ success: false, statusCode: 404, message: 'Resource not found.' });
        }

        const update = {
            status: 'active',
            available: true,
            approvedAt: new Date(),
            approvedBy: req.user?.userId || null,
            updatedAt: new Date()
        };

        const { success, statusCode, body } = await carsController.updateCar(carId, update);
        res.status(statusCode).send({ success, statusCode, body });

        if (success) {
            void writeAuditLog({
                action: 'car_pending_approve',
                actorId: req.user?.userId || null,
                actorRole: req.user?.role || null,
                targetId: carId,
                req
            });
        }
    } catch (error) {
        next(error);
    }
});

carRouter.get('/:id', async (req, res, next) => {
    try {
        const { success, statusCode, body } = await carsController.getCarById(req.params.id);
        res.status(statusCode).send({ success, statusCode, body });
    } catch (error) {
        next(error);
    }
});

carRouter.post('/', authenticateToken, checkRole('partner', 'admin'), validateBody(carCreateSchema), async (req, res, next) => {
    try {
        const payload = {
            ...req.body,
            ownerId: req.user?.userId || null,
            status: 'active',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        const { success, statusCode, body } = await carsController.addCar(payload);
        res.status(statusCode).send({ success, statusCode, body });

        if (success) {
            void writeAuditLog({
                action: 'car_create',
                actorId: req.user?.userId || null,
                actorRole: req.user?.role || null,
                targetId: body?.id || null,
                req
            });
        }
    } catch (error) {
        next(error);
    }
});

carRouter.put('/:id', authenticateToken, checkRole('partner', 'admin'), validateBody(carUpdateSchema), async (req, res, next) => {
    try {
        const existing = await carsController.carDataAccess.getCarById(req.params.id);
        if (!existing) {
            return res.status(404).send({ success: false, statusCode: 404, message: 'Resource not found.' });
        }

        const ownerId = getCarOwnerId(existing);
        const isAdmin = req.user?.role === 'admin';
        if (!isAdmin && ownerId && ownerId !== req.user?.userId) {
            return res.status(403).send({ success: false, statusCode: 403, message: 'Access denied.' });
        }

        const payload = { ...req.body, updatedAt: new Date() };
        const { success, statusCode, body } = await carsController.updateCar(req.params.id, payload);
        res.status(statusCode).send({ success, statusCode, body });

        if (success) {
            void writeAuditLog({
                action: 'car_update',
                actorId: req.user?.userId || null,
                actorRole: req.user?.role || null,
                targetId: req.params.id,
                req
            });
        }
    } catch (error) {
        next(error);
    }
});

carRouter.delete('/:id', authenticateToken, checkRole('partner', 'admin'), async (req, res, next) => {
    try {
        const existing = await carsController.carDataAccess.getCarById(req.params.id);
        if (!existing) {
            return res.status(404).send({ success: false, statusCode: 404, message: 'Resource not found.' });
        }

        const ownerId = getCarOwnerId(existing);
        const isAdmin = req.user?.role === 'admin';
        if (!isAdmin && ownerId && ownerId !== req.user?.userId) {
            return res.status(403).send({ success: false, statusCode: 403, message: 'Access denied.' });
        }

        const { success, statusCode, body } = await carsController.deleteCar(req.params.id);
        res.status(statusCode).send({ success, statusCode, body });

        if (success) {
            void writeAuditLog({
                action: 'car_delete',
                actorId: req.user?.userId || null,
                actorRole: req.user?.role || null,
                targetId: req.params.id,
                req
            });
        }
    } catch (error) {
        next(error);
    }
});

export default carRouter;