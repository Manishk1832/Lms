import userModel from "../models/user.model";
import { Response } from "express";
import { redis } from "../utils/redis";

//get user by id

export const getUserbyId  = async(id:string, res:Response, ) =>{
    const userJson = await redis.get(id);
    if(userJson){
        const user = JSON.parse(userJson);
        return res.status(200).json({
            success:true,
            user
        })
    }

}

//get all user

export const getAllUsersService = async(res:Response)=>{
    const users = await userModel.find().sort({createdAt:-1})

    res.status(200).json({
        success:true,
        users
    })

    
}

//update user role
export const  updateUserRoleService = async(res:Response,id:String,role:String)=>{
    const user = await userModel.findByIdAndUpdate(id,{role},{new:true});
    res.status(201).json({
        success:true,
        user
    })
}