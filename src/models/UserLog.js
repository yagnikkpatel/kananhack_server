import mongoose from "mongoose";

const userLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    email: {
      type: String,
      required: false,
      lowercase: true,
      trim: true,
    },
    action: {
      type: String,
      enum: ["REGISTER", "LOGIN"],
      required: true,
    },
    success: {
      type: Boolean,
      default: false,
    },
    ip: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    message: {
      type: String,
    },
  },
  { timestamps: true }
);

const UserLog = mongoose.model("UserLog", userLogSchema);

export default UserLog;

