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

const getPagination = (req, defaultLimit = 20, maxLimit = 100) => {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(maxLimit, Math.max(1, Number(req.query.limit || defaultLimit)));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
};

const formatBytes = (bytes) => {
    const value = Number(bytes || 0);
    if (!value) {
        return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const index = Math.min(units.length - 1, Math.floor(Math.log(value) / Math.log(1024)));
    const size = (value / Math.pow(1024, index)).toFixed(2);
    return `${size} ${units[index]}`;
};

const userUpdateSchema = z
    .object({
        username: z.string().trim().min(2).max(40).optional(),
        email: z.string().trim().email().optional(),
        password: z.string().min(8).optional(),
        isActive: z.boolean().optional()
    })
    .strict();

const maintenanceSchema = z
    .object({
        enabled: z.boolean(),
        pages: z.array(z.string().trim().min(1)).optional()
    })
    .strict();

const leadCreateSchema = z
    .object({
        name: z.string().trim().min(2).max(120),
        channel: z.string().trim().min(2).max(80),
        interest: z.string().trim().min(2).max(120).optional(),
        status: z.enum(['novo', 'contato', 'qualificado', 'perdido']).optional(),
        notes: z.string().trim().max(1000).optional()
    })
    .strict();

const leadUpdateSchema = leadCreateSchema.partial();

const pageSchema = z
    .object({
        title: z.string().trim().min(2).max(120),
        slug: z.string().trim().min(2).max(120),
        status: z.enum(['draft', 'published']).optional(),
        content: z.string().trim().max(5000).optional()
    })
    .strict();

const mediaSchema = z
    .object({
        name: z.string().trim().min(2).max(120),
        url: z.string().trim().url(),
        type: z.enum(['image', 'video', 'document']).optional(),
        usage: z.string().trim().max(120).optional(),
        status: z.enum(['active', 'draft']).optional()
    })
    .strict();

const stockSchema = z
    .object({
        name: z.string().trim().min(2).max(120),
        status: z.enum(['disponivel', 'reservado', 'vendido', 'avaliacao']).optional(),
        km: z.coerce.number().min(0).optional(),
        location: z.string().trim().max(120).optional(),
        suggestedPrice: z.coerce.number().min(0).optional()
    })
    .strict();

const commissionSchema = z
    .object({
        partner: z.string().trim().min(2).max(120),
        amount: z.coerce.number().min(0),
        status: z.enum(['pending', 'paid']).optional(),
        dueDate: z.string().trim().min(4).optional()
    })
    .strict();

const automationSchema = z
    .object({
        settings: z.record(z.boolean()).optional()
    })
    .strict();

const securityPolicySchema = z
    .object({
        twoFactorRequired: z.boolean(),
        roles: z.array(z.string().trim().min(2)).optional()
    })
    .strict();

const twoFactorSchema = z
    .object({
        enabled: z.boolean()
    })
    .strict();

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

userRouter.get('/maintenance', async (req, res) => {
    const record = await Mongo.db.collection('system_settings').findOne({ key: 'maintenance' });
    const enabled = Boolean(record?.enabled);
    const pages = Array.isArray(record?.pages) ? record.pages : [];

    res.json({
        success: true,
        statusCode: 200,
        body: {
            enabled,
            pages,
            updatedAt: record?.updatedAt || null
        }
    });
});

userRouter.post('/maintenance', validateBody(maintenanceSchema), async (req, res) => {
    const { enabled } = req.body;
    const pages = Array.isArray(req.body.pages) ? [...new Set(req.body.pages)].filter(Boolean) : [];

    await Mongo.db.collection('system_settings').updateOne(
        { key: 'maintenance' },
        { $set: { key: 'maintenance', enabled, pages, updatedAt: new Date() } },
        { upsert: true }
    );

    res.json({
        success: true,
        statusCode: 200,
        body: { enabled, pages }
    });

    void writeAuditLog({
        action: 'maintenance_toggle',
        actorId: req.user?.userId || null,
        actorRole: req.user?.role || null,
        targetId: 'maintenance',
        meta: { enabled, pages },
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

userRouter.get('/alerts', async (req, res) => {
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const [pendingAds, noMedia, docsPending, idleStock] = await Promise.all([
        Mongo.db.collection('cars').countDocuments({ status: 'pending' }),
        Mongo.db.collection('cars').countDocuments({
            $or: [
                { media: { $exists: false } },
                { media: null },
                { gallery: { $exists: false } },
                { gallery: { $size: 0 } }
            ]
        }),
        Mongo.db.collection('cars').countDocuments({ 'specs.docsStatus': 'pending' }),
        Mongo.db.collection('cars').countDocuments({ available: true, updatedAt: { $lte: sixtyDaysAgo } })
    ]);

    res.json({
        success: true,
        statusCode: 200,
        body: {
            items: [
                { title: 'Anúncios sem mídia', count: noMedia, description: 'Complete fotos e vídeos pendentes.' },
                { title: 'Documentos pendentes', count: docsPending, description: 'Laudos aguardando validação.' },
                { title: 'Anúncios para aprovação', count: pendingAds, description: 'Itens aguardando revisão.' },
                { title: 'Estoque parado', count: idleStock, description: 'Veículos sem movimento.' }
            ]
        }
    });
});

userRouter.get('/tasks', async (req, res) => {
    const [pendingAds, pendingLeads, inactivePartners] = await Promise.all([
        Mongo.db.collection('cars').countDocuments({ status: 'pending' }),
        Mongo.db.collection('leads').countDocuments({ status: 'novo' }),
        Mongo.db.collection('users').countDocuments({ role: 'partner', isActive: false })
    ]);

    res.json({
        success: true,
        statusCode: 200,
        body: {
            items: [
                {
                    id: 'pending_ads',
                    title: 'Revisar anúncios pendentes',
                    description: `${pendingAds} anúncios aguardando aprovação`,
                    link: '#anuncios'
                },
                {
                    id: 'pending_leads',
                    title: 'Responder leads novos',
                    description: `${pendingLeads} leads aguardando contato`,
                    link: '#leads'
                },
                {
                    id: 'inactive_partners',
                    title: 'Revisar parceiros inativos',
                    description: `${inactivePartners} parceiros inativos`,
                    link: '#parceiros'
                }
            ]
        }
    });
});

userRouter.get('/leads', async (req, res) => {
    const { page, limit, skip } = getPagination(req, 10, 50);
    const status = req.query.status ? String(req.query.status) : null;
    const channel = req.query.channel ? String(req.query.channel) : null;
    const filter = {};
    if (status) {
        filter.status = status;
    }
    if (channel) {
        filter.channel = channel;
    }

    const [items, total, sales] = await Promise.all([
        Mongo.db.collection('leads').find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
        Mongo.db.collection('leads').countDocuments(filter),
        Mongo.db.collection('leads').countDocuments({ ...filter, status: 'qualificado' })
    ]);

    const channelAgg = await Mongo.db.collection('leads').aggregate([
        { $match: filter },
        { $group: { _id: '$channel', total: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $limit: 1 }
    ]).toArray();
    const primarySource = channelAgg[0]?._id || null;

    res.json({
        success: true,
        statusCode: 200,
        body: {
            page,
            limit,
            total,
            sales,
            visits: total,
            primarySource,
            result: items.map((item) => ({
                id: item._id?.toString() || null,
                name: item.name,
                channel: item.channel,
                interest: item.interest || null,
                status: item.status || 'novo',
                createdAt: item.createdAt
            }))
        }
    });
});

userRouter.post('/leads', validateBody(leadCreateSchema), async (req, res) => {
    const payload = {
        ...req.body,
        status: req.body.status || 'novo',
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const result = await Mongo.db.collection('leads').insertOne(payload);

    res.status(201).json({
        success: true,
        statusCode: 201,
        body: { id: result.insertedId.toString() }
    });

    void writeAuditLog({
        action: 'lead_create',
        actorId: req.user?.userId || null,
        actorRole: req.user?.role || null,
        targetId: result.insertedId.toString(),
        req
    });
});

userRouter.patch('/leads/:id', validateBody(leadUpdateSchema), async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, statusCode: 400, message: 'Invalid lead id.' });
    }

    const update = { ...req.body, updatedAt: new Date() };
    await Mongo.db.collection('leads').updateOne({ _id: new ObjectId(req.params.id) }, { $set: update });

    res.json({ success: true, statusCode: 200, body: { id: req.params.id } });

    void writeAuditLog({
        action: 'lead_update',
        actorId: req.user?.userId || null,
        actorRole: req.user?.role || null,
        targetId: req.params.id,
        meta: update,
        req
    });
});

userRouter.delete('/leads/:id', async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, statusCode: 400, message: 'Invalid lead id.' });
    }

    await Mongo.db.collection('leads').deleteOne({ _id: new ObjectId(req.params.id) });

    res.json({ success: true, statusCode: 200, body: { id: req.params.id } });

    void writeAuditLog({
        action: 'lead_delete',
        actorId: req.user?.userId || null,
        actorRole: req.user?.role || null,
        targetId: req.params.id,
        req
    });
});

userRouter.get('/finance', async (req, res) => {
    const { limit, skip } = getPagination(req, 6, 50);
    const [commissions, totals] = await Promise.all([
        Mongo.db.collection('commissions').find({}).sort({ dueDate: 1 }).skip(skip).limit(limit).toArray(),
        Mongo.db.collection('commissions').aggregate([
            {
                $group: {
                    _id: null,
                    revenue: { $sum: '$amount' },
                    commissionDue: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, '$amount', 0] } },
                    commissionsCount: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } }
                }
            }
        ]).toArray()
    ]);

    const summary = totals[0] || { revenue: 0, commissionDue: 0, commissionsCount: 0 };

    res.json({
        success: true,
        statusCode: 200,
        body: {
            revenue: summary.revenue || 0,
            revenueTrend: 'Atualizado',
            commissionDue: summary.commissionDue || 0,
            commissionsCount: summary.commissionsCount || 0,
            commissions: commissions.map((item) => ({
                id: item._id?.toString() || null,
                partner: item.partner,
                amount: item.amount,
                status: item.status || 'pending',
                dueDate: item.dueDate || null
            }))
        }
    });
});

userRouter.post('/finance/commissions', validateBody(commissionSchema), async (req, res) => {
    const payload = {
        ...req.body,
        status: req.body.status || 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
    };

    const result = await Mongo.db.collection('commissions').insertOne(payload);

    res.status(201).json({ success: true, statusCode: 201, body: { id: result.insertedId.toString() } });

    void writeAuditLog({
        action: 'commission_create',
        actorId: req.user?.userId || null,
        actorRole: req.user?.role || null,
        targetId: result.insertedId.toString(),
        req
    });
});

userRouter.patch('/finance/commissions/:id', async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, statusCode: 400, message: 'Invalid commission id.' });
    }

    const update = { status: req.body?.status || 'paid', updatedAt: new Date() };
    await Mongo.db.collection('commissions').updateOne({ _id: new ObjectId(req.params.id) }, { $set: update });

    res.json({ success: true, statusCode: 200, body: { id: req.params.id } });

    void writeAuditLog({
        action: 'commission_update',
        actorId: req.user?.userId || null,
        actorRole: req.user?.role || null,
        targetId: req.params.id,
        meta: update,
        req
    });
});

userRouter.get('/pages', async (req, res) => {
    const { page, limit, skip } = getPagination(req, 12, 50);
    const items = await Mongo.db.collection('pages').find({}).sort({ updatedAt: -1 }).skip(skip).limit(limit).toArray();
    res.json({
        success: true,
        statusCode: 200,
        body: {
            page,
            limit,
            result: items.map((item) => ({
                id: item._id?.toString() || null,
                title: item.title,
                slug: item.slug,
                status: item.status || 'draft',
                content: item.content || '',
                createdAt: item.createdAt,
                updatedAt: item.updatedAt
            }))
        }
    });
});

userRouter.post('/pages', validateBody(pageSchema), async (req, res) => {
    const payload = {
        ...req.body,
        status: req.body.status || 'draft',
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const result = await Mongo.db.collection('pages').insertOne(payload);
    res.status(201).json({ success: true, statusCode: 201, body: { id: result.insertedId.toString() } });
    void writeAuditLog({
        action: 'page_create',
        actorId: req.user?.userId || null,
        actorRole: req.user?.role || null,
        targetId: result.insertedId.toString(),
        req
    });
});

userRouter.put('/pages/:id', validateBody(pageSchema), async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, statusCode: 400, message: 'Invalid page id.' });
    }
    const update = { ...req.body, updatedAt: new Date() };
    await Mongo.db.collection('pages').updateOne({ _id: new ObjectId(req.params.id) }, { $set: update });
    res.json({ success: true, statusCode: 200, body: { id: req.params.id } });
    void writeAuditLog({
        action: 'page_update',
        actorId: req.user?.userId || null,
        actorRole: req.user?.role || null,
        targetId: req.params.id,
        req
    });
});

userRouter.delete('/pages/:id', async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, statusCode: 400, message: 'Invalid page id.' });
    }
    await Mongo.db.collection('pages').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true, statusCode: 200, body: { id: req.params.id } });
    void writeAuditLog({
        action: 'page_delete',
        actorId: req.user?.userId || null,
        actorRole: req.user?.role || null,
        targetId: req.params.id,
        req
    });
});

userRouter.get('/media', async (req, res) => {
    const { page, limit, skip } = getPagination(req, 12, 50);
    const items = await Mongo.db.collection('media').find({}).sort({ updatedAt: -1 }).skip(skip).limit(limit).toArray();
    res.json({
        success: true,
        statusCode: 200,
        body: {
            page,
            limit,
            result: items.map((item) => ({
                id: item._id?.toString() || null,
                name: item.name,
                url: item.url,
                type: item.type || 'image',
                usage: item.usage || '',
                status: item.status || 'active',
                updatedAt: item.updatedAt
            }))
        }
    });
});

userRouter.post('/media', validateBody(mediaSchema), async (req, res) => {
    const payload = {
        ...req.body,
        status: req.body.status || 'active',
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const result = await Mongo.db.collection('media').insertOne(payload);
    res.status(201).json({ success: true, statusCode: 201, body: { id: result.insertedId.toString() } });
    void writeAuditLog({
        action: 'media_create',
        actorId: req.user?.userId || null,
        actorRole: req.user?.role || null,
        targetId: result.insertedId.toString(),
        req
    });
});

userRouter.put('/media/:id', validateBody(mediaSchema), async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, statusCode: 400, message: 'Invalid media id.' });
    }
    const update = { ...req.body, updatedAt: new Date() };
    await Mongo.db.collection('media').updateOne({ _id: new ObjectId(req.params.id) }, { $set: update });
    res.json({ success: true, statusCode: 200, body: { id: req.params.id } });
    void writeAuditLog({
        action: 'media_update',
        actorId: req.user?.userId || null,
        actorRole: req.user?.role || null,
        targetId: req.params.id,
        req
    });
});

userRouter.delete('/media/:id', async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, statusCode: 400, message: 'Invalid media id.' });
    }
    await Mongo.db.collection('media').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true, statusCode: 200, body: { id: req.params.id } });
    void writeAuditLog({
        action: 'media_delete',
        actorId: req.user?.userId || null,
        actorRole: req.user?.role || null,
        targetId: req.params.id,
        req
    });
});

userRouter.get('/stock', async (req, res) => {
    const { page, limit, skip } = getPagination(req, 8, 50);
    const items = await Mongo.db.collection('inventory').find({}).sort({ updatedAt: -1 }).skip(skip).limit(limit).toArray();
    res.json({
        success: true,
        statusCode: 200,
        body: {
            page,
            limit,
            result: items.map((item) => ({
                id: item._id?.toString() || null,
                name: item.name,
                status: item.status || 'disponivel',
                km: item.km || 0,
                location: item.location || '',
                suggestedPrice: item.suggestedPrice || 0,
                updatedAt: item.updatedAt
            }))
        }
    });
});

userRouter.post('/stock', validateBody(stockSchema), async (req, res) => {
    const payload = {
        ...req.body,
        status: req.body.status || 'disponivel',
        createdAt: new Date(),
        updatedAt: new Date()
    };
    const result = await Mongo.db.collection('inventory').insertOne(payload);
    res.status(201).json({ success: true, statusCode: 201, body: { id: result.insertedId.toString() } });
    void writeAuditLog({
        action: 'stock_create',
        actorId: req.user?.userId || null,
        actorRole: req.user?.role || null,
        targetId: result.insertedId.toString(),
        req
    });
});

userRouter.put('/stock/:id', validateBody(stockSchema), async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, statusCode: 400, message: 'Invalid stock id.' });
    }
    const update = { ...req.body, updatedAt: new Date() };
    await Mongo.db.collection('inventory').updateOne({ _id: new ObjectId(req.params.id) }, { $set: update });
    res.json({ success: true, statusCode: 200, body: { id: req.params.id } });
    void writeAuditLog({
        action: 'stock_update',
        actorId: req.user?.userId || null,
        actorRole: req.user?.role || null,
        targetId: req.params.id,
        req
    });
});

userRouter.delete('/stock/:id', async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, statusCode: 400, message: 'Invalid stock id.' });
    }
    await Mongo.db.collection('inventory').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ success: true, statusCode: 200, body: { id: req.params.id } });
    void writeAuditLog({
        action: 'stock_delete',
        actorId: req.user?.userId || null,
        actorRole: req.user?.role || null,
        targetId: req.params.id,
        req
    });
});

userRouter.post('/stock/import', async (req, res) => {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const payload = rows
        .map((row) => ({
            name: row.name || row.veiculo || row.vehicle || '',
            status: row.status || 'disponivel',
            km: Number(row.km || row.quilometragem || 0),
            location: row.local || row.location || '',
            suggestedPrice: Number(row.preco || row.suggestedprice || 0),
            createdAt: new Date(),
            updatedAt: new Date()
        }))
        .filter((row) => row.name);

    if (!payload.length) {
        return res.status(400).json({ success: false, statusCode: 400, message: 'No valid rows found.' });
    }

    await Mongo.db.collection('inventory').insertMany(payload);
    res.json({ success: true, statusCode: 200, body: { inserted: payload.length } });

    void writeAuditLog({
        action: 'stock_import',
        actorId: req.user?.userId || null,
        actorRole: req.user?.role || null,
        targetId: 'inventory',
        meta: { inserted: payload.length },
        req
    });
});

userRouter.get('/reports', async (req, res) => {
    const collection = Mongo.db.collection('reports');
    const count = await collection.countDocuments();
    if (!count) {
        await collection.insertMany([
            { name: 'Desempenho por parceiro', description: 'Ranking de leads e vendas', createdAt: new Date() },
            { name: 'Origem de leads', description: 'UTM e campanhas ativas', createdAt: new Date() }
        ]);
    }
    const items = await collection.find({}).sort({ createdAt: -1 }).toArray();
    res.json({
        success: true,
        statusCode: 200,
        body: {
            result: items.map((item) => ({
                id: item._id?.toString() || null,
                name: item.name,
                description: item.description || '',
                lastGeneratedAt: item.lastGeneratedAt || null
            }))
        }
    });
});

userRouter.post('/reports/:id/run', async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, statusCode: 400, message: 'Invalid report id.' });
    }
    await Mongo.db.collection('reports').updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { lastGeneratedAt: new Date() } }
    );
    res.json({ success: true, statusCode: 200, body: { id: req.params.id } });
    void writeAuditLog({
        action: 'report_run',
        actorId: req.user?.userId || null,
        actorRole: req.user?.role || null,
        targetId: req.params.id,
        req
    });
});

userRouter.post('/reports/run-all', async (req, res) => {
    await Mongo.db.collection('reports').updateMany({}, { $set: { lastGeneratedAt: new Date() } });
    res.json({ success: true, statusCode: 200, body: { updated: true } });
    void writeAuditLog({
        action: 'reports_run_all',
        actorId: req.user?.userId || null,
        actorRole: req.user?.role || null,
        targetId: 'reports',
        req
    });
});

userRouter.get('/notifications', async (req, res) => {
    const { page, limit, skip } = getPagination(req, 8, 50);
    const items = await Mongo.db.collection('notifications').find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray();
    res.json({
        success: true,
        statusCode: 200,
        body: {
            page,
            limit,
            result: items.map((item) => ({
                id: item._id?.toString() || null,
                title: item.title,
                message: item.message || '',
                read: Boolean(item.read)
            }))
        }
    });
});

userRouter.patch('/notifications/mark-read', async (req, res) => {
    await Mongo.db.collection('notifications').updateMany({ read: { $ne: true } }, { $set: { read: true } });
    res.json({ success: true, statusCode: 200, body: { updated: true } });
    void writeAuditLog({
        action: 'notifications_mark_read',
        actorId: req.user?.userId || null,
        actorRole: req.user?.role || null,
        targetId: 'notifications',
        req
    });
});

userRouter.get('/support', async (req, res) => {
    const [open, closed] = await Promise.all([
        Mongo.db.collection('support_requests').find({ status: 'open' }).sort({ createdAt: -1 }).limit(5).toArray(),
        Mongo.db.collection('support_requests').find({ status: 'closed' }).sort({ createdAt: -1 }).limit(5).toArray()
    ]);
    res.json({
        success: true,
        statusCode: 200,
        body: {
            open: open.map((item) => ({ title: item.title, description: item.description })),
            closed: closed.map((item) => ({ title: item.title, description: item.description }))
        }
    });
});

userRouter.get('/db/status', async (req, res) => {
    const stats = await Mongo.db.stats();
    const collections = await Mongo.db.listCollections().toArray();
    const lastBackup = await Mongo.db.collection('db_backups').find({}).sort({ createdAt: -1 }).limit(1).toArray();
    const collectionStats = await Promise.all(
        collections.map(async (collection) => {
            const name = collection.name;
            const [count, stats] = await Promise.all([
                Mongo.db.collection(name).countDocuments(),
                Mongo.db.collection(name).stats()
            ]);
            return { name, count, size: formatBytes(stats?.size || 0) };
        })
    );

    const usagePercent = stats.storageSize ? Math.round((stats.dataSize / stats.storageSize) * 100) : 0;

    res.json({
        success: true,
        statusCode: 200,
        body: {
            storageUsage: `${usagePercent}% usado`,
            indexHealth: 'Saudavel',
            lastBackup: lastBackup[0]?.createdAt || null,
            collections: collectionStats.map((item) => ({
                name: item.name,
                count: item.count,
                size: item.size,
                updatedAt: new Date()
            }))
        }
    });
});

userRouter.post('/db/backup', async (req, res) => {
    const payload = { createdAt: new Date(), actorId: req.user?.userId || null };
    const result = await Mongo.db.collection('db_backups').insertOne(payload);
    res.json({ success: true, statusCode: 200, body: { id: result.insertedId.toString() } });
    void writeAuditLog({
        action: 'db_backup',
        actorId: req.user?.userId || null,
        actorRole: req.user?.role || null,
        targetId: result.insertedId.toString(),
        req
    });
});

userRouter.get('/automations', async (req, res) => {
    const record = await Mongo.db.collection('system_settings').findOne({ key: 'automations' });
    res.json({
        success: true,
        statusCode: 200,
        body: { settings: record?.settings || {} }
    });
});

userRouter.post('/automations', validateBody(automationSchema), async (req, res) => {
    await Mongo.db.collection('system_settings').updateOne(
        { key: 'automations' },
        { $set: { key: 'automations', settings: req.body.settings || {}, updatedAt: new Date() } },
        { upsert: true }
    );
    res.json({ success: true, statusCode: 200, body: { settings: req.body.settings || {} } });
    void writeAuditLog({
        action: 'automations_update',
        actorId: req.user?.userId || null,
        actorRole: req.user?.role || null,
        targetId: 'automations',
        meta: req.body.settings || {},
        req
    });
});

userRouter.get('/security-policy', async (req, res) => {
    const record = await Mongo.db.collection('system_settings').findOne({ key: 'security_policy' });
    res.json({
        success: true,
        statusCode: 200,
        body: {
            twoFactorRequired: Boolean(record?.twoFactorRequired),
            roles: Array.isArray(record?.roles) ? record.roles : ['admin']
        }
    });
});

userRouter.post('/security-policy', validateBody(securityPolicySchema), async (req, res) => {
    const roles = Array.isArray(req.body.roles) ? [...new Set(req.body.roles)] : [];
    await Mongo.db.collection('system_settings').updateOne(
        { key: 'security_policy' },
        { $set: { key: 'security_policy', twoFactorRequired: req.body.twoFactorRequired, roles, updatedAt: new Date() } },
        { upsert: true }
    );
    res.json({ success: true, statusCode: 200, body: { twoFactorRequired: req.body.twoFactorRequired, roles } });
    void writeAuditLog({
        action: 'security_policy_update',
        actorId: req.user?.userId || null,
        actorRole: req.user?.role || null,
        targetId: 'security_policy',
        meta: { twoFactorRequired: req.body.twoFactorRequired, roles },
        req
    });
});

userRouter.patch('/:id/2fa', validateBody(twoFactorSchema), async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, statusCode: 400, message: 'Invalid user id.' });
    }

    await Mongo.db.collection('users').updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { twoFactorEnabled: req.body.enabled, updatedAt: new Date() } }
    );

    res.json({ success: true, statusCode: 200, body: { id: req.params.id, enabled: req.body.enabled } });

    void writeAuditLog({
        action: 'user_2fa_toggle',
        actorId: req.user?.userId || null,
        actorRole: req.user?.role || null,
        targetId: req.params.id,
        meta: { enabled: req.body.enabled },
        req
    });
});

userRouter.get('/metrics', async (req, res) => {
    const since = new Date();
    since.setMonth(since.getMonth() - 5);
    const [leads, feedback] = await Promise.all([
        Mongo.db.collection('leads').find({ createdAt: { $gte: since } }).toArray(),
        Mongo.db.collection('feedback').find({ createdAt: { $gte: since } }).toArray()
    ]);

    const byMonth = new Map();
    leads.forEach((lead) => {
        const date = new Date(lead.createdAt || Date.now());
        const label = date.toLocaleString('pt-BR', { month: 'short' });
        if (!byMonth.has(label)) {
            byMonth.set(label, { label, visits: 0, sales: 0, ratings: 0 });
        }
        const entry = byMonth.get(label);
        entry.visits += 1;
        if (lead.status === 'qualificado') {
            entry.sales += 1;
        }
    });

    feedback.forEach((item) => {
        const date = new Date(item.createdAt || Date.now());
        const label = date.toLocaleString('pt-BR', { month: 'short' });
        if (!byMonth.has(label)) {
            byMonth.set(label, { label, visits: 0, sales: 0, ratings: 0 });
        }
        const entry = byMonth.get(label);
        entry.ratings += 1;
    });

    const series = [];
    for (let i = 5; i >= 0; i -= 1) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const label = date.toLocaleString('pt-BR', { month: 'short' });
        if (!byMonth.has(label)) {
            byMonth.set(label, { label, visits: 0, sales: 0, ratings: 0 });
        }
        series.push(byMonth.get(label));
    }

    res.json({
        success: true,
        statusCode: 200,
        body: { series }
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