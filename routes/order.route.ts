import express from 'express'
import { authorizeRoles, isAuthenticated } from '../middleware/auth';
import { createOrder, getAllOrders } from '../Controllers/order.controller';
const OrderRouter = express.Router();

OrderRouter.post('/create-order',isAuthenticated,createOrder);
OrderRouter.get("/get-orders",isAuthenticated,authorizeRoles("admin"),getAllOrders )

export default OrderRouter;
