require("dotenv").config();
import express, { NextFunction, Request, Response } from "express";
export const app = express();
import cors from 'cors';
import cookieParser from "cookie-parser"
import {ErrorMiddleware} from "./middleware/error";
import userRouter from "./routes/user.route";
import courseRouter from "./routes/course.route";
import OrderRouter from "./routes/order.route";
import notificationRoute from "./routes/notification.route";




//body parser

app.use(express.json({limit:"50mb"}));


//cookie parser
app.use(cookieParser());



//cors => cross origin resouce sharing
 
app.use(cors({
    origin: process.env.ORIGIN

}));

//routes

app.use("/api/v1",userRouter,courseRouter,OrderRouter,notificationRoute);



//testing api

app.get("/test", (req:Request, res:Response, next:NextFunction)=>{
    res.status(200).json({
        success: true,
        message: "Api is working",
    });
})

//unknow route

app.all("*",(req:Request, res:Response, next:NextFunction)=>{
    const err = new Error(`Route ${req.originalUrl}not found`) as any;
    err.statusCoder = 400;
    next(err);
})

app.use(ErrorMiddleware);









