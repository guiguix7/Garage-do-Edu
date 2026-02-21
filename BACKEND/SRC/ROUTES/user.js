// Routes //
import express from 'express';
import { ObjectId } from 'mongodb';
import UserController from '../CONTROLLERS/users.js';
import { Mongo } from '../DB/db.js';
import { requireRole } from '../MIDDLEWARE/auth.js';

// Create router and controller instances //

const userRouter = express.Router();
const userController = new UserController();

userRouter.use(requireRole('admin'));

userRouter.get('/', async (req, res) => {
    const { success, statusCode, body } = await userController.getUsers();

    res.status(statusCode).send({ success, statusCode, body });
});

userRouter.delete('/:id', async (req, res) => {
    const { success, statusCode, body } = await userController.deleteUser(req.params.id);

    res.status(statusCode).send({ success, statusCode, body });
});

userRouter.put('/:id', async (req, res) => {
    const { success, statusCode, body } = await userController.updateUser(req.params.id, req.body);

    res.status(statusCode).send({ success, statusCode, body });
});

// Promoção
userRouter.patch('/:id/role', async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

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
})

export default userRouter;