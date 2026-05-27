const asyncHandler = (requestHandler) => async (req, res, next) => {
    Promise.resolve(requestHandler(req, res, next)).catch((error) => {
        console.error("Error in asyncHandler:", error);
        next(error);
    });
};

export { asyncHandler };
