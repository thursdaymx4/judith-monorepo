import { Router, type IRouter } from "express";
import healthRouter from "./health";
import judithRouter from "./judith";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/judith", judithRouter);

export default router;
