// Routes //
import express from 'express';
import CarsController from '../CONTROLLERS/cars_control.js';
import { authenticateToken, requireRole } from '../MIDDLEWARE/auth.js';

const carRouter = express.Router();
const carsController = new CarsController();

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

carRouter.get('/:id', async (req, res, next) => {
    try {
        const { success, statusCode, body } = await carsController.getCarById(req.params.id);
        res.status(statusCode).send({ success, statusCode, body });
    } catch (error) {
        next(error);
    }
});

carRouter.post('/', authenticateToken, requireRole('admin'), async (req, res, next) => {
    try {
        const { success, statusCode, body } = await carsController.addCar(req.body);
        res.status(statusCode).send({ success, statusCode, body });
    } catch (error) {
        next(error);
    }
});

carRouter.put('/:id', authenticateToken, requireRole('admin'), async (req, res, next) => {
    try {
        const { success, statusCode, body } = await carsController.updateCar(req.params.id, req.body);
        res.status(statusCode).send({ success, statusCode, body });
    } catch (error) {
        next(error);
    }
});

carRouter.delete('/:id', authenticateToken, requireRole('admin'), async (req, res, next) => {
    try {
        const { success, statusCode, body } = await carsController.deleteCar(req.params.id);
        res.status(statusCode).send({ success, statusCode, body });
    } catch (error) {
        next(error);
    }
});

export default carRouter;