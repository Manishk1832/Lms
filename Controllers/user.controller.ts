require("dotenv").config();

import { Request, Response, NextFunction } from "express";
import userModel, { IUser } from "../models/user.model";
import ErrorHandler from "../utils/ErrorHandler";
import { catchAsync } from "../middleware/catchAsyncErrors";
import jwt, { Secret, JwtPayload } from "jsonwebtoken";
import path from "path";
import ejs from "ejs";
import sendMail from "../utils/sendMail";
import {
  accessTokenOptions,
  refreshTokenOptions,
  sendToken,
} from "../utils/jwt";
import { redis } from "../utils/redis";
import { json } from "stream/consumers";
import cloudinary from "cloudinary";
import { getAllUsersService, getUserbyId, updateUserRoleService } from "../Services/user.service";

interface IRegistrationBody {
  name: string;
  email: string;
  password: string;
  avatar?: string;
}

export const registrationUser = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, password } = req.body;
      console.log(name, email, password);
      const isEmailExist = await userModel.findOne({ email });
      if (isEmailExist) {
        return next(new ErrorHandler("Email is alreay exist", 400));
      }

      const user: IRegistrationBody = {
        name,
        email,
        password,
      };
      const activationToken = createActivationToken(user);

      const activationCode = activationToken.activationCode;
      const data = { user: { name: user.name }, activationCode };
      const html = await ejs.renderFile(
        path.join(__dirname, "../mails/activation-mail.ejs"),
        data
      );
      try {
        await sendMail({
          email: user.email,
          subject: "Activate your account",
          template: "activation-mail.ejs",
          data,
        });
        res.status(201).json({
          success: true,
          message: `Please check your email: ${user.email} to activate your account!`,
          activationToken: activationToken.token,
        });
      } catch (error: any) {
        return next(new ErrorHandler(error.message, 400));
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

interface IActivationToken {
  token: string;
  activationCode: string;
}

export const createActivationToken = (user: any): IActivationToken => {
  const activationCode = Math.floor(1000 + Math.random() * 9000).toString();

  const token = jwt.sign(
    {
      user,
      activationCode,
    },
    process.env.ACTIVATION_SECRET as Secret,
    {
      expiresIn: "5m",
    }
  );

  return { token, activationCode };
};

interface IActivationRequest {
  activation_token: string;
  activation_code: string;
}

export const activateUser = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { activation_token, activation_code } =
        req.body as IActivationRequest;

      const newUser: { user: IUser; activationCode: string } = jwt.verify(
        activation_token,
        process.env.ACTIVATION_SECRET as string
      ) as { user: IUser; activationCode: string };

      if (newUser.activationCode !== activation_code) {
        return next(new ErrorHandler("Invalid activation code", 400));
      }

      const { name, email, password } = newUser.user;

      const existUser = await userModel.findOne({ email });

      if (existUser) {
        console.log(existUser);
        return next(new ErrorHandler("Email already exist", 400));
      }

      console.log(newUser.activationCode === activation_code, activation_code);

      const user = await userModel.create({
        name,
        email,
        password,
      });

      res.status(201).json({
        success: true,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

interface ILoginRequest {
  email: string;
  password: string;
}

export const loginUser = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log("dhe", "helllo");

      const { email, password } = req.body as ILoginRequest;

      if (!email || !password) {
        return next(new ErrorHandler("Please enter email and password", 400));
      }

      const user = await userModel.findOne({ email }).select("+password");

      if (!user) {
        return next(new ErrorHandler("Invalid email or password", 400));
      }

      const isPasswordMatch = await user.comparedPassword(password);

      if (!isPasswordMatch) {
        return next(new ErrorHandler("Invalid email or password", 400));
      }

      sendToken(user, 200, res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

export const logoutUser = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.cookie("access_token", "", { maxAge: 1 });
      res.cookie("refresh_token", "", { maxAge: 1 });

      const UserId = req.user?._id || "";
      await redis.del(UserId);

      res.json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error: any) {
      console.log(error.message);
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

export const updateAccessToken = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const refreshToken = req.cookies.refresh_token as string;
      const decoded = jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN || ""
      ) as JwtPayload;

      const message = "Could not refresh access token";
      if (!decoded) {
        return next(new ErrorHandler(message, 400));
      }
      const session = await redis.get(decoded.id as string);
      if (!session) {
        return next(new ErrorHandler(message, 400));
      }
      const user = JSON.parse(session);
      const access_token = jwt.sign(
        { id: user._id },
        process.env.ACCESS_TOKEN as string,
        {
          expiresIn: "5m",
        }
      );

      const refresh_token = jwt.sign(
        { id: user._id },
        process.env.REFRESH_TOKEN as string,
        {
          expiresIn: "7d",
        }
      );

      res.cookie("access_token", access_token, accessTokenOptions);
      res.cookie("refresh_token", refresh_token, refreshTokenOptions);

      req.user = user;

      res.status(200).json({
        status: "success",
        access_token,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

//get user Info

export const getUser = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id;
      getUserbyId(userId, res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

interface IsocialAuthBody {
  name: string;
  email: string;
  avatar: string;
}

//social auth

export const socialAuth = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, name, avatar } = req.body as IsocialAuthBody;
      console.log(req.body);
      const user = await userModel.findOne({ email });

      if (!user) {
        const newUser = await userModel.create({ name, email, avatar });
        sendToken(newUser, 201, res);
      } else {
        sendToken(user, 200, res);
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

//update user Info
interface IUpdateUserRequest {
  name?: string;
  email?: string;
}

export const updateUserInfo = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email } = req.body as IUpdateUserRequest;
      const userId = req.user?._id;
      const user = await userModel.findById(userId);

      if (email && user) {
        const isEmailExist = await userModel.findOne({ email });
        if (isEmailExist) {
          return next(new ErrorHandler("Email already exist", 400));
        }
        user.email = email;
      }

      if (name && user) {
        user.name = name;
      }
      await user?.save();
      await redis.set(userId, JSON.stringify(user) as any);

      return res.status(200).json({
        success: true,
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

interface IChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
}

export const updatePassword = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { oldPassword, newPassword } = req.body as IChangePasswordRequest;
      if (!oldPassword || !newPassword) {
        return next(
          new ErrorHandler("Please provide old and new password", 400)
        );
      }

      const user = await userModel.findById(req.user?._id).select("+password");

      if (user?.password == undefined) {
        return next(new ErrorHandler("Invaild User", 400));
      }
      const isPasswordMatch = await user?.comparedPassword(oldPassword);
      if (!isPasswordMatch) {
        return next(new ErrorHandler("Invalid old password", 400));
      }

      user.password = newPassword;

      await user.save();
      await redis.set(req.user?._id, JSON.stringify(user));

      res.status(200).json({
        success: true,
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

//update profile picture

interface IUpdateProfilepicture {
  avatar: string;
}

export const updateProfile = catchAsync(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { avatar } = req.body as IUpdateProfilepicture ;
      const userId = req.user?._id;

      const user = await userModel.findById(userId);

      if (avatar && user) {
        //if the user have one avatar then call this if
        if (user?.avatar?.public_id) {
          // first delete the old images
          await cloudinary.v2.uploader.destroy(user?.avatar?.public_id);

          const myClould = await cloudinary.v2.uploader.upload(avatar, {
            avatar: "avatars",
            width: 150,
          });

          user.avatar = {
            public_id: myClould.public_id,
            url: myClould.secure_url,
          };
        } else {
          const myClould = await cloudinary.v2.uploader.upload(avatar, {
            avatar: "avatars",
            width: 150,
          });
          user.avatar = {
            public_id: myClould.public_id,
            url: myClould.secure_url,
          };
        }
      }

      await user?.save();
      await redis.set(userId, JSON.stringify(user));

      res.status(200).json({
        success: "true",
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

//get all users  --only for Admin

export const getAllUsers = catchAsync( async(req:Request,res:Response,next:NextFunction)=> {
  try{
    getAllUsersService(res);
  }catch(error:any){
    return next(new ErrorHandler(error.message,400))
  }
})

//update user roles --only for Admin

export const  updateUserRoles = catchAsync(async(req:Request,res:Response,next:NextFunction)=>{
  try{
   const {id,role} = req.body
     updateUserRoleService(res,id,role);
  } catch(error:any){
    return next(new ErrorHandler(error.message,500));
  }
})
