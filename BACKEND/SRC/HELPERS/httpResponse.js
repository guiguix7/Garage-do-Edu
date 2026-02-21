// HTTP Response Helpers //
export const OK = (body) => {
    return {
        success: true,
        statusCode: 200,
        body: body
    }
}

export const NotFound = () => {
    return {
        success: false,
        statusCode: 404,
        body: 'Resource not found',
    }
}

export const ServerError = (errors) => {
    return {
        success: false,
        statusCode: 500,
        body: 'Internal server error',
    }
}