/**
 * @file server.ts
 * @description Clase que representa el servidor de la aplicación.
 */

import express, { Application } from 'express';
import cors from 'cors';
import signinRoutes from "./routes/authentication/singin/singinVerificationRoutes"; // Importar las rutas de signin
import loginRoutes from "./routes/authentication/login/loginVerificationRoutes"; // Importar las rutas de login
import randomPass from "./routes/authentication/login/PasswordReset/passwordResetEmailRoutes"; // Importar las rutas de login
import emailVerificationRoutes from './routes/authentication/email/emailVerificationRoutes';
import phoneVerificationRouter from './routes/authentication/phone/phoneVerificationRoutes';
import countryRoutes from './routes/authentication/pais/countryRoutes';

import { Auth } from './models/authModel';
import { Country } from './models/paisModel';
import { Verification } from './models/verificationModel';

class Server {

    private app: Application;
    private port: string;

    /**
     * Constructor de la clase Server.
     */
    constructor() {
        this.app = express();
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
        })
    }

    /**
     * Configura las rutas de la aplicación.
     */
    routes() {
        this.app.use('/api/auth', signinRoutes, loginRoutes,randomPass, emailVerificationRoutes, phoneVerificationRouter, countryRoutes);
    }

    /**
     * Configura los middlewares de la aplicación.
     */
    middlewares() {
        // Parseo body  
        this.app.use(express.json()); 

        // Cors
        this.app.use(cors());
    }

    /**
     * Conecta a la base de datos y sincroniza los modelos de Product y User.
     */ 
    async dbConnect() {
        try {
            await Auth.sync();
            await Verification.sync();
            await Country.sync();
        } catch (error) {
            console.error('Unable to connect to the database:', error);
        }
    }
}

export default Server;
