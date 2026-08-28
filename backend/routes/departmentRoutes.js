const express = require("express");
const { authenticate, authorize } = require("../middleware/authMiddleware");
const {
	listDepartments,
	createDepartment,
	updateDepartment,
	deleteDepartment
} = require("../controllers/departmentController");

const router = express.Router();

router.use(authenticate);
router.get("/", listDepartments);
router.post("/", authorize("admin"), createDepartment);
router.patch("/:id", authorize("admin"), updateDepartment);
router.delete("/:id", authorize("admin"), deleteDepartment);

module.exports = router;
