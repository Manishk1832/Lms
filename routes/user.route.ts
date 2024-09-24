import express from 'express';
import { activateUser, loginUser, logoutUser, registrationUser,updateAccessToken ,getUser, socialAuth,updateUserInfo,updatePassword,updateProfile, getAllUsers, updateUserRoles} from '../Controllers/user.controller';
import { isAuthenticated, authorizeRoles } from '../middleware/auth';
const userRouter = express.Router();

userRouter.post('/registration',registrationUser)
userRouter.post('/activate-user',activateUser)
userRouter.post('/login',loginUser)
userRouter.get('/logout',isAuthenticated,logoutUser)
userRouter.get("/refresh",updateAccessToken)
userRouter.get("/me",isAuthenticated,getUser)
userRouter.post("/social-auth",socialAuth);
userRouter.put("/update-user-info",isAuthenticated,updateUserInfo)
userRouter.put("/update-user-password",isAuthenticated,updatePassword)
userRouter.put("/update-user-avatar",isAuthenticated,updateProfile)
userRouter.get("/get-users",isAuthenticated,authorizeRoles("admin"),getAllUsers)
userRouter.put("/update-user",isAuthenticated,authorizeRoles("admin"),updateUserRoles)




export default userRouter ;