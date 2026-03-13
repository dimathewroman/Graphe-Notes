import { Router, type IRouter } from "express";
import healthRouter from "./health";
import foldersRouter from "./folders";
import notesRouter from "./notes";
import tagsRouter from "./tags";
import aiRouter from "./ai";
import smartFoldersRouter from "./smart-folders";
import modelsRouter from "./models";
import versionsRouter from "./versions";
import vaultRouter from "./vault";

const router: IRouter = Router();

router.use(healthRouter);
router.use(foldersRouter);
router.use(notesRouter);
router.use(versionsRouter);
router.use(tagsRouter);
router.use(aiRouter);
router.use(smartFoldersRouter);
router.use(modelsRouter);
router.use(vaultRouter);

export default router;
