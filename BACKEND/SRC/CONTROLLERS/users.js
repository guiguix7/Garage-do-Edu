// Controller //
import UserDataAccess from "../DATA/user.js";
import { OK, NotFound, ServerError } from '../HELPERS/httpResponse.js';

export default class UserController {
    constructor() {
        this.userDataAccess = new UserDataAccess();
    }

    async getUsers() {
        try {
            const users = await this.userDataAccess.getUsers();

            return OK(users);

        } catch (error) {
            return ServerError(error);
        }
    }

    async deleteUser(userId) {
        try {
            const deletedCount = await this.userDataAccess.deleteUser(userId);

            if (!deletedCount) {
                return NotFound();
            }

            return OK({ deleted: true });

        } catch (error) {
            return ServerError(error);
        }

    }

    async updateUser(userId, updateData) {
        try {
            const payload = { ...updateData };

            if (!payload.password) {
                delete payload.password;
            }

            const modifiedCount = await this.userDataAccess.updateUser(userId, payload);

            if (!modifiedCount) {
                return NotFound();
            }

            return OK({ updated: true });

        } catch (error) {
            return ServerError(error);
        }

    }
}