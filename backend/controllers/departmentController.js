const Department = require("../models/Department");
const User = require("../models/User");

const publicDepartment = department => ({
	id: department._id,
	code: department.code,
	name: department.name,
	active: department.active,
	createdAt: department.createdAt,
	updatedAt: department.updatedAt
});

exports.listDepartments = async (req, res) => {
	const filter = req.user.role === "admin" ? {} : { active: true };
	const departments = await Department.find(filter).sort({ name: 1 });
	res.json({ departments: departments.map(publicDepartment) });
};

exports.createDepartment = async (req, res) => {
	const code = req.body.code?.trim().toUpperCase();
	const name = req.body.name?.trim();

	if (!code || !name) {
		return res.status(400).json({ message: "Department code and name are required" });
	}

	try {
		const department = await Department.create({ code, name });
		res.status(201).json({ department: publicDepartment(department) });
	} catch (error) {
		if (error.code === 11000) {
			return res.status(409).json({ message: "Department code already exists" });
		}
		throw error;
	}
};

exports.updateDepartment = async (req, res) => {
	const update = {};
	if (req.body.code !== undefined) update.code = req.body.code.trim().toUpperCase();
	if (req.body.name !== undefined) update.name = req.body.name.trim();
	if (req.body.active !== undefined) update.active = Boolean(req.body.active);

	try {
		const department = await Department.findByIdAndUpdate(
			req.params.id,
			update,
			{ new: true, runValidators: true }
		);
		if (!department) return res.status(404).json({ message: "Department not found" });
		res.json({ department: publicDepartment(department) });
	} catch (error) {
		if (error.code === 11000) {
			return res.status(409).json({ message: "Department code already exists" });
		}
		throw error;
	}
};

exports.deleteDepartment = async (req, res) => {
	const department = await Department.findById(req.params.id);
	if (!department) return res.status(404).json({ message: "Department not found" });

	const userCount = await User.countDocuments({ department: department.code });
	if (userCount > 0) {
		return res.status(409).json({ message: "Cannot delete a department assigned to users" });
	}

	await department.deleteOne();
	res.json({ message: "Department deleted successfully" });
};
