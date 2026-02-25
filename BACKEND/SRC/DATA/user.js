// Data Access //

// Import necessary modules //
import { Mongo } from "../DB/db.js";
import { ObjectId } from "mongodb";
import bcrypt from "bcrypt";


// Define collection names //
const collectionName = "users";

// Define UserDataAccess class //
export default class UserDataAccess {
    // Get all users //
    async getUsers() {
        const result = await Mongo.db
            .collection(collectionName)
            .find({}, { projection: { password: 0 } })
            .toArray();

        console.log('Get Request', result.length, 'users found.');
        console.log('statusCode = 200');
        return ({ info: `${result.length} users found.`, result });
    }

    // Delete a user by ID //
    async deleteUser(userId) {
        if (!ObjectId.isValid(userId)) {
            return 0;
        }
        const result = await Mongo.db
            .collection(collectionName)
            .deleteOne({ _id: new ObjectId(userId) });

        console.log({
            'Delete Request': {
                success: result.deletedCount > 0,
                id_deleted: userId,
                deletedCount: result.deletedCount
            }
        });
        return result.deletedCount;
    }

    // Update a user by ID //
    async updateUser(userId, updateData) {
        if (!ObjectId.isValid(userId)) {
            return 0;
        }
        const updateFields = { ...updateData };

        if (updateData.password) {
            updateFields.password = await bcrypt.hash(updateData.password, 12);
        }

        const result = await Mongo.db
            .collection(collectionName)
            .updateOne(
                { _id: new ObjectId(userId) },
                { $set: updateFields }
            );
        return result.modifiedCount;
    }
}
