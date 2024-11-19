const User = require("../model/userModel");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const haversine = require("haversine-distance");

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

const protect = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
      next();
    } catch (error) {
      res
        .status(401)
        .json({ status_code: 401, message: "Not authorized, token failed" });
    }
  }
  if (!token) {
    res
      .status(401)
      .json({ status_code: 401, message: "Not authorized, no token" });
  }
};

// Create User
const createUser = async (req, res) => {
  try {
    const { name, email, password, address, latitude, longitude } = req.body;
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res
        .status(400)
        .json({ status_code: 400, message: "User already exists" });
    }

    // Convert latitude and longitude to GeoJSON format
    const geoLocation = {
      type: "Point",
      coordinates: [parseFloat(longitude), parseFloat(latitude)], // [longitude, latitude]
    };
    const user = await User.create({
      name,
      email,
      password,
      address,
      latitude,
      longitude,
      location: geoLocation,
    });
    user.token = generateToken(user._id);

    res.status(200).json({
      status_code: 200,
      message: "User created successfully",
      data: {
        name: user.name,
        email: user.email,
        address: user.address,
        latitude: user.latitude,
        longitude: user.longitude,
        status: user.status,
        register_at: user.register_at,
        token: user.token,
      },
    });
  } catch (error) {
    res.status(500).json({ status_code: 500, message: error.message });
  }
};

// Change User Status
const changeUserStatus = async (req, res) => {
  try {
    const userDetails = req.user;
    await User.updateMany({}, [
      {
        $set: {
          status: {
            $cond: {
              if: { $eq: ["$status", "active"] },
              then: "inactive",
              else: "active",
            },
          },
        },
      },
    ]);
    res.status(200).json({
      status_code: 200,
      message: "User statuses updated successfully",
    });
  } catch (error) {
    res.status(500).json({ status_code: 500, message: error.message });
  }
};

// Get Distance
const getDistance = async (req, res) => {
  try {
    const userDetails = req.user;
    const { destination_latitude, destination_longitude } = req.query;

    // Parse destination latitude and longitude
    const destinationCoordinates = [
      parseFloat(destination_longitude),
      parseFloat(destination_latitude),
    ];

    // Calculate the distance using MongoDB aggregation (in meters)
    const distanceResult = await User.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: destinationCoordinates },
          distanceField: "distance",
          spherical: true,
          query: { _id: userDetails._id }, // Query to limit results to the current user
        },
      },
    ]);

    // If no result, return error
    if (!distanceResult.length) {
      return res.status(404).json({
        status_code: 404,
        message: "Distance could not be calculated",
      });
    }

    // Convert distance from meters to kilometers
    const distance = distanceResult[0].distance / 1000;

    res.status(200).json({
      status_code: 200,
      message: "Distance calculated",
      distance: `${distance.toFixed(2)} km`,
    });
  } catch (error) {
    res.status(500).json({ status_code: 500, message: error.message });
  }
};

// Get User Listing
const getUserListing = async (req, res) => {
  try {
    // Extract and parse query parameters
    const { week_number, page = 1, limit = 10 } = req.query;
    const parsedPage = parseInt(page, 10);
    const parsedLimit = parseInt(limit, 10);

    // Validate page and limit
    if (isNaN(parsedPage) || parsedPage < 1) {
      return res.status(400).json({
        status_code: 400,
        message: "Invalid page number. Page must be a positive integer.",
      });
    }

    if (isNaN(parsedLimit) || parsedLimit < 1) {
      return res.status(400).json({
        status_code: 400,
        message: "Invalid limit number. Limit must be a positive integer.",
      });
    }

    // Parse week_number as an array of numbers
    const days = week_number.split(",").map(Number);

    // Map week numbers to day names for response formatting
    const dayMap = {
      0: "sunday",
      1: "monday",
      2: "tuesday",
      3: "wednesday",
      4: "thursday",
      5: "friday",
      6: "saturday",
    };

    // Initialize response object
    const response = {};

    // Iterate through each day and fetch users
    for (const day of days) {
      const dayName = dayMap[day];
      const skip = (parsedPage - 1) * parsedLimit; // Skip documents for pagination

      // Fetch users for the current day using $dayOfWeek
      const users = await User.find({
        $expr: { $eq: [{ $dayOfWeek: "$register_at" }, day + 1] }, // +1 because $dayOfWeek ranges from 1 (Sunday) to 7 (Saturday)
      })
        .skip(skip) // Skip documents based on the page
        .limit(parsedLimit) // Limit the number of documents
        .select("name email"); // Select only the required fields

      // Format the response for the current day
      response[dayName] = users.map((user) => ({
        name: user.name,
        email: user.email,
      }));
    }

    // Return the response with the paginated user listing
    res.status(200).json({
      status_code: 200,
      message: "User listing fetched successfully",
      data: response,
    });
  } catch (error) {
    // Handle errors
    res.status(500).json({ status_code: 500, message: error.message });
  }
};

module.exports = {
  createUser,
  changeUserStatus,
  getDistance,
  getUserListing,
  protect,
};
