// Data Access Cars //

// Import necessary modules //
import { Mongo } from "../DB/db.js";
import { ObjectId } from "mongodb";

// Define collection name //
const collectionName = "cars";

// Define CarDataAccess class //    
export default class CarDataAccess {
    // Get all cars //
    async getCars() {
        const result = await Mongo.db
            .collection(collectionName)
            .find({ status: 'active' })
            .toArray();

        console.log('Get Request', result.length, 'cars found.');
        console.log('statusCode = 200');
        return ({ info: `${result.length} cars found.` , result });
    }

    // Get available cars //
    async getAvailableCars() {
        const result = await Mongo.db
            .collection(collectionName)
            .find({ available: true, status: 'active' })
            .toArray();

        console.log('Get Request', result.length, 'available cars found.');
        console.log('statusCode = 200');
        return ({ info: `${result.length} available cars found.` , result });
    }

    async getCarById(carId) {
        if (!ObjectId.isValid(carId)) {
            return null;
        }

        const document = await Mongo.db
            .collection(collectionName)
            .findOne({ _id: new ObjectId(carId), status: 'active' });

        return document;
    }

    async getPendingCarById(carId) {
        if (!ObjectId.isValid(carId)) {
            return null;
        }

        const document = await Mongo.db
            .collection(collectionName)
            .findOne({ _id: new ObjectId(carId), status: 'pending' });

        return document;
    }

    // Add a new car //
    async addCar(carData) {
        const result = await Mongo.db
            .collection(collectionName)
            .insertOne(carData);

        console.log('"added": true');
        return result.insertedId;
    }

    // Update a car by ID //
    async updateCar(carId, updateData) {
        if (!ObjectId.isValid(carId)) {
            return 0;
        }
        const result = await Mongo.db
            .collection(collectionName)
            .updateOne({ _id: new ObjectId(carId) }, { $set: updateData });

        console.log(result);
        return result.modifiedCount;
    }

    // Delete a car by ID //
    async deleteCar(carId) {
        if (!ObjectId.isValid(carId)) {
            return 0;
        }
        const result = await Mongo.db
            .collection(collectionName)
            .deleteOne({ _id: new ObjectId(carId) });

        return result.deletedCount;
    }
}
