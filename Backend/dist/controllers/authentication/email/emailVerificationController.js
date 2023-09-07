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
exports.resendVerificationCode = exports.verifyUser = exports.sendVerificationEmail = void 0;
const authModel_1 = require("../../../models/authModel");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const messages_1 = require("../../../middleware/messages");
const VERIFICATION_CODE_EXPIRATION_HOURS = 24;
// Función para enviar el código de verificación por correo electrónico
const sendVerificationEmail = (email, username, verificationCode) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Obtener la ruta absoluta del archivo de plantilla
        const templatePath = path_1.default.join(__dirname, '../..', 'templates', 'verificationEmail.html');
        // Leer la plantilla HTML desde el archivo
        const emailTemplate = fs_1.default.readFileSync(templatePath, 'utf-8');
        // Reemplazar los placeholders {{ username }} y {{ verificationCode }} con los valores reales
        const personalizedEmail = emailTemplate.replace('{{ username }}', username).replace('{{ verificationCode }}', verificationCode);
        // Crear el transporte de nodemailer globalmente para reutilizarlo
        const transporter = nodemailer_1.default.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASS,
            },
            secure: true,
        });
        const mailOptions = {
            from: process.env.MAIL_USER,
            to: email,
            subject: 'Verificación de correo electrónico',
            html: personalizedEmail, // Usar el contenido personalizado en el cuerpo del correo
        };
        // Enviar el correo de verificación
        yield transporter.sendMail(mailOptions);
        return true; // Indicar que el correo de verificación fue enviado con éxito
    }
    catch (error) {
        console.error('Error al enviar el correo de verificación:', error);
        return false; // Indicar que hubo un error al enviar el correo de verificación
    }
});
exports.sendVerificationEmail = sendVerificationEmail;
const verifyUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username, verificationCode } = req.body;
    // Validamos si el usuario existe en la base de datos
    const user = yield authModel_1.User.findOne({ where: { username: username } });
    if (!user) {
        return res.status(400).json({
            msg: messages_1.errorMessages.userNotExists(username),
        });
    }
    // Verificar si el usuario ya está verificado
    if (user.isEmailVerified) {
        return res.status(400).json({
            msg: messages_1.errorMessages.userAlreadyVerified,
        });
    }
    // Verificar si el código de verificación ha expirado
    const currentDate = new Date();
    if (user.verificationCodeExpiration && user.verificationCodeExpiration < currentDate) {
        return res.status(400).json({
            msg: messages_1.errorMessages.verificationCodeExpired,
        });
    }
    // Verificar si el código de verificación es válido
    if (user.verificationCode !== verificationCode) {
        return res.status(400).json({
            msg: messages_1.errorMessages.invalidVerificationCode,
        });
    }
    // Actualizar el registro del usuario para marcarlo como verificado
    try {
        yield authModel_1.User.update({ isEmailVerified: true }, { where: { username: username } });
        // Si el número de teléfono también está verificado, actualizamos isVerified a true
        if (user.isPhoneVerified) {
            yield authModel_1.User.update({ isVerified: true }, { where: { username: username } });
        }
        res.json({
            msg: messages_1.successMessages.userVerified,
        });
    }
    catch (error) {
        res.status(400).json({
            msg: messages_1.errorMessages.databaseError,
            error,
        });
    }
});
exports.verifyUser = verifyUser;
// Función para reenviar el código de verificación por correo electrónico
const resendVerificationCode = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { username } = req.body;
    // Validamos si el usuario existe en la base de datos
    const user = yield authModel_1.User.findOne({ where: { username: username } });
    if (!user) {
        return res.status(400).json({
            msg: messages_1.errorMessages.userNotExists(username),
        });
    }
    // Verificar si el usuario ya está verificado
    if (user.isEmailVerified) {
        return res.status(400).json({
            msg: messages_1.errorMessages.userAlreadyVerified,
        });
    }
    // Generar un nuevo código de verificación
    const newVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    // Actualizar la información del usuario en la base de datos con el nuevo código y la nueva fecha de expiración
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + VERIFICATION_CODE_EXPIRATION_HOURS);
    try {
        yield authModel_1.User.update({
            verificationCode: newVerificationCode,
            verificationCodeExpiration: expirationDate,
        }, { where: { username: username } });
        // Enviar el nuevo código de verificación por correo electrónico
        const emailSent = yield (0, exports.sendVerificationEmail)(user.email, user.username, newVerificationCode);
        if (emailSent) {
            res.json({
                msg: messages_1.successMessages.verificationCodeResent,
            });
        }
        else {
            res.status(500).json({
                msg: messages_1.errorMessages.emailVerificationError,
            });
        }
    }
    catch (error) {
        res.status(400).json({
            msg: messages_1.errorMessages.databaseError,
            error,
        });
    }
});
exports.resendVerificationCode = resendVerificationCode;
