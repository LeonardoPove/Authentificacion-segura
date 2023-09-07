

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { errorMessages } from './messages';


const validateToken = (req: Request, res: Response, next: NextFunction) => {
    const headerToken = req.headers['authorization'];

    // Verificar si el token existe y comienza con 'Bearer '
    if (headerToken != undefined && headerToken.startsWith('Bearer ')) {
        try {
            // Extraer el token del encabezado
            const bearerToken = headerToken.slice(7);
            // Verificar la autenticidad del token
            jwt.verify(bearerToken, process.env.SECRET_KEY || 'pepito123');
            // Si el token es válido, pasar al siguiente middleware o ruta
            next();
        } catch (error) {
            // Si hay un error en la verificación, responder con un error 401 (no autorizado)
            res.status(401).json({
                msg: errorMessages.invalidToken,
            });
        }
    } else { 
        // Si el token no está presente o no comienza con 'Bearer ', responder con un error 401 (no autorizado)
        res.status(401).json({
            msg: errorMessages.accessDeniedNoToken,
        });
    }
};

export default validateToken;
