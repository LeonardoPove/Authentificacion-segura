"use strict";
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
exports.loginUser = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const authModel_1 = require("../../../models/authModel");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const messages_1 = require("../../../middleware/messages");
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_REGEX_NUMBER = /\d/;
const PASSWORD_REGEX_UPPERCASE = /[A-Z]/;
const PASSWORD_REGEX_LOWERCASE = /[a-z]/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VERIFICATION_CODE_EXPIRATION_HOURS = 24;
const MAX_LOGIN_ATTEMPTS = 5; // Número máximo de intentos fallidos antes del bloqueo
// Controlador para el inicio de sesión
const loginUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, passwordorrandomPassword } = req.body;
    // Validamos si el usuario existe en la base de datos
    const user = yield authModel_1.User.findOne({ where: { username: username } });
    if (!user) {
        return res.status(400).json({
            msg: messages_1.errorMessages.userNotExists(username),
        });
    }
    // Verificamos si el usuario ha verificado su correo electrónico
    if (!user.isEmailVerified) {
        return res.status(400).json({
            msg: messages_1.errorMessages.userNotVerified,
        });
    }
    // Verificamos si el usuario ha verificado su número de teléfono
    if (!user.isPhoneVerified) {
        return res.status(400).json({
            msg: messages_1.errorMessages.phoneVerificationRequired,
        });
    }
    // Verificar si la cuenta está bloqueada debido a intentos fallidos
    if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        // Si la cuenta está bloqueada, verificamos si ha pasado el tiempo de bloqueo
        const currentDate = new Date();
        if (user.verificationCodeExpiration && user.verificationCodeExpiration > currentDate) {
            // Si aún está dentro del tiempo de bloqueo, respondemos con un mensaje de error
            return res.status(400).json({
                msg: messages_1.errorMessages.accountLocked,
            });
        }
        else {
            // Si ha pasado el tiempo de bloqueo, desbloqueamos la cuenta y restablecemos el contador de intentos
            yield unlockAccount(username);
        }
    }
    // Validamos si se proporcionó una contraseña o una contraseña aleatoria
    let passwordValid = false;
    if (passwordorrandomPassword.length === 10) {
        // Si la longitud es 10, asumimos que es una contraseña aleatoria
        passwordValid = passwordorrandomPassword === user.randomPassword;
    }
    else {
        // Caso contrario, se asume que es una contraseña normal
        passwordValid = yield bcrypt_1.default.compare(passwordorrandomPassword, user.password);
    }
    if (!passwordValid) {
        // Incrementar el contador de intentos fallidos
        yield authModel_1.User.update({ loginAttempts: user.loginAttempts + 1 }, { where: { username: username } });
        if (user.loginAttempts + 1 >= MAX_LOGIN_ATTEMPTS) {
            // Si excede el número máximo de intentos, bloquear la cuenta
            yield lockAccount(username);
        }
        return res.status(400).json({
            msg: messages_1.errorMessages.incorrectPassword(user.loginAttempts + 1),
        });
    }
    // Si la contraseña es válida, restablecer el contador de intentos de inicio de sesión fallidos
    yield authModel_1.User.update({ loginAttempts: 0 }, { where: { username: username } });
    if (passwordorrandomPassword.length === 10) {
        // Si se usó una contraseña aleatoria, generamos un token para la recuperación de contraseña
        const resetPasswordToken = jsonwebtoken_1.default.sign({
            username: username,
            rol: user.rol, // Incluir el rol en el token para utilizarlo posteriormente
        }, process.env.SECRET_KEY || 'pepito123', { expiresIn: '1h' } // Cambia el tiempo de expiración según tus necesidades
        );
        return res.json({
            msg: 'Inicio de sesión Recuperación de contraseña',
            token: resetPasswordToken,
        });
    }
    else {
        // Si se usó una contraseña normal, generamos un token de sesión
        const token = jsonwebtoken_1.default.sign({
            username: username,
            rol: user.rol, // Incluir el rol en el token para utilizarlo posteriormente
        }, process.env.SECRET_KEY || 'pepito123');
        return res.json({
            msg: messages_1.successMessages.userLoggedIn,
            token: token,
            rol: user.rol,
        });
    }
});
exports.loginUser = loginUser;
function unlockAccount(username) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Actualiza la cuenta para desbloquearla y restablecer el contador de intentos fallidos
            yield authModel_1.User.update({ loginAttempts: 0 }, { where: { username: username } });
        }
        catch (error) {
            console.error('Error al desbloquear la cuenta:', error);
        }
    });
}
function lockAccount(username) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Actualiza la cuenta para bloquearla y configurar la expiración del bloqueo (por ejemplo, 3 minutos)
            const currentDate = new Date();
            const expirationDate = new Date(currentDate.getTime() + 1 * 60 * 1000); // 3 minutos de bloqueo
            yield authModel_1.User.update({ loginAttempts: MAX_LOGIN_ATTEMPTS, verificationCodeExpiration: expirationDate }, { where: { username: username } });
        }
        catch (error) {
            console.error('Error al bloquear la cuenta:', error);
        }
    });
}
