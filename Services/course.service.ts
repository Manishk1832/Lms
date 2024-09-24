import { Response,Request,NextFunction } from "express";
import CourseModel from "../models/course.model";
import { catchAsync } from "../middleware/catchAsyncErrors";


//create course

export const  createCourse = catchAsync(async(data:any, res:Response)=>{
    const course = await CourseModel.create(data);
    res.status(201).json({
        success:true,
        course
    })
})

//get all courses

export const getAllCoursesService = async(res:Response)=>{
    const Courses = await CourseModel.find().sort({createdAt:-1})
  
    res.status(200).json({
        success:true,
        Courses
    })
  
    
  }