const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const serverConfig = require("./config/serverconfig.js");
const { connectDB } = require("./config/db.js");
const methods = require("./method");
const SubCategory = require("./model/sub");
const Category = require("./model/category");
const User = require("./model/user");
const { transform } = require("./method");

const app = express();

// Enable CORS middleware manually
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }
    next();
});

// Middleware to automatically parse incoming JSON payloads
app.use(express.json());

// Serve frontend static assets from parent directory
const path = require("path");
app.use(express.static(path.join(__dirname, "..")));

// A simple test route to verify the server works in your browser
app.get("/", (req, res) => {
    res.status(200).json({ message: "Luxora API server is up and running!" });
});

// API Routes mapped to Mongoose models
// 1. Admins
app.get("/api/admins", methods.get("admin"));
app.get("/api/admins/:id", methods.get("admin"));
app.post("/api/admins", methods.post("admin"));
app.put("/api/admins/:id", methods.update("admin"));
app.delete("/api/admins/:id", methods.delete("admin"));

// 2. Categories
app.get("/api/categories", methods.get("category"));
app.get("/api/categories/:id", methods.get("category"));
app.post("/api/categories", methods.post("category"));
app.put("/api/categories/:id", methods.update("category"));
app.delete("/api/categories/:id", methods.delete("category"));

// 3. Customers (Mapped to 'customer_id' table/model)
app.get("/api/customers", methods.get("customer_id"));
app.get("/api/customers/:id", methods.get("customer_id"));
app.post("/api/customers", methods.post("customer_id"));
app.put("/api/customers/:id", methods.update("customer_id"));
app.delete("/api/customers/:id", methods.delete("customer_id"));

// 4. Providers (Mapped to 'providers' table/model)
app.get("/api/providers", methods.get("providers"));
app.get("/api/providers/:id", methods.get("providers"));
app.post("/api/providers", methods.post("providers"));
app.put("/api/providers/:id", methods.update("providers"));
app.delete("/api/providers/:id", methods.delete("providers"));

// 5. Products/Subcategories (Mapped to 'sub_category' table in MongoDB)
// Custom GET routes to fetch joined data with categories
app.get("/api/sub_categories", async (req, res) => {
    try {
        const subCategories = await SubCategory.find({});
        const categories = await Category.find({});
        const categoryMap = {};
        categories.forEach(c => {
            categoryMap[c._id] = c.category_name;
        });
        const data = subCategories.map(sc => {
            const scObj = transform(sc);
            scObj.category_name = categoryMap[scObj.category_id] || "Unknown";
            return scObj;
        });
        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
app.get("/api/sub_categories/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const sc = await SubCategory.findById(id);
        if (!sc) {
            return res.status(404).json({ success: false, message: "Record not found" });
        }
        const cat = await Category.findById(sc.category_id);
        const data = transform(sc);
        data.category_name = cat ? cat.category_name : "Unknown";
        res.status(200).json({ success: true, data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
app.post("/api/sub_categories", methods.post("sub_category"));
app.put("/api/sub_categories/:id", methods.update("sub_category"));
app.delete("/api/sub_categories/:id", methods.delete("sub_category"));

// 6. User Authentication with OTP via SMTP
const nodemailer = require("nodemailer");

const sendOTPEmail = async (email, otp) => {
    if (serverConfig.SMTP_USER && serverConfig.SMTP_PASS) {
        try {
            const transporter = nodemailer.createTransport({
                host: serverConfig.SMTP_HOST,
                port: serverConfig.SMTP_PORT,
                secure: serverConfig.SMTP_PORT === 465,
                auth: {
                    user: serverConfig.SMTP_USER,
                    pass: serverConfig.SMTP_PASS
                }
            });
            await transporter.sendMail({
                from: `"Luxora Bespoke" <${serverConfig.SMTP_USER}>`,
                to: email,
                subject: "Luxora Verification Code",
                text: `Your Luxora verification code is: ${otp}. It is valid for 5 minutes.`,
                html: `<div style="font-family: sans-serif; padding: 20px; background-color: #fcfbf9; border: 1px solid #c5a028; border-radius: 8px; max-width: 500px; margin: auto;">
                        <h2 style="color: #c5a028; font-family: serif; border-bottom: 1px solid rgba(197, 160, 40, 0.2); padding-bottom: 10px;">Luxora Verification Code</h2>
                        <p style="color: #1c1c1e; font-size: 16px;">Welcome to the Luxora collection. Use the one-time passcode below to verify your account:</p>
                        <div style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #c5a028; text-align: center; margin: 30px 0; padding: 15px; background: rgba(197, 160, 40, 0.08); border-radius: 6px;">
                          ${otp}
                        </div>
                        <p style="color: #60606a; font-size: 12px; text-align: center;">This code will expire in 5 minutes. If you did not request this code, please ignore this email.</p>
                      </div>`
            });
            console.log(`[SMTP] Successfully sent OTP to ${email}`);
        } catch (mailError) {
            console.error(`[SMTP Error] Failed to send email to ${email}:`, mailError.message);
            throw new Error(`Email delivery failed: ${mailError.message}`);
        }
    } else {
        console.log(`\n==================================================`);
        console.log(`[MOCK SMTP] SMTP credentials not set in .env!`);
        console.log(`[MOCK SMTP] Generated OTP for user ${email}:`);
        console.log(`[MOCK SMTP] Code: ${otp}`);
        console.log(`==================================================\n`);
    }
};

app.post("/api/auth/send-otp", async (req, res) => {
    try {
        const { email, name, type } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, message: "Email is required" });
        }
        if (!type || (type !== 'login' && type !== 'signup')) {
            return res.status(400).json({ success: false, message: "Authentication type must be 'login' or 'signup'" });
        }

        // Generate a 6-digit OTP code
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes validity

        // Check if user exists
        const user = await User.findOne({ email });

        if (type === 'signup') {
            if (user) {
                return res.status(400).json({ success: false, message: "Email is already registered. Please log in instead." });
            }
            if (!name) {
                return res.status(400).json({ success: false, message: "Name is required for registration" });
            }
            // Register new user with OTP
            const newUser = new User({
                email,
                name,
                otp,
                otp_expiry: otpExpiry
            });
            await newUser.save();
        } else {
            // Login flow
            if (!user) {
                return res.status(400).json({ success: false, message: "Email is not registered. Please sign up first." });
            }
            // Update OTP for existing user
            user.otp = otp;
            user.otp_expiry = otpExpiry;
            await user.save();
        }

        // Send Email
        await sendOTPEmail(email, otp);

        res.status(200).json({ success: true, message: "Verification code sent successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.post("/api/auth/verify-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ success: false, message: "Email and OTP code are required" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found or code not requested" });
        }

        if (!user.otp || user.otp !== otp) {
            return res.status(400).json({ success: false, message: "Invalid verification code" });
        }

        const expiryTime = new Date(user.otp_expiry).getTime();
        if (expiryTime < Date.now()) {
            return res.status(400).json({ success: false, message: "Verification code has expired" });
        }

        // Clear OTP fields in the database upon successful verification
        user.otp = undefined;
        user.otp_expiry = undefined;
        await user.save();

        res.status(200).json({ success: true, message: "Logged in successfully", data: { email, name: user.name } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Main function to establish DB connection first, then start listening
const startServer = async () => {
    console.log("Starting server lifecycle...");
    try {
        // 1. Establish database connection
        await connectDB();

        // 2. Start the Express server
        app.listen(serverConfig.PORT, () => {
            console.log(`🚀 Server successfully running on port ${serverConfig.PORT}`);
            console.log(`🔗 Local API server URL: http://localhost:${serverConfig.PORT}`);
            
            const os = require("os");
            const interfaces = os.networkInterfaces();
            for (const interfaceName in interfaces) {
                for (const iface of interfaces[interfaceName]) {
                    if (iface.family === 'IPv4' && !iface.internal) {
                        console.log(`🔗 Network API server URL: http://${iface.address}:${serverConfig.PORT}`);
                    }
                }
            }
            
            console.log(`👉 Access Frontend Client at: file:///c:/Users/Abhishek/OneDrive/Desktop/luxora/login.html`);
        });
    } catch (err) {
        console.error("Critical: Server startup failed due to database connection error.");
        process.exit(1);
    }
};

startServer();