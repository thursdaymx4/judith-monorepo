import { Router, type IRouter } from "express";
import healthRouter from "./health";
import judithRouter from "./judith";
import pushRouter from "./push";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/judith", judithRouter);
router.use("/push", pushRouter);

export default router;
