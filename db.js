const { Sequelize } = require('sequelize');
require("dotenv").config();

const sequelize = new Sequelize(process.env.DB_URL, {
    dialect: "postgres",
    protocol: "postgres",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false,
        },
    },
    logging: false,
});

module.exports = sequelize;