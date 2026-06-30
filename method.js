const Admin = require("./model/admin");
const Category = require("./model/category");
const Customer = require("./model/customer");
const Provider = require("./model/provider");
const SubCategory = require("./model/sub");

const modelMap = {
    "admin": Admin,
    "category": Category,
    "customer_id": Customer,
    "providers": Provider,
    "sub_category": SubCategory
};

// Utility to transform Mongoose doc to format expected by front-end
const transform = (doc) => {
    if (!doc) return null;
    const obj = doc.toObject ? doc.toObject() : doc;
    obj.id = obj._id; // Map Mongoose _id to frontend id
    return obj;
};

// GET - Retrieve all documents or a single document by ID
const get = (tableName) => async (req, res) => {
    try {
        const Model = modelMap[tableName];
        if (!Model) {
            return res.status(400).json({ success: false, message: `Invalid model for table ${tableName}` });
        }
        const { id } = req.params;
        if (id) {
            const doc = await Model.findById(id);
            if (!doc) {
                return res.status(404).json({ success: false, message: "Record not found" });
            }
            return res.status(200).json({ success: true, data: transform(doc) });
        }
        const docs = await Model.find({});
        res.status(200).json({ success: true, data: docs.map(transform) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// POST - Create a new document
const post = (tableName) => async (req, res) => {
    try {
        const Model = modelMap[tableName];
        if (!Model) {
            return res.status(400).json({ success: false, message: `Invalid model for table ${tableName}` });
        }
        const doc = new Model(req.body);
        await doc.save();
        res.status(201).json({ success: true, data: transform(doc) });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// UPDATE - Update an existing document by ID
const update = (tableName) => async (req, res) => {
    try {
        const Model = modelMap[tableName];
        if (!Model) {
            return res.status(400).json({ success: false, message: `Invalid model for table ${tableName}` });
        }
        const { id } = req.params;
        const doc = await Model.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });
        if (!doc) {
            return res.status(404).json({ success: false, message: "Record not found" });
        }
        res.status(200).json({ success: true, data: transform(doc) });
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

// DELETE - Remove a document by ID
const deleteRecord = (tableName) => async (req, res) => {
    try {
        const Model = modelMap[tableName];
        if (!Model) {
            return res.status(400).json({ success: false, message: `Invalid model for table ${tableName}` });
        }
        const { id } = req.params;
        const doc = await Model.findByIdAndDelete(id);
        if (!doc) {
            return res.status(404).json({ success: false, message: "Record not found" });
        }
        res.status(200).json({ success: true, message: "Record deleted successfully", data: transform(doc) });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    get,
    post,
    update,
    delete: deleteRecord,
    transform
};
