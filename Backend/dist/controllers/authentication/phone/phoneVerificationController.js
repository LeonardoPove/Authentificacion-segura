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
exports.resendVerificationCodeSMS = exports.verifyPhoneNumber = exports.sendVerificationCode = void 0;
const authModel_1 = require("../../../models/authModel");
const twilio_1 = __importDefault(require("twilio"));
const messages_1 = require("../../../middleware/messages");
const generateCode_1 = require("../../../utils/generateCode");
const PHONE_VERIFICATION_LOCK_TIME_MINUTES = 15;
// Función para enviar el código de verificación por SMS
const sendVerificationCode = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, phoneNumber } = req.body;
    // Verificar que todos los campos obligatorios estén presentes en la solicitud
    if (!username || !phoneNumber) {
        return res.status(400).json({
            msg: messages_1.errorMessages.requiredFields,
        });
    }
    try {
        // Validamos si el usuario ya existe en la base de datos
        const user = yield authModel_1.User.findOne({ where: { username: username } });
        if (!user) {
            return res.status(400).json({
                msg: messages_1.errorMessages.userNotExists(username),
            });
        }
        // Verificar si el usuario ya está verificado
        if (user.isVerified) {
            return res.status(400).json({
                msg: messages_1.errorMessages.userAlreadyVerified,
            });
        }
        // Verificar si el número de teléfono ya está registrado
        if (user.phoneNumber) {
            return res.status(400).json({
                msg: messages_1.errorMessages.phoneNumberExists,
            });
        }
        const existingUserWithPhoneNumber = yield authModel_1.User.findOne({ where: { phoneNumber: phoneNumber } });
        if (existingUserWithPhoneNumber) {
            return res.status(400).json({
                msg: messages_1.errorMessages.phoneNumberInUse,
            });
        }
        // Generar el código de verificación único
        const verificationCode = (0, generateCode_1.generateVerificationCode)();
        // Guardar usuario en la base de datos con el código de verificación y número de teléfono
        const expirationDate = new Date();
        expirationDate.setMinutes(expirationDate.getMinutes() + PHONE_VERIFICATION_LOCK_TIME_MINUTES);
        yield authModel_1.User.update({
            phoneNumber: phoneNumber,
            verificationCode: verificationCode,
            verificationCodeExpiration: expirationDate,
            isPhoneVerified: false,
        }, { where: { username: username } });
        // Crear un cliente de Twilio para enviar el mensaje de SMS
        const client = (0, twilio_1.default)(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        // Enviar el código de verificación por SMS
        client.messages
            .create({
            body: `Tu código de verificación es: ${verificationCode}`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phoneNumber,
        })
            .then((message) => {
            console.log('Código de verificación enviado por SMS:', message.sid);
            res.json({
                msg: messages_1.successMessages.verificationCodeSent,
            });
        })
            .catch((error) => {
            console.error('Error al enviar el código de verificación por SMS:', error);
            res.status(500).json({
                msg: messages_1.errorMessages.phoneNumberVerificationError,
                error,
            });
        });
    }
    catch (error) {
        res.status(400).json({
            msg: messages_1.errorMessages.databaseError,
            error,
        });
    }
});
exports.sendVerificationCode = sendVerificationCode;
// Función para verificar el código de verificación recibido por SMS
const verifyPhoneNumber = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, phoneNumber, verificationCode } = req.body;
    // Validamos si el usuario existe en la base de datos
    const user = yield authModel_1.User.findOne({ where: { username: username } });
    if (!user) {
        return res.status(400).json({
            msg: messages_1.errorMessages.userNotExists(username),
        });
    }
    // Verificar si el usuario ya está verificado con el correo electrónico
    if (!user.isEmailVerified) {
        return res.status(400).json({
            msg: messages_1.errorMessages.userNotVerified,
        });
    }
    // Verificar si el número de teléfono coincide con el almacenado en la base de datos
    if (user.phoneNumber !== phoneNumber) {
        return res.status(400).json({
            msg: messages_1.errorMessages.incorrectPhoneNumber,
        });
    }
    // Verificar si el número de teléfono ya ha sido verificado previamente
    if (user.isPhoneVerified) {
        return res.status(400).json({
            msg: messages_1.errorMessages.phoneAlreadyVerified,
        });
    }
    // Verificar si el código de verificación es válido
    if (user.verificationCode !== verificationCode) {
        return res.status(400).json({
            msg: messages_1.errorMessages.invalidVerificationCode,
        });
    }
    // Actualizar el registro del usuario para marcar el número de teléfono como verificado
    try {
        yield authModel_1.User.update({ isPhoneVerified: true }, { where: { username: username } });
        // Si el correo electrónico también está verificado, actualizamos isVerified a true
        if (user.isEmailVerified) {
            yield authModel_1.User.update({ isVerified: true }, { where: { username: username } });
        }
        res.json({
            msg: messages_1.successMessages.phoneVerified,
        });
    }
    catch (error) {
        res.status(400).json({
            msg: messages_1.errorMessages.databaseError,
            error,
        });
    }
});
exports.verifyPhoneNumber = verifyPhoneNumber;
const resendVerificationCodeSMS = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username } = req.body;
    // Validamos si el usuario existe en la base de datos
    const user = yield authModel_1.User.findOne({ where: { username: username } });
    if (!user) {
        return res.status(400).json({
            msg: messages_1.errorMessages.userNotExists(username),
        });
    }
    // Verificar si el usuario ya está verificado
    if (user.isPhoneVerified) {
        return res.status(400).json({
            msg: messages_1.errorMessages.phoneAlreadyVerified,
        });
    }
    // Generar un nuevo código de verificación
    const newVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    // Actualizar la información del usuario en la base de datos con el nuevo código y la nueva fecha de expiración
    const expirationDate = new Date();
    expirationDate.setMinutes(expirationDate.getMinutes() + PHONE_VERIFICATION_LOCK_TIME_MINUTES);
    try {
        yield authModel_1.User.update({
            verificationCode: newVerificationCode,
            verificationCodeExpiration: expirationDate,
        }, { where: { username: username } });
        // Enviar el nuevo código de verificación por SMS
        const client = (0, twilio_1.default)(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        client.messages
            .create({
            body: `Tu nuevo código de verificación por SMS es: ${newVerificationCode}`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: user.phoneNumber,
        })
            .then((message) => {
            console.log('Nuevo código de verificación enviado por SMS:', message.sid);
            res.json({
                msg: messages_1.successMessages.verificationCodeSent,
            });
        })
            .catch((error) => {
            console.error('Error al enviar el nuevo código de verificación por SMS:', error);
            res.status(500).json({
                msg: messages_1.errorMessages.phoneNumberVerificationError,
                error,
            });
        });
    }
    catch (error) {
        res.status(400).json({
            msg: messages_1.errorMessages.databaseError,
            error,
        });
    }
});
exports.resendVerificationCodeSMS = resendVerificationCodeSMS;
