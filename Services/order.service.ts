import { NextFunction,Response } from "express";
import { catchAsync } from "../middleware/catchAsyncErrors";
import OrderModel from "../models/order.model";

//create a new order

export const newOrder = catchAsync(async(data:any,res:Response,next:NextFunction)=>{
   const order =  await OrderModel.create(data);

     res.status(201).json({
        success:true,
        order,
    })
})


//get all orders

export const getAllOrdersService = async(res:Response)=>{
  const Orders = await OrderModel.find().sort({createdAt:-1})

  res.status(200).json({
      success:true,
      Orders
  })

}
