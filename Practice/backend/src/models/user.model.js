import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { ApiError } from "../utils/ApiError.js";

const userSchema = new mongoose.Schema({
    username:{
        type:String,
        required:true,
        unique:true,
        lowercase:true,
        trim:true,
        index:true
    },
    email:{
        type:String,
        required:true,
        unique:true,
        lowercase:true,
        trim:true
    },
    fullname:{
        type:String,
        required:true,
        trim:true,
        index:true
    },
    avatar:{
        type:String,
        required:true,
        trim:true
    },
    coverimage:{
        type:String,
    },
    watchhistory:[
        {
            type:String,
            ref:"Video"
        }
    ],
    password:{
        type : String,
        required: [true, "Password is required"]
    },
    refereshtoken :{
        type : String
    }
},
{
    timestamps : true
}
);

userSchema.pre("save", async function(next){
    if(!this.isModified("password")){
        // return next();
        return;
    }
    this.password = await bcrypt.hash(this.password, 10);
    // next();
});

userSchema.methods.isPasswordCorrect = async function(password){
    return await bcrypt.compare(password , this.password);
}

userSchema.methods.generateAccessToken = async function(password){
    return jwt.sign(
        {
            _id: this._id,
            email : this.email,
            username : this.username,
            fullname : this.fullname
        },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn : process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}

userSchema.methods.generateRefreshToken = async function(password){
    return jwt.sign(
        {
            _id: this._id
        },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn : process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

userSchema.methods.generateAccessAndRefreshTokens = async function (userId){
    try{
        const user = await User.findById(userId);
        const accessToken = await user.generateAccessToken();
        const refreshToken = await user.generateRefreshToken();

        user.refereshtoken = refreshToken;
        await user.save({validateBeforeSave : false});
        
        return { accessToken, refreshToken };
    }catch(error){
        throw new ApiError(500,error, "Error generating tokens");
    }
}

export const User = mongoose.model("User",userSchema);