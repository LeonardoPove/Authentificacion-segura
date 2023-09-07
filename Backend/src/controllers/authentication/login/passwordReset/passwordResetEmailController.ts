import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { User, UserModel } from '../../../../models/authModel';
import { errorMessages, successMessages } from '../../../../middleware/messages';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Función para enviar el correo de recuperación de contraseña con la nueva contraseña aleatoria
export const sendPasswordResetEmail = async (email: string, username: string, randomPassword: string) => {
    try {
        // Obtener la ruta absoluta del archivo de plantilla
        const templatePath = path.join(__dirname, '../../..', 'templates', 'randomPasswordEmail.html');

        // Leer la plantilla HTML desde el archivo
        const emailTemplate = fs.readFileSync(templatePath, 'utf-8');

        // Reemplazar el placeholder {{ randomPassword }} con la contraseña aleatoria real
        const personalizedEmail = emailTemplate.replace('{{ username }}', username).replace('{{ randomPassword }}', randomPassword);

        // Crear el transporte de nodemailer globalmente para reutilizarlo
        const transporter = nodemailer.createTransport({
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
        await transporter.sendMail(mailOptions);

        return true; // Indicar que el correo de recuperación de contraseña fue enviado con éxito
    } catch (error) {
        console.error('Error al enviar el correo de recuperación de contraseña:', error);
        return false; // Indicar que hubo un error al enviar el correo de recuperación de contraseña
    }
};

// Nueva función para solicitar recuperación de contraseña
export const requestPasswordReset = async (req: Request, res: Response) => {
    const { usernameOrEmail } = req.body;

    if (!usernameOrEmail) {
        return res.status(400).json({
            msg: errorMessages.missingUsernameOrEmail,
        });
    }

    let user: UserModel | null = null;

    if (EMAIL_REGEX.test(usernameOrEmail)) {
        user = await User.findOne({ where: { email: usernameOrEmail } });
    } else {
        user = await User.findOne({ where: { username: usernameOrEmail } });
    }

    if (!user) {
        return res.status(404).json({
            msg: errorMessages.userNotFound,
        });
    }

    // Verificar si el correo electrónico o número de teléfono han sido verificados
    if (!user.isEmailVerified && !user.isPhoneVerified) {
        return res.status(400).json({
            msg: errorMessages.unverifiedAccount,
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
    await user.save();

    // Enviar el correo con la contraseña aleatoria
    const emailSent = await sendPasswordResetEmail(user.email, user.username, randomPassword);

    res.json({
        msg: successMessages.passwordResetEmailSent,
    });
};

// Nueva función para cambiar la contraseña
export const resetPassword = async (req: Request, res: Response) => {
    const { usernameOrEmail, randomPassword, newPassword } = req.body;

    // Buscar el usuario por username o email
    let user: UserModel | null = null;

    if (EMAIL_REGEX.test(usernameOrEmail)) {
        user = await User.findOne({ where: { email: usernameOrEmail } });
    } else {
        user = await User.findOne({ where: { username: usernameOrEmail } });
    }

    if (!user) {
        return res.status(404).json({
            msg: errorMessages.userNotFound,
        });
    }

    // Verificar la contraseña aleatoria enviada por correo y su tiempo de expiración
    if (user.randomPassword !== randomPassword || user.verificationCodeExpiration < new Date()) {
        return res.status(400).json({
            msg: errorMessages.invalidRandomPassword,
        });
    }

    // Cambiar la contraseña a la nueva contraseña proporcionada
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    // Reiniciar la contraseña aleatoria y tiempo de expiración en la base de datos
    user.randomPassword = null;
    user.verificationCodeExpiration = null;
    await user.save();

    res.json({
        msg: successMessages.passwordUpdated,
    });
};

// Función para generar una contraseña aleatoria
function generateRandomPassword(length: number): string {
    const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomPassword = '';

    for (let i = 0; i < length; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        randomPassword += characters.charAt(randomIndex);
    }

    return randomPassword;
}
