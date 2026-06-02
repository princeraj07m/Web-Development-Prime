import jwt from 'jsonwebtoken';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { User } from '../models/User.model.js';

export const verifyJWT  = asyncHandler(async (req, _, next) => {
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");

    if(!token){
        throw new ApiError(401, "Unauthorized request, token is missing");
    }
    try {
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const user = await User.findById(decodedToken._id).select("-password -refereshtoken").then((user) => {
            if(!user){
                throw new ApiError(401, "Unauthorized request, user not found");
            }
            req.user = user;
            next();
        });
    } catch (error) {
        throw new ApiError(401, "Unauthorized, invalid token");
    }
})