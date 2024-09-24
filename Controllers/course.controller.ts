import { NextFunction, Request, Response } from "express";
import { catchAsync } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import cloudinary from "cloudinary";
import { createCourse, getAllCoursesService } from "../Services/course.service";
import CourseModel from "../models/course.model";
import { redis } from "../utils/redis";
import mongoose from "mongoose";
import ejs from "ejs";
import path from "path";
import sendMail from "../utils/sendMail";
import NotificationModel from "../models/notification.model";

//upload course

export const uploadCourse = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;

      console.log(data);
      const thumbnail = data.thumbnail;
      if (thumbnail) {
        const myCloud = await cloudinary.v2.uploader.upload(thumbnail, {
          folder: "courses",
        });

        data.thumbnail = {
          public_id: myCloud.public_id,
          url: myCloud.secure_url,
        };
      }
      createCourse(data, res, next);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

//edit course

export const editCourse = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;
      const thumbnail = data.thumbnail;
      if (thumbnail) {
        await cloudinary.v2.uploader.destroy(thumbnail.public_id);

        const myCloud = await cloudinary.v2.uploader.upload(thumbnail, {
          folder: "courses",
        });

        data.thumbnail = {
          public_id: myCloud.public_id,
          url: myCloud.secure_url,
        };
      }

      const courseId = req.params.id;

      const course = await CourseModel.findByIdAndUpdate(
        courseId,
        { $set: data },
        { new: true }
      );

      res.status(200).json({
        success: true,
        course,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

//get  single course -- without purchasing

export const getSingleCourse = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const courseId = req.params.id;
      const isCatcheExist = await redis.get(courseId);

      if (isCatcheExist) {
        const course = JSON.parse(isCatcheExist);
        res.status(200).json({
          success: true,
          course,
        });
      } else {
        const course = await CourseModel.findById(req.params.id).select(
          "-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links"
        );
        await redis.set(courseId, JSON.stringify(course));

        res.status(200).json({
          success: true,
          course,
        });
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

//get all courses --without purchasing
export const getAllCourse = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const isCatcheExist = await redis.get("allCourses");

      if (isCatcheExist) {
        const courses = JSON.parse(isCatcheExist);
        res.status(200).json({
          success: true,
          courses,
        });
      } else {
        const courses = await CourseModel.find().select(
          "-courseData.videoUrl -courseData.suggestion -courseData.questions -courseData.links"
        );

        await redis.set("allCourses", JSON.stringify(courses));

        res.status(200).json({
          success: true,
          courses,
        });
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

//get course content --only on valid user
export const getCourseByUser = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userCourseList = req.user?.courses;
      const courseId = req.params.id;

      const courseExist = userCourseList?.find(
        (course: any) => course._id.toString() === courseId
      );

      if (!courseExist) {
        return next(
          new ErrorHandler("You are not eligible  to access this course", 404)
        );
      }

      const course = await CourseModel.findById(courseId);
      const content = course?.courseData;

      res.status(200).json({
        success: true,
        content,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

//add questions in course

interface IAddQuestionData {
  question: string;
  courseId: string;
  contentId: string;
}

export const addQuestion = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { question, courseId, contentId }: IAddQuestionData = req.body;
      const course = await CourseModel.findById(courseId);

      console.log(question, courseId, contentId);

      if (!mongoose.Types.ObjectId.isValid(courseId)) {
        return next(new ErrorHandler("Invalid course id", 400));
      }

      // const courseContent = course?.courseData?.find((item: any) => {
      //   item._id.equals(contentId);
      // });

      const courseContent = course?.courseData?.find((item: any) =>
        item._id.equals(contentId)
      );

      console.log(courseContent);

      if (!courseContent) {
        return next(new ErrorHandler("Invalid content id", 400));
      }

      //create a new question object

      const newQuestion: any = {
        user: req.user,
        question,
        questionReplies: [],
      };

      //add the question to our course content
      courseContent.questions.push(newQuestion);

      await NotificationModel.create({
        user:req.user?.id,
        title:"New Question Received",
        message:`You have a new Question in ${courseContent?.title}`,

    });

      await course?.save();
      res.status(200).json({
        success: true,
        course,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

//add answer in question

interface IAddAnswerData {
  answer: string;
  courseId: string;
  contentId: string;
  questionId: string;
}

export const addAnswer = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { answer, courseId, contentId, questionId }: IAddAnswerData =
        req.body;

      const course = await CourseModel.findById(courseId);

      if (!mongoose.Types.ObjectId.isValid(courseId)) {
        return next(new ErrorHandler("Invalid course id", 400));
      }

      const courseContent = course?.courseData?.find((item: any) =>
        item._id.equals(contentId)
      );
      if (!courseContent) {
        return next(new ErrorHandler("Invalid content id", 400));
      }
      const question = courseContent?.questions?.find((item: any) =>
        item._id.equals(questionId)
      );

      if (!question) {
        return next(new ErrorHandler("Invalid question id", 400));
      }

      const newAnswer: any = {
        user: req.user,
        answer,
      };

      question.questionReplies.push(newAnswer);

      await course?.save();

      if (req.user?._id === question?.user?._id) {
        //create notificatiion
        await NotificationModel.create({
          user:req.user?._id,
          title:"New Question Reply Recieved",
          message:`You have a new question reply in ${courseContent.title}`
        })

      } else {
        const data = {
          name: question?.user?.name,
          title: courseContent?.title,
        };
        const html = await ejs.renderFile(
          path.join(__dirname, "../mails/question-reply.ejs"),
          data
        );

        try {
          await sendMail({
            email: question?.user?.email,
            subject: "Question Reply",
            template: "question-reply.ejs",
            data,
          });
        } catch (error: any) {
          return next(new ErrorHandler(error.message, 500));
        }
      }

      res.status(200).json({
        success: true,
        course,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

interface IAddReviewData {
  review: string;
  rating: number;
  userId: string;
}

export const addReview = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userCourseList = req.user?.courses;
      const courseId = req.params.id;

      //check if course id is already exist in user course list base on _id
      const courseExist = userCourseList?.some(
        (course: any) => course._id.toString() === courseId.toString()
      );


      if (!courseExist) {
        return next(
          new ErrorHandler("You are not eligible to access this course", 404)
        );
      }

      const course = await CourseModel.findById(courseId);
      console.log(course)

      const { review, rating } = req.body as IAddReviewData;

      const reviewData: any = {
        user: req.user,
        comment: review,
        rating,
      };

      course?.reviews.push(reviewData);

      let avg = 0;
      course?.reviews.forEach((rev: any) => {
        avg += rev.rating;
      });

      if (course) {
        course.ratings = avg / course?.reviews.length; //one example we have  2 reviews one is  5 another is one is 4 then avg will be 4.5
      }

      await course?.save();

      const notification = {
        title: "New Review  Recieved",
        message: `${req.user?.name} has given a review in ${course?.name}`,
      };

      res.status(200).json({
        success: true,
        course,
      });


    } catch (error: any) {
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

//add reply in review

interface IAddReviewData {
  comment: string;
  courseId: string;
  reviewId: string;
}


export const addReplytoReview = catchAsync(async(req:Request,res:Response,next:NextFunction)=>{
  try{
    const {comment, courseId, reviewId}:IAddReviewData = req.body;
    const course = await CourseModel.findById(courseId);

    if(!course){
      return next(new ErrorHandler("Course not found", 404))
    }

    //rev => review
    const review = course?.reviews?.find((rev:any)=>rev._id.toString() === reviewId.toString())

    if(!review){
      return next(new ErrorHandler("Review not found", 404))
    }
    const replyData:any = {
      user: req.user,
      comment
    };

    if(!review?.commentReplies){
      review.commentReplies = [];
    }

    review?.commentReplies?.push(replyData);

    await course.save();

    res.status(200).json({
      success: true,
      course,
    })

  }catch(error:any){
    return next(new ErrorHandler(error.message, 500));

  }

})


//get all courses  --only for Admin

export const getAllCourses = catchAsync( async(req:Request,res:Response,next:NextFunction)=> {
  try{
    getAllCoursesService(res)
  }catch(error:any){
    return next(new ErrorHandler(error.message,400))
  }
})

