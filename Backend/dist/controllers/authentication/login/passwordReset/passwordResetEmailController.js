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
exports.resetPassword = exports.requestPasswordReset = exports.sendPasswordResetEmail = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const authModel_1 = require("../../../../models/authModel");
const messages_1 = require("../../../../middleware/messages");
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Función para enviar el correo de recuperación de contraseña con la nueva contraseña aleatoria
const sendPasswordResetEmail = (email, username, randomPassword) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Obtener la ruta absoluta del archivo de plantilla
        const templatePath = path_1.default.join(__dirname, '../../..', 'templates', 'randomPasswordEmail.html');
        // Leer la plantilla HTML desde el archivo
        const emailTemplate = fs_1.default.readFileSync(templatePath, 'utf-8');
        // Reemplazar el placeholder {{ randomPassword }} con la contraseña aleatoria real
        const personalizedEmail = emailTemplate.replace('{{ username }}', username).replace('{{ randomPassword }}', randomPassword);
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
            subject: 'Recuperación de Contraseña',
            html: personalizedEmail, // Usar el contenido personalizado en el cuerpo del correo
        };
        // Enviar el correo de recuperación de contraseña
        yield transporter.sendMail(mailOptions);
        return true; // Indicar que el correo de recuperación de contraseña fue enviado con éxito
    }
    catch (error) {
        console.error('Error al enviar el correo de recuperación de contraseña:', error);
        return false; // Indicar que hubo un error al enviar el correo de recuperación de contraseña
    }
});
exports.sendPasswordResetEmail = sendPasswordResetEmail;
// Nueva función para solicitar recuperación de contraseña
const requestPasswordReset = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { usernameOrEmail } = req.body;
    if (!usernameOrEmail) {
        return res.status(400).json({
            msg: messages_1.errorMessages.missingUsernameOrEmail,
        });
    }
    let user = null;
    if (EMAIL_REGEX.test(usernameOrEmail)) {
        user = yield authModel_1.User.findOne({ where: { email: usernameOrEmail } });
    }
    else {
        user = yield authModel_1.User.findOne({ where: { username: usernameOrEmail } });
    }
    if (!user) {
        return res.status(404).json({
            msg: messages_1.errorMessages.userNotFound,
        });
    }
    // Verificar si el correo electrónico o número de teléfono han sido verificados
    if (!user.isEmailVerified && !user.isPhoneVerified) {
        return res.status(400).json({
            msg: messages_1.errorMessages.unverifiedAccount,
        });
    }
    // Generar contraseña aleatoria
    const randomPassword = generateRandomPassword(10); // Longitud de contraseña aleatoria
    // Calcular tiempo de expiración (por ejemplo, 5 minutos)
    const expirationTime = new Date();
    expirationTime.setMinutes(expirationTime.getMinutes() + 10); // Cambia a 5 para tu necesidad
    // Actualizar la contraseña aleatoria y tiempo de expiración en la base de datos
    user.randomPassword = randomPassword;
    user.verificationCodeExpiration = expirationTime;
    yield user.save();
    // Enviar el correo con la contraseña aleatoria
    const emailSent = yield (0, exports.sendPasswordResetEmail)(user.email, user.username, randomPassword);
    res.json({
        msg: messages_1.successMessages.passwordResetEmailSent,
    });
});
exports.requestPasswordReset = requestPasswordReset;
// Nueva función para cambiar la contraseña
const resetPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { usernameOrEmail, randomPassword, newPassword } = req.body;
    // Buscar el usuario por username o email
    let user = null;
    if (EMAIL_REGEX.test(usernameOrEmail)) {
        user = yield authModel_1.User.findOne({ where: { email: usernameOrEmail } });
    }
    else {
        user = yield authModel_1.User.findOne({ where: { username: usernameOrEmail } });
    }
    if (!user) {
        return res.status(404).json({
            msg: messages_1.errorMessages.userNotFound,
        });
    }
    // Verificar la contraseña aleatoria enviada por correo y su tiempo de expiración
    if (user.randomPassword !== randomPassword || user.verificationCodeExpiration < new Date()) {
        return res.status(400).json({
            msg: messages_1.errorMessages.invalidRandomPassword,
        });
    }
    // Cambiar la contraseña a la nueva contraseña proporcionada
    const hashedPassword = yield bcrypt_1.default.hash(newPassword, 10);
    user.password = hashedPassword;
    // Reiniciar la contraseña aleatoria y tiempo de expiración en la base de datos
    user.randomPassword = null;
    user.verificationCodeExpiration = null;
    yield user.save();
    res.json({
        msg: messages_1.successMessages.passwordUpdated,
    });
});
exports.resetPassword = resetPassword;
// Función para generar una contraseña aleatoria
function generateRandomPassword(length) {
    const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomPassword = '';
    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        randomPassword += characters.charAt(randomIndex);
    }
    return randomPassword;
}
