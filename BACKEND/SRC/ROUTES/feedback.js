import express from 'express';
import { z } from 'zod';
import { Mongo } from '../DB/db.js';
import { authenticateToken } from '../MIDDLEWARE/auth.js';
import { validateBody } from '../MIDDLEWARE/validate.js';
import { writeAuditLog } from '../HELPERS/audit.js';

const feedbackRouter = express.Router();

const feedbackSchema = z.object({
    rating: z.coerce.number().int().min(1).max(5),
    message: z.string().trim().min(10).max(1000),
    orderId: z.string().trim().min(3).max(80).optional()
});

feedbackRouter.get('/', async (req, res, next) => {
    try {
        const page = Math.max(1, Number(req.query.page || 1));
        const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));
        const skip = (page - 1) * limit;

        const [items, stats] = await Promise.all([
            Mongo.db
                .collection('feedback')
                .find({})
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .toArray(),
            Mongo.db
                .collection('feedback')
                .aggregate([
                    {
                        $group: {
                            _id: null,
                            average: { $avg: '$rating' },
                            total: { $sum: 1 }
                        }
                    }
                ])
                .toArray()
        ]);

        const summary = stats[0] || { average: 0, total: 0 };

        res.json({
            success: true,
            statusCode: 200,
            body: {
                page,
                limit,
                total: summary.total,
                averageRating: Number((summary.average || 0).toFixed(2)),
                result: items.map((item) => ({
                    id: item._id?.toString() || null,
                    rating: item.rating,
                    message: item.message,
                    createdAt: item.createdAt
                }))
            }
        });
    } catch (error) {
        next(error);
    }
});

feedbackRouter.post('/', authenticateToken, validateBody(feedbackSchema), async (req, res, next) => {
    try {
        const { rating, message, orderId } = req.body;
        const userId = req.user?.userId;

        // Evita duplicidade por usuario/pedido para reduzir abuso e fraude.
        const duplicateFilter = orderId ? { userId, orderId } : { userId, orderId: { $exists: false } };
        const existing = await Mongo.db.collection('feedback').findOne(duplicateFilter);
        if (existing) {
            return res.status(409).json({
                success: false,
                statusCode: 409,
                message: 'Feedback already submitted.'
            });
        }

        const payload = {
            userId,
            rating,
            message,
            orderId: orderId || null,
            createdAt: new Date()
        };

        const result = await Mongo.db.collection('feedback').insertOne(payload);

        res.status(201).json({
            success: true,
            statusCode: 201,
            body: { id: result.insertedId.toString() }
        });

        void writeAuditLog({
            action: 'feedback_create',
            actorId: userId || null,
            actorRole: req.user?.role || null,
            targetId: result.insertedId.toString(),
            req
        });
    } catch (error) {
        next(error);
    }
});

export default feedbackRouter;
