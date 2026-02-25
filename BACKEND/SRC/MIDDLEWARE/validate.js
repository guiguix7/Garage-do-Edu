import { ZodError } from 'zod';

export const validateBody = (schema) => (req, res, next) => {
    try {
        req.body = schema.parse(req.body ?? {});
        next();
    } catch (error) {
        if (error instanceof ZodError) {
            return res.status(400).json({
                success: false,
                statusCode: 400,
                message: 'Invalid request payload.',
                issues: error.issues.map((issue) => ({
                    path: issue.path.join('.'),
                    message: issue.message
                }))
            });
        }
        next(error);
    }
};
