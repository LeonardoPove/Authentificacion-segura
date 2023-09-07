import { DataTypes, Model } from 'sequelize';
import sequelize from '../database/connection';

export interface UserModel extends Model {
  id: number;
  username: string;
  password: string;
  email: string;
  rol: string;
  isVerified: boolean;
  isPhoneVerified:boolean,
  isEmailVerified: boolean;
  verificationCode: string;
  loginAttempts: number;
  verificationCodeExpiration: any;
  randomPassword: any;

}

export const User = sequelize.define<UserModel>('user', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  rol: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  isVerified: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  isEmailVerified: { 
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  verificationCode: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
  },
  loginAttempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  verificationCodeExpiration: {
    type: DataTypes.DATE,
  },
  randomPassword: {
    type: DataTypes.STRING,
  },
  
  isPhoneVerified: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,

  },
});
