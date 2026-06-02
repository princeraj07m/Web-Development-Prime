import {asyncHandler} from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { User } from '../models/User.model.js';
import { uploadOnCloudinary } from '../utils/cloudinary.js';
import jwt from 'jsonwebtoken';

const registerUser = asyncHandler(async (req, res) => {
    //get user data
    const { fullname, email,username, password } = req.body;
    console.log(email);

    //validate user data
    if(
        [fullname, email, username, password].some(field => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required");
    }

    //check if user already exists
    const existedUser =await User.findOne({
        $or: [
            { email },{ username }
        ]
    })
    if(existedUser){
        throw new ApiError(409, "User already exists");
    }

    // check for avatar and cover image
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverimage[0]?.path;
    
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverimage) && req.files.coverimage.length > 0){
        coverImageLocalPath = req.files.coverimage[0].path;
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    //upload avatar and cover image to cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!avatar){
        throw new ApiError(500, "Failed to upload avatar");
    }

    //create user
    const user = await User.create({
        fullname,
        email,
        username:username.toLowerCase(),
        password,
        avatar: avatar?.url,
        coverimage: coverImage?.url||""
    });

    // check if user is created
    const createdUser = await User.findById(user._id).select(
        "-password -refereshtoken"
    )
    if(!createdUser){
        throw new ApiError(500, "Failed to create user");
    } 
    //return response to client
    return res.status(201).json(
        new ApiResponse(201,createdUser, "User registered successfully")
    );
});

const loginUser = asyncHandler(async (req, res) => {
    console.log("Content-Type:", req.headers["content-type"]);
    console.log("Method:", req.method);
    const { email,username, password } = req.body;

    if(!(username || email)){
        throw new ApiError(400, "Username or email is required");
    }

    //find the user
    const user = await User.findOne({
        $or: [
            { email },{ username }
        ]
    })

    if(!user){
        throw new ApiError(404, "User not found");
    }

    //check password
    const isPasswordValid = await user.isPasswordCorrect(password);
    if(!isPasswordValid){
        throw new ApiError(401, "Invalid credentials");
    }

    //generate access and refresh tokens
    const { accessToken, refreshToken } = await user.generateAccessAndRefreshTokens(user._id);

    const loggedInUser = await User.findById(user._id).select("-password -refereshtoken")

    //send cookies
    const options = {
        httpOnly: true,
        secure: true
    };
    return res.status(200)
              .cookie("accessToken", accessToken, options)
              .cookie("refreshToken", refreshToken, options)
              .json(new ApiResponse(200, {user: loggedInUser, accessToken, refreshToken}, "User logged in successfully"))

});

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(req.user._id, { $set:{refereshtoken: undefined}},{ new: true });
    const options = {
        httpOnly: true,
        secure: true
    };

    return res.status(200)
                .clearCookie("accessToken",options)
                .clearCookie("refreshToken", options)
                .json(new ApiResponse(200, {}, "User logged out successfully"))
});


const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
    
    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized request - refresh token is missing");
    }

    try{
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

        const user = await User.findById(decodedToken._id);

        if(!user || user.refereshtoken !== incomingRefreshToken){
            throw new ApiError(401, "Unauthorized request - invalid refresh token");
        }
        const options = {
            httpOnly: true,
            secure: true
        };

        const { accessToken, newRefreshToken } = await user.generateAccessAndRefreshTokens(user._id);

        return res.status(200)
                  .cookie("accessToken", accessToken, options)
                  .cookie("refreshToken", newRefreshToken, options)
                  .json(new ApiResponse(200, { accessToken, newRefreshToken }, "Access token refreshed successfully"))

    }catch(error){
        throw new ApiError(401, "Unauthorized request - invalid refresh token");
    }
})

export { 
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken
 };