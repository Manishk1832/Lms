import express from "express";
import { isAuthenticated, authorizeRoles } from "../middleware/auth";
import { uploadCourse,editCourse ,getSingleCourse,getAllCourse,getCourseByUser, addQuestion, addAnswer, addReview, addReplytoReview,getAllCourses} from "../Controllers/course.controller";
const courseRouter = express.Router();

courseRouter.post(
  "/create-course",
  isAuthenticated,
  authorizeRoles("admin"),
  uploadCourse
);

courseRouter.put(
  "/edit-course/:id",
  isAuthenticated,
  authorizeRoles("admin"),
  editCourse
); 

courseRouter.get(
  "/get-course/:id",
  getSingleCourse
);

courseRouter.get(
  "/get-courses",
  getAllCourse
)

courseRouter.get(
  "/get-course-content/:id",
  isAuthenticated,
  getCourseByUser
)

courseRouter.put(
  "/add-question",
  isAuthenticated,
  addQuestion 
)

courseRouter.put(
  "/add-answer",
  isAuthenticated,
  addAnswer
)

courseRouter.put(
  "/add-review/:id",
  isAuthenticated,
  addReview
)

courseRouter.put(
  "/add-reply",
  isAuthenticated,
  authorizeRoles("admin"),
  addReplytoReview
)
courseRouter.get(
  "get-courses",
  isAuthenticated,
  authorizeRoles("admin"),
  getAllCourses
)


export default courseRouter;
