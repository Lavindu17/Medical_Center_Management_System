export class AppError extends Error {
    public statusCode: number;
    public status: string;
    public isOperational: boolean;

    constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

export const handleError = (err: any) => {
    // Simple error structure for API responses
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    return Response.json(
        {
            status: 'error',
            message
        },
        { status: statusCode }
    );
};
