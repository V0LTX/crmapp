const express = require("express");
const { authenticate } = require("../middlewares/auth");
const validate = require("../middlewares/validate");
const { idParamSchema } = require("../schemas/commonSchemas");
const { bulkRegionHandleSchema } = require("../schemas/clientSchemas");
const { listRegions, getRegionDetails, handleWholeRegion } = require("../controllers/regionController");

const router = express.Router();

router.use(authenticate);

router.get("/", listRegions);
router.get("/:id", validate(idParamSchema, "params"), getRegionDetails);
router.post("/:id/handle-all", validate(idParamSchema, "params"), validate(bulkRegionHandleSchema), handleWholeRegion);

module.exports = router;
