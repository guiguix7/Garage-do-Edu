// Projeto/BACKEND/SRC/ROUTES/user.js
// Routes //
import express from 'express';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import UserController from '../CONTROLLERS/users.js';
import { Mongo } from '../DB/db.js';
import { checkRole } from '../MIDDLEWARE/auth.js';
import { validateBody } from '../MIDDLEWARE/validate.js';
import { writeAuditLog } from '../HELPERS/audit.js';

// Create router and controller instances //

const userRouter = express.Router();
const userController = new UserController();

const userUpdateSchema = z
    .object({
        username: z.string().trim().min(2).max(40).optional(),
        email: z.string().trim().email().optional(),
        password: z.string().min(8).optional(),
        isActive: z.boolean().optional()
    })
    .strict();

const maintenanceSchema = z.object({
    enabled: z.boolean()
});

userRouter.use(checkRole('admin'));

userRouter.get('/', async (req, res) => {
    const { success, statusCode, body } = await userController.getUsers();

    res.status(statusCode).send({ success, statusCode, body });
});

userRouter.get('/logs', async (req, res) => {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
        Mongo.db.collection('audit_logs').find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
        Mongo.db.collection('audit_logs').countDocuments()
    ]);

    res.json({
        success: true,
        statusCode: 200,
        body: {
            page,
            limit,
            total,
            result: items
        }
    });
});

userRouter.post('/maintenance', validateBody(maintenanceSchema), async (req, res) => {
    const { enabled } = req.body;

    await Mongo.db.collection('system_settings').updateOne(
        { key: 'maintenance' },
        { $set: { key: 'maintenance', enabled, updatedAt: new Date() } },
        { upsert: true }
    );

    res.json({
        success: true,
        statusCode: 200,
        body: { enabled }
    });

    void writeAuditLog({
        action: 'maintenance_toggle',
        actorId: req.user?.userId || null,
        actorRole: req.user?.role || null,
        targetId: 'maintenance',
        meta: { enabled },
        req
    });
});

userRouter.get('/stats', async (req, res) => {
    const [totalUsers, totalCars, availableCars, partners, admins] = await Promise.all([
        Mongo.db.collection('users').countDocuments(),
        Mongo.db.collection('cars').countDocuments(),
        Mongo.db.collection('cars').countDocuments({ available: true }),
        Mongo.db.collection('users').countDocuments({ role: 'partner' }),
        Mongo.db.collection('users').countDocuments({ role: 'admin' })
    ]);

    res.json({
        success: true,
        statusCode: 200,
        body: {
            totalUsers,
            totalCars,
            availableCars,
            soldCars: Math.max(0, totalCars - availableCars),
            partners,
            admins
        }
    });
});

userRouter.delete('/:id', async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
            success: false,
            statusCode: 400,
            message: 'Invalid user id.'
        });
    }
    const { success, statusCode, body } = await userController.deleteUser(req.params.id);

    res.status(statusCode).send({ success, statusCode, body });

    if (success) {
        void writeAuditLog({
            action: 'user_delete',
            actorId: req.user?.userId || null,
            actorRole: req.user?.role || null,
            targetId: req.params.id,
            req
        });
    }
});

userRouter.put('/:id', validateBody(userUpdateSchema), async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
            success: false,
            statusCode: 400,
            message: 'Invalid user id.'
        });
    }
    const { success, statusCode, body } = await userController.updateUser(req.params.id, req.body);

    res.status(statusCode).send({ success, statusCode, body });

    if (success) {
        void writeAuditLog({
            action: 'user_update',
            actorId: req.user?.userId || null,
            actorRole: req.user?.role || null,
            targetId: req.params.id,
            req
        });
    }
});

// Promoção
userRouter.patch('/:id/role', async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (!ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            statusCode: 400,
            message: 'Invalid user id.'
        });
    }

    if (role !== 'partner') {
        return res.status(400).json({
            success: false,
            statusCode: 400,
            message: 'Access denied.'
        });
    }

    const result = await Mongo.db.collection('users').updateOne(
        {
            _id: new ObjectId(id),
            role: 'client'
        },
        {
            $set: {
                role: 'partner'
            }
        }
    )

    if (result.modifiedCount === 0) {
        return res.status(404).json({
            success: false,
            statusCode: 404,
            message: 'User not found or already promoted.'
        });
    }

    res.json({
        success: true,
        statusCode: 200,
        message: 'User promoted to partner successfully.',
        body: {
            idPromoted: id,
            newRole: 'partner'
        }
    })

    void writeAuditLog({
        action: 'user_role_promoted',
        actorId: req.user?.userId || null,
        actorRole: req.user?.role || null,
        targetId: id,
        req
    });
})


export default userRouter;