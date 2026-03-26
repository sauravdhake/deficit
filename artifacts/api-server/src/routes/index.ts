import { Router, type IRouter } from "express";
import healthRouter from "./health";
import dashboardRouter from "./dashboard";
import employeesRouter from "./employees";
import docsRouter from "./docs";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(employeesRouter);
router.use(docsRouter);

export default router;
