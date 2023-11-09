

import { Sequelize } from "sequelize";


const sequelize = new Sequelize('pruebavs1', 'root', 'admin123', {
    host: 'localhost',
    dialect: 'mysql',
});

export default sequelize;

