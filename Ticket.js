const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const Ticket = sequelize.define('Ticket', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    vatin: {
        type: DataTypes.STRING(11),
        allowNull: false,
    },
    first_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    last_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
    }
}, {
    tableName: 'ticket_info',
    timestamps: false,
});

module.exports = Ticket;