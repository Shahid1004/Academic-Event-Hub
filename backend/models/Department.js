const mongoose = require("mongoose");

const departmentSchema = new mongoose.Schema({
	code: {
		type: String,
		required: true,
		unique: true,
		uppercase: true,
		trim: true,
		match: /^[A-Z0-9_-]+$/
	},
	name: {
		type: String,
		required: true,
		trim: true,
		minlength: 2,
		maxlength: 120
	},
	active: {
		type: Boolean,
		default: true
	}
}, { timestamps: true });

module.exports = mongoose.model("Department", departmentSchema);
