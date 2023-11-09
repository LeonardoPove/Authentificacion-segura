"use strict";
/**
 * @file server.ts
 * @description Clase que representa el servidor de la aplicación.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const singinVerificationRoutes_1 = __importDefault(require("./routes/authentication/singin/singinVerificationRoutes")); // Importar las rutas de signin
const loginVerificationRoutes_1 = __importDefault(require("./routes/authentication/login/loginVerificationRoutes")); // Importar las rutas de login
const passwordResetEmailRoutes_1 = __importDefault(require("./routes/authentication/login/PasswordReset/passwordResetEmailRoutes")); // Importar las rutas de login
const emailVerificationRoutes_1 = __importDefault(require("./routes/authentication/email/emailVerificationRoutes"));
const phoneVerificationRoutes_1 = __importDefault(require("./routes/authentication/phone/phoneVerificationRoutes"));
const countryRoutes_1 = __importDefault(require("./routes/authentication/pais/countryRoutes"));
const authModel_1 = require("./models/authModel");
const paisModel_1 = require("./models/paisModel");
const verificationModel_1 = require("./models/verificationModel");
class Server {
    /**
     * Constructor de la clase Server.
     */
    constructor() {
        this.app = (0, express_1.default)();
        this.port = process.env.PORT || '3010';
        this.listen();
        this.middlewares();
        this.routes();
        this.dbConnect();
    }
    /**
     * Inicia el servidor y escucha en el puerto especificado.
     */
    listen() {
        this.app.listen(this.port, () => {
            console.log('Aplicacion corriendo en el puerto ' + this.port);
        });
    }
    /**
     * Configura las rutas de la aplicación.
     */
    routes() {
        this.app.use('/api/auth', singinVerificationRoutes_1.default, loginVerificationRoutes_1.default, passwordResetEmailRoutes_1.default, emailVerificationRoutes_1.default, phoneVerificationRoutes_1.default, countryRoutes_1.default);
    }
    /**
     * Configura los middlewares de la aplicación.
     */
    middlewares() {
        // Parseo body  
        this.app.use(express_1.default.json());
        // Cors
        this.app.use((0, cors_1.default)());
    }
    /**
     * Conecta a la base de datos y sincroniza los modelos de Product y User.
     */
    dbConnect() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield authModel_1.Auth.sync();
                yield verificationModel_1.Verification.sync();
                yield paisModel_1.Country.sync();
            }
            catch (error) {
                console.error('Unable to connect to the database:', error);
            }
        });
    }
}
exports.default = Server;
